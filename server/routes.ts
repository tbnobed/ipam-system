import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertDeviceSchema, insertVlanSchema, insertSubnetSchema, insertSettingSchema, insertUserSchema, insertUserPermissionSchema } from "@shared/schema";
import { networkScanner } from "./network";
import { migrationManager } from "./migrations";
import { z } from "zod";
import * as XLSX from 'xlsx';

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });



  // Dashboard metrics
  app.get("/api/dashboard/metrics", async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ error: "Failed to fetch dashboard metrics" });
    }
  });

  // VLANs
  app.get("/api/vlans", async (req, res) => {
    try {
      const vlans = await storage.getAllVlans();
      res.json(vlans);
    } catch (error) {
      console.error("Error fetching VLANs:", error);
      res.status(500).json({ error: "Failed to fetch VLANs" });
    }
  });

  app.post("/api/vlans", async (req, res) => {
    try {
      const validatedData = insertVlanSchema.parse(req.body);
      const vlan = await storage.createVlan(validatedData);
      res.status(201).json(vlan);
    } catch (error) {
      console.error("Error creating VLAN:", error);
      res.status(400).json({ error: "Failed to create VLAN" });
    }
  });

  app.put("/api/vlans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertVlanSchema.parse(req.body);
      const vlan = await storage.updateVlan(id, validatedData);
      res.json(vlan);
    } catch (error) {
      console.error("Error updating VLAN:", error);
      res.status(400).json({ error: "Failed to update VLAN" });
    }
  });

  app.delete("/api/vlans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteVlan(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting VLAN:", error);
      res.status(400).json({ error: "Failed to delete VLAN" });
    }
  });

  // Subnets
  app.get("/api/subnets", async (req, res) => {
    try {
      const subnets = await storage.getAllSubnets();
      res.json(subnets);
    } catch (error) {
      console.error("Error fetching subnets:", error);
      res.status(500).json({ error: "Failed to fetch subnets" });
    }
  });

  app.post("/api/subnets", async (req, res) => {
    try {
      const validatedData = insertSubnetSchema.parse(req.body);
      const subnet = await storage.createSubnet(validatedData);
      res.status(201).json(subnet);
    } catch (error) {
      console.error("Error creating subnet:", error);
      res.status(400).json({ error: "Failed to create subnet" });
    }
  });

  app.put("/api/subnets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertSubnetSchema.parse(req.body);
      const subnet = await storage.updateSubnet(id, validatedData);
      res.json(subnet);
    } catch (error) {
      console.error("Error updating subnet:", error);
      res.status(400).json({ error: "Failed to update subnet" });
    }
  });

  app.delete("/api/subnets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
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

  // Subnet utilization for dashboard
  app.get("/api/dashboard/subnet-utilization", async (req, res) => {
    try {
      const subnets = await storage.getAllSubnets();
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

  // Devices
  app.get("/api/devices", async (req, res) => {
    try {
      const { search, vlan, subnet, status, page = "1", limit = "50", sortBy, sortOrder } = req.query;
      const filters = {
        search: search ? search as string : undefined,
        vlan: vlan ? vlan as string : undefined,
        subnet: subnet ? subnet as string : undefined,
        status: status ? status as string : undefined,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        sortBy: sortBy ? sortBy as string : undefined,
        sortOrder: (sortOrder === 'asc' || sortOrder === 'desc') ? sortOrder as 'asc' | 'desc' : undefined,
      };
      
      console.log("Device query filters:", filters);
      const devices = await storage.getDevices(filters);
      console.log(`Returned ${devices.data.length} devices out of ${devices.total} total`);
      console.log("Sample device IPs:", devices.data.slice(0, 5).map(d => `${d.id}:${d.ipAddress}:subnet${d.subnetId}`));
      
      // Set proper headers for large JSON responses
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.json(devices);
    } catch (error) {
      console.error("Error fetching devices:", error);
      res.status(500).json({ error: "Failed to fetch devices" });
    }
  });

  app.post("/api/devices", async (req, res) => {
    try {
      const validatedData = insertDeviceSchema.parse(req.body);
      const device = await storage.createDevice(validatedData);
      res.status(201).json(device);
    } catch (error) {
      console.error("Error creating device:", error);
      res.status(400).json({ error: "Failed to create device" });
    }
  });

  app.put("/api/devices/:id", async (req, res) => {
    try {
      const deviceId = parseInt(req.params.id);
      const validatedData = insertDeviceSchema.partial().parse(req.body);
      const device = await storage.updateDevice(deviceId, validatedData);
      res.json(device);
    } catch (error) {
      console.error("Error updating device:", error);
      res.status(400).json({ error: "Failed to update device" });
    }
  });

  app.delete("/api/devices/:id", async (req, res) => {
    try {
      const deviceId = parseInt(req.params.id);
      await storage.deleteDevice(deviceId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting device:", error);
      res.status(500).json({ error: "Failed to delete device" });
    }
  });

  // Get all devices for dashboard calculations (no pagination)
  app.get("/api/devices/all", async (req, res) => {
    try {
      const devices = await storage.getAllDevicesForExport();
      res.json({ data: devices });
    } catch (error) {
      console.error("Error fetching all devices:", error);
      res.status(500).json({ error: "Failed to fetch devices" });
    }
  });



  // Network scanning
  app.post("/api/network/scan", async (req, res) => {
    try {
      const { subnetIds } = req.body;
      console.log("Received scan request with subnetIds:", subnetIds);
      
      // Ensure subnetIds is an array
      const validSubnetIds = Array.isArray(subnetIds) ? subnetIds : [];
      console.log("Processing scan with subnet IDs:", validSubnetIds);
      
      const scanId = await networkScanner.startScan(validSubnetIds);
      res.json({ scanId, status: "started" });
    } catch (error) {
      console.error("Error starting network scan:", error);
      res.status(500).json({ error: "Failed to start network scan" });
    }
  });

  app.get("/api/network/scan/:id", async (req, res) => {
    try {
      const scanId = parseInt(req.params.id);
      const scan = await storage.getNetworkScan(scanId);
      res.json(scan);
    } catch (error) {
      console.error("Error fetching network scan:", error);
      res.status(500).json({ error: "Failed to fetch network scan" });
    }
  });

  app.get("/api/network/scan", async (req, res) => {
    try {
      const status = networkScanner.getScanStatus();
      res.json(status);
    } catch (error) {
      console.error("Error getting network scan status:", error);
      res.status(500).json({ error: "Failed to get scan status" });
    }
  });

  app.post("/api/network/scan/stop", async (req, res) => {
    try {
      console.log("Stop scan request received");
      networkScanner.stopScan();
      res.json({ success: true, message: "Scan stopped" });
    } catch (error) {
      console.error("Error stopping network scan:", error);
      res.status(500).json({ error: "Failed to stop network scan" });
    }
  });

  app.post("/api/network/fix-subnets", async (req, res) => {
    try {
      console.log("Manual fix requested for device subnet assignments");
      const result = await networkScanner.fixExistingDeviceSubnets();
      res.json(result);
    } catch (error) {
      console.error("Error fixing device subnet assignments:", error);
      res.status(500).json({ error: "Failed to fix device subnet assignments" });
    }
  });

  app.post("/api/devices/:id/ping", async (req, res) => {
    try {
      const deviceId = parseInt(req.params.id);
      const device = await storage.getDevice(deviceId);
      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }
      
      const pingResult = await networkScanner.pingDevice(device.ipAddress);
      res.json(pingResult);
    } catch (error) {
      console.error("Error pinging device:", error);
      res.status(500).json({ error: "Failed to ping device" });
    }
  });

  // Activity logs
  app.get("/api/activity", async (req, res) => {
    try {
      const { limit = "20" } = req.query;
      const activities = await storage.getRecentActivity(parseInt(limit as string));
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  // Export
  app.get("/api/export/devices", async (req, res) => {
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
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
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

  app.put("/api/settings/:key", async (req, res) => {
    try {
      const { key } = req.params;
      const { value, description } = req.body;
      const setting = await storage.setSetting(key, value, description);
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

  // Authentication endpoints
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      
      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== password) {
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

  // User management endpoints
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
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

  app.post("/api/users", async (req, res) => {
    try {
      const { username, password, role = "viewer" } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      
      const user = await storage.createUser({
        username,
        password,
        role,
        isActive: true
      });
      
      res.status(201).json(user);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(400).json({ error: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { username, password, role, isActive } = req.body;
      
      const user = await storage.updateUser(userId, {
        username,
        password,
        role,
        isActive
      });
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(400).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      await storage.deleteUser(userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // User permissions endpoints
  app.get("/api/user-permissions/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const permissions = await storage.getUserPermissions(userId);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ error: "Failed to fetch user permissions" });
    }
  });

  app.post("/api/user-permissions", async (req, res) => {
    try {
      const { userId, permissions } = req.body;
      
      if (!userId || !permissions || !Array.isArray(permissions)) {
        return res.status(400).json({ error: "User ID and permissions array are required" });
      }
      
      // Delete existing permissions for this user
      await storage.deleteUserPermissions(userId);
      
      // Create new permissions
      const createdPermissions = [];
      for (const perm of permissions) {
        if (!perm.permission) continue;
        
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
