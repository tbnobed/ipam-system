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
    
    // Simple query without complex sorting since frontend handles it
    const data = await db.select()
      .from(devices)
      .where(whereClause)
      .orderBy(devices.ipAddress)
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(devices)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

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

    return {
      totalIPs: deviceCount.count,
      allocatedIPs: deviceCount.count,
      onlineDevices,
      offlineDevices,
      totalVLANs: vlanCount.count,
      totalSubnets: subnetCount.count,
      changesSinceLastScan: {
        online: 0,
        offline: 0,
      },
    };
  }
}

export const storage = new DatabaseStorage();