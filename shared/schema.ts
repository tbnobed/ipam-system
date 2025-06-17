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
  cableColor: text("cable_color"),
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

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  key: text("key").unique().notNull(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users, {
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

export const insertVlanSchema = createInsertSchema(vlans, {
  name: z.string().min(1, "Name is required"),
  vlanId: z.number().min(1, "VLAN ID is required")
});

export const insertSubnetSchema = createInsertSchema(subnets, {
  network: z.string().min(1, "Network is required")
});

export const insertDeviceSchema = createInsertSchema(devices, {
  ipAddress: z.string().min(1, "IP address is required")
});

export const insertNetworkScanSchema = createInsertSchema(networkScans, {
  status: z.string().optional()
});

export const insertActivityLogSchema = createInsertSchema(activityLogs, {
  action: z.string().min(1, "Action is required"),
  entityType: z.string().min(1, "Entity type is required")
});

export const insertSettingSchema = createInsertSchema(settings, {
  key: z.string().min(1, "Setting key is required"),
  value: z.string().min(1, "Setting value is required")
}).omit({ id: true, updatedAt: true });

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

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;