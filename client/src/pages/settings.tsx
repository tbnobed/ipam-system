import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";

interface Setting {
  id: number;
  key: string;
  value: string;
  description?: string;
  updatedAt: string;
}

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // State for all settings
  const [scanInterval, setScanInterval] = useState("5");
  const [pingTimeout, setPingTimeout] = useState("2");
  const [autoDiscovery, setAutoDiscovery] = useState(true);
  const [portScanning, setPortScanning] = useState(false);
  const [deviceAlerts, setDeviceAlerts] = useState(true);
  const [subnetAlerts, setSubnetAlerts] = useState(true);
  const [alertThreshold, setAlertThreshold] = useState("90");
  const [dataRetention, setDataRetention] = useState("90");

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/settings"],
  });

  // Load settings into state when data is fetched
  useEffect(() => {
    if (settings && Array.isArray(settings)) {
      const settingsMap = settings.reduce((acc: Record<string, string>, setting: Setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {});

      setScanInterval(settingsMap.scan_interval || "5");
      setPingTimeout(settingsMap.ping_timeout || "2");
      setAutoDiscovery(settingsMap.auto_discovery === "true");
      setPortScanning(settingsMap.port_scanning === "true");
      setDeviceAlerts(settingsMap.device_alerts === "true");
      setSubnetAlerts(settingsMap.subnet_alerts === "true");
      setAlertThreshold(settingsMap.alert_threshold || "90");
      setDataRetention(settingsMap.data_retention || "90");
    }
  }, [settings]);

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (settingsToSave: Array<{ key: string; value: string; description?: string }>) => {
      const promises = settingsToSave.map(setting =>
        apiRequest(`/api/settings/${setting.key}`, "PUT", { 
          value: setting.value, 
          description: setting.description 
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings saved",
        description: "Your settings have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Export data mutation
  const exportDataMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/export", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `ipam-export-${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "Export successful",
        description: "Your data has been exported successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Clear historical data mutation
  const clearDataMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/clear-historical-data", "POST");
    },
    onSuccess: () => {
      toast({
        title: "Data cleared",
        description: "Historical data has been cleared successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear historical data. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveSettings = () => {
    const settingsToSave = [
      { key: "scan_interval", value: scanInterval, description: "Network scan interval in minutes" },
      { key: "ping_timeout", value: pingTimeout, description: "Ping timeout in seconds" },
      { key: "auto_discovery", value: autoDiscovery.toString(), description: "Enable automatic device discovery" },
      { key: "port_scanning", value: portScanning.toString(), description: "Scan common ports during discovery" },
      { key: "device_alerts", value: deviceAlerts.toString(), description: "Alert when devices go offline" },
      { key: "subnet_alerts", value: subnetAlerts.toString(), description: "Alert when subnet utilization exceeds threshold" },
      { key: "alert_threshold", value: alertThreshold, description: "Utilization alert threshold percentage" },
      { key: "data_retention", value: dataRetention, description: "Data retention period in days" },
    ];

    saveSettingsMutation.mutate(settingsToSave);
  };

  const handleResetToDefaults = () => {
    setScanInterval("5");
    setPingTimeout("2");
    setAutoDiscovery(true);
    setPortScanning(false);
    setDeviceAlerts(true);
    setSubnetAlerts(true);
    setAlertThreshold("90");
    setDataRetention("90");
  };

  if (isLoading) {
    return (
      <>
        <Header
          title="System Settings"
          subtitle="Configure network scanning and monitoring preferences"
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex justify-center items-center h-64">
            <div className="text-lg">Loading settings...</div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header
        title="System Settings"
        subtitle="Configure network scanning and monitoring preferences"
      />
      
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl space-y-6">
          {/* Scanning Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Network Scanning</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="scan-interval">Scan Interval (minutes)</Label>
                  <Input
                    id="scan-interval"
                    type="number"
                    value={scanInterval}
                    onChange={(e) => setScanInterval(e.target.value)}
                    min={1}
                    max={60}
                  />
                </div>
                <div>
                  <Label htmlFor="ping-timeout">Ping Timeout (seconds)</Label>
                  <Input
                    id="ping-timeout"
                    type="number"
                    value={pingTimeout}
                    onChange={(e) => setPingTimeout(e.target.value)}
                    min={1}
                    max={10}
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch 
                  id="auto-discovery" 
                  checked={autoDiscovery}
                  onCheckedChange={setAutoDiscovery}
                />
                <Label htmlFor="auto-discovery">
                  Enable automatic device discovery
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch 
                  id="port-scanning" 
                  checked={portScanning}
                  onCheckedChange={setPortScanning}
                />
                <Label htmlFor="port-scanning">
                  Scan common ports during discovery
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch 
                  id="device-alerts" 
                  checked={deviceAlerts}
                  onCheckedChange={setDeviceAlerts}
                />
                <Label htmlFor="device-alerts">
                  Alert when devices go offline
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch 
                  id="subnet-alerts" 
                  checked={subnetAlerts}
                  onCheckedChange={setSubnetAlerts}
                />
                <Label htmlFor="subnet-alerts">
                  Alert when subnet utilization exceeds threshold
                </Label>
              </div>
              
              <div>
                <Label htmlFor="alert-threshold">Utilization Alert Threshold (%)</Label>
                <Input
                  id="alert-threshold"
                  type="number"
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(e.target.value)}
                  min={50}
                  max={100}
                />
              </div>
            </CardContent>
          </Card>

          {/* User Management */}
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="username">Current User</Label>
                  <Input id="username" value={user?.username || "Unknown"} disabled />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={user?.role || "viewer"} disabled>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrator</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Button variant="outline" disabled>
                Change Password
              </Button>
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <Button 
                  variant="outline"
                  onClick={() => exportDataMutation.mutate()}
                  disabled={exportDataMutation.isPending}
                >
                  {exportDataMutation.isPending ? "Exporting..." : "Export All Data"}
                </Button>
                <Button variant="outline" disabled>
                  Import Configuration
                </Button>
              </div>
              
              <div>
                <Label htmlFor="retention">Data Retention Period (days)</Label>
                <Input
                  id="retention"
                  type="number"
                  value={dataRetention}
                  onChange={(e) => setDataRetention(e.target.value)}
                  min={30}
                  max={365}
                />
              </div>
              
              <Button 
                variant="destructive"
                onClick={() => {
                  if (window.confirm("Are you sure you want to clear all historical data? This action cannot be undone.")) {
                    clearDataMutation.mutate();
                  }
                }}
                disabled={clearDataMutation.isPending}
              >
                {clearDataMutation.isPending ? "Clearing..." : "Clear Historical Data"}
              </Button>
            </CardContent>
          </Card>

          {/* Save Settings */}
          <div className="flex justify-end space-x-4">
            <Button variant="outline" onClick={handleResetToDefaults}>
              Reset to Defaults
            </Button>
            <Button 
              onClick={handleSaveSettings}
              disabled={saveSettingsMutation.isPending}
            >
              {saveSettingsMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
