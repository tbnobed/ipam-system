import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("viewer"), // "admin" or "viewer"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const vlans = pgTable("vlans", {
  id: serial("id").primaryKey(),
  vlanId: integer("vlan_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  cableColor: text("cable_color"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subnets = pgTable("subnets", {
  id: serial("id").primaryKey(),
  network: text("network").notNull(), // e.g., "192.168.1.0/24"
  gateway: text("gateway").notNull(),
  vlanId: integer("vlan_id").references(() => vlans.id),
  assignmentType: text("assignment_type").notNull(), // "static" or "dhcp"
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  ipAddress: text("ip_address").notNull(),
  hostname: text("hostname"),
  macAddress: text("mac_address"),
  vendor: text("vendor"),
  deviceType: text("device_type"),
  purpose: text("purpose"),
  location: text("location"),
  subnetId: integer("subnet_id").references(() => subnets.id, { onDelete: "set null" }),
  status: text("status").notNull().default("unknown"), // "online", "offline", "unknown"
  lastSeen: timestamp("last_seen"),
  openPorts: text("open_ports").array(),
  assignmentType: text("assignment_type").notNull().default("static"), // "static" or "dhcp"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const networkScans = pgTable("network_scans", {
  id: serial("id").primaryKey(),
  subnetId: integer("subnet_id").references(() => subnets.id, { onDelete: "cascade" }),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  devicesFound: integer("devices_found").default(0),
  status: text("status").notNull().default("running"), // "running", "completed", "failed"
  results: jsonb("results"), // Store scan results as JSON
});

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(), // "device", "vlan", "subnet", etc.
  entityId: integer("entity_id"),
  details: jsonb("details"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertVlanSchema = createInsertSchema(vlans).omit({
  id: true,
  createdAt: true,
});

export const insertSubnetSchema = createInsertSchema(subnets).omit({
  id: true,
  createdAt: true,
});

export const insertDeviceSchema = createInsertSchema(devices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNetworkScanSchema = createInsertSchema(networkScans).omit({
  id: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  timestamp: true,
});

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
