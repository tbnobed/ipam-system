import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Settings() {
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
                    defaultValue={5}
                    min={1}
                    max={60}
                  />
                </div>
                <div>
                  <Label htmlFor="ping-timeout">Ping Timeout (seconds)</Label>
                  <Input
                    id="ping-timeout"
                    type="number"
                    defaultValue={2}
                    min={1}
                    max={10}
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch id="auto-discovery" />
                <Label htmlFor="auto-discovery">
                  Enable automatic device discovery
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch id="port-scanning" />
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
                <Switch id="device-alerts" />
                <Label htmlFor="device-alerts">
                  Alert when devices go offline
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch id="subnet-alerts" />
                <Label htmlFor="subnet-alerts">
                  Alert when subnet utilization exceeds threshold
                </Label>
              </div>
              
              <div>
                <Label htmlFor="alert-threshold">Utilization Alert Threshold (%)</Label>
                <Input
                  id="alert-threshold"
                  type="number"
                  defaultValue={90}
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
              
              <Button variant="outline">
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
                <Button variant="outline">
                  Export All Data
                </Button>
                <Button variant="outline">
                  Import Configuration
                </Button>
              </div>
              
              <div>
                <Label htmlFor="retention">Data Retention Period (days)</Label>
                <Input
                  id="retention"
                  type="number"
                  defaultValue={90}
                  min={30}
                  max={365}
                />
              </div>
              
              <Button variant="destructive">
                Clear Historical Data
              </Button>
            </CardContent>
          </Card>

          {/* Save Settings */}
          <div className="flex justify-end space-x-4">
            <Button variant="outline">
              Reset to Defaults
            </Button>
            <Button>
              Save Settings
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
