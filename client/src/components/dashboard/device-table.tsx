import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Edit, Activity, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { DeviceFilters, PaginatedResponse } from "@/lib/types";
import type { Device } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function DeviceTable() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<DeviceFilters>({
    page: 1,
    limit: 50,
  });

  const { data: deviceData, isLoading, refetch } = useQuery<PaginatedResponse<Device>>({
    queryKey: ['/api/devices', filters],
  });

  const { data: vlans = [] } = useQuery({
    queryKey: ['/api/vlans'],
  });

  const handleSearch = (search: string) => {
    setFilters(prev => ({ ...prev, search: search || undefined, page: 1 }));
  };

  const handleVlanFilter = (vlan: string) => {
    setFilters(prev => ({ ...prev, vlan: vlan === "all" ? undefined : vlan, page: 1 }));
  };

  const handleStatusFilter = (status: string) => {
    setFilters(prev => ({ ...prev, status: status === "all" ? undefined : status, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const handlePingDevice = async (device: Device) => {
    try {
      const response = await apiRequest('POST', `/api/devices/${device.id}/ping`);
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Ping Successful",
          description: `${device.ipAddress} responded in ${result.responseTime}ms`,
        });
      } else {
        toast({
          title: "Ping Failed",
          description: `${device.ipAddress} is not responding`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to ping device",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDevice = async (device: Device) => {
    if (!confirm(`Are you sure you want to delete ${device.hostname || device.ipAddress}?`)) {
      return;
    }

    try {
      await apiRequest('DELETE', `/api/devices/${device.id}`);
      toast({
        title: "Success",
        description: "Device deleted successfully",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete device",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <Badge className="status-online">🟢 Online</Badge>;
      case 'offline':
        return <Badge className="status-offline">🔴 Offline</Badge>;
      default:
        return <Badge className="status-unknown">⚪ Unknown</Badge>;
    }
  };

  const getDeviceTypeBadge = (deviceType: string) => {
    const colors = {
      'Camera': 'bg-blue-100 text-blue-800',
      'Router': 'bg-green-100 text-green-800',
      'Switch': 'bg-purple-100 text-purple-800',
      'Audio': 'bg-orange-100 text-orange-800',
      'Server': 'bg-gray-100 text-gray-800',
    };
    
    return (
      <Badge className={colors[deviceType as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {deviceType}
      </Badge>
    );
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading devices...</div>;
  }

  const devices = deviceData?.data || [];
  const totalPages = deviceData?.totalPages || 1;
  const currentPage = deviceData?.page || 1;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Device Status</h3>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Input
                placeholder="Search devices..."
                className="pl-10 w-64"
                onChange={(e) => handleSearch(e.target.value)}
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            </div>
            <Select onValueChange={handleVlanFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All VLANs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All VLANs</SelectItem>
                {vlans.map((vlan: any) => (
                  <SelectItem key={vlan.id} value={vlan.vlanId.toString()}>
                    VLAN {vlan.vlanId} - {vlan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={handleStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Hostname</TableHead>
                <TableHead>VLAN/Subnet</TableHead>
                <TableHead>Device Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>MAC Address</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((device) => (
                <TableRow key={device.id} className="hover:bg-gray-50">
                  <TableCell>{getStatusBadge(device.status)}</TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{device.ipAddress}</span>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-gray-900">
                        {device.hostname || 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-500">{device.purpose}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-900">VLAN {device.subnetId}</div>
                    <div className="text-sm text-gray-500">Subnet info</div>
                  </TableCell>
                  <TableCell>
                    {device.deviceType && getDeviceTypeBadge(device.deviceType)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-900">
                    {device.location}
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-sm">{device.macAddress}</div>
                    <div className="text-xs text-gray-500">{device.vendor}</div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {device.lastSeen 
                      ? formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true })
                      : 'Never'
                    }
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {}}
                        className="text-primary hover:text-primary-dark"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePingDevice(device)}
                        className="text-primary hover:text-primary-dark"
                      >
                        <Activity className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDevice(device)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-700">
            Showing {((currentPage - 1) * filters.limit!) + 1} to{' '}
            {Math.min(currentPage * filters.limit!, deviceData?.total || 0)} of{' '}
            {deviceData?.total || 0} devices
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
