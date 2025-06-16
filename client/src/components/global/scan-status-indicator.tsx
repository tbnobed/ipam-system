import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Globe, Wifi, ChevronDown, ChevronUp, Square, Eye } from 'lucide-react';
import { useNetworkScan } from '@/hooks/use-network-scan';

export default function ScanStatusIndicator() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const {
    isScanning,
    currentScanId,
    progress,
    foundDevices,
    currentSubnet,
    connectionStatus,
    scanProgress,
    stopScan
  } = useNetworkScan();

  // Don't render if no active scan
  if (!isScanning && !currentScanId) {
    return null;
  }

  return (
    <>
      {/* Floating scan status indicator */}
      <div className="fixed bottom-4 right-4 z-50 max-w-sm">
        <Card className="shadow-lg border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Globe className={`w-4 h-4 ${isScanning ? 'animate-spin text-blue-600' : 'text-gray-400'}`} />
                <span className="font-medium text-sm">Network Scan</span>
                <Badge variant={isScanning ? 'default' : 'secondary'}>
                  {isScanning ? 'Running' : 'Completed'}
                </Badge>
              </div>
              <div className="flex items-center space-x-1">
                <Wifi className={`w-3 h-3 ${
                  connectionStatus === 'connected' ? 'text-green-600' : 
                  connectionStatus === 'connecting' ? 'text-yellow-600' : 'text-red-600'
                }`} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="h-6 w-6 p-0"
                >
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                </Button>
              </div>
            </div>

            {isExpanded && (
              <div className="space-y-3">
                <Progress value={scanProgress} className="h-2" />
                
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>
                    <span className="font-medium">Progress: </span>
                    {progress.total > 0 ? (
                      `${progress.current} / ${progress.total}`
                    ) : (
                      `${scanProgress}%`
                    )}
                  </div>
                  <div>
                    <span className="font-medium">Found: </span>
                    {foundDevices.length}
                  </div>
                </div>

                {currentSubnet && (
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">Scanning: </span>
                    {currentSubnet}
                  </div>
                )}

                {progress.currentIP && (
                  <div className="text-xs text-gray-500">
                    <Globe className="w-3 h-3 inline mr-1" />
                    {progress.currentIP}
                  </div>
                )}

                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDetails(true)}
                    className="flex-1 text-xs"
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    Details
                  </Button>
                  {isScanning && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={stopScan}
                      className="flex-1 text-xs"
                    >
                      <Square className="w-3 h-3 mr-1" />
                      Stop
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed scan dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className={`w-5 h-5 ${isScanning ? 'animate-spin text-blue-600' : 'text-gray-400'}`} />
              Network Scan Details
              {currentScanId && (
                <Badge variant="outline" className="text-xs">
                  ID: {currentScanId}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Progress section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Scan Progress</span>
                <Badge variant={isScanning ? 'default' : 'secondary'}>
                  {isScanning ? 'Running' : 'Completed'}
                </Badge>
              </div>
              <Progress value={scanProgress} className="h-3 mb-2" />
              <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Progress: </span>
                  {progress.total > 0 ? (
                    `${progress.current} / ${progress.total} IPs`
                  ) : (
                    `${scanProgress}%`
                  )}
                </div>
                <div>
                  <span className="font-medium">Devices found: </span>
                  {foundDevices.length}
                </div>
                <div>
                  <span className="font-medium">Connection: </span>
                  <span className={
                    connectionStatus === 'connected' ? 'text-green-600' : 
                    connectionStatus === 'connecting' ? 'text-yellow-600' : 'text-red-600'
                  }>
                    {connectionStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* Current activity */}
            {isScanning && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-sm font-medium text-blue-900 mb-1">Current Activity</div>
                {currentSubnet && (
                  <div className="text-sm text-blue-700">
                    Scanning subnet: {currentSubnet}
                  </div>
                )}
                {progress.currentIP && (
                  <div className="text-xs text-blue-600 mt-1">
                    <Globe className="w-3 h-3 inline mr-1" />
                    Currently checking: {progress.currentIP}
                  </div>
                )}
              </div>
            )}

            {/* Recently found devices */}
            {foundDevices.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">
                  Recently Discovered Devices ({foundDevices.length})
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {foundDevices.slice(-10).map((device, index) => (
                    <div key={`${device.ipAddress}-${index}`} className="p-2 bg-gray-50 rounded border-l-2 border-l-green-500">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-medium">{device.ipAddress}</span>
                        <Badge variant={device.isAlive ? 'default' : 'secondary'} className="text-xs">
                          {device.isAlive ? 'Online' : 'Offline'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mt-1">
                        <div>
                          <span className="font-medium">Hostname: </span>
                          {device.hostname || 'Unknown'}
                        </div>
                        <div>
                          <span className="font-medium">Vendor: </span>
                          {device.vendor || 'Unknown'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setShowDetails(false)}>
                Close
              </Button>
              {isScanning && (
                <Button variant="destructive" onClick={stopScan}>
                  <Square className="w-4 h-4 mr-2" />
                  Stop Scan
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}