import { Card, CardContent } from "@/components/ui/card";
import { Network, CheckCircle, AlertTriangle, Layers } from "lucide-react";
import type { DashboardMetrics } from "@/lib/types";

interface MetricsCardsProps {
  metrics: DashboardMetrics;
}

export default function MetricsCards({ metrics }: MetricsCardsProps) {
  const cards = [
    {
      title: "Total IPs",
      value: metrics.totalIPs.toLocaleString(),
      subtitle: `Allocated: ${metrics.allocatedIPs.toLocaleString()}`,
      icon: Network,
      color: "bg-primary",
    },
    {
      title: "Online Devices",
      value: metrics.onlineDevices.toLocaleString(),
      subtitle: `↑ ${metrics.changesSinceLastScan.online} since last scan`,
      subtitleColor: "text-green-600",
      icon: CheckCircle,
      color: "bg-green-500",
    },
    {
      title: "Offline Devices",
      value: metrics.offlineDevices.toLocaleString(),
      subtitle: `↓ ${metrics.changesSinceLastScan.offline} since last scan`,
      subtitleColor: "text-red-600",
      icon: AlertTriangle,
      color: "bg-red-500",
    },
    {
      title: "VLANs",
      value: metrics.totalVLANs.toString(),
      subtitle: `Subnets: ${metrics.totalSubnets}`,
      icon: Layers,
      color: "bg-orange-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
