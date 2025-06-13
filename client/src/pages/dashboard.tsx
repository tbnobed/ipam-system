import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/layout/header";
import MetricsCards from "@/components/dashboard/metrics-cards";
import SubnetOverview from "@/components/dashboard/subnet-overview";
import RecentActivity from "@/components/dashboard/recent-activity";
import DeviceTable from "@/components/dashboard/device-table";
import { apiRequest } from "@/lib/queryClient";
import type { DashboardMetrics, SubnetUtilization, ActivityItem } from "@/lib/types";

export default function Dashboard() {
  const { toast } = useToast();

  const { data: metrics, isLoading: metricsLoading } = useQuery<DashboardMetrics>({
    queryKey: ['/api/dashboard/metrics'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: subnets, isLoading: subnetsLoading } = useQuery<SubnetUtilization[]>({
    queryKey: ['/api/dashboard/subnet-utilization'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<ActivityItem[]>({
    queryKey: ['/api/activity'],
    refetchInterval: 30000,
  });

  const handleNetworkScan = async () => {
    try {
      const response = await apiRequest('POST', '/api/network/scan', {
        subnetIds: [], // Empty array means scan all subnets
      });
      const result = await response.json();
      
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
  };

  const handleExport = async () => {
    try {
      const response = await apiRequest('GET', '/api/export/devices');
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `devices-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Export Complete",
        description: "Device data has been exported to CSV",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export device data",
        variant: "destructive",
      });
    }
  };

  if (metricsLoading) {
    return <div className="flex items-center justify-center h-64">Loading dashboard...</div>;
  }

  return (
    <>
      <Header
        title="Network Dashboard"
        subtitle="Monitor and manage IP address allocations across your network"
        showActions
        onScan={handleNetworkScan}
        onExport={handleExport}
      />
      
      <main className="flex-1 overflow-y-auto p-6">
        {/* Metrics Cards */}
        {metrics && <MetricsCards metrics={metrics} />}
        
        {/* Subnet Overview and Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {subnets && <SubnetOverview subnets={subnets} />}
          {activities && <RecentActivity activities={activities} />}
        </div>
        
        {/* Device Status Table */}
        <DeviceTable />
      </main>
    </>
  );
}
