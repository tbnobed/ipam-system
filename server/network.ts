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

  addWebSocketClient(ws: any) {
    this.wsClients.add(ws);
    
    // Send current scan status if one is active
    if (this.activeScan && this.currentScanId) {
      this.broadcastProgress();
    }
  }

  removeWebSocketClient(ws: any) {
    this.wsClients.delete(ws);
  }

  private broadcastProgress() {
    const message = {
      type: 'scan_progress',
      scanId: this.currentScanId,
      isActive: this.activeScan,
      progress: this.scanProgress,
      timestamp: new Date()
    };

    this.wsClients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify(message));
      }
    });
  }

  private broadcastScanUpdate(update: any) {
    const message = {
      type: 'scan_update',
      scanId: this.currentScanId,
      ...update,
      timestamp: new Date()
    };

    this.wsClients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(message));
      }
    });
  }

  getScanStatus() {
    return {
      isActive: this.activeScan,
      scanId: this.currentScanId,
      progress: this.scanProgress
    };
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

      this.currentScanId = scan.id;
      this.scanProgress = { current: 0, total: 0 };
      
      // Start scanning in background
      this.performScan(scan.id, subnetIds).finally(() => {
        this.activeScan = false;
        this.currentScanId = null;
        this.scanProgress = { current: 0, total: 0 };
        this.broadcastProgress();
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
      
      // Log scan start activity
      await storage.createActivityLog({
        action: 'scan_started',
        entityType: 'network_scan',
        entityId: scanId,
        details: { subnetIds, scanId },
      });
      
      const results: DeviceDiscovery[] = [];
      
      for (const subnetId of subnetIds) {
        const subnet = await storage.getSubnet(subnetId);
        if (!subnet) continue;

        this.broadcastScanUpdate({ 
          status: 'scanning_subnet', 
          subnet: subnet.network 
        });

        const subnetResults = await this.scanSubnet(subnet.network);
        results.push(...subnetResults);

        // Update device statuses in database - only process devices that belong to this subnet
        for (const result of subnetResults) {
          const correctSubnetId = await this.findSubnetForIP(result.ipAddress);
          if (correctSubnetId === subnet.id) {
            await this.updateDeviceFromScan(result, subnet.id);
          }
          // If device belongs to a different subnet, skip it for now - it will be processed when that subnet is scanned
        }

        // Only broadcast devices that actually belong to this subnet
        const validDevices = [];
        for (const result of subnetResults) {
          const correctSubnetId = await this.findSubnetForIP(result.ipAddress);
          if (correctSubnetId === subnet.id) {
            validDevices.push(result);
          }
        }

        // Broadcast found devices
        this.broadcastScanUpdate({
          status: 'subnet_complete',
          subnet: subnet.network,
          devicesFound: validDevices.length,
          newDevices: validDevices.filter(d => d.isAlive)
        });
      }

      // Update scan record
      await storage.updateNetworkScan(scanId, {
        endTime: new Date(),
        status: 'completed',
        devicesFound: results.length,
        results: results,
      });

      // Broadcast completion summary
      const summary = this.generateScanSummary(results, subnetIds);
      this.broadcastScanUpdate({
        status: 'scan_completed',
        summary,
        totalDevicesFound: results.length,
        onlineDevices: results.filter(d => d.isAlive).length,
        subnetsScanned: subnetIds.length
      });

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

      console.log(`Network scan ${scanId} completed. Found ${results.length} devices.`);
    } catch (error) {
      console.error(`Network scan ${scanId} failed:`, error);
      
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
    }
  }

  private async scanSubnet(network: string): Promise<DeviceDiscovery[]> {
    const results: DeviceDiscovery[] = [];
    const ipRange = this.getIPRange(network);

    console.log(`Scanning subnet ${network} (${ipRange.length} IPs)`);

    // Update total progress count
    this.scanProgress.total = ipRange.length;
    this.scanProgress.current = 0;
    this.broadcastProgress();

    // Scan IPs in batches to avoid overwhelming the network
    const batchSize = 20;
    for (let i = 0; i < ipRange.length; i += batchSize) {
      const batch = ipRange.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(ip => this.scanIP(ip))
      );
      
      const aliveResults = batchResults.filter(result => result.isAlive);
      results.push(...aliveResults);
      
      // Update progress
      this.scanProgress.current = Math.min(i + batchSize, ipRange.length);
      this.scanProgress.currentIP = batch[batch.length - 1];
      this.broadcastProgress();

      // Broadcast any newly found devices
      if (aliveResults.length > 0) {
        this.broadcastScanUpdate({
          status: 'devices_found',
          subnet: network,
          devices: aliveResults,
          progress: this.scanProgress
        });
      }
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
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
      // Ping the IP
      const pingResult = await this.pingDevice(ipAddress);
      result.isAlive = pingResult.success;

      if (result.isAlive) {
        // Try to get hostname using multiple methods
        try {
          // First try reverse DNS lookup
          const hostnames = await dns.promises.reverse(ipAddress);
          result.hostname = hostnames[0]?.replace(/\.$/, ''); // Remove trailing dot
        } catch (error) {
          // If reverse DNS fails, try nslookup
          try {
            const { stdout } = await execAsync(`nslookup ${ipAddress}`);
            const nameMatch = stdout.match(/name = ([^\s]+)/);
            if (nameMatch) {
              result.hostname = nameMatch[1].replace(/\.$/, '');
            }
          } catch (nslookupError) {
            // Try nbtscan for Windows machines
            try {
              const { stdout } = await execAsync(`timeout 5 nbtscan ${ipAddress}`);
              const nameMatch = stdout.match(/(\S+)\s+<00>/);
              if (nameMatch) {
                result.hostname = nameMatch[1];
              }
            } catch (nbtError) {
              // All hostname resolution methods failed
            }
          }
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
        error: String(error),
      };
    }
  }

  private async getMacAddress(ipAddress: string): Promise<string | undefined> {
    try {
      // First ping the IP to populate ARP table
      await execAsync(`ping -c 1 -W 1 ${ipAddress}`);
      
      // Try ARP table lookup with multiple formats
      try {
        const { stdout } = await execAsync(`arp -n ${ipAddress}`);
        // Match different MAC address formats
        let match = stdout.match(/([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/i);
        if (!match) {
          // Try hyphen format
          match = stdout.match(/([0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2})/i);
          if (match) {
            return match[1].replace(/-/g, ':').toLowerCase();
          }
        }
        return match ? match[1].toLowerCase() : undefined;
      } catch (arpError) {
        // Try alternative methods
        try {
          // Try ip neighbor (Linux)
          const { stdout } = await execAsync(`ip neighbor show ${ipAddress}`);
          const match = stdout.match(/lladdr ([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/i);
          return match ? match[1].toLowerCase() : undefined;
        } catch (ipError) {
          // Try arping for more reliable MAC detection
          try {
            const { stdout } = await execAsync(`timeout 3 arping -c 1 ${ipAddress}`);
            const match = stdout.match(/([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/i);
            return match ? match[1].toLowerCase() : undefined;
          } catch (arpingError) {
            return undefined;
          }
        }
      }
    } catch (error) {
      return undefined;
    }
  }

  private async getVendorFromMac(macAddress: string): Promise<string | undefined> {
    try {
      // Extract OUI (first 3 octets)
      const oui = macAddress.split(':').slice(0, 3).join(':');
      
      // Common vendor OUI database for broadcast equipment
      const vendors: { [key: string]: string } = {
        // Cisco Systems
        '00:11:bb': 'Cisco Systems', '00:1e:7a': 'Cisco Systems', '00:26:0a': 'Cisco Systems',
        '88:f0:31': 'Cisco Systems', '00:d0:d3': 'Cisco Systems', '00:0c:85': 'Cisco Systems',
        
        // Sony Professional
        '00:09:d3': 'Sony Corp', '00:1c:a8': 'Sony Corp', '08:96:d7': 'Sony Corp',
        
        // Panasonic Broadcast
        '00:0d:f0': 'Panasonic', '00:80:45': 'Panasonic', '9c:04:eb': 'Panasonic',
        
        // Canon Professional
        '00:12:18': 'Canon Inc', '00:1e:8f': 'Canon Inc', 'dc:ef:80': 'Canon Inc',
        
        // Blackmagic Design
        '00:12:ba': 'Blackmagic Design', '00:17:c4': 'Blackmagic Design',
        
        // Grass Valley / Belden
        '00:02:a1': 'Grass Valley', '00:0e:d6': 'Grass Valley',
        
        // Harris Broadcast
        '00:06:4f': 'Harris Corp', '00:0f:ff': 'Harris Corp',
        
        // Evertz Microsystems
        '00:1b:67': 'Evertz Microsystems', '00:21:27': 'Evertz Microsystems',
        
        // Ross Video
        '00:0c:8b': 'Ross Video', '00:16:9d': 'Ross Video',
        
        // Hewlett Packard Enterprise
        '00:11:85': 'HPE', '28:80:23': 'HPE', '70:10:6f': 'HPE',
        
        // Dell Technologies
        '00:14:22': 'Dell Inc', '84:7b:eb': 'Dell Inc', 'f4:8e:38': 'Dell Inc',
        
        // Ubiquiti Networks
        '04:18:d6': 'Ubiquiti', '24:a4:3c': 'Ubiquiti', 'f0:9f:c2': 'Ubiquiti',
        
        // Virtualization
        '00:50:56': 'VMware', '08:00:27': 'Oracle VirtualBox', '00:15:5d': 'Microsoft Hyper-V',
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
    
    // Support common CIDR ranges
    if (cidrNum < 16 || cidrNum > 30) {
      console.warn(`Unsupported CIDR: ${cidr}. Supported ranges: /16 to /30`);
      return [];
    }

    const baseParts = baseIP.split('.').map(Number);
    const ips: string[] = [];
    
    // Calculate network size
    const hostBits = 32 - cidrNum;
    const totalHosts = Math.pow(2, hostBits);
    
    // For large networks, limit scanning to avoid performance issues
    const maxScanIPs = 1024; // Limit to 1024 IPs for practical scanning
    const actualScanCount = Math.min(totalHosts - 2, maxScanIPs); // Exclude network and broadcast
    
    if (totalHosts > maxScanIPs + 2) {
      console.log(`Large network detected (${totalHosts} hosts). Limiting scan to ${maxScanIPs} IPs.`);
    }

    // Convert base IP to integer for calculations
    const baseIPInt = (baseParts[0] << 24) + (baseParts[1] << 16) + (baseParts[2] << 8) + baseParts[3];
    const networkMask = (0xFFFFFFFF << hostBits) >>> 0;
    const networkAddress = (baseIPInt & networkMask) >>> 0;

    // Generate IP addresses
    for (let i = 1; i <= actualScanCount; i++) {
      const ipInt = networkAddress + i;
      const ip = [
        (ipInt >>> 24) & 0xFF,
        (ipInt >>> 16) & 0xFF,
        (ipInt >>> 8) & 0xFF,
        ipInt & 0xFF
      ].join('.');
      ips.push(ip);
    }

    return ips;
  }

  private async updateDeviceFromScan(discovery: DeviceDiscovery, subnetId: number) {
    try {
      // Calculate the correct subnet for this device based on its IP address
      const correctSubnetId = await this.findSubnetForIP(discovery.ipAddress);
      const useSubnetId = correctSubnetId || subnetId; // Fallback to provided subnetId if calculation fails
      
      console.log(`Device ${discovery.ipAddress}: passed subnetId=${subnetId}, calculated subnetId=${correctSubnetId}, using subnetId=${useSubnetId}`);
      
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
          openPorts: discovery.openPorts?.map(String) || existingDevice.openPorts,
          subnetId: useSubnetId, // Update subnet assignment if needed
        });
      } else if (discovery.isAlive) {
        // Create new device for discovered IP
        await storage.createDevice({
          ipAddress: discovery.ipAddress,
          hostname: discovery.hostname,
          macAddress: discovery.macAddress,
          vendor: discovery.vendor,
          subnetId: useSubnetId,
          status: 'online',
          lastSeen: new Date(),
          openPorts: discovery.openPorts?.map(String) || null,
          assignmentType: 'dhcp', // Assume DHCP for discovered devices
        });
      }
    } catch (error) {
      console.error(`Error updating device ${discovery.ipAddress}:`, error);
    }
  }

  private async findSubnetForIP(ipAddress: string): Promise<number | null> {
    try {
      // Get all subnets
      const subnets = await storage.getAllSubnets();
      
      // Convert IP to integer for range checking
      const ipParts = ipAddress.split('.').map(Number);
      const ipInt = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
      
      console.log(`Finding subnet for IP ${ipAddress} (int: ${ipInt})`);
      
      // Find which subnet this IP belongs to
      for (const subnet of subnets) {
        const [networkAddr, cidrBits] = subnet.network.split('/');
        const cidr = parseInt(cidrBits);
        const hostBits = 32 - cidr;
        
        const networkParts = networkAddr.split('.').map(Number);
        const networkInt = (networkParts[0] << 24) + (networkParts[1] << 16) + (networkParts[2] << 8) + networkParts[3];
        const broadcastInt = networkInt + Math.pow(2, hostBits) - 1;
        
        console.log(`  Checking subnet ${subnet.id} (${subnet.network}): network=${networkInt}, broadcast=${broadcastInt}`);
        
        // Check if IP falls within this subnet range (excluding network and broadcast addresses)
        if (ipInt > networkInt && ipInt < broadcastInt) {
          console.log(`  ✓ IP ${ipAddress} belongs to subnet ${subnet.id} (${subnet.network})`);
          return subnet.id;
        }
      }
      
      console.log(`  ✗ IP ${ipAddress} doesn't match any subnet`);
      return null; // IP doesn't match any subnet
    } catch (error) {
      console.error(`Error finding subnet for IP ${ipAddress}:`, error);
      return null;
    }
  }
}

export const networkScanner = new NetworkScanner();

// Start periodic scanning when the server starts
networkScanner.startPeriodicScanning(5); // Scan every 5 minutes
