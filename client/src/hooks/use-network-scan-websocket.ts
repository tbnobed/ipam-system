import { useState, useEffect, useRef } from 'react';

interface ScanProgress {
  current: number;
  total: number;
  currentIP?: string;
}

interface ScanUpdate {
  type: 'scan_progress' | 'scan_update';
  scanId: number | null;
  isActive: boolean;
  progress?: ScanProgress;
  status?: string;
  subnet?: string;
  devices?: any[];
  devicesFound?: number;
  newDevices?: any[];
  timestamp: string;
}

interface NetworkScanWebSocket {
  scanProgress: ScanProgress;
  isScanning: boolean;
  currentScanId: number | null;
  currentSubnet: string | null;
  foundDevices: any[];
  scanStatus: string | null;
  lastUpdate: string | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export function useNetworkScanWebSocket(): NetworkScanWebSocket {
  const [scanProgress, setScanProgress] = useState<ScanProgress>({ current: 0, total: 0 });
  const [isScanning, setIsScanning] = useState(false);
  const [currentScanId, setCurrentScanId] = useState<number | null>(null);
  const [currentSubnet, setCurrentSubnet] = useState<string | null>(null);
  const [foundDevices, setFoundDevices] = useState<any[]>([]);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');
    
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        if (mountedRef.current) {
          setConnectionStatus('connected');
          console.log('WebSocket connected for network scan updates');
        }
      };

      wsRef.current.onmessage = (event) => {
        if (!mountedRef.current) return;
        
        try {
          const update: ScanUpdate = JSON.parse(event.data);
          setLastUpdate(update.timestamp);

          if (update.type === 'scan_progress') {
            setIsScanning(update.isActive);
            setCurrentScanId(update.scanId);
            if (update.progress) {
              setScanProgress(update.progress);
            }
          } else if (update.type === 'scan_update') {
            setScanStatus(update.status || null);
            
            if (update.status === 'scanning_subnet' && update.subnet) {
              setCurrentSubnet(update.subnet);
              setFoundDevices([]); // Reset found devices for new subnet
            } else if (update.status === 'devices_found' && Array.isArray(update.devices)) {
              setFoundDevices(prev => [...prev, ...update.devices]);
            } else if (update.status === 'subnet_complete') {
              setCurrentSubnet(null);
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = () => {
        if (mountedRef.current) {
          setConnectionStatus('disconnected');
          // Attempt to reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect();
            }
          }, 3000);
        }
      };

      wsRef.current.onerror = () => {
        if (mountedRef.current) {
          setConnectionStatus('error');
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setConnectionStatus('error');
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    scanProgress,
    isScanning,
    currentScanId,
    currentSubnet,
    foundDevices,
    scanStatus,
    lastUpdate,
    connectionStatus
  };
}