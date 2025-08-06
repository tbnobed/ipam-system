import { exec } from 'child_process';
import { promisify } from 'util';
import dns from 'dns';
import { storage } from './storage';

const execAsync = promisify(exec);

interface PingResult {
  success: boolean;
  responseTime?: number;
  error?: string;
}

interface DeviceDiscovery {
  ipAddress: string;
  hostname?: string;
  macAddress?: string;
  vendor?: string;
  openPorts?: number[];
  isAlive: boolean;
}

class NetworkScanner {
  private activeScan: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private currentScanId: number | null = null;
  private scanProgress: { current: number; total: number; currentIP?: string } = { current: 0, total: 0 };
  private wsClients: Set<any> = new Set();

  constructor() {
    // Reset scanning state on startup
    this.activeScan = false;
    this.currentScanId = null;
  }

  resetScanState() {
    this.activeScan = false;
    this.currentScanId = null;
    this.scanProgress = { current: 0, total: 0 };
  }

  async startPeriodicScanning(intervalMinutes: number = 60) {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }

    this.scanInterval = setInterval(async () => {
      if (!this.activeScan) {
        try {
          const subnets = await storage.getAllSubnets();
          console.log(`Periodic scan found ${subnets.length} subnets:`, subnets.map(s => s.network));
          const subnetIds = subnets.map(s => s.id);
          await this.startScan(subnetIds);
        } catch (error) {
          console.error('Error in periodic scan:', error);
        }
      }
    }, intervalMinutes * 60 * 1000);

    console.log(`Periodic network scanning started (every ${intervalMinutes} minutes)`);
  }

  addWebSocketClient(ws: any) {
    this.wsClients.add(ws);
  }

  removeWebSocketClient(ws: any) {
    this.wsClients.delete(ws);
  }

  private broadcastProgress() {
    const message = JSON.stringify({
      type: 'scan_progress',
      scanId: this.currentScanId,
      isActive: this.activeScan,
      progress: this.scanProgress,
      timestamp: new Date().toISOString()
    });

    this.wsClients.forEach(ws => {
      try {
        ws.send(message);
      } catch (error) {
        this.wsClients.delete(ws);
      }
    });
  }

  private broadcastScanUpdate(update: any) {
    const message = JSON.stringify({
      type: 'scan_update',
      ...update,
      timestamp: new Date().toISOString()
    });

    this.wsClients.forEach(ws => {
      try {
        ws.send(message);
      } catch (error) {
        this.wsClients.delete(ws);
      }
    });
  }

  getScanStatus() {
    return {
      isActive: this.activeScan,
      currentScanId: this.currentScanId,
      progress: this.scanProgress
    };
  }

  stopScan() {
    console.log('Stopping network scan');
    this.activeScan = false;
    const previousScanId = this.currentScanId;
    this.currentScanId = null;
    this.scanProgress = { current: 0, total: 0 };
    
    // Broadcast scan stopped update
    this.broadcastScanUpdate({
      status: 'scan_stopped',
      scanId: previousScanId,
      message: 'Network scan stopped by user'
    });
    
    this.broadcastProgress();
  }

  async startScan(subnetIds: number[]): Promise<number> {
    if (this.activeScan) {
      // Force reset if stuck - safety measure
      console.log('Forcing reset of stuck scan state');
      this.resetScanState();
    }

    this.activeScan = true;
    
    const scanRecord = await storage.createNetworkScan({
      subnetId: null,
      status: 'running',
      devicesFound: 0,
      results: { subnets: subnetIds }
    });

    this.currentScanId = scanRecord.id;
    console.log(`Starting network scan ${scanRecord.id} for subnets: [`, subnetIds.join(', '), ']');

    // Start the scan in the background
    this.performScan(scanRecord.id, subnetIds);

    return scanRecord.id;
  }

  private async performScan(scanId: number, subnetIds: number[]) {
    try {
      const subnets = await storage.getAllSubnets();
      // If no specific subnets provided, scan all available subnets
      const selectedSubnets = subnetIds.length > 0 
        ? subnets.filter(subnet => subnetIds.includes(subnet.id))
        : subnets;
      
      // Calculate total IPs across all subnets for accurate progress tracking
      const totalIPs = selectedSubnets.reduce((total, subnet) => {
        const ipRange = this.getIPRange(subnet.network);
        return total + ipRange.length;
      }, 0);
      
      // Initialize progress tracking for all subnets
      this.scanProgress = { current: 0, total: totalIPs };
      this.broadcastProgress();
      
      let results: DeviceDiscovery[] = [];

      for (const subnet of selectedSubnets) {
        // Broadcast subnet scanning start
        this.broadcastScanUpdate({
          scanId,
          isActive: true,
          status: 'scanning_subnet',
          subnet: subnet.network
        });

        const subnetResults = await this.scanSubnet(subnet.network);
        results.push(...subnetResults);

        // Update each discovered device in the database
        const aliveDevices = subnetResults.filter(d => d.isAlive);
        for (const device of aliveDevices) {
          await this.updateDeviceFromScan(device, subnet.id);
        }

        // Broadcast devices found for this subnet
        if (aliveDevices.length > 0) {
          this.broadcastScanUpdate({
            scanId,
            isActive: true,
            status: 'devices_found',
            subnet: subnet.network,
            devices: aliveDevices,
            devicesFound: aliveDevices.length
          });
        }

        // Broadcast subnet completion
        this.broadcastScanUpdate({
          scanId,
          isActive: true,
          status: 'subnet_complete',
          subnet: subnet.network,
          devicesFound: aliveDevices.length
        });
      }

      this.activeScan = false;
      this.currentScanId = null;

      await storage.updateNetworkScan(scanId, {
        endTime: new Date(),
        status: 'completed',
        devicesFound: results.filter(d => d.isAlive).length,
        results: results
      });

      // Generate and broadcast scan summary
      const summary = this.generateScanSummary(results, subnetIds);
      
      // Add a small delay to ensure message is sent before potential connection cleanup
      setTimeout(() => {
        this.broadcastScanUpdate({
          scanId,
          isActive: false,
          summary,
          devicesFound: results.filter(d => d.isAlive).length,
          status: 'scan_completed'
        });
      }, 100); // Keep this fixed at 100ms as it's for WebSocket message delivery, not network timing

      // Log scan completion activity
      await storage.createActivityLog({
        action: 'scan_completed',
        entityType: 'network_scan',
        entityId: scanId,
        details: { 
          devicesFound: results.length,
          onlineDevices: results.filter(d => d.isAlive).length,
          subnetsScanned: subnetIds.length,
          scanId 
        },
      });

      const aliveCount = results.filter(d => d.isAlive).length;
      console.log(`Network scan ${scanId} completed. Scanned ${results.length} IPs, found ${aliveCount} alive devices.`);
      console.log(`Production debug - alive devices:`, results.filter(d => d.isAlive).map(d => d.ipAddress));
    } catch (error) {
      console.error(`Network scan ${scanId} failed:`, error);
      
      // Reset scan state on error
      this.activeScan = false;
      this.currentScanId = null;
      
      // Log scan failure activity
      await storage.createActivityLog({
        action: 'scan_failed',
        entityType: 'network_scan',
        entityId: scanId,
        details: { error: error instanceof Error ? error.message : 'Unknown error', scanId },
      });
      
      await storage.updateNetworkScan(scanId, {
        endTime: new Date(),
        status: 'failed',
        results: { error: error instanceof Error ? error.message : 'Unknown error' },
      });

      // Broadcast scan failure
      this.broadcastScanUpdate({
        scanId,
        isActive: false,
        status: 'scan_failed'
      });
    }
  }

  private async scanSubnet(network: string): Promise<DeviceDiscovery[]> {
    const results: DeviceDiscovery[] = [];
    const ipRange = this.getIPRange(network);

    console.log(`Scanning subnet ${network} (${ipRange.length} IPs)`);

    // Don't reset progress - maintain cumulative progress across all subnets
    const previousCurrent = this.scanProgress.current;

    // Scan IPs in batches to avoid overwhelming the network
    const batchSize = 20;
    for (let i = 0; i < ipRange.length; i += batchSize) {
      const batch = ipRange.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (ip) => {
          // Update current IP being scanned for real-time display
          this.scanProgress.currentIP = ip;
          this.broadcastProgress();
          return this.scanIP(ip);
        })
      );
      
      const aliveResults = batchResults.filter(result => result.isAlive);
      results.push(...aliveResults);
      
      // Enhanced logging for production debugging
      console.log(`Batch scan results for ${network}: ${batchResults.length} scanned, ${aliveResults.length} alive`);
      if (aliveResults.length > 0) {
        console.log(`Found alive devices:`, aliveResults.map(d => `${d.ipAddress}(alive:${d.isAlive})`));
      }
      
      // Broadcast newly found devices immediately
      if (aliveResults.length > 0) {
        this.broadcastScanUpdate({
          scanId: this.currentScanId,
          isActive: true,
          status: 'devices_found',
          subnet: network,
          devices: aliveResults,
          devicesFound: aliveResults.length,
          newDevices: aliveResults
        });
      }
      
      // Update cumulative progress across all subnets
      this.scanProgress.current = previousCurrent + Math.min(i + batchSize, ipRange.length);
      this.broadcastProgress();

      // Get configurable delay to prevent network flooding
      const timeoutSetting = await storage.getSetting('ping_timeout');
      const baseTimeout = timeoutSetting ? parseInt(timeoutSetting.value) : 2;
      const networkDelay = Math.max(100, baseTimeout * 50); // Scale delay with timeout, minimum 100ms
      await new Promise(resolve => setTimeout(resolve, networkDelay));
    }

    return results;
  }

  private generateScanSummary(results: DeviceDiscovery[], subnetIds: number[]) {
    const onlineDevices = results.filter(d => d.isAlive);
    
    const devicesByVendor = onlineDevices.reduce((acc, device) => {
      const vendor = device.vendor || 'Unknown';
      acc[vendor] = (acc[vendor] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const devicesByType = onlineDevices.reduce((acc, device) => {
      // Guess device type based on open ports or hostname
      let type = 'Unknown';
      if (device.openPorts?.includes(80) || device.openPorts?.includes(443)) {
        type = 'Web Server';
      } else if (device.openPorts?.includes(22)) {
        type = 'SSH Server';
      } else if (device.openPorts?.includes(23)) {
        type = 'Telnet Device';
      } else if (device.hostname?.toLowerCase().includes('camera')) {
        type = 'Camera';
      } else if (device.hostname?.toLowerCase().includes('switch')) {
        type = 'Network Switch';
      } else if (device.hostname?.toLowerCase().includes('router')) {
        type = 'Router';
      }
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalScanned: results.length,
      onlineDevices: onlineDevices.length,
      offlineDevices: results.length - onlineDevices.length,
      subnetsScanned: subnetIds.length,
      vendorBreakdown: devicesByVendor,
      deviceTypeBreakdown: devicesByType,
      timestamp: new Date().toISOString()
    };
  }

  private async scanIP(ipAddress: string): Promise<DeviceDiscovery> {
    const result: DeviceDiscovery = {
      ipAddress,
      isAlive: false,
    };

    try {
      // Enhanced ping for shared gateway networks
      const pingResult = await this.pingDevice(ipAddress);
      result.isAlive = pingResult.success;
      
      // Enhanced logging for debugging production scan issues
      if (result.isAlive) {
        console.log(`✅ Device found at ${ipAddress} - ping success`);
      }

      if (result.isAlive) {
        // Try to get hostname
        try {
          const hostname = await dns.promises.reverse(ipAddress);
          result.hostname = hostname[0];
        } catch (error) {
          // Hostname lookup failed, that's okay
        }

        // Try to get MAC address (works for local network)
        try {
          result.macAddress = await this.getMacAddress(ipAddress);
          if (result.macAddress) {
            result.vendor = await this.getVendorFromMac(result.macAddress);
          }
        } catch (error) {
          // MAC address lookup failed, that's okay
        }

        // Scan common ports
        result.openPorts = await this.scanCommonPorts(ipAddress);
      }
    } catch (error) {
      console.error(`Error scanning ${ipAddress}:`, error);
    }

    return result;
  }

  async pingDevice(ipAddress: string): Promise<PingResult> {
    try {
      // Get ping timeout from settings
      const timeoutSetting = await storage.getSetting('ping_timeout');
      const timeout = timeoutSetting ? parseInt(timeoutSetting.value) : 2;
      
      // Enhanced ping settings for shared gateway networks
      // Use multiple attempts with different timing for better reliability
      const { stdout } = await execAsync(`ping -c 3 -W ${timeout} -i 0.3 ${ipAddress}`);
      
      // Parse response time from ping output
      const match = stdout.match(/time=([0-9.]+)/);
      const responseTime = match ? parseFloat(match[1]) : undefined;

      return {
        success: true,
        responseTime,
      };
    } catch (error) {
      // Fallback with single packet and longer timeout
      try {
        const timeoutSetting = await storage.getSetting('ping_timeout');
        const timeout = timeoutSetting ? parseInt(timeoutSetting.value) * 2 : 5; // Double timeout for fallback
        const { stdout } = await execAsync(`ping -c 1 -W ${timeout} ${ipAddress}`);
        const match = stdout.match(/time=([0-9.]+)/);
        const responseTime = match ? parseFloat(match[1]) : undefined;
        
        return {
          success: true,
          responseTime,
        };
      } catch (fallbackError) {
        return {
          success: false,
          error: String(error),
        };
      }
    }
  }

  private async getMacAddress(ipAddress: string): Promise<string | undefined> {
    try {
      // Enhanced ARP population for shared gateway networks
      await execAsync(`ping -c 2 -W 1 ${ipAddress}`);
      
      // Try multiple methods for MAC address detection
      const methods = [
        // Method 1: Standard ARP table
        async () => {
          const { stdout } = await execAsync(`arp -n ${ipAddress}`);
          let match = stdout.match(/([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/i);
          if (!match) {
            match = stdout.match(/([0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2})/i);
            if (match) {
              return match[1].replace(/-/g, ':').toLowerCase();
            }
          }
          return match ? match[1].toLowerCase() : undefined;
        },
        
        // Method 2: IP neighbor (modern Linux)
        async () => {
          const { stdout } = await execAsync(`ip neighbor show ${ipAddress}`);
          const match = stdout.match(/lladdr ([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/i);
          return match ? match[1].toLowerCase() : undefined;
        },
        
        // Method 3: arping (most reliable for shared gateways)
        async () => {
          try {
            const timeoutSetting = await storage.getSetting('ping_timeout');
            const timeout = timeoutSetting ? parseInt(timeoutSetting.value) + 1 : 3; // Slightly longer for arping
            const { stdout } = await execAsync(`timeout ${timeout} arping -c 2 ${ipAddress}`);
            const match = stdout.match(/([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/i);
            return match ? match[1].toLowerCase() : undefined;
          } catch (arpingError) {
            return undefined;
          }
        }
      ];

      // Try each method sequentially until one succeeds
      for (const method of methods) {
        try {
          const mac = await method();
          if (mac) return mac;
        } catch (error) {
          continue; // Try next method
        }
      }
      
      return undefined;
    } catch (error) {
      return undefined;
    }
  }

  private async getVendorFromMac(macAddress: string): Promise<string | undefined> {
    try {
      const oui = macAddress.replace(/:/g, '').substring(0, 6).toUpperCase();
      
      // Simple vendor mapping based on common OUI prefixes
      const vendors: Record<string, string> = {
        '001B11': 'Cisco Systems',
        '0050C2': 'IEEE Registration Authority',
        '00E04C': 'Realtek Semiconductor',
        '001A2F': 'Cisco Systems',
        '002522': 'Cisco Systems',
        '0026F2': 'Cisco Systems',
        '0027D7': 'Belkin International',
        'D85D4C': 'Apple',
        '3C07F4': 'Apple',
        '78A3E4': 'Apple',
        '24F094': 'Apple',
        '6C96CF': 'Apple',
        '8C8590': 'Apple'
      };

      return vendors[oui] || undefined;
    } catch (error) {
      return undefined;
    }
  }

  private async scanCommonPorts(ipAddress: string): Promise<number[]> {
    const commonPorts = [22, 23, 53, 80, 135, 139, 443, 445, 993, 995];
    const openPorts: number[] = [];

    // Get ping timeout from settings for port scanning
    const timeoutSetting = await storage.getSetting('ping_timeout');
    const timeout = timeoutSetting ? parseInt(timeoutSetting.value) : 2;

    const portPromises = commonPorts.map(async (port) => {
      try {
        await execAsync(`timeout ${timeout} nc -z ${ipAddress} ${port}`);
        return port;
      } catch (error) {
        return null;
      }
    });

    const results = await Promise.all(portPromises);
    return results.filter(port => port !== null) as number[];
  }

  private getIPRange(network: string): string[] {
    const [baseIP, cidr] = network.split('/');
    const cidrNum = parseInt(cidr, 10);
    
    // Support any valid CIDR notation
    if (cidrNum < 8 || cidrNum > 30) {
      throw new Error(`CIDR /${cidrNum} is not supported for scanning (use /8 to /30)`);
    }

    const hostBits = 32 - cidrNum;
    const totalHosts = Math.pow(2, hostBits);
    
    // Convert base IP to integer
    const baseParts = baseIP.split('.').map(Number);
    const baseInt = (baseParts[0] << 24) + (baseParts[1] << 16) + (baseParts[2] << 8) + baseParts[3];
    
    // Calculate network address
    const mask = (0xFFFFFFFF << hostBits) >>> 0;
    const networkInt = (baseInt & mask) >>> 0;
    
    const ips: string[] = [];

    // Generate all usable IPs in the range (skip network and broadcast)
    for (let i = 1; i < totalHosts - 1; i++) {
      const ipInt = networkInt + i;
      const ip = [
        (ipInt >>> 24) & 255,
        (ipInt >>> 16) & 255,
        (ipInt >>> 8) & 255,
        ipInt & 255
      ].join('.');
      ips.push(ip);
    }

    return ips;
  }

  private async findSubnetForIP(ipAddress: string): Promise<number | null> {
    try {
      const subnets = await storage.getAllSubnets();
      console.log(`🔍 Finding subnet for IP ${ipAddress}, available subnets:`, subnets.map(s => `${s.id}: ${s.network}`));
      
      // Sort by CIDR specificity (most specific first) to prevent conflicts
      const sortedSubnets = subnets.sort((a, b) => {
        const cidrA = parseInt(a.network.split('/')[1]);
        const cidrB = parseInt(b.network.split('/')[1]);
        // Higher CIDR = more specific, should be checked first
        if (cidrA !== cidrB) return cidrB - cidrA;
        return a.network.localeCompare(b.network);
      });
      
      for (const subnet of sortedSubnets) {
        const isMatch = this.isIPInSubnet(ipAddress, subnet.network);
        console.log(`   Checking ${ipAddress} against subnet ${subnet.id} (${subnet.network}): ${isMatch ? '✅ MATCH' : '❌ no match'}`);
        if (isMatch) {
          console.log(`✅ Found subnet ${subnet.id} for IP ${ipAddress}`);
          return subnet.id;
        }
      }
      console.error(`❌ No subnet found for IP ${ipAddress}`);
    } catch (error) {
      console.error(`Error finding subnet for IP ${ipAddress}:`, error);
    }
    
    return null;
  }

  // Public method for device import to find subnet for IP
  async findSubnetForDeviceIP(ipAddress: string): Promise<number | null> {
    return this.findSubnetForIP(ipAddress);
  }

  private isIPInSubnet(ipAddress: string, subnet: string): boolean {
    const [network, cidr] = subnet.split('/');
    const cidrNum = parseInt(cidr, 10);
    
    // Convert IP addresses to 32-bit integers
    const ipToInt = (ip: string): number => {
      return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
    };
    
    const ipInt = ipToInt(ipAddress);
    const networkInt = ipToInt(network);
    const mask = (0xFFFFFFFF << (32 - cidrNum)) >>> 0;
    
    return (ipInt & mask) === (networkInt & mask);
  }

  private async updateDeviceFromScan(discovery: DeviceDiscovery, originalSubnetId: number) {
    try {
      // Check if device already exists
      const existingDevice = await storage.getDeviceByIP(discovery.ipAddress);
      
      if (existingDevice) {
        // Update existing device - let database triggers handle subnet assignment
        await storage.updateDevice(existingDevice.id, {
          hostname: discovery.hostname || existingDevice.hostname,
          macAddress: discovery.macAddress || existingDevice.macAddress,
          vendor: discovery.vendor || existingDevice.vendor,
          status: 'online',
          lastSeen: new Date(),
          openPorts: (discovery.openPorts || []).map(String),
        });
      } else {
        // Create new device - ALWAYS determine correct subnet by IP address
        const correctSubnetId = await this.findSubnetForIP(discovery.ipAddress);
        if (correctSubnetId) {
          await storage.createDevice({
            ipAddress: discovery.ipAddress,
            hostname: discovery.hostname,
            macAddress: discovery.macAddress,
            vendor: discovery.vendor,
            subnetId: correctSubnetId, // Use ONLY the calculated subnet ID
            status: 'online',
            lastSeen: new Date(),
            openPorts: (discovery.openPorts || []).map(String),
            assignmentType: 'static',
            createdBy: 'system scan',
          });
          console.log(`✅ Created device ${discovery.ipAddress} in subnet ${correctSubnetId}`);
        } else {
          console.error(`❌ Could not assign subnet for IP ${discovery.ipAddress} - skipping device creation`);
        }
      }
    } catch (error) {
      console.error(`Error updating device ${discovery.ipAddress}:`, error);
      console.error('Full error details:', error);
      // Continue processing other devices even if one fails
    }
  }

  async fixExistingDeviceSubnets() {
    console.log('Starting to fix existing device subnet assignments...');
    
    try {
      const devices = await storage.getAllDevicesForExport();
      let correctedCount = 0;
      
      for (const device of devices) {
        if (device.ipAddress) {
          const correctSubnetId = await this.findSubnetForIP(device.ipAddress);
          if (correctSubnetId && correctSubnetId !== device.subnetId) {
            await storage.updateDevice(device.id, { subnetId: correctSubnetId });
            correctedCount++;
            console.log(`Fixed device ${device.id} (${device.ipAddress}): subnet ${device.subnetId} -> ${correctSubnetId}`);
          }
        }
      }
      
      console.log(`Fixed ${correctedCount} device subnet assignments using CIDR precedence`);
      return { correctedCount, details: `Fixed ${correctedCount} devices` };
    } catch (error) {
      console.error('Error fixing device subnet assignments:', error);
      return { correctedCount: 0, details: 'Failed to fix device assignments' };
    }
  }
}

export const networkScanner = new NetworkScanner();