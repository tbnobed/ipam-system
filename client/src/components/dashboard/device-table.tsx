import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Edit, Activity, Trash2, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { DeviceFilters, PaginatedResponse } from "@/lib/types";
import type { Device } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const editDeviceSchema = z.object({
  hostname: z.string().optional(),
  deviceType: z.string().optional(),
  location: z.string().optional(),
  purpose: z.string().optional(),
  vendor: z.string().optional(),
});

type EditDeviceFormData = z.infer<typeof editDeviceSchema>;

export default function DeviceTable() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<DeviceFilters>({
    page: 1,
    limit: 50,
  });
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const form = useForm<EditDeviceFormData>({
    resolver: zodResolver(editDeviceSchema),
    defaultValues: {
      hostname: "",
      deviceType: "",
      location: "",
      purpose: "",
      vendor: "",
    },
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue]);

  // Update filters when debounced search changes
  useEffect(() => {
    setFilters(prev => ({ 
      ...prev, 
      search: debouncedSearch || undefined, 
      page: 1 
    }));
  }, [debouncedSearch]);

  const { data: deviceData, isLoading, refetch } = useQuery<PaginatedResponse<Device>>({
    queryKey: ['/api/devices', filters],
  });

  const { data: vlans = [] } = useQuery<any[]>({
    queryKey: ['/api/vlans'],
  });

  const { data: subnets = [] } = useQuery<any[]>({
    queryKey: ['/api/subnets'],
  });

  const updateDeviceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EditDeviceFormData }) => 
      apiRequest(`/api/devices/${id}`, 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
      setEditDialogOpen(false);
      setEditingDevice(null);
      form.reset();
      toast({
        title: "Device updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Failed to update device",
        variant: "destructive",
      });
    },
  });

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
  };

  const handleVlanFilter = (vlan: string) => {
    setFilters(prev => ({ 
      ...prev, 
      vlan: vlan === "all" ? undefined : vlan, 
      subnet: undefined, // Clear subnet filter when VLAN changes
      page: 1 
    }));
  };

  const handleStatusFilter = (status: string) => {
    setFilters(prev => ({ ...prev, status: status === "all" ? undefined : status, page: 1 }));
  };

  const handleSubnetFilter = (subnet: string) => {
    setFilters(prev => ({ ...prev, subnet: subnet === "all" ? undefined : subnet, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const handleSort = (field: string) => {
    let newDirection: "asc" | "desc" = "asc";
    if (sortField === field) {
      newDirection = sortDirection === "asc" ? "desc" : "asc";
    }
    
    setSortField(field);
    setSortDirection(newDirection);
    
    // Update filters to include sorting
    setFilters(prev => ({ 
      ...prev, 
      sortBy: field, 
      sortOrder: newDirection,
      page: 1 
    }));
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4" />;
    }
    return sortDirection === "asc" ? 
      <ArrowUp className="w-4 h-4" /> : 
      <ArrowDown className="w-4 h-4" />;
  };

  const handleEditDevice = (device: Device) => {
    setEditingDevice(device);
    form.reset({
      hostname: device.hostname || "",
      deviceType: device.deviceType || "",
      location: device.location || "",
      purpose: device.purpose || "",
      vendor: device.vendor || "",
    });
    setEditDialogOpen(true);
  };

  const onSubmitEdit = (data: EditDeviceFormData) => {
    if (editingDevice) {
      updateDeviceMutation.mutate({ id: editingDevice.id, data });
    }
  };

  const handlePingDevice = async (device: Device) => {
    try {
      const response = await apiRequest(`/api/devices/${device.id}/ping`, 'POST');
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
      await apiRequest(`/api/devices/${device.id}`, 'DELETE');
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

  const rawDevices = deviceData?.data || [];
  const totalPages = deviceData?.totalPages || 1;
  const currentPage = deviceData?.page || 1;

  // Apply client-side sorting since backend sorting has issues
  const devices = [...rawDevices].sort((a, b) => {
    if (!sortField) return 0;
    
    let aValue = a[sortField as keyof Device];
    let bValue = b[sortField as keyof Device];
    
    // Handle null/undefined values
    if (aValue === null || aValue === undefined) aValue = "";
    if (bValue === null || bValue === undefined) bValue = "";
    
    // Special handling for IP addresses
    if (sortField === 'ipAddress') {
      const aIP = String(aValue).split('.').map(Number);
      const bIP = String(bValue).split('.').map(Number);
      
      for (let i = 0; i < 4; i++) {
        if (aIP[i] !== bIP[i]) {
          const result = aIP[i] - bIP[i];
          return sortDirection === "asc" ? result : -result;
        }
      }
      return 0;
    }
    
    // For dates
    if (sortField === 'lastSeen') {
      const aDate = aValue ? new Date(aValue as string).getTime() : 0;
      const bDate = bValue ? new Date(bValue as string).getTime() : 0;
      const result = aDate - bDate;
      return sortDirection === "asc" ? result : -result;
    }
    
    // Convert to string for text comparison
    const aStr = String(aValue).toLowerCase();
    const bStr = String(bValue).toLowerCase();
    
    if (sortDirection === "asc") {
      return aStr.localeCompare(bStr);
    } else {
      return bStr.localeCompare(aStr);
    }
  });

  return (
    <div>
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Device</DialogTitle>
            <DialogDescription>
              Update device information including hostname, type, location, and other details.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitEdit)} className="space-y-4">
              <FormField
                control={form.control}
                name="hostname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hostname</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter hostname" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deviceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Device Type</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select device type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Camera">Camera</SelectItem>
                          <SelectItem value="Video Server">Video Server</SelectItem>
                          <SelectItem value="Audio Mixer">Audio Mixer</SelectItem>
                          <SelectItem value="Video Mixer">Video Mixer</SelectItem>
                          <SelectItem value="Router">Router</SelectItem>
                          <SelectItem value="Switch">Switch</SelectItem>
                          <SelectItem value="Audio Equipment">Audio Equipment</SelectItem>
                          <SelectItem value="Video Monitor">Video Monitor</SelectItem>
                          <SelectItem value="Encoder">Encoder</SelectItem>
                          <SelectItem value="Decoder">Decoder</SelectItem>
                          <SelectItem value="NAS">NAS Storage</SelectItem>
                          <SelectItem value="Server">Server</SelectItem>
                          <SelectItem value="Workstation">Workstation</SelectItem>
                          <SelectItem value="Media Player">Media Player</SelectItem>
                          <SelectItem value="Streaming Device">Streaming Device</SelectItem>
                          <SelectItem value="KVM">KVM Switch</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter location" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purpose</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter purpose/description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vendor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter vendor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateDeviceMutation.isPending}
                >
                  {updateDeviceMutation.isPending ? "Updating..." : "Update Device"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Device Status</h3>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Input
                placeholder="Search devices..."
                className="pl-10 w-64"
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            </div>
            <Select onValueChange={handleVlanFilter} value={filters.vlan || "all"}>
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
            <Select onValueChange={handleSubnetFilter} value={filters.subnet || "all"}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Subnets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subnets</SelectItem>
                {(() => {
                  // Filter subnets based on selected VLAN
                  const filteredSubnets = filters.vlan && filters.vlan !== "all" 
                    ? subnets.filter((subnet: any) => {
                        const vlan = vlans.find(v => v.vlanId.toString() === filters.vlan);
                        return vlan && subnet.vlanId === vlan.id;
                      })
                    : subnets;
                  
                  return filteredSubnets.map((subnet: any) => (
                    <SelectItem key={subnet.id} value={subnet.id.toString()}>
                      {subnet.network}
                    </SelectItem>
                  ));
                })()}
              </SelectContent>
            </Select>
            <Select onValueChange={handleStatusFilter} value={filters.status || "all"}>
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
                <TableHead>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-semibold"
                    onClick={() => handleSort("status")}
                  >
                    Status
                    {getSortIcon("status")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-semibold"
                    onClick={() => handleSort("ipAddress")}
                  >
                    IP Address
                    {getSortIcon("ipAddress")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-semibold"
                    onClick={() => handleSort("hostname")}
                  >
                    Hostname
                    {getSortIcon("hostname")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-semibold"
                    onClick={() => handleSort("subnetId")}
                  >
                    VLAN/Subnet
                    {getSortIcon("subnetId")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-semibold"
                    onClick={() => handleSort("deviceType")}
                  >
                    Device Type
                    {getSortIcon("deviceType")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-semibold"
                    onClick={() => handleSort("location")}
                  >
                    Location
                    {getSortIcon("location")}
                  </Button>
                </TableHead>
                <TableHead>MAC Address</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-semibold"
                    onClick={() => handleSort("lastSeen")}
                  >
                    Last Seen
                    {getSortIcon("lastSeen")}
                  </Button>
                </TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    {filters.search || filters.vlan || filters.status ? 
                      "No devices found matching your filters. Try adjusting your search criteria." :
                      "No devices found. Start a network scan to discover devices on your network."
                    }
                  </TableCell>
                </TableRow>
              ) : (
                devices.map((device) => (
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
                    {(() => {
                      const subnet = subnets.find(s => s.id === device.subnetId);
                      const vlan = subnet ? vlans.find(v => v.id === subnet.vlanId) : null;
                      return (
                        <div>
                          <div className="text-sm text-gray-900">
                            {vlan ? `VLAN ${vlan.vlanId}` : 'No VLAN'}
                          </div>
                          <div className="text-sm text-gray-500 font-mono">
                            {subnet ? subnet.network : 'No subnet'}
                          </div>
                        </div>
                      );
                    })()}
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
                        onClick={() => handleEditDevice(device)}
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
                ))
              )}
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
    </div>
  );
}
