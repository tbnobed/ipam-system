import { 
  users, vlans, subnets, devices, networkScans, activityLogs,
  type User, type InsertUser, type Vlan, type InsertVlan,
  type Subnet, type InsertSubnet, type Device, type InsertDevice,
  type NetworkScan, type InsertNetworkScan, type ActivityLog, type InsertActivityLog
} from "@shared/schema";
import { db } from "./db";
import { eq, like, and, or, desc, asc, sql, ne } from "drizzle-orm";
import type { DashboardMetrics, DeviceFilters, PaginatedResponse } from "@/lib/types";

interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  
  // VLANs
  getAllVlans(): Promise<Vlan[]>;
  createVlan(insertVlan: InsertVlan): Promise<Vlan>;
  updateVlan(id: number, updates: Partial<InsertVlan>): Promise<Vlan>;
  deleteVlan(id: number): Promise<void>;
  
  // Subnets
  getAllSubnets(): Promise<Subnet[]>;
  getSubnet(id: number): Promise<Subnet | undefined>;
  createSubnet(insertSubnet: InsertSubnet): Promise<Subnet>;
  updateSubnet(id: number, updates: Partial<InsertSubnet>): Promise<Subnet>;
  deleteSubnet(id: number): Promise<void>;
  getSubnetUtilization(subnetId: number): Promise<any>;
  
  // Devices
  getDevices(filters: DeviceFilters): Promise<PaginatedResponse<Device>>;
  getDevice(id: number): Promise<Device | undefined>;
  getDeviceByIP(ipAddress: string): Promise<Device | undefined>;
  createDevice(insertDevice: InsertDevice): Promise<Device>;
  updateDevice(id: number, updates: Partial<InsertDevice>): Promise<Device>;
  deleteDevice(id: number): Promise<void>;
  getAllDevicesForExport(): Promise<Device[]>;
  
  // Network Scans
  createNetworkScan(insertScan: InsertNetworkScan): Promise<NetworkScan>;
  getNetworkScan(id: number): Promise<NetworkScan | undefined>;
  updateNetworkScan(id: number, updates: Partial<InsertNetworkScan>): Promise<NetworkScan>;
  
  // Activity Logs
  getRecentActivity(limit: number): Promise<ActivityLog[]>;
  createActivityLog(insertLog: InsertActivityLog): Promise<ActivityLog>;
  
  // Dashboard
  getDashboardMetrics(): Promise<DashboardMetrics>;
  
  // Device subnet fixes
  fixDeviceSubnetAssignments(subnet20Id: number, subnet21Id: number): Promise<{correctedCount: number, details: string}>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getAllVlans(): Promise<Vlan[]> {
    return await db.select().from(vlans).orderBy(vlans.vlanId);
  }

  async createVlan(insertVlan: InsertVlan): Promise<Vlan> {
    const [vlan] = await db
      .insert(vlans)
      .values(insertVlan)
      .returning();
    return vlan;
  }

  async updateVlan(id: number, updates: Partial<InsertVlan>): Promise<Vlan> {
    const [vlan] = await db
      .update(vlans)
      .set(updates)
      .where(eq(vlans.id, id))
      .returning();
    return vlan;
  }

  async deleteVlan(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      // Get all subnet IDs for this VLAN first
      const vlanSubnets = await tx.select({ id: subnets.id }).from(subnets).where(eq(subnets.vlanId, id));
      const subnetIds = vlanSubnets.map(s => s.id);
      
      if (subnetIds.length > 0) {
        // Delete all devices in these subnets
        for (const subnetId of subnetIds) {
          await tx.delete(devices).where(eq(devices.subnetId, subnetId));
        }
        
        // Delete all network scans for these subnets
        for (const subnetId of subnetIds) {
          await tx.delete(networkScans).where(eq(networkScans.subnetId, subnetId));
        }
        
        // Delete all subnets for this VLAN
        await tx.delete(subnets).where(eq(subnets.vlanId, id));
      }
      
      // Finally delete the VLAN
      await tx.delete(vlans).where(eq(vlans.id, id));
    });
  }

  async getAllSubnets(): Promise<Subnet[]> {
    return await db.select().from(subnets).orderBy(subnets.network);
  }

  async getSubnet(id: number): Promise<Subnet | undefined> {
    const [subnet] = await db.select().from(subnets).where(eq(subnets.id, id));
    return subnet || undefined;
  }

  async createSubnet(insertSubnet: InsertSubnet): Promise<Subnet> {
    const [subnet] = await db
      .insert(subnets)
      .values(insertSubnet)
      .returning();
    return subnet;
  }

  async updateSubnet(id: number, updates: Partial<InsertSubnet>): Promise<Subnet> {
    const [subnet] = await db
      .update(subnets)
      .set(updates)
      .where(eq(subnets.id, id))
      .returning();
    return subnet;
  }

  async deleteSubnet(id: number): Promise<void> {
    // Check if there are any network scans referencing this subnet
    const scansWithSubnet = await db
      .select({ id: networkScans.id })
      .from(networkScans)
      .where(eq(networkScans.subnetId, id));
    
    if (scansWithSubnet.length > 0) {
      // Update network scans to remove the subnet reference instead of deleting them
      await db
        .update(networkScans)
        .set({ subnetId: null })
        .where(eq(networkScans.subnetId, id));
    }
    
    // Get the subnet being deleted to check if we need to reassign devices
    const subnetToDelete = await this.getSubnet(id);
    if (subnetToDelete) {
      console.log(`Deleting subnet ${subnetToDelete.network} (ID: ${id})`);
      
      // Get devices in this subnet that might need reassignment
      const devicesInSubnet = await db
        .select({ ipAddress: devices.ipAddress, id: devices.id })
        .from(devices)
        .where(eq(devices.subnetId, id));
      
      console.log(`Found ${devicesInSubnet.length} devices in subnet ${subnetToDelete.network}`);
      
      // Try to reassign devices to correct subnets based on their IP addresses
      for (const device of devicesInSubnet) {
        const correctSubnetId = await this.findCorrectSubnetForIP(device.ipAddress, id);
        if (correctSubnetId) {
          await db.update(devices)
            .set({ subnetId: correctSubnetId })
            .where(eq(devices.id, device.id));
          console.log(`Reassigned device ${device.ipAddress} to subnet ${correctSubnetId}`);
        } else {
          // If no correct subnet found, delete the device
          await db.delete(devices).where(eq(devices.id, device.id));
          console.log(`Deleted device ${device.ipAddress} (no suitable subnet found)`);
        }
      }
    }
    
    // Delete any activity logs that reference this subnet
    await db.delete(activityLogs).where(
      and(
        eq(activityLogs.entityType, 'subnet'),
        eq(activityLogs.entityId, id)
      )
    );
    
    // Finally, delete the subnet
    await db.delete(subnets).where(eq(subnets.id, id));
  }

  private async findCorrectSubnetForIP(ipAddress: string, excludeSubnetId: number): Promise<number | null> {
    const subnets = await this.getAllSubnets();
    
    for (const subnet of subnets) {
      if (subnet.id === excludeSubnetId) continue; // Skip the subnet being deleted
      
      const [networkAddr, cidrBits] = subnet.network.split('/');
      const cidr = parseInt(cidrBits);
      
      if (cidr === 24) {
        const ipOctets = ipAddress.split('.');
        const networkOctets = networkAddr.split('.');
        const ipPrefix = `${ipOctets[0]}.${ipOctets[1]}.${ipOctets[2]}`;
        const networkPrefix = `${networkOctets[0]}.${networkOctets[1]}.${networkOctets[2]}`;
        
        if (ipPrefix === networkPrefix) {
          const hostOctet = parseInt(ipOctets[3]);
          if (hostOctet >= 1 && hostOctet <= 254) {
            return subnet.id;
          }
        }
      }
    }
    
    return null;
  }

  async getSubnetUtilization(subnetId: number): Promise<any> {
    const subnet = await this.getSubnet(subnetId);
    if (!subnet) return null;
    
    // Get devices that actually belong to this subnet's IP range, not just assigned subnet ID
    const [network, prefixLength] = subnet.network.split('/');
    const cidr = parseInt(prefixLength);
    const hostBits = 32 - cidr;
    
    // Convert network to integer for comparison
    const networkParts = network.split('.').map(Number);
    const networkInt = (networkParts[0] << 24) + (networkParts[1] << 16) + (networkParts[2] << 8) + networkParts[3];
    const mask = (0xFFFFFFFF << hostBits) >>> 0;
    
    // Get all devices and filter by IP range
    const allDevices = await db.select().from(devices);
    const devicesInRange = allDevices.filter(device => {
      if (!device.ipAddress) return false;
      const deviceParts = device.ipAddress.split('.').map(Number);
      const deviceInt = (deviceParts[0] << 24) + (deviceParts[1] << 16) + (deviceParts[2] << 8) + deviceParts[3];
      return (deviceInt & mask) === (networkInt & mask);
    });
    
    const deviceCount = devicesInRange.length;
    
    // Calculate total IPs from CIDR notation
    const totalIPs = Math.pow(2, hostBits) - 2; // Subtract network and broadcast addresses
    const availableIPs = totalIPs - deviceCount;
    const utilizationPercent = totalIPs > 0 ? Math.round((deviceCount / totalIPs) * 100) : 0;
    
    return {
      id: subnet.id,
      name: subnet.network,
      utilizationPercent,
      description: subnet.description,
      availableIPs,
      totalIPs,
      deviceCount,
    };
  }

  async getDevices(filters: DeviceFilters): Promise<PaginatedResponse<Device>> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    let conditions = [];

    if (filters.search) {
      conditions.push(
        sql`(${devices.ipAddress} LIKE ${`%${filters.search}%`} OR ${devices.hostname} LIKE ${`%${filters.search}%`})`
      );
    }

    if (filters.status) {
      conditions.push(eq(devices.status, filters.status));
    }

    if (filters.vlan) {
      // Get all subnets for this VLAN and filter devices by IP range
      const vlanSubnets = await db
        .select({ network: subnets.network })
        .from(subnets)
        .innerJoin(vlans, eq(subnets.vlanId, vlans.id))
        .where(eq(vlans.vlanId, parseInt(filters.vlan)));
      
      if (vlanSubnets.length > 0) {
        const ipRangeConditions = vlanSubnets.map(subnet => {
          const [network, prefixLength] = subnet.network.split('/');
          const cidr = parseInt(prefixLength);
          const hostBits = 32 - cidr;
          const networkParts = network.split('.');
          
          // For /24 networks, use simple prefix matching for performance
          if (cidr === 24) {
            return sql`${devices.ipAddress} LIKE ${networkParts.slice(0, 3).join('.') + '.%'}`;
          } else {
            // For other CIDR blocks, use more complex matching
            return sql`inet '${devices.ipAddress}' << inet '${subnet.network}'`;
          }
        });
        
        conditions.push(or(...ipRangeConditions));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Query all devices - no longer restrict by specific subnet IDs
    // This ensures devices show up regardless of which subnet ID they're assigned to
    const data = await db.select()
      .from(devices)
      .where(whereClause)
      .orderBy(devices.ipAddress)
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(devices)
      .where(whereClause);

    return {
      data,
      total: Number(count),
      page,
      limit,
      totalPages: Math.ceil(Number(count) / limit),
    };
  }

  async getDevice(id: number): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.id, id));
    return device || undefined;
  }

  async getDeviceByIP(ipAddress: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.ipAddress, ipAddress));
    return device || undefined;
  }

  async createDevice(insertDevice: InsertDevice): Promise<Device> {
    const [device] = await db
      .insert(devices)
      .values(insertDevice)
      .returning();
    return device;
  }

  async updateDevice(id: number, updates: Partial<InsertDevice>): Promise<Device> {
    const [device] = await db
      .update(devices)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(devices.id, id))
      .returning();
    return device;
  }

  async deleteDevice(id: number): Promise<void> {
    await db.delete(devices).where(eq(devices.id, id));
  }

  async getAllDevicesForExport(): Promise<Device[]> {
    return await db.select().from(devices).orderBy(devices.ipAddress);
  }

  async createNetworkScan(insertScan: InsertNetworkScan): Promise<NetworkScan> {
    const [scan] = await db
      .insert(networkScans)
      .values(insertScan)
      .returning();
    return scan;
  }

  async getNetworkScan(id: number): Promise<NetworkScan | undefined> {
    const [scan] = await db.select().from(networkScans).where(eq(networkScans.id, id));
    return scan || undefined;
  }

  async updateNetworkScan(id: number, updates: Partial<InsertNetworkScan>): Promise<NetworkScan> {
    const [scan] = await db
      .update(networkScans)
      .set(updates)
      .where(eq(networkScans.id, id))
      .returning();
    return scan;
  }

  async getRecentActivity(limit: number): Promise<ActivityLog[]> {
    return await db
      .select()
      .from(activityLogs)
      .orderBy(desc(activityLogs.timestamp))
      .limit(limit);
  }

  async createActivityLog(insertLog: InsertActivityLog): Promise<ActivityLog> {
    const [log] = await db
      .insert(activityLogs)
      .values(insertLog)
      .returning();
    return log;
  }

  async fixDeviceSubnetAssignments(): Promise<{correctedCount: number, details: string}> {
    try {
      const allDevices = await db.select().from(devices);
      const allSubnets = await db.select().from(subnets);
      
      let correctedCount = 0;
      const corrections: string[] = [];
      
      for (const device of allDevices) {
        if (!device.ipAddress) continue;
        
        // Find correct subnet using CIDR calculations
        const correctSubnet = allSubnets.find(subnet => {
          const [network, prefixLength] = subnet.network.split('/');
          const cidr = parseInt(prefixLength);
          const hostBits = 32 - cidr;
          
          const networkParts = network.split('.').map(Number);
          const deviceParts = device.ipAddress.split('.').map(Number);
          
          const networkInt = (networkParts[0] << 24) + (networkParts[1] << 16) + (networkParts[2] << 8) + networkParts[3];
          const deviceInt = (deviceParts[0] << 24) + (deviceParts[1] << 16) + (deviceParts[2] << 8) + deviceParts[3];
          const mask = (0xFFFFFFFF << hostBits) >>> 0;
          
          return (deviceInt & mask) === (networkInt & mask);
        });
        
        if (correctSubnet && device.subnetId !== correctSubnet.id) {
          await db.update(devices)
            .set({ subnetId: correctSubnet.id })
            .where(eq(devices.id, device.id));
          
          corrections.push(`${device.ipAddress}: ${device.subnetId} -> ${correctSubnet.id}`);
          correctedCount++;
        }
      }
      
      const details = `Fixed ${correctedCount} device subnet assignments using CIDR calculations`;
      console.log(details);
      corrections.forEach(correction => console.log(`Fixed ${correction}`));
      
      return { correctedCount, details };
    } catch (error) {
      console.error("Error in fixDeviceSubnetAssignments:", error);
      throw error;
    }
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    // Get device counts by status
    const deviceCounts = await db
      .select({
        status: devices.status,
        count: sql<number>`count(*)`
      })
      .from(devices)
      .groupBy(devices.status);

    const onlineDevices = deviceCounts.find(d => d.status === 'online')?.count || 0;
    const offlineDevices = deviceCounts.find(d => d.status === 'offline')?.count || 0;

    // Get VLAN and subnet counts
    const [vlanCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(vlans);

    const [subnetCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(subnets);

    // Get total device count
    const [deviceCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(devices);

    // Get total IP capacity from subnets - handle overlapping ranges
    const subnetCapacity = await db
      .select({
        network: subnets.network
      })
      .from(subnets);

    const ipRanges = new Set<string>();
    let totalCapacity = 0;
    
    subnetCapacity.forEach(subnet => {
      const [network, prefixLength] = subnet.network.split('/');
      const cidr = parseInt(prefixLength);
      const hostBits = 32 - cidr;
      
      // Generate all IPs in this subnet to detect overlaps
      const networkParts = network.split('.').map(Number);
      const networkInt = (networkParts[0] << 24) + (networkParts[1] << 16) + (networkParts[2] << 8) + networkParts[3];
      
      for (let i = 1; i < Math.pow(2, hostBits) - 1; i++) {
        const ipInt = networkInt + i;
        const ip = [
          (ipInt >>> 24) & 255,
          (ipInt >>> 16) & 255,
          (ipInt >>> 8) & 255,
          ipInt & 255
        ].join('.');
        ipRanges.add(ip);
      }
    });
    
    totalCapacity = ipRanges.size;

    // Get vendor breakdown
    const vendorCounts = await db
      .select({
        vendor: devices.vendor,
        count: sql<number>`count(*)`
      })
      .from(devices)
      .where(sql`${devices.vendor} IS NOT NULL AND ${devices.vendor} != ''`)
      .groupBy(devices.vendor)
      .orderBy(sql`count(*) DESC`)
      .limit(5);

    // Get recent scans count (last 24 hours)
    const recentScans = await db
      .select({ count: sql<number>`count(*)` })
      .from(networkScans)
      .where(sql`${networkScans.startTime} > NOW() - INTERVAL '24 hours'`);

    // Get last scan time
    const lastScan = await db
      .select({ startTime: networkScans.startTime })
      .from(networkScans)
      .orderBy(desc(networkScans.startTime))
      .limit(1);

    // Calculate network utilization
    const networkUtilization = totalCapacity > 0 ? Math.round((deviceCount.count / totalCapacity) * 100) : 0;

    // Count critical alerts (offline devices that were recently online)
    const criticalAlerts = await db
      .select({ count: sql<number>`count(*)` })
      .from(devices)
      .where(sql`${devices.status} = 'offline' AND ${devices.lastSeen} > NOW() - INTERVAL '1 hour'`);

    return {
      totalIPs: totalCapacity,
      allocatedIPs: deviceCount.count,
      availableIPs: totalCapacity - deviceCount.count,
      onlineDevices,
      offlineDevices,
      totalVLANs: vlanCount.count,
      totalSubnets: subnetCount.count,
      changesSinceLastScan: {
        online: 0,
        offline: 0,
      },
      lastScanTime: lastScan[0]?.startTime?.toISOString() || undefined,
      scanningStatus: 'idle',
      networkUtilization,
      criticalAlerts: criticalAlerts[0]?.count || 0,
      recentScansCount: recentScans[0]?.count || 0,
      topVendors: vendorCounts.map(v => ({ name: v.vendor || 'Unknown', count: v.count })),
    };
  }
}

export const storage = new DatabaseStorage();