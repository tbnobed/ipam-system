import { Card, CardContent } from "@/components/ui/card";
import { Network, CheckCircle, AlertTriangle, Layers, TrendingUp, Bell, Activity, Users } from "lucide-react";
import type { DashboardMetrics } from "@/lib/types";

interface MetricsCardsProps {
  metrics: DashboardMetrics;
}

export default function MetricsCards({ metrics }: MetricsCardsProps) {
  const cards = [
    {
      title: "Network Capacity",
      value: metrics.totalIPs.toLocaleString(),
      subtitle: `${metrics.allocatedIPs.toLocaleString()} allocated, ${metrics.availableIPs.toLocaleString()} available`,
      icon: Network,
      color: "bg-blue-500",
    },
    {
      title: "Online Devices",
      value: metrics.onlineDevices.toLocaleString(),
      subtitle: `${metrics.changesSinceLastScan.online > 0 ? '↑' : ''}${metrics.changesSinceLastScan.online} since last scan`,
      subtitleColor: "text-green-600",
      icon: CheckCircle,
      color: "bg-green-500",
    },
    {
      title: "Network Utilization",
      value: `${metrics.networkUtilization}%`,
      subtitle: `${metrics.offlineDevices} offline devices`,
      subtitleColor: metrics.networkUtilization > 90 ? "text-red-600" : metrics.networkUtilization > 70 ? "text-yellow-600" : "text-gray-500",
      icon: TrendingUp,
      color: metrics.networkUtilization > 90 ? "bg-red-500" : metrics.networkUtilization > 70 ? "bg-yellow-500" : "bg-green-500",
    },
    {
      title: "Critical Alerts",
      value: metrics.criticalAlerts.toString(),
      subtitle: `${metrics.recentScansCount} scans today`,
      subtitleColor: metrics.criticalAlerts > 0 ? "text-red-600" : "text-gray-500",
      icon: Bell,
      color: metrics.criticalAlerts > 0 ? "bg-red-500" : "bg-gray-500",
    },
    {
      title: "Network Segments",
      value: metrics.totalVLANs.toString(),
      subtitle: `${metrics.totalSubnets} subnets configured`,
      icon: Layers,
      color: "bg-purple-500",
    },
    {
      title: "Device Vendors",
      value: metrics.topVendors.length.toString(),
      subtitle: metrics.topVendors[0] ? `Top: ${metrics.topVendors[0].name} (${metrics.topVendors[0].count})` : "No vendor data",
      icon: Users,
      color: "bg-indigo-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className="p-6">
            <CardContent className="p-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{card.title}</p>
                  <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                </div>
                <div className={`flex-shrink-0 w-12 h-12 ${card.color.replace('bg-', 'bg-')}/10 rounded-lg flex items-center justify-center`}>
                  <Icon className={`${card.color.replace('bg-', 'text-')} w-6 h-6`} />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <span className={`text-sm ${card.subtitleColor || 'text-gray-500'}`}>
                  {card.subtitle}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
