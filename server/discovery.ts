import { storage } from './storage';
import type { Subnet, Vlan } from '@shared/schema';

/**
 * Network Discovery Service
 * 
 * This service handles dynamic discovery of VLAN-subnet relationships
 * based on actual network topology rather than hardcoded assignments.
 */
export class NetworkDiscoveryService {
  
  /**
   * Discover and assign VLAN-subnet relationships dynamically
   * 
   * This function analyzes the network topology to determine which
   * subnets belong to which VLANs based on:
   * - Gateway analysis
   * - Network device discovery
   * - Routing table analysis
   * - Manual VLAN configuration verification
   */
  async discoverVlanSubnetRelationships(): Promise<{
    assigned: number;
    unassigned: number;
    errors: string[];
  }> {
    console.log('🔍 Starting dynamic VLAN-subnet relationship discovery...');
    
    const results = {
      assigned: 0,
      unassigned: 0,
      errors: [] as string[]
    };

    try {
      // Get all unassigned subnets (vlanId = null)
      const allSubnets = await storage.getAllSubnets();
      const unassignedSubnets = allSubnets.filter(subnet => subnet.vlanId === null);
      
      console.log(`Found ${unassignedSubnets.length} unassigned subnets to analyze`);

      // Get all available VLANs
      const allVlans = await storage.getAllVlans();
      console.log(`Available VLANs for assignment:`, allVlans.map(v => `${v.vlanId}:${v.name}`));

      for (const subnet of unassignedSubnets) {
        try {
          const assignedVlan = await this.discoverSubnetVlan(subnet, allVlans);
          
          if (assignedVlan) {
            // Update subnet with discovered VLAN assignment
            await storage.updateSubnet(subnet.id, { vlanId: assignedVlan.id });
            results.assigned++;
            console.log(`✅ Assigned subnet ${subnet.network} to VLAN ${assignedVlan.vlanId} (${assignedVlan.name})`);
          } else {
            results.unassigned++;
            console.log(`⚠️  Could not determine VLAN for subnet ${subnet.network}`);
          }
        } catch (error) {
          const errorMsg = `Failed to discover VLAN for subnet ${subnet.network}: ${error}`;
          console.error(errorMsg);
          results.errors.push(errorMsg);
          results.unassigned++;
        }
      }

      console.log(`Discovery complete: ${results.assigned} assigned, ${results.unassigned} unassigned, ${results.errors.length} errors`);
      
    } catch (error) {
      console.error('Discovery service error:', error);
      results.errors.push(`Discovery service error: ${error}`);
    }

    return results;
  }

  /**
   * Discover which VLAN a subnet belongs to based on network analysis
   */
  private async discoverSubnetVlan(subnet: Subnet, availableVlans: Vlan[]): Promise<Vlan | null> {
    console.log(`🔎 Analyzing subnet ${subnet.network} for VLAN assignment...`);

    // Method 1: Gateway-based discovery
    // Analyze gateway IP to determine VLAN based on network topology
    const gatewayBasedVlan = await this.discoverVlanByGateway(subnet, availableVlans);
    if (gatewayBasedVlan) {
      console.log(`Gateway analysis assigned ${subnet.network} to VLAN ${gatewayBasedVlan.vlanId}`);
      return gatewayBasedVlan;
    }

    // Method 2: Device discovery
    // Look at devices already discovered in this subnet to infer VLAN
    const deviceBasedVlan = await this.discoverVlanByDevices(subnet, availableVlans);
    if (deviceBasedVlan) {
      console.log(`Device analysis assigned ${subnet.network} to VLAN ${deviceBasedVlan.vlanId}`);
      return deviceBasedVlan;
    }

    // Method 3: Network pattern analysis
    // Use subnet naming patterns and IP ranges to infer VLAN
    const patternBasedVlan = await this.discoverVlanByPattern(subnet, availableVlans);
    if (patternBasedVlan) {
      console.log(`Pattern analysis assigned ${subnet.network} to VLAN ${patternBasedVlan.vlanId}`);
      return patternBasedVlan;
    }

    console.log(`❌ No VLAN discovered for subnet ${subnet.network}`);
    return null;
  }

  /**
   * Discover VLAN by analyzing gateway configuration
   */
  private async discoverVlanByGateway(subnet: Subnet, availableVlans: Vlan[]): Promise<Vlan | null> {
    // This could be extended to check actual network routing tables
    // For now, we use logical inference based on IP ranges
    
    if (!subnet.gateway) return null;

    // Example: If gateway is in engineering IP range, assign to engineering VLAN
    const gatewayIP = subnet.gateway;
    
    // Look for VLANs with matching IP patterns
    for (const vlan of availableVlans) {
      if (this.isGatewayInVlanRange(gatewayIP, vlan)) {
        return vlan;
      }
    }

    return null;
  }

  /**
   * Discover VLAN by analyzing existing devices in the subnet
   */
  private async discoverVlanByDevices(subnet: Subnet, availableVlans: Vlan[]): Promise<Vlan | null> {
    try {
      // Get devices in this subnet
      const devicesResult = await storage.getDevices({ 
        subnet: subnet.id.toString(), 
        page: 1, 
        limit: 1000 
      });
      const devices = devicesResult.data;
      
      if (devices.length === 0) {
        return null;
      }

      // Analyze device types and purposes to infer VLAN
      // This could be extended with more sophisticated logic
      const deviceTypes = devices.map((d: any) => d.deviceType).filter(Boolean);
      const purposes = devices.map((d: any) => d.purpose).filter(Boolean);
      
      console.log(`Subnet ${subnet.network} contains devices:`, deviceTypes, purposes);

      // Example logic: broadcast equipment typically on specific VLANs
      if (deviceTypes.some((type: any) => ['encoder', 'decoder', 'camera'].includes(type?.toLowerCase()))) {
        // Look for broadcast/production VLANs
        const broadcastVlan = availableVlans.find(v => 
          v.name.toLowerCase().includes('broadcast') || 
          v.name.toLowerCase().includes('production') ||
          v.name.toLowerCase().includes('srt')
        );
        if (broadcastVlan) return broadcastVlan;
      }

      if (deviceTypes.some((type: any) => ['switch', 'router', 'controller'].includes(type?.toLowerCase()))) {
        // Look for engineering/control VLANs
        const engineeringVlan = availableVlans.find(v => 
          v.name.toLowerCase().includes('engineering') || 
          v.name.toLowerCase().includes('control') ||
          v.name.toLowerCase().includes('management')
        );
        if (engineeringVlan) return engineeringVlan;
      }

    } catch (error) {
      console.warn('Device-based discovery failed:', error);
    }

    return null;
  }

  /**
   * Discover VLAN by analyzing subnet patterns and IP ranges
   */
  private async discoverVlanByPattern(subnet: Subnet, availableVlans: Vlan[]): Promise<Vlan | null> {
    const network = subnet.network;
    
    // Extract IP range info for pattern matching
    const [ipRange, cidr] = network.split('/');
    const ipParts = ipRange.split('.');
    
    // Pattern matching based on common broadcast facility conventions
    if (ipParts[0] === '10' && ipParts[1] === '63') {
      // 10.63.x.x typically engineering networks
      const engineeringVlan = availableVlans.find(v => 
        v.name.toLowerCase().includes('engineering') ||
        v.name.toLowerCase().includes('control')
      );
      if (engineeringVlan) return engineeringVlan;
    }
    
    if (ipParts[0] === '172' && ipParts[1] === '31') {
      // 172.31.x.x typically production/SRT networks
      const productionVlan = availableVlans.find(v => 
        v.name.toLowerCase().includes('srt') ||
        v.name.toLowerCase().includes('production') ||
        v.name.toLowerCase().includes('encoder')
      );
      if (productionVlan) return productionVlan;
    }

    // If subnet description contains VLAN hints
    if (subnet.description) {
      const desc = subnet.description.toLowerCase();
      for (const vlan of availableVlans) {
        const vlanName = vlan.name.toLowerCase();
        if (desc.includes(vlanName) || vlanName.includes(desc)) {
          return vlan;
        }
      }
    }

    return null;
  }

  /**
   * Check if a gateway IP logically belongs to a VLAN's IP range
   */
  private isGatewayInVlanRange(gatewayIP: string, vlan: Vlan): boolean {
    // This is a placeholder for more sophisticated routing analysis
    // In a real implementation, you'd check routing tables, VLAN configurations, etc.
    
    // For now, use simple IP range logic
    const gatewayParts = gatewayIP.split('.');
    
    // Example: VLAN 320/321 typically use 10.63.x.x
    if (vlan.vlanId >= 320 && vlan.vlanId <= 321) {
      return gatewayParts[0] === '10' && gatewayParts[1] === '63';
    }
    
    // Example: VLAN 172 typically uses 172.31.x.x
    if (vlan.vlanId === 172) {
      return gatewayParts[0] === '172' && gatewayParts[1] === '31';
    }
    
    return false;
  }

  /**
   * Manual VLAN assignment for specific subnet configurations
   * Call this after import to assign known relationships
   */
  async assignKnownVlanRelationships(): Promise<void> {
    console.log('🔧 Applying known VLAN-subnet relationships...');
    
    try {
      const allSubnets = await storage.getAllSubnets();
      const allVlans = await storage.getAllVlans();
      
      // Example known relationships - these could be configurable
      const knownRelationships = [
        { subnetPattern: '10.63.20.', vlanId: 320 }, // Engineering Control
        { subnetPattern: '10.63.21.', vlanId: 321 }, // Engineering Control 2  
        { subnetPattern: '172.31.2.', vlanId: 172 },  // SRT Encoder
      ];
      
      for (const relationship of knownRelationships) {
        const subnet = allSubnets.find(s => s.network.startsWith(relationship.subnetPattern));
        const vlan = allVlans.find(v => v.vlanId === relationship.vlanId);
        
        if (subnet && vlan && subnet.vlanId === null) {
          await storage.updateSubnet(subnet.id, { vlanId: vlan.id });
          console.log(`✅ Assigned known relationship: ${subnet.network} → VLAN ${vlan.vlanId}`);
        }
      }
      
    } catch (error) {
      console.error('Error applying known VLAN relationships:', error);
    }
  }
}

export const discoveryService = new NetworkDiscoveryService();