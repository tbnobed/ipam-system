import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Square, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { NetworkScanResult } from "@/lib/types";
import type { Subnet } from "@shared/schema";

export default function Discovery() {
  const { toast } = useToast();
  const [selectedSubnet, setSelectedSubnet] = useState<string>("");
  const [activeScan, setActiveScan] = useState<number | null>(null);

  const { data: subnets } = useQuery<Subnet[]>({
    queryKey: ['/api/subnets'],
  });

  const { data: scanResult, refetch: refetchScan } = useQuery<NetworkScanResult>({
    queryKey: ['/api/network/scan', activeScan],
    enabled: !!activeScan,
    refetchInterval: activeScan ? 2000 : false,
  });

  const handleStartScan = async () => {
    try {
      const subnetIds = selectedSubnet ? [parseInt(selectedSubnet)] : [];
      const response = await apiRequest('/api/network/scan', 'POST', { subnetIds });
      const result = await response.json();
      
      setActiveScan(result.scanId);
      toast({
        title: "Network Scan Started",
        description: `Scanning ${selectedSubnet ? 'selected subnet' : 'all subnets'}...`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start network scan",
        variant: "destructive",
      });
    }
  };

  const handleStopScan = () => {
    setActiveScan(null);
    toast({
      title: "Scan Stopped",
      description: "Network scan has been stopped",
    });
  };

  const getScanProgress = () => {
    if (!scanResult) return 0;
    
    if (scanResult.status === 'completed') return 100;
    if (scanResult.status === 'failed') return 0;
    
    // For running scans, estimate progress based on time elapsed
    const startTime = new Date(scanResult.startTime).getTime();
    const elapsed = Date.now() - startTime;
    const estimatedTotal = 5 * 60 * 1000; // 5 minutes estimated
    
    return Math.min(90, (elapsed / estimatedTotal) * 100);
  };

  return (
    <>
      <Header
        title="Network Discovery"
        subtitle="Discover and scan devices across your network"
      />
      
      <main className="flex-1 overflow-y-auto p-6">
        {/* Scan Controls */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Network Scanning</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex-1">
                <Select value={selectedSubnet} onValueChange={setSelectedSubnet}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subnet to scan (or leave empty for all)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subnets</SelectItem>
                    {subnets?.map((subnet) => (
                      <SelectItem key={subnet.id} value={subnet.id.toString()}>
                        {subnet.network} - {subnet.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex space-x-2">
                {activeScan ? (
                  <Button onClick={handleStopScan} variant="destructive">
                    <Square className="w-4 h-4 mr-2" />
                    Stop Scan
                  </Button>
                ) : (
                  <Button onClick={handleStartScan}>
                    <Play className="w-4 h-4 mr-2" />
                    Start Scan
                  </Button>
                )}
                <Button variant="outline" onClick={() => refetchScan()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Scan Progress */}
            {activeScan && scanResult && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Scan Progress</span>
                  <Badge variant={
                    scanResult.status === 'completed' ? 'default' :
                    scanResult.status === 'failed' ? 'destructive' : 'secondary'
                  }>
                    {scanResult.status}
                  </Badge>
                </div>
                <Progress value={getScanProgress()} className="h-2" />
                <div className="text-sm text-gray-600">
                  Devices found: {scanResult.devicesFound}
                  {scanResult.endTime && (
                    <span className="ml-4">
                      Completed: {new Date(scanResult.endTime).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scan Results */}
        {scanResult && scanResult.results && (
          <Card>
            <CardHeader>
              <CardTitle>Discovered Devices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.isArray(scanResult.results) && scanResult.results.map((device: any, index: number) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-4">
                        <span className="font-mono text-sm font-medium">
                          {device.ipAddress}
                        </span>
                        <Badge variant={device.isAlive ? 'default' : 'secondary'}>
                          {device.isAlive ? 'Online' : 'Offline'}
                        </Badge>
                      </div>
                      <Button size="sm" variant="outline">
                        Add to Inventory
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Hostname: </span>
                        {device.hostname || 'Unknown'}
                      </div>
                      <div>
                        <span className="font-medium">MAC: </span>
                        <span className="font-mono">{device.macAddress || 'Unknown'}</span>
                      </div>
                      <div>
                        <span className="font-medium">Vendor: </span>
                        {device.vendor || 'Unknown'}
                      </div>
                      <div>
                        <span className="font-medium">Open Ports: </span>
                        {device.openPorts?.join(', ') || 'None detected'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
