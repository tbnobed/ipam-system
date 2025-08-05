import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Header from "@/components/layout/header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

interface SettingsState {
  scan_interval: string;
  ping_timeout: string;
  auto_discovery: boolean;
  port_scanning: boolean;
  device_alerts: boolean;
  subnet_alerts: boolean;
  alert_threshold: string;
  data_retention: string;
}

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isResetting, setIsResetting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch all settings
  const { data: settingsData = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/settings'],
  });

  // Convert settings array to object for easier form handling
  const settingsMap = (settingsData as any[]).reduce((acc: any, setting: any) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});

  // Local state for form values
  const [settings, setSettings] = useState<SettingsState>({
    scan_interval: '5',
    ping_timeout: '2',
    auto_discovery: true,
    port_scanning: false,
    device_alerts: true,
    subnet_alerts: true,
    alert_threshold: '90',
    data_retention: '90',
  });

  // Update local state when settings are loaded
  useEffect(() => {
    if ((settingsData as any[]).length > 0) {
      const newSettings = {
        scan_interval: settingsMap.scan_interval || '5',
        ping_timeout: settingsMap.ping_timeout || '2',
        auto_discovery: settingsMap.auto_discovery === 'true',
        port_scanning: settingsMap.port_scanning === 'true',
        device_alerts: settingsMap.device_alerts === 'true',
        subnet_alerts: settingsMap.subnet_alerts === 'true',
        alert_threshold: settingsMap.alert_threshold || '90',
        data_retention: settingsMap.data_retention || '90',
      };
      console.log('Loading settings from server:', newSettings);
      setSettings(newSettings);
    }
  }, [settingsData]);

  // Update a single setting
  const updateSetting = async (key: string, value: string) => {
    try {
      await apiRequest(`/api/settings/${key}`, 'PUT', { value });
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    } catch (error) {
      console.error(`Error updating ${key}:`, error);
      throw error;
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    console.log('=== SAVING SETTINGS ===');
    console.log('Current settings:', settings);
    
    try {
      // Update each setting
      const updates = [
        { key: 'scan_interval', value: settings.scan_interval },
        { key: 'ping_timeout', value: settings.ping_timeout },
        { key: 'auto_discovery', value: settings.auto_discovery.toString() },
        { key: 'port_scanning', value: settings.port_scanning.toString() },
        { key: 'device_alerts', value: settings.device_alerts.toString() },
        { key: 'subnet_alerts', value: settings.subnet_alerts.toString() },
        { key: 'alert_threshold', value: settings.alert_threshold },
        { key: 'data_retention', value: settings.data_retention },
      ];

      console.log('Updating settings with:', updates);
      await Promise.all(updates.map(update => updateSetting(update.key, update.value)));

      console.log('Settings updated successfully');
      toast({
        title: "Settings Updated",
        description: "System settings have been saved successfully.",
      });
      
    } catch (error) {
      console.error('Settings update error:', error);
      toast({
        title: "Error",
        description: `Failed to update settings: ${error}`,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = async () => {
    setIsResetting(true);
    try {
      const defaultSettings = {
        scan_interval: '5',
        ping_timeout: '2',
        auto_discovery: true,
        port_scanning: false,
        device_alerts: true,
        subnet_alerts: true,
        alert_threshold: '90',
        data_retention: '90',
      };

      const updates = [
        { key: 'scan_interval', value: '5' },
        { key: 'ping_timeout', value: '2' },
        { key: 'auto_discovery', value: 'true' },
        { key: 'port_scanning', value: 'false' },
        { key: 'device_alerts', value: 'true' },
        { key: 'subnet_alerts', value: 'true' },
        { key: 'alert_threshold', value: '90' },
        { key: 'data_retention', value: '90' },
      ];

      await Promise.all(updates.map(update => updateSetting(update.key, update.value)));
      setSettings(defaultSettings);

      toast({
        title: "Settings Reset",
        description: "All settings have been reset to default values.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const clearHistoricalData = async () => {
    try {
      await apiRequest("/api/clear-historical-data", "POST");
      toast({
        title: "Data Cleared",
        description: "Historical data has been cleared successfully.",
      });
    } catch (error) {
      console.error('Clear data error:', error);
      toast({
        title: "Error",
        description: "Failed to clear historical data.",
        variant: "destructive",
      });
    }
  };

  const exportAllData = async () => {
    try {
      const response = await apiRequest("/api/export", "GET");
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ipam-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Export Complete",
        description: "Data has been exported successfully.",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Error",
        description: "Failed to export data.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <>
        <Header
          title="System Settings"
          subtitle="Configure network scanning and monitoring preferences"
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl">
            <div className="animate-pulse space-y-6">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
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
                    <Label htmlFor="scan_interval">Scan Interval (minutes)</Label>
                    <Input
                      id="scan_interval"
                      type="number"
                      min={1}
                      max={60}
                      value={settings.scan_interval}
                      onChange={(e) => setSettings(prev => ({ ...prev, scan_interval: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ping_timeout">Ping Timeout (seconds)</Label>
                    <Input
                      id="ping_timeout"
                      type="number"
                      min={1}
                      max={10}
                      value={settings.ping_timeout}
                      onChange={(e) => setSettings(prev => ({ ...prev, ping_timeout: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={settings.auto_discovery}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, auto_discovery: checked }))}
                  />
                  <Label>Enable automatic device discovery</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={settings.port_scanning}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, port_scanning: checked }))}
                  />
                  <Label>Scan common ports during discovery</Label>
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
                    checked={settings.device_alerts}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, device_alerts: checked }))}
                  />
                  <Label>Alert when devices go offline</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={settings.subnet_alerts}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, subnet_alerts: checked }))}
                  />
                  <Label>Alert when subnet utilization exceeds threshold</Label>
                </div>
                
                <div>
                  <Label htmlFor="alert_threshold">Utilization Alert Threshold (%)</Label>
                  <Input
                    id="alert_threshold"
                    type="number"
                    min={50}
                    max={100}
                    value={settings.alert_threshold}
                    onChange={(e) => setSettings(prev => ({ ...prev, alert_threshold: e.target.value }))}
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
                    <Input id="username" value="admin" disabled />
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select defaultValue="admin">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrator</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Button variant="outline" type="button">
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
                  <Button variant="outline" type="button" onClick={exportAllData}>
                    Export All Data
                  </Button>
                  <Button variant="outline" type="button">
                    Import Configuration
                  </Button>
                </div>
                
                <div>
                  <Label htmlFor="data_retention">Data Retention Period (days)</Label>
                  <Input
                    id="data_retention"
                    type="number"
                    min={30}
                    max={365}
                    value={settings.data_retention}
                    onChange={(e) => setSettings(prev => ({ ...prev, data_retention: e.target.value }))}
                  />
                </div>
                
                <Button 
                  variant="destructive" 
                  type="button"
                  onClick={clearHistoricalData}
                >
                  Clear Historical Data
                </Button>
              </CardContent>
            </Card>

            {/* Save Settings */}
            <div className="flex justify-end space-x-4">
              <Button 
                variant="outline" 
                type="button"
                onClick={resetToDefaults}
                disabled={isResetting}
              >
                {isResetting ? "Resetting..." : "Reset to Defaults"}
              </Button>
              <Button 
                onClick={handleSaveSettings}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
        </div>
      </main>
    </>
  );
}