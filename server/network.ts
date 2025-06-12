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

  async startPeriodicScanning(intervalMinutes: number = 5) {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }

    this.scanInterval = setInterval(async () => {
      if (!this.activeScan) {
        try {
          const subnets = await storage.getAllSubnets();
          const subnetIds = subnets.map(s => s.id);
          await this.startScan(subnetIds);
        } catch (error) {
          console.error('Error in periodic scan:', error);
        }
      }
    }, intervalMinutes * 60 * 1000);

    console.log(`Periodic network scanning started (every ${intervalMinutes} minutes)`);
  }

  async startScan(subnetIds: number[]): Promise<number> {
    if (this.activeScan) {
      throw new Error('Scan already in progress');
    }

    this.activeScan = true;
    
    try {
      // Create scan record
      const scan = await storage.createNetworkScan({
        subnetId: subnetIds[0], // For now, scan one subnet at a time
        startTime: new Date(),
        status: 'running',
        devicesFound: 0,
        results: null,
      });

      // Start scanning in background
      this.performScan(scan.id, subnetIds).finally(() => {
        this.activeScan = false;
      });

      return scan.id;
    } catch (error) {
      this.activeScan = false;
      throw error;
    }
  }

  private async performScan(scanId: number, subnetIds: number[]) {
    try {
      console.log(`Starting network scan ${scanId} for subnets:`, subnetIds);
      
      const results: DeviceDiscovery[] = [];
      
      for (const subnetId of subnetIds) {
        const subnet = await storage.getSubnet(subnetId);
        if (!subnet) continue;

        const subnetResults = await this.scanSubnet(subnet.network);
        results.push(...subnetResults);

        // Update device statuses in database
        for (const result of subnetResults) {
          await this.updateDeviceFromScan(result, subnetId);
        }
      }

      // Update scan record
      await storage.updateNetworkScan(scanId, {
        endTime: new Date(),
        status: 'completed',
        devicesFound: results.length,
        results: results,
      });

      console.log(`Network scan ${scanId} completed. Found ${results.length} devices.`);
    } catch (error) {
      console.error(`Network scan ${scanId} failed:`, error);
      await storage.updateNetworkScan(scanId, {
        endTime: new Date(),
        status: 'failed',
        results: { error: error.message },
      });
    }
  }

  private async scanSubnet(network: string): Promise<DeviceDiscovery[]> {
    const results: DeviceDiscovery[] = [];
    const ipRange = this.getIPRange(network);

    console.log(`Scanning subnet ${network} (${ipRange.length} IPs)`);

    // Scan IPs in batches to avoid overwhelming the network
    const batchSize = 20;
    for (let i = 0; i < ipRange.length; i += batchSize) {
      const batch = ipRange.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(ip => this.scanIP(ip))
      );
      
      results.push(...batchResults.filter(result => result.isAlive));
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  private async scanIP(ipAddress: string): Promise<DeviceDiscovery> {
    const result: DeviceDiscovery = {
      ipAddress,
      isAlive: false,
    };

    try {
      // Ping the IP
      const pingResult = await this.pingDevice(ipAddress);
      result.isAlive = pingResult.success;

      if (result.isAlive) {
        // Try to get hostname
        try {
          const hostnames = await dns.promises.reverse(ipAddress);
          result.hostname = hostnames[0];
        } catch (error) {
          // Hostname resolution failed, that's okay
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
      const { stdout } = await execAsync(`ping -c 1 -W 2 ${ipAddress}`);
      
      // Parse response time from ping output
      const match = stdout.match(/time=([0-9.]+)/);
      const responseTime = match ? parseFloat(match[1]) : undefined;

      return {
        success: true,
        responseTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async getMacAddress(ipAddress: string): Promise<string | undefined> {
    try {
      // Try ARP table lookup
      const { stdout } = await execAsync(`arp -n ${ipAddress}`);
      const match = stdout.match(/([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/i);
      return match ? match[1].toLowerCase() : undefined;
    } catch (error) {
      return undefined;
    }
  }

  private async getVendorFromMac(macAddress: string): Promise<string | undefined> {
    try {
      // Extract OUI (first 3 octets)
      const oui = macAddress.split(':').slice(0, 3).join(':');
      
      // This is a simplified vendor lookup
      // In a real implementation, you'd use a proper OUI database
      const vendors: { [key: string]: string } = {
        '00:11:22': 'Cisco Systems',
        'aa:bb:cc': 'Sony Corp',
        '11:22:33': 'Yamaha Corp',
        '00:50:56': 'VMware',
        '08:00:27': 'Oracle VirtualBox',
      };

      return vendors[oui] || 'Unknown';
    } catch (error) {
      return undefined;
    }
  }

  private async scanCommonPorts(ipAddress: string): Promise<number[]> {
    const commonPorts = [22, 23, 53, 80, 443, 554, 8080, 8443];
    const openPorts: number[] = [];

    // Scan ports in parallel but with timeout
    const portPromises = commonPorts.map(async (port) => {
      try {
        const { stdout } = await execAsync(`timeout 2 nc -z ${ipAddress} ${port}`, { timeout: 3000 });
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
    const cidrNum = parseInt(cidr);
    
    // For simplicity, only handle /24 networks
    if (cidrNum !== 24) {
      console.warn(`Unsupported CIDR: ${cidr}. Only /24 networks are supported.`);
      return [];
    }

    const baseParts = baseIP.split('.').map(Number);
    const ips: string[] = [];

    // Generate all IPs in the /24 range (skip network and broadcast addresses)
    for (let i = 1; i < 255; i++) {
      ips.push(`${baseParts[0]}.${baseParts[1]}.${baseParts[2]}.${i}`);
    }

    return ips;
  }

  private async updateDeviceFromScan(discovery: DeviceDiscovery, subnetId: number) {
    try {
      // Check if device already exists
      const existingDevice = await storage.getDeviceByIP(discovery.ipAddress);
      
      if (existingDevice) {
        // Update existing device
        await storage.updateDevice(existingDevice.id, {
          status: discovery.isAlive ? 'online' : 'offline',
          lastSeen: discovery.isAlive ? new Date() : existingDevice.lastSeen,
          hostname: discovery.hostname || existingDevice.hostname,
          macAddress: discovery.macAddress || existingDevice.macAddress,
          vendor: discovery.vendor || existingDevice.vendor,
          openPorts: discovery.openPorts || existingDevice.openPorts,
        });
      } else if (discovery.isAlive) {
        // Create new device for discovered IP
        await storage.createDevice({
          ipAddress: discovery.ipAddress,
          hostname: discovery.hostname,
          macAddress: discovery.macAddress,
          vendor: discovery.vendor,
          subnetId,
          status: 'online',
          lastSeen: new Date(),
          openPorts: discovery.openPorts,
          assignmentType: 'dhcp', // Assume DHCP for discovered devices
        });
      }
    } catch (error) {
      console.error(`Error updating device ${discovery.ipAddress}:`, error);
    }
  }
}

export const networkScanner = new NetworkScanner();

// Start periodic scanning when the server starts
networkScanner.startPeriodicScanning(5); // Scan every 5 minutes
