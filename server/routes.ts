import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertDeviceSchema, insertVlanSchema, insertSubnetSchema, insertSettingSchema, insertUserSchema, insertUserPermissionSchema, insertUserGroupSchema, insertGroupPermissionSchema } from "@shared/schema";
import { networkScanner } from "./network";
import { migrationManager } from "./migrations";
import { notificationService } from "./notifications";
import { z } from "zod";
import * as XLSX from 'xlsx';
import session from 'express-session';
import bcrypt from 'bcrypt';

// Authentication middleware
const requireAuth = (req: any, res: any, next: any) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  req.user = user;
  next();
};

// Helper function to get user's accessible VLANs
const getUserAccessibleVlans = async (userId: number, userRole: string) => {
  if (userRole === 'admin') {
    return await storage.getAllVlans();
  }
  
  const userPermissions = await storage.getUserPermissions(userId);
  const accessibleVlanIds = userPermissions
    .filter(p => p.vlanId)
    .map(p => p.vlanId);
  
  if (accessibleVlanIds.length === 0) {
    return [];
  }
  
  const allVlans = await storage.getAllVlans();
  return allVlans.filter(vlan => accessibleVlanIds.includes(vlan.id));
};

// Helper function to get user's accessible subnets
const getUserAccessibleSubnets = async (userId: number, userRole: string) => {
  if (userRole === 'admin') {
    return await storage.getAllSubnets();
  }
  
  const userPermissions = await storage.getUserPermissions(userId);
  const accessibleSubnetIds = userPermissions
    .filter(p => p.subnetId)
    .map(p => p.subnetId);
  
  if (accessibleSubnetIds.length === 0) {
    return [];
  }
  
  const allSubnets = await storage.getAllSubnets();
  return allSubnets.filter(subnet => accessibleSubnetIds.includes(subnet.id));
};

// Helper function to filter devices by accessible subnets
const filterDevicesByAccessibleSubnets = async (devices: any[], userId: number, userRole: string) => {
  if (userRole === 'admin') {
    return devices;
  }
  
  const accessibleSubnets = await getUserAccessibleSubnets(userId, userRole);
  const accessibleSubnetIds = accessibleSubnets.map(s => s.id);
  
  return devices.filter(device => accessibleSubnetIds.includes(device.subnetId));
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize sessions
  app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }));
  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Health check endpoint for Docker
  app.get('/api/auth/health', (req, res) => {
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      features: {
        authentication: true,
        notifications: !!process.env.SENDGRID_API_KEY,
        database: true
      }
    });
  });



  // Dashboard metrics - requires authentication
  app.get("/api/dashboard/metrics", requireAuth, async (req: any, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ error: "Failed to fetch dashboard metrics" });
    }
  });

  // VLANs - now with access control
  app.get("/api/vlans", requireAuth, async (req: any, res) => {
    try {
      const vlans = await getUserAccessibleVlans(req.user.id, req.user.role);
      res.json(vlans);
    } catch (error) {
      console.error("Error fetching VLANs:", error);
      res.status(500).json({ error: "Failed to fetch VLANs" });
    }
  });

  app.post("/api/vlans", requireAuth, async (req: any, res) => {
    try {
      // Only admins can create VLANs
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      const validatedData = insertVlanSchema.parse(req.body);
      const vlan = await storage.createVlan(validatedData);
      res.status(201).json(vlan);
    } catch (error) {
      console.error("Error creating VLAN:", error);
      res.status(400).json({ error: "Failed to create VLAN" });
    }
  });

  app.put("/api/vlans/:id", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if user has permission to modify this VLAN
      if (req.user.role !== 'admin') {
        const userPermissions = await storage.getUserPermissions(req.user.id);
        const hasPermission = userPermissions.some(p => 
          p.vlanId === id && (p.permission === 'write' || p.permission === 'admin')
        );
        
        if (!hasPermission) {
          return res.status(403).json({ error: "Insufficient permissions" });
        }
      }
      
      const validatedData = insertVlanSchema.parse(req.body);
      const vlan = await storage.updateVlan(id, validatedData);
      res.json(vlan);
    } catch (error) {
      console.error("Error updating VLAN:", error);
      res.status(400).json({ error: "Failed to update VLAN" });
    }
  });

  app.delete("/api/vlans/:id", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Only admins can delete VLANs
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      await storage.deleteVlan(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting VLAN:", error);
      res.status(400).json({ error: "Failed to delete VLAN" });
    }
  });

  // Subnets - now with access control
  app.get("/api/subnets", requireAuth, async (req: any, res) => {
    try {
      const subnets = await getUserAccessibleSubnets(req.user.id, req.user.role);
      res.json(subnets);
    } catch (error) {
      console.error("Error fetching subnets:", error);
      res.status(500).json({ error: "Failed to fetch subnets" });
    }
  });

  app.post("/api/subnets", requireAuth, async (req: any, res) => {
    try {
      // Only admins can create subnets
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      const validatedData = insertSubnetSchema.parse(req.body);
      const subnet = await storage.createSubnet(validatedData);
      res.status(201).json(subnet);
    } catch (error) {
      console.error("Error creating subnet:", error);
      res.status(400).json({ error: "Failed to create subnet" });
    }
  });

  app.put("/api/subnets/:id", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if user has permission to modify this subnet
      if (req.user.role !== 'admin') {
        const userPermissions = await storage.getUserPermissions(req.user.id);
        const hasPermission = userPermissions.some(p => 
          p.subnetId === id && (p.permission === 'write' || p.permission === 'admin')
        );
        
        if (!hasPermission) {
          return res.status(403).json({ error: "Insufficient permissions" });
        }
      }
      
      const validatedData = insertSubnetSchema.parse(req.body);
      const subnet = await storage.updateSubnet(id, validatedData);
      res.json(subnet);
    } catch (error) {
      console.error("Error updating subnet:", error);
      res.status(400).json({ error: "Failed to update subnet" });
    }
  });

  app.delete("/api/subnets/:id", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Only admins can delete subnets
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      await storage.deleteSubnet(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting subnet:", error);
      res.status(400).json({ error: "Failed to delete subnet" });
    }
  });

  app.get("/api/subnets/:id/utilization", async (req, res) => {
    try {
      const subnetId = parseInt(req.params.id);
      const utilization = await storage.getSubnetUtilization(subnetId);
      res.json(utilization);
    } catch (error) {
      console.error("Error fetching subnet utilization:", error);
      res.status(500).json({ error: "Failed to fetch subnet utilization" });
    }
  });

  // Subnet utilization for dashboard - requires authentication
  app.get("/api/dashboard/subnet-utilization", requireAuth, async (req: any, res) => {
    try {
      const subnets = await getUserAccessibleSubnets(req.user.id, req.user.role);
      const utilizationData = await Promise.all(
        subnets.map(async (subnet) => {
          const utilization = await storage.getSubnetUtilization(subnet.id);
          return {
            id: subnet.id,
            name: subnet.network,
            description: subnet.description || '',
            utilization: utilization.utilizationPercent || 0,
            available: utilization.availableIPs || 0,
            total: utilization.totalIPs || 0,
          };
        })
      );
      res.json(utilizationData);
    } catch (error) {
      console.error("Error fetching subnet utilization:", error);
      res.status(500).json({ error: "Failed to fetch subnet utilization" });
    }
  });

  // Devices - requires authentication and filters by accessible subnets
  app.get("/api/devices", requireAuth, async (req: any, res) => {
    try {
      const { search, vlan, subnet, status, page = "1", limit, sortBy, sortOrder } = req.query;
      const filters = {
        search: search ? search as string : undefined,
        vlan: vlan ? vlan as string : undefined,
        subnet: subnet ? subnet as string : undefined,
        status: status ? status as string : undefined,
        page: parseInt(page as string),
        limit: limit ? parseInt(limit as string) : undefined, // No default limit - show all devices
        sortBy: sortBy ? sortBy as string : undefined,
        sortOrder: (sortOrder === 'asc' || sortOrder === 'desc') ? sortOrder as 'asc' | 'desc' : undefined,
      };
      
      console.log("Device query filters:", filters);
      const devices = await storage.getDevices(filters);
      
      // Filter devices by accessible subnets
      const filteredDevices = await filterDevicesByAccessibleSubnets(devices.data, req.user.id, req.user.role);
      
      console.log(`Returned ${filteredDevices.length} devices out of ${devices.total} total (filtered by permissions)`);
      console.log("Sample device IPs:", filteredDevices.slice(0, 5).map(d => `${d.id}:${d.ipAddress}:subnet${d.subnetId}`));
      
      // Set proper headers for large JSON responses
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.json({
        data: filteredDevices,
        total: filteredDevices.length,
        page: filters.page,
        limit: filters.limit
      });
    } catch (error) {
      console.error("Error fetching devices:", error);
      res.status(500).json({ error: "Failed to fetch devices" });
    }
  });

  app.post("/api/devices", requireAuth, async (req: any, res) => {
    try {
      // Only users with write permissions to the subnet can create devices
      const validatedData = insertDeviceSchema.parse(req.body);
      
      if (req.user.role !== 'admin') {
        const userPermissions = await storage.getUserPermissions(req.user.id);
        const hasPermission = userPermissions.some(p => 
          p.subnetId === validatedData.subnetId && (p.permission === 'write' || p.permission === 'admin')
        );
        
        if (!hasPermission) {
          return res.status(403).json({ error: "Insufficient permissions" });
        }
      }
      
      const device = await storage.createDevice(validatedData);
      res.status(201).json(device);
    } catch (error) {
      console.error("Error creating device:", error);
      res.status(400).json({ error: "Failed to create device" });
    }
  });

  app.put("/api/devices/:id", requireAuth, async (req: any, res) => {
    try {
      const deviceId = parseInt(req.params.id);
      const validatedData = insertDeviceSchema.partial().parse(req.body);
      
      // Check if user has permission to modify this device
      if (req.user.role !== 'admin') {
        const existingDevice = await storage.getDevice(deviceId);
        if (!existingDevice) {
          return res.status(404).json({ error: "Device not found" });
        }
        
        const userPermissions = await storage.getUserPermissions(req.user.id);
        const hasPermission = userPermissions.some(p => 
          p.subnetId === existingDevice.subnetId && (p.permission === 'write' || p.permission === 'admin')
        );
        
        if (!hasPermission) {
          return res.status(403).json({ error: "Insufficient permissions" });
        }
      }
      
      const device = await storage.updateDevice(deviceId, validatedData);
      res.json(device);
    } catch (error) {
      console.error("Error updating device:", error);
      res.status(400).json({ error: "Failed to update device" });
    }
  });

  app.delete("/api/devices/:id", requireAuth, async (req: any, res) => {
    try {
      const deviceId = parseInt(req.params.id);
      
      // Check if user has permission to delete this device
      if (req.user.role !== 'admin') {
        const existingDevice = await storage.getDevice(deviceId);
        if (!existingDevice) {
          return res.status(404).json({ error: "Device not found" });
        }
        
        const userPermissions = await storage.getUserPermissions(req.user.id);
        const hasPermission = userPermissions.some(p => 
          p.subnetId === existingDevice.subnetId && (p.permission === 'write' || p.permission === 'admin')
        );
        
        if (!hasPermission) {
          return res.status(403).json({ error: "Insufficient permissions" });
        }
      }
      
      await storage.deleteDevice(deviceId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting device:", error);
      res.status(500).json({ error: "Failed to delete device" });
    }
  });

  // Get all devices for dashboard calculations (no pagination) - requires authentication
  app.get("/api/devices/all", requireAuth, async (req: any, res) => {
    try {
      const devices = await storage.getAllDevicesForExport();
      
      // Filter devices by accessible subnets
      const filteredDevices = await filterDevicesByAccessibleSubnets(devices, req.user.id, req.user.role);
      
      res.json({ data: filteredDevices });
    } catch (error) {
      console.error("Error fetching all devices:", error);
      res.status(500).json({ error: "Failed to fetch devices" });
    }
  });



  // Network scanning - requires authentication
  app.post("/api/network/scan", requireAuth, async (req: any, res) => {
    try {
      const { subnetIds } = req.body;
      console.log("Received scan request with subnetIds:", subnetIds);
      
      // Ensure subnetIds is an array and filter by accessible subnets
      let validSubnetIds = Array.isArray(subnetIds) ? subnetIds : [];
      
      if (req.user.role !== 'admin') {
        const accessibleSubnets = await getUserAccessibleSubnets(req.user.id, req.user.role);
        const accessibleSubnetIds = accessibleSubnets.map(s => s.id);
        validSubnetIds = validSubnetIds.filter(id => accessibleSubnetIds.includes(id));
      }
      
      console.log("Processing scan with subnet IDs:", validSubnetIds);
      
      const scanId = await networkScanner.startScan(validSubnetIds);
      res.json({ scanId, status: "started" });
    } catch (error) {
      console.error("Error starting network scan:", error);
      res.status(500).json({ error: "Failed to start network scan" });
    }
  });

  app.get("/api/network/scan/:id", requireAuth, async (req: any, res) => {
    try {
      const scanId = parseInt(req.params.id);
      const scan = await storage.getNetworkScan(scanId);
      res.json(scan);
    } catch (error) {
      console.error("Error fetching network scan:", error);
      res.status(500).json({ error: "Failed to fetch network scan" });
    }
  });

  app.get("/api/network/scan", requireAuth, async (req: any, res) => {
    try {
      const status = networkScanner.getScanStatus();
      res.json(status);
    } catch (error) {
      console.error("Error getting network scan status:", error);
      res.status(500).json({ error: "Failed to get scan status" });
    }
  });

  app.post("/api/network/scan/stop", requireAuth, async (req: any, res) => {
    try {
      console.log("Stop scan request received");
      networkScanner.stopScan();
      res.json({ success: true, message: "Scan stopped" });
    } catch (error) {
      console.error("Error stopping network scan:", error);
      res.status(500).json({ error: "Failed to stop network scan" });
    }
  });

  app.post("/api/network/fix-subnets", requireAuth, async (req: any, res) => {
    try {
      // Only admins can fix subnet assignments
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      console.log("Manual fix requested for device subnet assignments");
      const result = await networkScanner.fixExistingDeviceSubnets();
      res.json(result);
    } catch (error) {
      console.error("Error fixing device subnet assignments:", error);
      res.status(500).json({ error: "Failed to fix device subnet assignments" });
    }
  });

  app.post("/api/devices/:id/ping", requireAuth, async (req: any, res) => {
    try {
      const deviceId = parseInt(req.params.id);
      const device = await storage.getDevice(deviceId);
      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }
      
      // Check if user has permission to ping this device
      if (req.user.role !== 'admin') {
        const userPermissions = await storage.getUserPermissions(req.user.id);
        const hasPermission = userPermissions.some(p => 
          p.subnetId === device.subnetId
        );
        
        if (!hasPermission) {
          return res.status(403).json({ error: "Insufficient permissions" });
        }
      }
      
      const pingResult = await networkScanner.pingDevice(device.ipAddress);
      res.json(pingResult);
    } catch (error) {
      console.error("Error pinging device:", error);
      res.status(500).json({ error: "Failed to ping device" });
    }
  });

  // Activity logs - requires authentication
  app.get("/api/activity", requireAuth, async (req: any, res) => {
    try {
      const { limit = "20" } = req.query;
      const activities = await storage.getRecentActivity(parseInt(limit as string));
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  // Export - requires authentication
  app.get("/api/export/devices", requireAuth, async (req: any, res) => {
    try {
      const excelBuffer = await generateDeviceExcel();
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="network_devices_by_vlan.xlsx"');
      res.send(excelBuffer);
    } catch (error) {
      console.error("Error exporting devices:", error);
      res.status(500).json({ error: "Failed to export devices" });
    }
  });

  // Settings
  app.get("/api/settings", requireAuth, async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // Test notification endpoint (admin only)
  app.post('/api/test-notification', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { type, message } = req.body;
      
      // Send a test notification
      await notificationService.processAlert({
        type: type || 'device_offline',
        message: message || 'Test notification from IPAM system',
        severity: 'medium',
        timestamp: new Date(),
        metadata: { source: 'manual_test', userId: user.id }
      });

      res.json({ 
        success: true, 
        message: 'Test notification sent. Check console logs for delivery details.' 
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
      res.status(500).json({ error: 'Failed to send test notification' });
    }
  });

  app.get("/api/settings/:key", async (req, res) => {
    try {
      const { key } = req.params;
      const setting = await storage.getSetting(key);
      if (!setting) {
        return res.status(404).json({ error: "Setting not found" });
      }
      res.json(setting);
    } catch (error) {
      console.error("Error fetching setting:", error);
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const { key, value, description } = req.body;
      const setting = await storage.setSetting(key, value, description);
      res.status(201).json(setting);
    } catch (error) {
      console.error("Error creating setting:", error);
      res.status(400).json({ error: "Failed to create setting" });
    }
  });

  app.put("/api/settings/:key", requireAuth, async (req, res) => {
    try {
      const { key } = req.params;
      const { value, description } = req.body;
      const setting = await storage.setSetting(key, value, description);
      
      // If scan interval was updated, restart periodic scanning
      if (key === 'scan_interval') {
        const scanInterval = parseInt(value);
        networkScanner.startPeriodicScanning(scanInterval);
        console.log(`Periodic scanning interval updated to ${scanInterval} minutes`);
      }
      
      res.json(setting);
    } catch (error) {
      console.error("Error updating setting:", error);
      res.status(400).json({ error: "Failed to update setting" });
    }
  });

  app.delete("/api/settings/:key", async (req, res) => {
    try {
      const { key } = req.params;
      await storage.deleteSetting(key);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting setting:", error);
      res.status(500).json({ error: "Failed to delete setting" });
    }
  });

  // Export all data endpoint
  app.get("/api/export", requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      const excelBuffer = await generateDeviceExcel();
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="ipam_system_export.xlsx"');
      res.send(excelBuffer);
    } catch (error) {
      console.error("Error exporting data:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  // Clear historical data endpoint
  app.post("/api/clear-historical-data", requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      // Clear old activity logs based on data retention setting
      const retentionSetting = await storage.getSetting('data_retention');
      const retentionDays = retentionSetting ? parseInt(retentionSetting.value) : 90;
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      await storage.clearHistoricalData(cutoffDate);
      
      res.json({ message: "Historical data cleared successfully" });
    } catch (error) {
      console.error("Error clearing historical data:", error);
      res.status(500).json({ error: "Failed to clear historical data" });
    }
  });

  // Authentication endpoints
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Use bcrypt to compare the password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      if (!user.isActive) {
        return res.status(401).json({ error: "Account is disabled" });
      }
      
      // Store user in session
      (req as any).session.user = {
        id: user.id,
        username: user.username,
        role: user.role,
        isActive: user.isActive
      };
      
      res.json({
        id: user.id,
        username: user.username,
        role: user.role,
        isActive: user.isActive
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      (req as any).session.destroy((err: any) => {
        if (err) {
          console.error("Logout error:", err);
          return res.status(500).json({ error: "Logout failed" });
        }
        res.json({ message: "Logged out successfully" });
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      const user = (req as any).session?.user;
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      // Verify user still exists and is active
      const currentUser = await storage.getUser(user.id);
      if (!currentUser || !currentUser.isActive) {
        (req as any).session.destroy();
        return res.status(401).json({ error: "User not found or inactive" });
      }
      
      res.json({
        id: currentUser.id,
        username: currentUser.username,
        role: currentUser.role,
        isActive: currentUser.isActive
      });
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(500).json({ error: "Authentication check failed" });
    }
  });

  // User management endpoints - only admins can access these
  app.get("/api/users", requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/users", requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      const { username, password, role = "viewer", groupId } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      
      // Hash the password before storing
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        role,
        groupId,
        isActive: true
      });
      
      res.status(201).json(user);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(400).json({ error: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      const userId = parseInt(req.params.id);
      const { username, password, role, isActive, groupId } = req.body;
      
      // Prepare update data
      const updateData: any = {
        username,
        role,
        isActive,
        groupId
      };
      
      // Only hash and include password if it's provided
      if (password && password.trim() !== '') {
        updateData.password = await bcrypt.hash(password, 10);
      }
      
      const user = await storage.updateUser(userId, updateData);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(400).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      const userId = parseInt(req.params.id);
      await storage.deleteUser(userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // User Groups Management
  app.get("/api/user-groups", requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      const groups = await storage.getAllUserGroups();
      res.json(groups);
    } catch (error) {
      console.error("Error fetching user groups:", error);
      res.status(500).json({ error: "Failed to fetch user groups" });
    }
  });

  app.post("/api/user-groups", requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      const validatedData = insertUserGroupSchema.parse(req.body);
      const group = await storage.createUserGroup(validatedData);
      res.status(201).json(group);
    } catch (error) {
      console.error("Error creating user group:", error);
      res.status(400).json({ error: "Failed to create user group" });
    }
  });

  app.put("/api/user-groups/:id", requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      const groupId = parseInt(req.params.id);
      const validatedData = insertUserGroupSchema.parse(req.body);
      const group = await storage.updateUserGroup(groupId, validatedData);
      
      if (!group) {
        return res.status(404).json({ error: "User group not found" });
      }
      
      res.json(group);
    } catch (error) {
      console.error("Error updating user group:", error);
      res.status(400).json({ error: "Failed to update user group" });
    }
  });

  app.delete("/api/user-groups/:id", requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      const groupId = parseInt(req.params.id);
      await storage.deleteUserGroup(groupId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user group:", error);
      res.status(500).json({ error: "Failed to delete user group" });
    }
  });

  // Assign users to groups
  app.put("/api/users/:id/group", requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      const userId = parseInt(req.params.id);
      const { groupId } = req.body;
      
      const user = await storage.assignUserToGroup(userId, groupId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error assigning user to group:", error);
      res.status(400).json({ error: "Failed to assign user to group" });
    }
  });

  // Group permissions management
  app.get("/api/group-permissions/:groupId", requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      const groupId = parseInt(req.params.groupId);
      console.log(`Fetching group permissions for groupId: ${groupId}`);
      const permissions = await storage.getGroupPermissions(groupId);
      console.log(`Found ${permissions.length} permissions for group ${groupId}:`, permissions);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching group permissions:", error);
      res.status(500).json({ error: "Failed to fetch group permissions" });
    }
  });

  app.post("/api/group-permissions", requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      const { groupId, permissions } = req.body;
      console.log("Received group permissions request:", { groupId, permissions });
      
      // Handle bulk save if permissions array is provided
      if (groupId && permissions && Array.isArray(permissions)) {
        console.log(`Bulk saving ${permissions.length} permissions for group ${groupId}`);
        
        // Delete existing permissions for this group
        await storage.deleteGroupPermissions(groupId);
        console.log(`Deleted existing permissions for group ${groupId}`);
        
        // Create new permissions
        const createdPermissions = [];
        for (const perm of permissions) {
          const permissionData = {
            groupId,
            vlanId: perm.vlanId || null,
            subnetId: perm.subnetId || null,
            permission: perm.permission
          };
          
          console.log("Creating permission:", permissionData);
          const validatedData = insertGroupPermissionSchema.parse(permissionData);
          const permission = await storage.createGroupPermission(validatedData);
          createdPermissions.push(permission);
        }
        
        console.log(`Successfully created ${createdPermissions.length} permissions`);
        res.status(201).json(createdPermissions);
      } else {
        // Handle single permission creation
        console.log("Single permission creation:", req.body);
        const validatedData = insertGroupPermissionSchema.parse(req.body);
        const permission = await storage.createGroupPermission(validatedData);
        res.status(201).json(permission);
      }
    } catch (error) {
      console.error("Error creating group permission:", error);
      console.error("Request body:", req.body);
      res.status(400).json({ error: "Failed to create group permission" });
    }
  });

  app.put("/api/group-permissions/:id", requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      const permissionId = parseInt(req.params.id);
      const validatedData = insertGroupPermissionSchema.parse(req.body);
      const permission = await storage.updateGroupPermission(permissionId, validatedData);
      
      if (!permission) {
        return res.status(404).json({ error: "Group permission not found" });
      }
      
      res.json(permission);
    } catch (error) {
      console.error("Error updating group permission:", error);
      res.status(400).json({ error: "Failed to update group permission" });
    }
  });

  app.delete("/api/group-permissions/:id", requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      const permissionId = parseInt(req.params.id);
      await storage.deleteGroupPermission(permissionId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting group permission:", error);
      res.status(500).json({ error: "Failed to delete group permission" });
    }
  });

  // User permissions endpoints
  app.get("/api/user-permissions/:userId", requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      const userId = parseInt(req.params.userId);
      const permissions = await storage.getUserPermissions(userId);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ error: "Failed to fetch user permissions" });
    }
  });

  app.post("/api/user-permissions", requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      const { userId, permissions } = req.body;
      
      if (!userId || !permissions || !Array.isArray(permissions)) {
        return res.status(400).json({ error: "User ID and permissions array are required" });
      }
      
      // Delete existing permissions for this user
      await storage.deleteUserPermissions(userId);
      
      // Create new permissions
      const createdPermissions = [];
      for (const perm of permissions) {
        if (!perm.permission || perm.permission === 'none') continue;
        
        if (!perm.vlanId && !perm.subnetId) continue;
        
        const userPermission = await storage.createUserPermission({
          userId,
          vlanId: perm.vlanId || null,
          subnetId: perm.subnetId || null,
          permission: perm.permission
        });
        
        createdPermissions.push(userPermission);
      }
      
      res.status(201).json(createdPermissions);
    } catch (error) {
      console.error("Error creating user permissions:", error);
      res.status(400).json({ error: "Failed to create user permissions" });
    }
  });

  app.put("/api/user-permissions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { userId, vlanId, subnetId, permission } = req.body;
      
      const userPermission = await storage.updateUserPermission(id, {
        userId,
        vlanId: vlanId || null,
        subnetId: subnetId || null,
        permission
      });
      
      res.json(userPermission);
    } catch (error) {
      console.error("Error updating user permission:", error);
      res.status(400).json({ error: "Failed to update user permission" });
    }
  });

  app.delete("/api/user-permissions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteUserPermission(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user permission:", error);
      res.status(500).json({ error: "Failed to delete user permission" });
    }
  });

  // Start network scan endpoint
  app.post("/api/network/scan", async (req, res) => {
    try {
      const { subnetIds = [] } = req.body;
      
      // If no specific subnets provided, scan all subnets
      let scanSubnetIds = subnetIds;
      if (scanSubnetIds.length === 0) {
        const allSubnets = await storage.getAllSubnets();
        scanSubnetIds = allSubnets.map(s => s.id);
      }
      
      const scanId = await networkScanner.startScan(scanSubnetIds);
      res.json({ scanId, message: "Network scan started" });
    } catch (error) {
      console.error("Error starting network scan:", error);
      res.status(500).json({ error: "Failed to start network scan" });
    }
  });

  // Network scan status endpoint
  app.get("/api/network/scan/status", async (req, res) => {
    try {
      const status = networkScanner.getScanStatus();
      res.json(status);
    } catch (error) {
      console.error("Error getting scan status:", error);
      res.status(500).json({ error: "Failed to get scan status" });
    }
  });

  // Create WebSocket server for real-time scan updates
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    // Add client to network scanner for real-time updates
    networkScanner.addWebSocketClient(ws);
    
    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 30000);
    
    ws.on('pong', () => {
      // Connection is alive - no action needed
    });
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      clearInterval(heartbeatInterval);
      networkScanner.removeWebSocketClient(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clearInterval(heartbeatInterval);
      networkScanner.removeWebSocketClient(ws);
    });
  });

  return httpServer;
}

async function generateDeviceExcel(): Promise<Buffer> {
  // Get all devices with their subnet and VLAN information
  const devices = await storage.getAllDevicesForExport();
  const vlans = await storage.getAllVlans();
  const subnets = await storage.getAllSubnets();
  
  // Create a new workbook
  const workbook = XLSX.utils.book_new();
  
  // Headers for device data
  const headers = ['IP Address', 'Hostname', 'MAC Address', 'Device Type', 'Location', 'Status', 'Last Seen', 'Subnet', 'Gateway'];
  
  // Group devices by VLAN
  const devicesByVlan: { [key: string]: any[] } = {};
  
  for (const device of devices) {
    // Find the subnet for this device
    const subnet = subnets.find(s => s.id === device.subnetId);
    if (!subnet) continue;
    
    // Find the VLAN for this subnet
    const vlan = vlans.find(v => v.id === subnet.vlanId);
    if (!vlan) continue;
    
    const vlanKey = `VLAN_${vlan.vlanId}_${vlan.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    if (!devicesByVlan[vlanKey]) {
      devicesByVlan[vlanKey] = [];
    }
    
    // Add device with subnet information
    devicesByVlan[vlanKey].push([
      device.ipAddress,
      device.hostname || '',
      device.macAddress || '',
      device.deviceType || '',
      device.location || '',
      device.status,
      device.lastSeen ? new Date(device.lastSeen).toISOString() : '',
      subnet.network,
      subnet.gateway || ''
    ]);
  }
  
  // Create a summary tab
  const summaryData = [
    ['VLAN Summary Report'],
    ['Generated:', new Date().toISOString()],
    [''],
    ['VLAN ID', 'VLAN Name', 'Device Count', 'Subnets']
  ];
  
  for (const [vlanKey, devices] of Object.entries(devicesByVlan)) {
    const vlanMatch = vlanKey.match(/VLAN_(\d+)_(.+)/);
    if (vlanMatch) {
      const vlanId = vlanMatch[1];
      const vlanName = vlanMatch[2].replace(/_/g, ' ');
      const vlan = vlans.find(v => v.vlanId.toString() === vlanId);
      const vlanSubnets = subnets.filter(s => s.vlanId === vlan?.id).map(s => s.network).join(', ');
      
      summaryData.push([
        vlanId,
        vlanName,
        devices.length.toString(),
        vlanSubnets
      ]);
    }
  }
  
  // Add summary worksheet
  const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summaryWS, 'Summary');
  
  // Create a worksheet for each VLAN
  for (const [vlanKey, devices] of Object.entries(devicesByVlan)) {
    if (devices.length > 0) {
      const worksheetData = [headers, ...devices];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // Set column widths
      worksheet['!cols'] = [
        { wch: 15 }, // IP Address
        { wch: 20 }, // Hostname
        { wch: 18 }, // MAC Address
        { wch: 15 }, // Device Type
        { wch: 20 }, // Location
        { wch: 10 }, // Status
        { wch: 20 }, // Last Seen
        { wch: 18 }, // Subnet
        { wch: 15 }  // Gateway
      ];
      
      // Truncate sheet name to Excel limit (31 characters)
      const sheetName = vlanKey.length > 31 ? vlanKey.substring(0, 31) : vlanKey;
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }
  }
  
  // If no VLANs have devices, create a single "All Devices" sheet
  if (Object.keys(devicesByVlan).length === 0) {
    const allDevicesData = devices.map(device => {
      const subnet = subnets.find(s => s.id === device.subnetId);
      return [
        device.ipAddress,
        device.hostname || '',
        device.macAddress || '',
        device.deviceType || '',
        device.location || '',
        device.status,
        device.lastSeen ? new Date(device.lastSeen).toISOString() : '',
        subnet?.network || '',
        subnet?.gateway || ''
      ];
    });
    
    const worksheetData = [headers, ...allDevicesData];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    worksheet['!cols'] = [
      { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 20 }, 
      { wch: 10 }, { wch: 20 }, { wch: 18 }, { wch: 15 }
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, 'All Devices');
  }
  
  // Generate Excel file buffer
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
