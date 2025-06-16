import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export function useNetworkScan() {
  const queryClient = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);
  const [foundDevices, setFoundDevices] = useState<any[]>([]);

  // Query for scan status
  const { data: scanStatus, refetch: refetchScanStatus } = useQuery({
    queryKey: ['/api/network/scan'],
    refetchInterval: 5000,
  });

  // Sync with server scan status
  useEffect(() => {
    if (scanStatus && typeof scanStatus === 'object') {
      const status = scanStatus as any;
      setIsScanning(status.isActive || false);
    }
  }, [scanStatus]);

  const startScan = async (subnetIds: number[] = []) => {
    try {
      const response = await fetch('/api/network/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subnetIds }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to start scan');
      }
      
      setIsScanning(true);
      refetchScanStatus();
      return response;
    } catch (error) {
      console.error('Failed to start scan:', error);
      throw error;
    }
  };

  const stopScan = async () => {
    try {
      await fetch('/api/network/scan/stop', {
        method: 'POST',
      });
      
      setIsScanning(false);
      refetchScanStatus();
    } catch (error) {
      console.error('Failed to stop scan:', error);
      throw error;
    }
  };

  return {
    isScanning,
    foundDevices,
    startScan,
    stopScan,
    refetchScanStatus,
    serverScanStatus: scanStatus
  };
}