export interface DashboardMetrics {
  totalIPs: number;
  allocatedIPs: number;
  availableIPs: number;
  onlineDevices: number;
  offlineDevices: number;
  totalVLANs: number;
  totalSubnets: number;
  changesSinceLastScan: {
    online: number;
    offline: number;
  };
  lastScanTime?: string;
  scanningStatus: 'idle' | 'scanning' | 'completed';
  networkUtilization: number;
  criticalAlerts: number;
  recentScansCount: number;
  topVendors: Array<{ name: string; count: number }>;
}

export interface SubnetUtilization {
  id: number;
  name: string;
  utilization: number;
  description: string;
  available: number;
  total: number;
}

export interface DeviceFilters {
  search?: string;
  vlan?: string;
  subnet?: string;
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ActivityItem {
  id: number;
  action: string;
  entityType: string;
  entityId: number;
  details: any;
  timestamp: string;
}

export interface NetworkScanResult {
  id: number;
  status: 'running' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  devicesFound: number;
  results?: any;
}

export interface PingResult {
  success: boolean;
  responseTime?: number;
  error?: string;
  timestamp: string;
}
