import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface NetworkScanHook {
  startScan: (subnetIds?: number[]) => Promise<void>;
  stopScan: () => void;
  scanResult: any;
  isScanning: boolean;
  scanProgress: number;
}

export function useNetworkScan(): NetworkScanHook {
  const { toast } = useToast();
  const [activeScanId, setActiveScanId] = useState<number | null>(null);

  const { data: scanResult } = useQuery({
    queryKey: ['/api/network/scan', activeScanId],
    enabled: !!activeScanId,
    refetchInterval: activeScanId ? 2000 : false,
  });

  const startScan = useCallback(async (subnetIds: number[] = []) => {
    try {
      const response = await apiRequest('/api/network/scan', 'POST', { subnetIds });
      const result = await response.json();
      
      setActiveScanId(result.scanId);
      toast({
        title: "Network Scan Started",
        description: `Scan ID: ${result.scanId}. This may take several minutes.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start network scan",
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopScan = useCallback(() => {
    setActiveScanId(null);
    toast({
      title: "Scan Stopped",
      description: "Network scan has been stopped",
    });
  }, [toast]);

  const getScanProgress = useCallback(() => {
    if (!scanResult) return 0;
    
    if ((scanResult as any).status === 'completed') return 100;
    if ((scanResult as any).status === 'failed') return 0;
    
    // For running scans, estimate progress based on time elapsed
    const startTime = new Date((scanResult as any).startTime).getTime();
    const elapsed = Date.now() - startTime;
    const estimatedTotal = 5 * 60 * 1000; // 5 minutes estimated
    
    return Math.min(90, (elapsed / estimatedTotal) * 100);
  }, [scanResult]);

  return {
    startScan,
    stopScan,
    scanResult,
    isScanning: !!activeScanId && (scanResult as any)?.status === 'running',
    scanProgress: getScanProgress(),
  };
}
