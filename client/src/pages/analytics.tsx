import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import { TrendingUp, TrendingDown, Activity, Network, AlertCircle, CheckCircle } from "lucide-react";
import type { DashboardMetrics, SubnetUtilization, ActivityItem } from "@/lib/types";

export default function Analytics() {
  const { data: metrics } = useQuery<DashboardMetrics>({
    queryKey: ['/api/dashboard/metrics'],
    refetchInterval: 30000,
  });

  const { data: subnets } = useQuery<SubnetUtilization[]>({
    queryKey: ['/api/dashboard/subnet-utilization'],
    refetchInterval: 30000,
  });

  const { data: activities } = useQuery<ActivityItem[]>({
    queryKey: ['/api/activity'],
    refetchInterval: 30000,
  });

  // Prepare chart data
  const subnetUtilizationData = subnets?.map(subnet => ({
    name: subnet.name.split(' ')[0], // Short name
    utilization: subnet.utilization,
    available: subnet.available,
    total: subnet.total,
    used: subnet.total - subnet.available
  })) || [];

  const vendorData = metrics?.topVendors.map((vendor, index) => ({
    name: vendor.name,
    count: vendor.count,
    fill: `hsl(${index * 60}, 70%, 50%)`
  })) || [];

  const networkOverviewData = metrics ? [
    {
      name: 'Network Capacity',
      total: metrics.totalIPs,
      allocated: metrics.allocatedIPs,
      available: metrics.availableIPs,
      utilization: metrics.networkUtilization
    }
  ] : [];

  const deviceStatusData = metrics ? [
    { name: 'Online', value: metrics.onlineDevices, fill: '#22c55e' },
    { name: 'Offline', value: metrics.offlineDevices, fill: '#ef4444' }
  ] : [];

  // Activity trends by day
  const activityTrends = activities?.reduce((acc, activity) => {
    const date = new Date(activity.timestamp).toLocaleDateString();
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const activityData = Object.entries(activityTrends).map(([date, count]) => ({
    date,
    activities: count
  }));

  return (
    <>
      <Header
        title="Network Analytics"
        subtitle="Comprehensive network performance insights and trends"
      />
      
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Key Performance Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Network Health</p>
                  <p className="text-2xl font-bold">
                    {metrics ? Math.round((metrics.onlineDevices / (metrics.onlineDevices + metrics.offlineDevices)) * 100) : 0}%
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <div className="mt-2">
                <Badge variant={metrics && metrics.onlineDevices > metrics.offlineDevices ? "default" : "destructive"}>
                  {metrics && metrics.onlineDevices > metrics.offlineDevices ? "Healthy" : "Needs Attention"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Utilization</p>
                  <p className="text-2xl font-bold">{metrics?.networkUtilization || 0}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-500" />
              </div>
              <Progress value={metrics?.networkUtilization || 0} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Critical Alerts</p>
                  <p className="text-2xl font-bold">{metrics?.criticalAlerts || 0}</p>
                </div>
                <AlertCircle className={`w-8 h-8 ${(metrics?.criticalAlerts || 0) > 0 ? 'text-red-500' : 'text-gray-400'}`} />
              </div>
              <div className="mt-2">
                <Badge variant={(metrics?.criticalAlerts || 0) > 0 ? "destructive" : "secondary"}>
                  {(metrics?.criticalAlerts || 0) > 0 ? "Action Required" : "All Clear"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Scans Today</p>
                  <p className="text-2xl font-bold">{metrics?.recentScansCount || 0}</p>
                </div>
                <Activity className="w-8 h-8 text-purple-500" />
              </div>
              <div className="mt-2">
                <Badge variant="outline">
                  Active Monitoring
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Subnet Utilization</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={subnetUtilizationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'used' ? `${value} IPs used` : `${value} IPs available`,
                      name === 'used' ? 'Used' : 'Available'
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="used" stackId="a" fill="#3b82f6" name="Used" />
                  <Bar dataKey="available" stackId="a" fill="#e5e7eb" name="Available" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Device Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={deviceStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {deviceStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} devices`]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Vendor Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={vendorData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip formatter={(value) => [`${value} devices`]} />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Network Activity Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value} events`]} />
                  <Area type="monotone" dataKey="activities" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Network Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Network Capacity Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={networkOverviewData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    `${Number(value).toLocaleString()} IPs`,
                    name === 'total' ? 'Total Capacity' : name === 'allocated' ? 'Allocated' : 'Available'
                  ]}
                />
                <Legend />
                <Bar dataKey="allocated" fill="#3b82f6" name="Allocated" />
                <Bar dataKey="available" fill="#10b981" name="Available" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
