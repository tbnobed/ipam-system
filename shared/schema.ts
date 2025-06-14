import { pgTable, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
});

export const vlans = pgTable("vlans", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  vlanId: integer("vlan_id").unique().notNull(),
  name: text("name").notNull(),
  description: text("description"),
});

export const subnets = pgTable("subnets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  network: text("network").unique().notNull(), // e.g., "192.168.1.0/24"
  gateway: text("gateway"),
  description: text("description"),
  vlanId: integer("vlan_id").references(() => vlans.id),
});

export const devices = pgTable("devices", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  ipAddress: text("ip_address").unique().notNull(),
  hostname: text("hostname"),
  macAddress: text("mac_address"),
  vendor: text("vendor"),
  deviceType: text("device_type"),
  purpose: text("purpose"),
  location: text("location"),
  subnetId: integer("subnet_id").references(() => subnets.id),
  status: text("status").notNull().default("unknown"), // online, offline, unknown
  lastSeen: timestamp("last_seen"),
  openPorts: text("open_ports").array(),
  assignmentType: text("assignment_type").default("dhcp"), // dhcp, static, reserved
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const networkScans = pgTable("network_scans", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  status: text("status").notNull().default("running"), // running, completed, failed
  startTime: timestamp("start_time").notNull().defaultNow(),
  endTime: timestamp("end_time"),
  devicesFound: integer("devices_found").default(0),
  subnetId: integer("subnet_id").references(() => subnets.id),
  results: jsonb("results"),
});

export const activityLogs = pgTable("activity_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  details: jsonb("details"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const migrations = pgTable("migrations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  version: text("version").unique().notNull(),
  name: text("name").notNull(),
  appliedAt: timestamp("applied_at").notNull().defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users, {
  id: z.number().optional(),
}).omit({
  id: true,
});

export const insertVlanSchema = createInsertSchema(vlans, {
  id: z.number().optional(),
}).omit({
  id: true,
});

export const insertSubnetSchema = createInsertSchema(subnets, {
  id: z.number().optional(),
}).omit({
  id: true,
});

export const insertDeviceSchema = createInsertSchema(devices, {
  id: z.number().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNetworkScanSchema = createInsertSchema(networkScans, {
  id: z.number().optional(),
  startTime: z.date().optional(),
}).omit({
  id: true,
  startTime: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs, {
  id: z.number().optional(),
  timestamp: z.date().optional(),
}).omit({
  id: true,
  timestamp: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Vlan = typeof vlans.$inferSelect;
export type InsertVlan = z.infer<typeof insertVlanSchema>;

export type Subnet = typeof subnets.$inferSelect;
export type InsertSubnet = z.infer<typeof insertSubnetSchema>;

export type Device = typeof devices.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;

export type NetworkScan = typeof networkScans.$inferSelect;
export type InsertNetworkScan = z.infer<typeof insertNetworkScanSchema>;

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

export type Migration = typeof migrations.$inferSelect;