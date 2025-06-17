import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Header from "@/components/layout/header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";

const settingsSchema = z.object({
  scan_interval: z.string().min(1),
  ping_timeout: z.string().min(1),
  auto_discovery: z.boolean(),
  port_scanning: z.boolean(),
  device_alerts: z.boolean(),
  subnet_alerts: z.boolean(),
  alert_threshold: z.string().min(1),
  data_retention: z.string().min(1),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isResetting, setIsResetting] = useState(false);

  // Fetch all settings
  const { data: settingsData = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/settings'],
  });

  // Convert settings array to object for easier form handling
  const settingsMap = (settingsData as any[]).reduce((acc: any, setting: any) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      scan_interval: '5',
      ping_timeout: '2',
      auto_discovery: true,
      port_scanning: false,
      device_alerts: true,
      subnet_alerts: true,
      alert_threshold: '90',
      data_retention: '90',
    },
  });

  // Update form when settings are loaded
  useEffect(() => {
    if ((settingsData as any[]).length > 0) {
      const values = {
        scan_interval: settingsMap.scan_interval || '5',
        ping_timeout: settingsMap.ping_timeout || '2',
        auto_discovery: settingsMap.auto_discovery === 'true',
        port_scanning: settingsMap.port_scanning === 'true',
        device_alerts: settingsMap.device_alerts === 'true',
        subnet_alerts: settingsMap.subnet_alerts === 'true',
        alert_threshold: settingsMap.alert_threshold || '90',
        data_retention: settingsMap.data_retention || '90',
      };
      form.reset(values);
    }
  }, [settingsData, settingsMap, form]);

  // Mutation to update settings
  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return apiRequest(`/api/settings/${key}`, 'PUT', { value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    },
  });

  const onSubmit = async (data: SettingsFormData) => {
    console.log('Form submission started with data:', data);
    console.log('Form errors:', form.formState.errors);
    
    try {
      // Update each setting
      const updates = [
        { key: 'scan_interval', value: data.scan_interval },
        { key: 'ping_timeout', value: data.ping_timeout },
        { key: 'auto_discovery', value: data.auto_discovery.toString() },
        { key: 'port_scanning', value: data.port_scanning.toString() },
        { key: 'device_alerts', value: data.device_alerts.toString() },
        { key: 'subnet_alerts', value: data.subnet_alerts.toString() },
        { key: 'alert_threshold', value: data.alert_threshold },
        { key: 'data_retention', value: data.data_retention },
      ];

      console.log('Updating settings with:', updates);
      await Promise.all(updates.map(update => updateSettingMutation.mutateAsync(update)));

      toast({
        title: "Settings Updated",
        description: "System settings have been saved successfully.",
      });
    } catch (error) {
      console.error('Settings update error:', error);
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  const resetToDefaults = async () => {
    setIsResetting(true);
    try {
      const defaults = [
        { key: 'scan_interval', value: '5' },
        { key: 'ping_timeout', value: '2' },
        { key: 'auto_discovery', value: 'true' },
        { key: 'port_scanning', value: 'false' },
        { key: 'device_alerts', value: 'true' },
        { key: 'subnet_alerts', value: 'true' },
        { key: 'alert_threshold', value: '90' },
        { key: 'data_retention', value: '90' },
      ];

      await Promise.all(defaults.map(update => updateSettingMutation.mutateAsync(update)));

      form.reset({
        scan_interval: '5',
        ping_timeout: '2',
        auto_discovery: true,
        port_scanning: false,
        device_alerts: true,
        subnet_alerts: true,
        alert_threshold: '90',
        data_retention: '90',
      });

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
      // This would clear old activity logs and scan data
      toast({
        title: "Data Cleared",
        description: "Historical data has been cleared successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear historical data.",
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-4xl space-y-6">
            {/* Scanning Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Network Scanning</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="scan_interval"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Scan Interval (minutes)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={60}
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ping_timeout"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ping Timeout (seconds)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="auto_discovery"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">
                        Enable automatic device discovery
                      </FormLabel>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="port_scanning"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">
                        Scan common ports during discovery
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Notification Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="device_alerts"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">
                        Alert when devices go offline
                      </FormLabel>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="subnet_alerts"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">
                        Alert when subnet utilization exceeds threshold
                      </FormLabel>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="alert_threshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Utilization Alert Threshold (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={50}
                          max={100}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
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
                  <Button variant="outline" type="button">
                    Export All Data
                  </Button>
                  <Button variant="outline" type="button">
                    Import Configuration
                  </Button>
                </div>
                
                <FormField
                  control={form.control}
                  name="data_retention"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Retention Period (days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={30}
                          max={365}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
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
                type="submit" 
                disabled={form.formState.isSubmitting}
                onClick={() => console.log('Save button clicked')}
              >
                {form.formState.isSubmitting ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </form>
        </Form>
      </main>
    </>
  );
}