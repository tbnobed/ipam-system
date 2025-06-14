import { 
  users, vlans, subnets, devices, networkScans, activityLogs,
  type User, type InsertUser, type Vlan, type InsertVlan,
  type Subnet, type InsertSubnet, type Device, type InsertDevice,
  type NetworkScan, type InsertNetworkScan, type ActivityLog, type InsertActivityLog
} from "@shared/schema";
import { db } from "./db";
import { eq, like, and, desc, asc, sql } from "drizzle-orm";
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
    // First, delete all devices in this subnet
    await db.delete(devices).where(eq(devices.subnetId, id));
    // Then delete the subnet
    await db.delete(subnets).where(eq(subnets.id, id));
  }

  async getSubnetUtilization(subnetId: number): Promise<any> {
    const subnet = await this.getSubnet(subnetId);
    if (!subnet) return null;
    
    const [deviceCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(devices)
      .where(eq(devices.subnetId, subnetId));
    
    const deviceCount = Number(deviceCountResult.count);
    
    // Calculate total IPs from CIDR notation
    const [network, prefixLength] = subnet.network.split('/');
    const totalIPs = Math.pow(2, 32 - parseInt(prefixLength)) - 2; // Subtract network and broadcast addresses
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
      // First find the VLAN record ID by vlanId number
      conditions.push(sql`${devices.subnetId} IN (
        SELECT s.id FROM ${subnets} s 
        JOIN ${vlans} v ON s.vlan_id = v.id 
        WHERE v.vlan_id = ${parseInt(filters.vlan)}
      )`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Query with proper JOIN to ensure all devices with valid subnets are returned
    const data = await db.select({
      id: devices.id,
      ipAddress: devices.ipAddress,
      hostname: devices.hostname,
      macAddress: devices.macAddress,
      vendor: devices.vendor,
      deviceType: devices.deviceType,
      purpose: devices.purpose,
      location: devices.location,
      subnetId: devices.subnetId,
      status: devices.status,
      lastSeen: devices.lastSeen,
      openPorts: devices.openPorts,
      assignmentType: devices.assignmentType,
      createdAt: devices.createdAt,
      updatedAt: devices.updatedAt,
    })
      .from(devices)
      .leftJoin(subnets, eq(devices.subnetId, subnets.id))
      .where(whereClause)
      .orderBy(devices.id) // Use ID ordering for consistent pagination
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(devices)
      .leftJoin(subnets, eq(devices.subnetId, subnets.id))
      .where(whereClause);

    return {
      data,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
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
      .values({
        ...insertDevice,
        updatedAt: new Date(),
      })
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

    // Get total IP capacity from subnets
    const subnetCapacity = await db
      .select({
        network: subnets.network
      })
      .from(subnets);

    let totalCapacity = 0;
    subnetCapacity.forEach(subnet => {
      const cidr = parseInt(subnet.network.split('/')[1]);
      const hostBits = 32 - cidr;
      const capacity = Math.pow(2, hostBits) - 2; // Subtract network and broadcast
      totalCapacity += capacity;
    });

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