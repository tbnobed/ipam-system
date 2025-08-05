import sgMail from '@sendgrid/mail';
import { storage } from "./storage";

export interface NotificationChannel {
  type: 'email' | 'webhook' | 'sms' | 'slack';
  config: Record<string, any>;
  enabled: boolean;
}

export interface AlertEvent {
  type: 'device_offline' | 'device_online' | 'subnet_threshold' | 'scan_failed';
  deviceId?: number;
  subnetId?: number;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class NotificationService {
  private notificationChannels: Map<string, NotificationChannel> = new Map();

  constructor() {
    // Initialize with basic notification channels
    this.setupDefaultChannels();
  }

  private setupDefaultChannels() {
    // Email notifications using SendGrid
    const sendGridApiKey = process.env.SENDGRID_API_KEY;
    if (sendGridApiKey) {
      sgMail.setApiKey(sendGridApiKey);
    }
    
    this.notificationChannels.set('email', {
      type: 'email',
      enabled: !!sendGridApiKey, // Enable if SendGrid API key is available
      config: {
        apiKey: sendGridApiKey,
        fromEmail: process.env.FROM_EMAIL || 'alerts@obedtv.com',
        toEmails: process.env.ALERT_EMAILS?.split(',') || ['alerts@obedtv.com']
      }
    });

    // Webhook notifications
    this.notificationChannels.set('webhook', {
      type: 'webhook',
      enabled: !!process.env.WEBHOOK_URL,
      config: {
        url: process.env.WEBHOOK_URL,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': process.env.WEBHOOK_TOKEN ? `Bearer ${process.env.WEBHOOK_TOKEN}` : undefined
        }
      }
    });

    // Slack notifications
    this.notificationChannels.set('slack', {
      type: 'slack',
      enabled: !!process.env.SLACK_WEBHOOK_URL,
      config: {
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        channel: process.env.SLACK_CHANNEL || '#alerts'
      }
    });
  }

  async processAlert(event: AlertEvent): Promise<void> {
    try {
      console.log(`Processing alert: ${event.type} - ${event.message}`);

      // Check if notifications are enabled for this type
      const settings = await this.getNotificationSettings();
      
      if (!this.shouldSendAlert(event.type, settings)) {
        console.log(`Notifications disabled for ${event.type}`);
        return;
      }

      // Send to all enabled channels
      const promises = Array.from(this.notificationChannels.entries())
        .filter(([_, channel]) => channel.enabled)
        .map(([name, channel]) => this.sendToChannel(name, channel, event));

      await Promise.allSettled(promises);

      // Log the alert in the activity table
      await storage.createActivityLog({
        action: 'alert_sent',
        entityType: event.deviceId ? 'device' : event.subnetId ? 'subnet' : 'system',
        entityId: event.deviceId || event.subnetId || null,
        details: {
          alertType: event.type,
          message: event.message,
          severity: event.severity,
          channelsSent: Array.from(this.notificationChannels.keys()).filter(k => this.notificationChannels.get(k)?.enabled)
        }
      });

    } catch (error) {
      console.error('Error processing alert:', error);
    }
  }

  private async getNotificationSettings(): Promise<Record<string, any>> {
    const settings = await storage.getAllSettings();
    return settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, any>);
  }

  private shouldSendAlert(alertType: string, settings: Record<string, any>): boolean {
    switch (alertType) {
      case 'device_offline':
      case 'device_online':
        return settings.device_alerts === 'true';
      case 'subnet_threshold':
        return settings.subnet_alerts === 'true';
      case 'scan_failed':
        return true; // Always send scan failure alerts
      default:
        return false;
    }
  }

  private async sendToChannel(name: string, channel: NotificationChannel, event: AlertEvent): Promise<void> {
    try {
      switch (channel.type) {
        case 'email':
          await this.sendEmail(channel.config, event);
          break;
        case 'webhook':
          await this.sendWebhook(channel.config, event);
          break;
        case 'slack':
          await this.sendSlack(channel.config, event);
          break;
        default:
          console.log(`Notification channel ${name} not implemented yet`);
      }
    } catch (error) {
      console.error(`Failed to send notification via ${name}:`, error);
    }
  }

  private async sendEmail(config: any, event: AlertEvent): Promise<void> {
    if (!config.apiKey) {
      console.log(`📧 [EMAIL] Skipped - missing SendGrid API key`);
      return;
    }

    // Get current email settings from database
    const settings = await this.getNotificationSettings();
    console.log('🔍 [EMAIL] Current notification settings:', settings);
    
    const emailRecipients = settings.alert_emails ? 
      settings.alert_emails.split(',').map((email: string) => email.trim()).filter(email => email) : 
      config.toEmails;
    
    console.log('📋 [EMAIL] Recipients resolved to:', emailRecipients);

    if (!emailRecipients || emailRecipients.length === 0) {
      console.log(`📧 [EMAIL] Skipped - no recipients configured`);
      return;
    }

    try {
      const msg = {
        to: emailRecipients,
        from: config.fromEmail,
        subject: `IPAM Alert: ${event.type.replace('_', ' ').toUpperCase()}`,
        text: event.message,
        html: this.formatEmailAlert(event)
      };

      await sgMail.send(msg);
      console.log(`📧 [EMAIL] Sent ${event.severity.toUpperCase()} alert to ${emailRecipients.join(', ')}`);
    } catch (error) {
      console.error('SendGrid email failed:', error);
      throw error;
    }
  }

  private async sendWebhook(config: any, event: AlertEvent): Promise<void> {
    if (!config.url) return;

    const payload = {
      timestamp: event.timestamp.toISOString(),
      alertType: event.type,
      severity: event.severity,
      message: event.message,
      deviceId: event.deviceId,
      subnetId: event.subnetId,
      metadata: event.metadata
    };

    const response = await fetch(config.url, {
      method: 'POST',
      headers: config.headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }

    console.log(`🔗 [WEBHOOK] Sent alert to ${config.url}`);
  }

  private async sendSlack(config: any, event: AlertEvent): Promise<void> {
    if (!config.webhookUrl) return;

    const color = this.getSeverityColor(event.severity);
    const emoji = this.getSeverityEmoji(event.severity);

    const payload = {
      channel: config.channel,
      username: 'IPAM System',
      icon_emoji: ':warning:',
      attachments: [{
        color: color,
        title: `${emoji} ${event.type.replace('_', ' ').toUpperCase()}`,
        text: event.message,
        timestamp: Math.floor(event.timestamp.getTime() / 1000),
        fields: [
          {
            title: 'Severity',
            value: event.severity.toUpperCase(),
            short: true
          },
          ...(event.deviceId ? [{
            title: 'Device ID',
            value: event.deviceId.toString(),
            short: true
          }] : []),
          ...(event.subnetId ? [{
            title: 'Subnet ID', 
            value: event.subnetId.toString(),
            short: true
          }] : [])
        ]
      }]
    };

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`);
    }

    console.log(`💬 [SLACK] Sent alert to ${config.channel}`);
  }

  private formatEmailAlert(event: AlertEvent): string {
    const severityColor = this.getSeverityColor(event.severity);
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${severityColor}; color: white; padding: 15px; text-align: center;">
          <h2>IPAM System Alert</h2>
        </div>
        <div style="padding: 20px; border: 1px solid #ddd;">
          <h3>${event.type.replace('_', ' ').toUpperCase()}</h3>
          <p><strong>Severity:</strong> ${event.severity.toUpperCase()}</p>
          <p><strong>Message:</strong> ${event.message}</p>
          <p><strong>Time:</strong> ${event.timestamp.toLocaleString()}</p>
          ${event.metadata ? `<p><strong>Details:</strong> ${JSON.stringify(event.metadata, null, 2)}</p>` : ''}
        </div>
        <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 12px;">
          This alert was generated by the IPAM System
        </div>
      </div>
    `;
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#ff0000';
      case 'high': return '#ff8c00';
      case 'medium': return '#ffa500';
      case 'low': return '#ffff00';
      default: return '#808080';
    }
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return 'ℹ️';
      default: return '📢';
    }
  }

  // Method to check subnet utilization and send alerts
  async checkSubnetUtilization(): Promise<void> {
    try {
      const settings = await this.getNotificationSettings();
      const threshold = parseInt(settings.alert_threshold || '90');
      
      if (settings.subnet_alerts !== 'true') {
        return;
      }

      const subnets = await storage.getAllSubnets();
      
      for (const subnet of subnets) {
        // Get devices in this subnet using the getDevices method
        const deviceResponse = await storage.getDevices();
        const devices = deviceResponse.data.filter((device: any) => device.subnetId === subnet.id);
        
        // Calculate utilization (simplified - you may want more sophisticated calculation)
        const totalIPs = this.calculateSubnetCapacity(subnet.network);
        const usedIPs = devices.length;
        const utilization = (usedIPs / totalIPs) * 100;
        
        if (utilization >= threshold) {
          await this.processAlert({
            type: 'subnet_threshold',
            subnetId: subnet.id,
            message: `Subnet ${subnet.network} utilization is ${utilization.toFixed(1)}% (threshold: ${threshold}%)`,
            severity: utilization >= 95 ? 'critical' : 'high',
            timestamp: new Date(),
            metadata: {
              utilization: utilization.toFixed(1),
              threshold,
              usedIPs,
              totalIPs,
              subnetNetwork: subnet.network
            }
          });
        }
      }
    } catch (error) {
      console.error('Error checking subnet utilization:', error);
    }
  }

  private calculateSubnetCapacity(network: string): number {
    // Extract CIDR notation (e.g., /24 from "10.63.20.1/24")
    const [, cidr] = network.split('/');
    if (!cidr) return 254; // Default for /24
    
    const hostBits = 32 - parseInt(cidr);
    return Math.pow(2, hostBits) - 2; // Subtract network and broadcast addresses
  }

  // Method to be called when a device status changes
  async handleDeviceStatusChange(deviceId: number, oldStatus: string, newStatus: string): Promise<void> {
    if (oldStatus === newStatus) return;

    const deviceResponse = await storage.getDevices();
    const device = deviceResponse.data.find((d: any) => d.id === deviceId);
    if (!device) return;

    const alertType = newStatus === 'offline' ? 'device_offline' : 'device_online';
    const severity = newStatus === 'offline' ? 'medium' : 'low';

    await this.processAlert({
      type: alertType,
      deviceId,
      message: `Device ${device.hostname || device.ipAddress} is now ${newStatus}`,
      severity,
      timestamp: new Date(),
      metadata: {
        ipAddress: device.ipAddress,
        hostname: device.hostname,
        previousStatus: oldStatus,
        currentStatus: newStatus
      }
    });
  }
}

// Export singleton instance
export const notificationService = new NotificationService();