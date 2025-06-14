import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Square, RefreshCw, Wifi, Globe, CheckCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { NetworkScanResult } from "@/lib/types";
import type { Subnet } from "@shared/schema";
import { useNetworkScanWebSocket } from "@/hooks/use-network-scan-websocket";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function Discovery() {
  const { toast } = useToast();
  const [selectedSubnet, setSelectedSubnet] = useState<string>("");
  const [activeScan, setActiveScan] = useState<number | null>(null);
  
  // WebSocket hook for real-time scan updates
  const {
    scanProgress,
    isScanning: wsIsScanning,
    currentScanId,
    currentSubnet,
    foundDevices,
    scanStatus,
    connectionStatus,
    scanSummary,
    showSummary,
    dismissSummary
  } = useNetworkScanWebSocket();

  const { data: subnets } = useQuery<Subnet[]>({
    queryKey: ['/api/subnets'],
  });

  const { data: scanResult, refetch: refetchScan } = useQuery<NetworkScanResult>({
    queryKey: ['/api/network/scan', activeScan],
    enabled: !!activeScan,
    refetchInterval: activeScan ? 2000 : false,
  });

  // Sync WebSocket scan state with local state
  useEffect(() => {
    if (wsIsScanning && currentScanId && !activeScan) {
      setActiveScan(currentScanId);
    } else if (!wsIsScanning && activeScan) {
      setActiveScan(null);
    }
  }, [wsIsScanning, currentScanId, activeScan]);

  const handleStartScan = async () => {
    try {
      let subnetIds: number[];
      
      if (selectedSubnet) {
        // If a specific subnet is selected, scan only that subnet
        subnetIds = [parseInt(selectedSubnet)];
      } else {
        // If no subnet is selected, scan all available subnets
        subnetIds = subnets?.map(subnet => subnet.id) || [];
      }
      
      const response = await apiRequest('/api/network/scan', 'POST', { subnetIds });
      const result = await response.json();
      
      setActiveScan(result.scanId);
      toast({
        title: "Network Scan Started",
        description: selectedSubnet 
          ? `Scanning selected subnet...` 
          : `Scanning all ${subnetIds.length} subnets...`,
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
    // Use WebSocket progress if available and scan is active
    if (wsIsScanning && scanProgress.total > 0) {
      return (scanProgress.current / scanProgress.total) * 100;
    }
    
    // Fallback to legacy scan result estimation
    if (!scanResult) return 0;
    
    if (scanResult.status === 'completed') return 100;
    if (scanResult.status === 'failed') return 0;
    
    // For running scans, estimate progress based on time elapsed
    const startTime = new Date(scanResult.startTime).getTime();
    const elapsed = Date.now() - startTime;
    const estimatedTotal = 5 * 60 * 1000; // 5 minutes estimated
    
    return Math.min(90, (elapsed / estimatedTotal) * 100);
  };

  const getDisplayedDevices = () => {
    // Use real-time WebSocket devices if scanning
    if (wsIsScanning && foundDevices.length > 0) {
      return foundDevices;
    }
    
    // Fallback to scan result devices
    if (scanResult?.results && Array.isArray(scanResult.results)) {
      return scanResult.results;
    }
    
    return [];
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
              <div className="flex items-center space-x-2">
                {/* WebSocket Connection Status */}
                <div className="flex items-center space-x-1">
                  <Wifi className={`w-4 h-4 ${
                    connectionStatus === 'connected' ? 'text-green-600' : 
                    connectionStatus === 'connecting' ? 'text-yellow-600' : 'text-red-600'
                  }`} />
                  <span className="text-xs text-gray-500">
                    {connectionStatus === 'connected' ? 'Live' : 
                     connectionStatus === 'connecting' ? 'Connecting' : 'Offline'}
                  </span>
                </div>
                {activeScan || wsIsScanning ? (
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
            {(activeScan || wsIsScanning) && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Scan Progress</span>
                  <div className="flex items-center space-x-2">
                    <Badge variant={
                      wsIsScanning ? 'secondary' :
                      scanResult?.status === 'completed' ? 'default' :
                      scanResult?.status === 'failed' ? 'destructive' : 'secondary'
                    }>
                      {wsIsScanning ? 'Running' : scanResult?.status || 'Unknown'}
                    </Badge>
                    {wsIsScanning && currentScanId && (
                      <span className="text-xs text-gray-500">ID: {currentScanId}</span>
                    )}
                  </div>
                </div>
                <Progress value={getScanProgress()} className="h-2" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Progress: </span>
                    {wsIsScanning && scanProgress.total > 0 ? (
                      `${scanProgress.current} / ${scanProgress.total} IPs`
                    ) : (
                      `${Math.round(getScanProgress())}%`
                    )}
                  </div>
                  <div>
                    <span className="font-medium">Devices found: </span>
                    {wsIsScanning ? foundDevices.length : (scanResult?.devicesFound || 0)}
                  </div>
                  <div>
                    {currentSubnet ? (
                      <>
                        <span className="font-medium">Scanning: </span>
                        {currentSubnet}
                      </>
                    ) : scanResult?.endTime ? (
                      <>
                        <span className="font-medium">Completed: </span>
                        {new Date(scanResult.endTime).toLocaleString()}
                      </>
                    ) : null}
                  </div>
                </div>
                {wsIsScanning && scanProgress.currentIP && (
                  <div className="text-xs text-gray-500">
                    <Globe className="w-3 h-3 inline mr-1" />
                    Currently scanning: {scanProgress.currentIP}
                  </div>
                )}
                {scanStatus && scanStatus !== 'scanning_subnet' && (
                  <div className="text-xs text-blue-600">
                    Status: {scanStatus.replace(/_/g, ' ')}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scan Results */}
        {(getDisplayedDevices().length > 0 || (activeScan || wsIsScanning)) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Discovered Devices</span>
                {wsIsScanning && foundDevices.length > 0 && (
                  <Badge variant="secondary" className="animate-pulse">
                    Live Results
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {getDisplayedDevices().length > 0 ? (
                <div className="space-y-4">
                  {getDisplayedDevices().map((device: any, index: number) => (
                    <div key={`${device.ipAddress}-${index}`} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-4">
                          <span className="font-mono text-sm font-medium">
                            {device.ipAddress}
                          </span>
                          <Badge variant={device.isAlive ? 'default' : 'secondary'}>
                            {device.isAlive ? 'Online' : 'Offline'}
                          </Badge>
                          {wsIsScanning && foundDevices.includes(device) && (
                            <Badge variant="outline" className="text-xs">
                              Just Found
                            </Badge>
                          )}
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
              ) : (wsIsScanning || activeScan) ? (
                <div className="text-center py-8 text-gray-500">
                  <Globe className="w-8 h-8 mx-auto mb-2 animate-spin" />
                  <p>Scanning network for devices...</p>
                  {currentSubnet && (
                    <p className="text-sm mt-1">Currently scanning: {currentSubnet}</p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No devices discovered yet. Start a scan to find devices on your network.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Scan Completion Summary Dialog */}
        <Dialog open={showSummary} onOpenChange={(open) => !open && dismissSummary()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Network Scan Complete
              </DialogTitle>
              <DialogDescription>
                Scan finished successfully. Here's what was discovered on your network.
              </DialogDescription>
            </DialogHeader>
            {scanSummary && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{scanSummary.onlineDevices}</div>
                    <div className="text-sm text-gray-600">Online Devices</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">{scanSummary.subnetsScanned}</div>
                    <div className="text-sm text-gray-600">Subnets Scanned</div>
                  </div>
                </div>
                
                {Object.keys(scanSummary.vendorBreakdown).length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Devices by Vendor:</h4>
                    <div className="space-y-1">
                      {Object.entries(scanSummary.vendorBreakdown).map(([vendor, count]) => (
                        <div key={vendor} className="flex justify-between text-sm">
                          <span>{vendor}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Object.keys(scanSummary.deviceTypeBreakdown).length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Devices by Type:</h4>
                    <div className="space-y-1">
                      {Object.entries(scanSummary.deviceTypeBreakdown).map(([type, count]) => (
                        <div key={type} className="flex justify-between text-sm">
                          <span>{type}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-500 text-center">
                  Scan completed at {new Date(scanSummary.timestamp).toLocaleString()}
                </div>
                
                <Button onClick={dismissSummary} className="w-full">
                  Close Summary
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}
