import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Globe, ChevronDown, ChevronUp, Square } from 'lucide-react';

export default function ScanStatusIndicator() {
  const [isExpanded, setIsExpanded] = useState(false);

  // Query for scan status
  const { data: scanStatus } = useQuery({
    queryKey: ['/api/network/scan'],
    refetchInterval: 5000,
  });

  const isScanning = scanStatus && typeof scanStatus === 'object' && (scanStatus as any).isActive;

  const stopScan = async () => {
    try {
      await fetch('/api/network/scan/stop', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Failed to stop scan:', error);
    }
  };

  // Don't render if no active scan
  if (!isScanning) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <Card className="shadow-lg border-l-4 border-l-blue-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Globe className="w-4 h-4 animate-spin text-blue-600" />
              <span className="font-medium text-sm">Network Scan</span>
              <Badge variant="default">Running</Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </Button>
          </div>

          {isExpanded && (
            <div className="space-y-3">
              <div className="text-xs text-gray-600">
                <span className="font-medium">Status: </span>
                Network scan is in progress...
              </div>

              <div className="flex space-x-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={stopScan}
                  className="flex-1 text-xs"
                >
                  <Square className="w-3 h-3 mr-1" />
                  Stop Scan
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}