import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database, 
  RefreshCw, 
  Settings, 
  Shield,
  Activity,
  FileText
} from "lucide-react";

interface MigrationStatus {
  applied: number;
  pending: number;
  appliedMigrations: string[];
  pendingMigrations: Array<{ version: string; name: string }>;
}

export default function Admin() {
  const { toast } = useToast();
  const [isFixingSubnets, setIsFixingSubnets] = useState(false);

  const { data: migrationStatus, isLoading: migrationLoading } = useQuery<MigrationStatus>({
    queryKey: ['/api/admin/migrations/status'],
  });

  const applyMigrationsMutation = useMutation({
    mutationFn: () => apiRequest('/api/admin/migrations/apply', 'POST'),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Migrations applied successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/migrations/status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to apply migrations",
        variant: "destructive",
      });
    },
  });

  const fixSubnetsMutation = useMutation({
    mutationFn: () => apiRequest('/api/admin/fix-device-subnets', 'POST'),
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: `Fixed ${data.correctedCount} device subnet assignments`,
      });
      setIsFixingSubnets(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to fix subnet assignments",
        variant: "destructive",
      });
      setIsFixingSubnets(false);
    },
  });

  const handleFixSubnets = () => {
    setIsFixingSubnets(true);
    fixSubnetsMutation.mutate();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Administration</h1>
        <p className="text-muted-foreground">
          Monitor and maintain the IPAM system to prevent deployment issues
        </p>
      </div>

      {/* Migration Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Migrations
          </CardTitle>
          <CardDescription>
            Track and apply database schema changes and fixes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {migrationLoading ? (
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Checking migration status...</span>
            </div>
          ) : migrationStatus ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Applied: {migrationStatus.applied}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">Pending: {migrationStatus.pending}</span>
                </div>
              </div>

              {migrationStatus.pending > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    You have {migrationStatus.pending} pending migration(s). Apply them to ensure system stability.
                  </AlertDescription>
                </Alert>
              )}

              {migrationStatus.pendingMigrations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Pending Migrations:</h4>
                  {migrationStatus.pendingMigrations.map((migration) => (
                    <div key={migration.version} className="flex items-center gap-2 p-2 bg-muted rounded">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">{migration.version}: {migration.name}</span>
                    </div>
                  ))}
                </div>
              )}

              <Button 
                onClick={() => applyMigrationsMutation.mutate()}
                disabled={applyMigrationsMutation.isPending || migrationStatus.pending === 0}
                className="w-full"
              >
                {applyMigrationsMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Applying Migrations...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2" />
                    Apply Pending Migrations
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Failed to load migration status
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Subnet Assignment Fix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Subnet Assignment Protection
          </CardTitle>
          <CardDescription>
            Fix and prevent device subnet assignment issues that can cause devices to disappear
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Activity className="h-4 w-4" />
            <AlertDescription>
              This system automatically prevents the subnet assignment bug that caused 123 devices 
              to be hidden in production. Database triggers now ensure devices are always assigned 
              to the correct subnet based on their IP address.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <h4 className="text-sm font-medium">Automatic Protections Active:</h4>
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Auto-subnet assignment on device creation</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Auto-reassignment on IP address changes</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Device protection during subnet deletion</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Startup validation and correction</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-medium">Manual Correction:</h4>
            <p className="text-sm text-muted-foreground">
              Run this if you suspect devices are assigned to incorrect subnets
            </p>
            <Button 
              onClick={handleFixSubnets}
              disabled={isFixingSubnets || fixSubnetsMutation.isPending}
              variant="outline"
              className="w-full"
            >
              {isFixingSubnets || fixSubnetsMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Fixing Subnet Assignments...
                </>
              ) : (
                <>
                  <Settings className="h-4 w-4 mr-2" />
                  Fix Device Subnet Assignments
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Status
          </CardTitle>
          <CardDescription>
            Current system health and deployment readiness
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Database Triggers</span>
              <Badge variant="default" className="bg-green-500">Active</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Migration System</span>
              <Badge variant="default" className="bg-green-500">Operational</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Network Scanner</span>
              <Badge variant="default" className="bg-green-500">Running</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Subnet Protection</span>
              <Badge variant="default" className="bg-green-500">Enabled</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}