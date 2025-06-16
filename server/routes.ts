import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertDeviceSchema, insertVlanSchema, insertSubnetSchema } from "@shared/schema";
import { networkScanner } from "./network";
import { migrationManager } from "./migrations";
import { z } from "zod";

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
      const devices = await storage.getAllDevicesForExport();
      const csvData = generateDeviceCSV(devices);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="devices.csv"');
      res.send(csvData);
    } catch (error) {
      console.error("Error exporting devices:", error);
      res.status(500).json({ error: "Failed to export devices" });
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

function generateDeviceCSV(devices: any[]): string {
  const headers = ['IP Address', 'Hostname', 'MAC Address', 'Device Type', 'Location', 'Status', 'Last Seen'];
  const rows = devices.map(device => [
    device.ipAddress,
    device.hostname || '',
    device.macAddress || '',
    device.deviceType || '',
    device.location || '',
    device.status,
    device.lastSeen ? new Date(device.lastSeen).toISOString() : ''
  ]);
  
  return [headers, ...rows].map(row => 
    row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(',')
  ).join('\n');
}
