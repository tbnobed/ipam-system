import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle, Edit, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ActivityItem } from "@/lib/types";

interface RecentActivityProps {
  activities: ActivityItem[];
}

export default function RecentActivity({ activities }: RecentActivityProps) {
  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'device_discovered':
      case 'device_added':
        return <Plus className="w-3 h-3 text-green-600" />;
      case 'device_offline':
        return <AlertTriangle className="w-3 h-3 text-red-600" />;
      case 'device_online':
        return <CheckCircle className="w-3 h-3 text-green-600" />;
      case 'device_updated':
        return <Edit className="w-3 h-3 text-primary" />;
      case 'scan_started':
        return <RefreshCw className="w-3 h-3 text-orange-600" />;
      case 'scan_completed':
        return <CheckCircle className="w-3 h-3 text-green-600" />;
      case 'scan_failed':
        return <AlertTriangle className="w-3 h-3 text-red-600" />;
      case 'vlan_created':
      case 'subnet_created':
        return <Plus className="w-3 h-3 text-blue-600" />;
      case 'vlan_updated':
      case 'subnet_updated':
        return <Edit className="w-3 h-3 text-blue-600" />;
      default:
        return <RefreshCw className="w-3 h-3 text-gray-600" />;
    }
  };

  const getActivityColor = (action: string) => {
    switch (action) {
      case 'device_discovered':
      case 'device_added':
      case 'device_online':
      case 'scan_completed':
        return 'bg-green-100';
      case 'device_offline':
      case 'scan_failed':
        return 'bg-red-100';
      case 'device_updated':
        return 'bg-primary/10';
      case 'scan_started':
        return 'bg-orange-100';
      case 'vlan_created':
      case 'vlan_updated':
      case 'subnet_created':
      case 'subnet_updated':
        return 'bg-blue-100';
      default:
        return 'bg-gray-100';
    }
  };

  const formatActivityMessage = (activity: ActivityItem) => {
    const details = activity.details || {};
    
    switch (activity.action) {
      case 'device_discovered':
        return `New device discovered: ${details.hostname || details.ipAddress}${details.vendor ? ` (${details.vendor})` : ''}`;
      case 'device_added':
        return `Device manually added: ${details.hostname || details.ipAddress}`;
      case 'device_offline':
        return `Device went offline: ${details.hostname || details.ipAddress}`;
      case 'device_online':
        return `Device came online: ${details.hostname || details.ipAddress}`;
      case 'device_updated':
        return `Device updated: ${details.hostname || details.ipAddress}`;
      case 'scan_started':
        return `Network scan started for ${details.subnetIds?.length || 0} subnet${details.subnetIds?.length !== 1 ? 's' : ''}`;
      case 'scan_completed':
        return `Network scan completed - Found ${details.devicesFound || 0} devices (${details.onlineDevices || 0} online)`;
      case 'scan_failed':
        return `Network scan failed: ${details.error || 'Unknown error'}`;
      case 'vlan_created':
        return `VLAN created: ${details.name || `VLAN ${details.vlanId}`}`;
      case 'vlan_updated':
        return `VLAN updated: ${details.name || `VLAN ${details.vlanId}`}`;
      case 'subnet_created':
        return `Subnet created: ${details.network || 'Unknown network'}`;
      case 'subnet_updated':
        return `Subnet updated: ${details.network || 'Unknown network'}`;
      default:
        return activity.action.replace('_', ' ');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Activity</CardTitle>
        <Button variant="link" className="text-primary">
          View All
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start space-x-3">
              <div className={`flex-shrink-0 w-8 h-8 ${getActivityColor(activity.action)} rounded-full flex items-center justify-center`}>
                {getActivityIcon(activity.action)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  {formatActivityMessage(activity)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
