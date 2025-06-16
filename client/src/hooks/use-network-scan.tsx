import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ScanProgress {
  current: number;
  total: number;
  currentIP?: string;
}

interface ScanDevice {
  ipAddress: string;
  hostname?: string;
  macAddress?: string;
  vendor?: string;
  openPorts?: number[];
  isAlive: boolean;
}

interface ScanSummary {
  onlineDevices: number;
  subnetsScanned: number;
  vendorBreakdown: Record<string, number>;
  deviceTypeBreakdown: Record<string, number>;
  timestamp: string;
}

interface NetworkScanState {
  isScanning: boolean;
  currentScanId: number | null;
  progress: ScanProgress;
  foundDevices: ScanDevice[];
  currentSubnet?: string;
  scanStatus?: string;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  summary?: ScanSummary;
}

export function useNetworkScan() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [scanState, setScanState] = useState<NetworkScanState>({
    isScanning: false,
    currentScanId: null,
    progress: { current: 0, total: 0 },
    foundDevices: [],
    connectionStatus: 'disconnected'
  });

  // Query for scan status
  const { data: scanStatus, refetch: refetchScanStatus } = useQuery({
    queryKey: ['/api/network/scan'],
    refetchInterval: scanState.isScanning ? 2000 : 10000,
  });

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      setScanState(prev => ({ ...prev, connectionStatus: 'connecting' }));

      ws.onopen = () => {
        console.log('WebSocket connected for network scan updates');
        setScanState(prev => ({ ...prev, connectionStatus: 'connected' }));
        
        // Clear any reconnection timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'scan_started') {
            setScanState(prev => ({
              ...prev,
              isScanning: true,
              currentScanId: data.scanId,
              foundDevices: [],
              progress: { current: 0, total: 0 },
              summary: undefined
            }));
            queryClient.invalidateQueries({ queryKey: ['/api/network/scan'] });
          }
          
          else if (data.type === 'scan_progress') {
            setScanState(prev => ({
              ...prev,
              progress: {
                current: data.current || 0,
                total: data.total || 0,
                currentIP: data.currentIP
              },
              currentSubnet: data.currentSubnet,
              scanStatus: data.status
            }));
          }
          
          else if (data.type === 'device_found') {
            setScanState(prev => ({
              ...prev,
              foundDevices: [...prev.foundDevices, data.device]
            }));
          }
          
          else if (data.type === 'scan_completed') {
            setScanState(prev => ({
              ...prev,
              isScanning: false,
              currentScanId: null,
              scanStatus: 'completed',
              summary: data.summary
            }));
            queryClient.invalidateQueries({ queryKey: ['/api/network/scan'] });
            queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
            queryClient.invalidateQueries({ queryKey: ['/api/devices/all'] });
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard/subnet-utilization'] });
          }
          
          else if (data.type === 'scan_failed') {
            setScanState(prev => ({
              ...prev,
              isScanning: false,
              currentScanId: null,
              scanStatus: 'failed'
            }));
            queryClient.invalidateQueries({ queryKey: ['/api/network/scan'] });
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        setScanState(prev => ({ ...prev, connectionStatus: 'disconnected' }));
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setScanState(prev => ({ ...prev, connectionStatus: 'disconnected' }));
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setScanState(prev => ({ ...prev, connectionStatus: 'disconnected' }));
    }
  }, [queryClient]);

  // Initialize WebSocket connection
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // Sync with server scan status
  useEffect(() => {
    if (scanStatus && typeof scanStatus === 'object') {
      setScanState(prev => ({
        ...prev,
        isScanning: (scanStatus as any).isActive || false,
        currentScanId: (scanStatus as any).currentScanId || null
      }));
    }
  }, [scanStatus]);

  const startScan = async (subnetIds: number[] = []) => {
    try {
      const response = await apiRequest('/api/network/scan', 'POST', { subnetIds });
      refetchScanStatus();
      return response;
    } catch (error) {
      console.error('Failed to start scan:', error);
      throw error;
    }
  };

  const stopScan = async () => {
    try {
      await apiRequest('/api/network/scan/stop', 'POST');
      setScanState(prev => ({
        ...prev,
        isScanning: false,
        currentScanId: null,
        scanStatus: 'stopped'
      }));
      refetchScanStatus();
    } catch (error) {
      console.error('Failed to stop scan:', error);
      throw error;
    }
  };

  const dismissSummary = () => {
    setScanState(prev => ({ ...prev, summary: undefined }));
  };

  const getScanProgress = () => {
    if (scanState.progress.total === 0) return 0;
    return Math.round((scanState.progress.current / scanState.progress.total) * 100);
  };

  return {
    // State
    isScanning: scanState.isScanning,
    currentScanId: scanState.currentScanId,
    progress: scanState.progress,
    foundDevices: scanState.foundDevices,
    currentSubnet: scanState.currentSubnet,
    scanStatus: scanState.scanStatus,
    connectionStatus: scanState.connectionStatus,
    summary: scanState.summary,
    
    // Computed
    scanProgress: getScanProgress(),
    
    // Actions
    startScan,
    stopScan,
    dismissSummary,
    refetchScanStatus,
    
    // Server scan status
    serverScanStatus: scanStatus
  };
}