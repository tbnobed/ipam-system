import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Network, Users, Activity, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Vlan, Subnet, InsertVlan, InsertSubnet } from "@shared/schema";

const vlanSchema = z.object({
  vlanId: z.number().min(1).max(4094),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  cableColor: z.string().optional()
});

const subnetSchema = z.object({
  network: z.string().min(1, "Network is required").regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:[0-9]|[1-2][0-9]|3[0-2])$/, "Invalid network format (e.g., 192.168.1.0/24)"),
  gateway: z.string().min(1, "Gateway is required").ip("Invalid IP address"),
  vlanId: z.number().min(1, "VLAN is required"),
  assignmentType: z.enum(["static", "dhcp"]),
  description: z.string().optional()
});

type VlanFormData = z.infer<typeof vlanSchema>;
type SubnetFormData = z.infer<typeof subnetSchema>;

export default function VLANs() {
  const [vlanDialogOpen, setVlanDialogOpen] = useState(false);
  const [subnetDialogOpen, setSubnetDialogOpen] = useState(false);
  const [subnetDetailsOpen, setSubnetDetailsOpen] = useState(false);
  const [editingVlan, setEditingVlan] = useState<Vlan | null>(null);
  const [editingSubnet, setEditingSubnet] = useState<Subnet | null>(null);
  const [selectedSubnet, setSelectedSubnet] = useState<Subnet | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: vlans, isLoading: vlansLoading } = useQuery<Vlan[]>({
    queryKey: ['/api/vlans'],
  });

  const { data: subnets, isLoading: subnetsLoading } = useQuery<Subnet[]>({
    queryKey: ['/api/subnets'],
  });

  const { data: subnetUtilization } = useQuery<any[]>({
    queryKey: ['/api/dashboard/subnet-utilization'],
    refetchInterval: 30000,
  });

  const { data: devices } = useQuery<{data: any[]}>({
    queryKey: ['/api/devices'],
    refetchInterval: 30000,
  });

  const getSubnetsForVlan = (vlanId: number) => {
    return subnets?.filter(subnet => subnet.vlanId === vlanId) || [];
  };

  const getSubnetMetrics = (subnetId: number) => {
    const utilData = subnetUtilization?.find((util: any) => util.id === subnetId);
    const deviceData = devices?.data?.filter((device: any) => device.subnetId === subnetId) || [];
    const onlineDevices = deviceData.filter((device: any) => device.status === 'online').length;
    const offlineDevices = deviceData.filter((device: any) => device.status === 'offline').length;
    
    return {
      totalIPs: utilData?.total || 0,
      usedIPs: (utilData?.total || 0) - (utilData?.available || 0),
      availableIPs: utilData?.available || 0,
      utilization: utilData?.utilization || 0,
      totalDevices: deviceData.length,
      onlineDevices,
      offlineDevices,
      healthStatus: onlineDevices > offlineDevices ? 'healthy' : offlineDevices > 0 ? 'warning' : 'inactive'
    };
  };

  const getSubnetDetails = (subnet: Subnet) => {
    const deviceData = devices?.data?.filter((device: any) => device.subnetId === subnet.id) || [];
    const metrics = getSubnetMetrics(subnet.id);
    
    // Parse network CIDR
    const [networkAddr, cidrBits] = subnet.network.split('/');
    const cidr = parseInt(cidrBits);
    const hostBits = 32 - cidr;
    const totalHosts = Math.pow(2, hostBits) - 2; // Subtract network and broadcast
    
    // Generate IP range
    const networkParts = networkAddr.split('.').map(Number);
    const networkInt = (networkParts[0] << 24) + (networkParts[1] << 16) + (networkParts[2] << 8) + networkParts[3];
    const broadcastInt = networkInt + Math.pow(2, hostBits) - 1;
    
    const usedIPs = new Set(deviceData.map((device: any) => device.ipAddress));
    const availableRanges: string[] = [];
    const usedRanges: { ip: string; device: any }[] = [];
    
    // Generate available and used IP lists
    for (let i = networkInt + 1; i < broadcastInt; i++) {
      const ip = [
        (i >>> 24) & 255,
        (i >>> 16) & 255,
        (i >>> 8) & 255,
        i & 255
      ].join('.');
      
      const device = deviceData.find((d: any) => d.ipAddress === ip);
      if (device) {
        usedRanges.push({ ip, device });
      } else {
        availableRanges.push(ip);
      }
    }
    
    return {
      subnet,
      metrics,
      totalHosts,
      networkAddress: networkAddr,
      broadcastAddress: [
        (broadcastInt >>> 24) & 255,
        (broadcastInt >>> 16) & 255,
        (broadcastInt >>> 8) & 255,
        broadcastInt & 255
      ].join('.'),
      firstUsableIP: [
        ((networkInt + 1) >>> 24) & 255,
        ((networkInt + 1) >>> 16) & 255,
        ((networkInt + 1) >>> 8) & 255,
        (networkInt + 1) & 255
      ].join('.'),
      lastUsableIP: [
        ((broadcastInt - 1) >>> 24) & 255,
        ((broadcastInt - 1) >>> 16) & 255,
        ((broadcastInt - 1) >>> 8) & 255,
        (broadcastInt - 1) & 255
      ].join('.'),
      availableRanges: availableRanges.slice(0, 50), // Limit for performance
      usedRanges,
      deviceData
    };
  };

  const handleSubnetCardClick = (subnet: Subnet) => {
    setSelectedSubnet(subnet);
    setSubnetDetailsOpen(true);
  };

  // VLAN mutations
  const createVlanMutation = useMutation({
    mutationFn: (data: VlanFormData) => apiRequest('/api/vlans', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vlans'] });
      setVlanDialogOpen(false);
      toast({ title: "VLAN created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create VLAN", variant: "destructive" });
    }
  });

  const updateVlanMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: VlanFormData }) => 
      apiRequest(`/api/vlans/${id}`, 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vlans'] });
      setVlanDialogOpen(false);
      setEditingVlan(null);
      toast({ title: "VLAN updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update VLAN", variant: "destructive" });
    }
  });

  const deleteVlanMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/vlans/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vlans'] });
      toast({ title: "VLAN deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete VLAN", variant: "destructive" });
    }
  });

  // Subnet mutations
  const createSubnetMutation = useMutation({
    mutationFn: (data: SubnetFormData) => apiRequest('/api/subnets', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subnets'] });
      setSubnetDialogOpen(false);
      toast({ title: "Subnet created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create subnet", variant: "destructive" });
    }
  });

  const updateSubnetMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SubnetFormData }) => 
      apiRequest(`/api/subnets/${id}`, 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subnets'] });
      setSubnetDialogOpen(false);
      setEditingSubnet(null);
      toast({ title: "Subnet updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update subnet", variant: "destructive" });
    }
  });

  const deleteSubnetMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/subnets/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subnets'] });
      toast({ title: "Subnet deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete subnet", variant: "destructive" });
    }
  });

  if (vlansLoading || subnetsLoading) {
    return <div className="flex items-center justify-center h-64">Loading VLANs...</div>;
  }

  return (
    <>
      <Header
        title="VLANs & Subnets"
        subtitle="Manage network segmentation and IP address spaces"
      />
      
      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Virtual LANs</h3>
          <div className="space-x-2">
            <Dialog open={vlanDialogOpen} onOpenChange={setVlanDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingVlan(null)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add VLAN
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingVlan ? 'Edit VLAN' : 'Add New VLAN'}</DialogTitle>
                </DialogHeader>
                <VlanForm
                  vlan={editingVlan}
                  onSubmit={(data: VlanFormData) => {
                    if (editingVlan) {
                      updateVlanMutation.mutate({ id: editingVlan.id, data });
                    } else {
                      createVlanMutation.mutate(data);
                    }
                  }}
                  isLoading={createVlanMutation.isPending || updateVlanMutation.isPending}
                />
              </DialogContent>
            </Dialog>
            
            <Dialog open={subnetDialogOpen} onOpenChange={setSubnetDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={() => setEditingSubnet(null)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Subnet
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingSubnet ? 'Edit Subnet' : 'Add New Subnet'}</DialogTitle>
                </DialogHeader>
                <SubnetForm
                  subnet={editingSubnet}
                  vlans={vlans || []}
                  onSubmit={(data: SubnetFormData) => {
                    if (editingSubnet) {
                      updateSubnetMutation.mutate({ id: editingSubnet.id, data });
                    } else {
                      createSubnetMutation.mutate(data);
                    }
                  }}
                  isLoading={createSubnetMutation.isPending || updateSubnetMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-6">
          {vlans?.map((vlan) => {
            const vlanSubnets = getSubnetsForVlan(vlan.id);
            
            return (
              <Card key={vlan.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <CardTitle>VLAN {vlan.vlanId}</CardTitle>
                      <Badge variant="secondary">{vlan.name}</Badge>
                      {vlan.cableColor && (
                        <div 
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: vlan.cableColor }}
                          title={`Cable Color: ${vlan.cableColor}`}
                        />
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setEditingVlan(vlan);
                          setVlanDialogOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete VLAN</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete VLAN {vlan.vlanId} ({vlan.name})? 
                              This action cannot be undone and will permanently delete:
                              <br />• All subnets in this VLAN
                              <br />• All devices in those subnets
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteVlanMutation.mutate(vlan.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{vlan.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Subnets</h4>
                    {vlanSubnets.length > 0 ? (
                      <div className="grid gap-4">
                        {vlanSubnets.map((subnet) => {
                          const metrics = getSubnetMetrics(subnet.id);
                          
                          return (
                            <div key={subnet.id} className="p-6 border rounded-lg bg-white shadow-sm">
                              {/* Subnet Header */}
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-4">
                                  <span className="font-mono text-lg font-medium">
                                    {subnet.network}
                                  </span>
                                  <Badge variant="outline">
                                    {subnet.assignmentType.toUpperCase()}
                                  </Badge>
                                  <Badge 
                                    variant={
                                      metrics.healthStatus === 'healthy' ? 'default' : 
                                      metrics.healthStatus === 'warning' ? 'destructive' : 'secondary'
                                    }
                                  >
                                    {metrics.healthStatus === 'healthy' ? 'Healthy' : 
                                     metrics.healthStatus === 'warning' ? 'Issues' : 'Inactive'}
                                  </Badge>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => {
                                      setEditingSubnet(subnet);
                                      setSubnetDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="text-red-600">
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Subnet</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete subnet {subnet.network}? 
                                          This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteSubnetMutation.mutate(subnet.id)}
                                          className="bg-red-600 hover:bg-red-700"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>

                              {/* Network Metrics Grid - Clickable */}
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                <button 
                                  onClick={() => handleSubnetCardClick(subnet)}
                                  className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                                >
                                  <Network className="w-8 h-8 text-blue-600" />
                                  <div>
                                    <p className="text-sm font-medium text-gray-700">Total IPs</p>
                                    <p className="text-xl font-bold text-blue-600">{metrics.totalIPs.toLocaleString()}</p>
                                  </div>
                                </button>
                                
                                <button 
                                  onClick={() => handleSubnetCardClick(subnet)}
                                  className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors cursor-pointer"
                                >
                                  <Activity className="w-8 h-8 text-green-600" />
                                  <div>
                                    <p className="text-sm font-medium text-gray-700">Available</p>
                                    <p className="text-xl font-bold text-green-600">{metrics.availableIPs.toLocaleString()}</p>
                                  </div>
                                </button>
                                
                                <button 
                                  onClick={() => handleSubnetCardClick(subnet)}
                                  className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors cursor-pointer"
                                >
                                  <Users className="w-8 h-8 text-orange-600" />
                                  <div>
                                    <p className="text-sm font-medium text-gray-700">Used IPs</p>
                                    <p className="text-xl font-bold text-orange-600">{metrics.usedIPs.toLocaleString()}</p>
                                  </div>
                                </button>
                                
                                <button 
                                  onClick={() => handleSubnetCardClick(subnet)}
                                  className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors cursor-pointer"
                                >
                                  <AlertTriangle className={`w-8 h-8 ${metrics.offlineDevices > 0 ? 'text-red-600' : 'text-purple-600'}`} />
                                  <div>
                                    <p className="text-sm font-medium text-gray-700">Devices</p>
                                    <p className="text-xl font-bold text-purple-600">
                                      {metrics.onlineDevices}/{metrics.totalDevices}
                                    </p>
                                  </div>
                                </button>
                              </div>

                              {/* Utilization Progress Bar */}
                              <div className="mb-4">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm font-medium text-gray-700">Network Utilization</span>
                                  <span className="text-sm text-gray-600">{metrics.utilization.toFixed(1)}%</span>
                                </div>
                                <Progress 
                                  value={metrics.utilization} 
                                  className={`w-full ${
                                    metrics.utilization > 90 ? 'text-red-600' : 
                                    metrics.utilization > 70 ? 'text-yellow-600' : 'text-green-600'
                                  }`}
                                />
                              </div>

                              {/* Subnet Details */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 pt-4 border-t">
                                <div>
                                  <span className="font-medium">Gateway: </span>
                                  <span className="font-mono">{subnet.gateway}</span>
                                </div>
                                <div>
                                  <span className="font-medium">Description: </span>
                                  {subnet.description || 'No description'}
                                </div>
                                {metrics.totalDevices > 0 && (
                                  <>
                                    <div>
                                      <span className="font-medium">Online Devices: </span>
                                      <span className="text-green-600 font-medium">{metrics.onlineDevices}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium">Offline Devices: </span>
                                      <span className="text-red-600 font-medium">{metrics.offlineDevices}</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No subnets configured</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Subnet Details Dialog */}
        <Dialog open={subnetDetailsOpen} onOpenChange={setSubnetDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Subnet Details: {selectedSubnet?.network}
              </DialogTitle>
            </DialogHeader>
            {selectedSubnet && (
              <SubnetDetailsDialog 
                subnet={selectedSubnet} 
                details={getSubnetDetails(selectedSubnet)}
              />
            )}
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}

// Subnet Details Dialog Component
interface SubnetDetailsDialogProps {
  subnet: Subnet;
  details: {
    subnet: Subnet;
    metrics: {
      totalIPs: number;
      usedIPs: number;
      availableIPs: number;
      utilization: number;
      totalDevices: number;
      onlineDevices: number;
      offlineDevices: number;
      healthStatus: string;
    };
    totalHosts: number;
    networkAddress: string;
    broadcastAddress: string;
    firstUsableIP: string;
    lastUsableIP: string;
    availableRanges: string[];
    usedRanges: { ip: string; device: any }[];
    deviceData: any[];
  };
}

function SubnetDetailsDialog({ subnet, details }: SubnetDetailsDialogProps) {
  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700">Network Range</p>
          <p className="text-lg font-bold text-blue-600">{subnet.network}</p>
          <p className="text-xs text-gray-500">
            {details.firstUsableIP} - {details.lastUsableIP}
          </p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700">Available IPs</p>
          <p className="text-lg font-bold text-green-600">{details.metrics.availableIPs}</p>
          <p className="text-xs text-gray-500">
            {((details.metrics.availableIPs / details.totalHosts) * 100).toFixed(1)}% free
          </p>
        </div>
        <div className="p-4 bg-orange-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700">Used IPs</p>
          <p className="text-lg font-bold text-orange-600">{details.metrics.usedIPs}</p>
          <p className="text-xs text-gray-500">
            {details.usedRanges.length} devices
          </p>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700">Gateway</p>
          <p className="text-lg font-bold text-purple-600 font-mono">{subnet.gateway}</p>
          <p className="text-xs text-gray-500">{subnet.assignmentType.toUpperCase()}</p>
        </div>
      </div>

      {/* IP Allocation Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Used IPs */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3 flex items-center">
            <Users className="w-4 h-4 mr-2" />
            Used IP Addresses ({details.usedRanges.length})
          </h4>
          <div className="border rounded-lg max-h-64 overflow-y-auto">
            {details.usedRanges.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">IP Address</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Device</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {details.usedRanges.map(({ ip, device }: { ip: string; device: any }) => (
                    <tr key={ip} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-sm">{ip}</td>
                      <td className="px-3 py-2 text-sm">
                        {device.hostname || 'Unknown Device'}
                        {device.vendor && (
                          <div className="text-xs text-gray-500">{device.vendor}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge 
                          variant={device.status === 'online' ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {device.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-4 text-center text-gray-500">No IP addresses in use</div>
            )}
          </div>
        </div>

        {/* Available IPs */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3 flex items-center">
            <Activity className="w-4 h-4 mr-2" />
            Available IP Addresses ({details.availableRanges.length > 50 ? '50+' : details.availableRanges.length})
          </h4>
          <div className="border rounded-lg max-h-64 overflow-y-auto">
            {details.availableRanges.length > 0 ? (
              <div className="p-3 space-y-1">
                {details.availableRanges.map((ip: string) => (
                  <div key={ip} className="font-mono text-sm p-2 bg-green-50 rounded border hover:bg-green-100">
                    {ip}
                  </div>
                ))}
                {details.metrics.availableIPs > 50 && (
                  <div className="text-center text-gray-500 text-sm p-2">
                    ... and {details.metrics.availableIPs - 50} more available IPs
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">No IP addresses available</div>
            )}
          </div>
        </div>
      </div>

      {/* Network Information */}
      <div className="border-t pt-4">
        <h4 className="font-medium text-gray-900 mb-3 flex items-center">
          <Network className="w-4 h-4 mr-2" />
          Network Information
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Network Address:</span>
            <div className="font-mono">{details.networkAddress}</div>
          </div>
          <div>
            <span className="font-medium text-gray-700">Broadcast Address:</span>
            <div className="font-mono">{details.broadcastAddress}</div>
          </div>
          <div>
            <span className="font-medium text-gray-700">Subnet Mask:</span>
            <div className="font-mono">/{subnet.network.split('/')[1]}</div>
          </div>
          <div>
            <span className="font-medium text-gray-700">Total Hosts:</span>
            <div>{details.totalHosts.toLocaleString()}</div>
          </div>
          <div>
            <span className="font-medium text-gray-700">Utilization:</span>
            <div>{details.metrics.utilization.toFixed(1)}%</div>
          </div>
          <div>
            <span className="font-medium text-gray-700">Assignment Type:</span>
            <div className="capitalize">{subnet.assignmentType}</div>
          </div>
        </div>
        {subnet.description && (
          <div className="mt-3">
            <span className="font-medium text-gray-700">Description:</span>
            <div className="mt-1">{subnet.description}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// VLAN Form Component
interface VlanFormProps {
  vlan?: Vlan | null;
  onSubmit: (data: VlanFormData) => void;
  isLoading: boolean;
}

function VlanForm({ vlan, onSubmit, isLoading }: VlanFormProps) {
  const form = useForm<VlanFormData>({
    resolver: zodResolver(vlanSchema),
    defaultValues: {
      vlanId: vlan?.vlanId || 0,
      name: vlan?.name || "",
      description: vlan?.description || "",
      cableColor: vlan?.cableColor || ""
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="vlanId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>VLAN ID</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  min={1}
                  max={4094}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Production, Management, etc." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Description of this VLAN's purpose" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="cableColor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cable Color (Optional)</FormLabel>
              <FormControl>
                <Input {...field} type="color" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex justify-end space-x-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : vlan ? "Update VLAN" : "Create VLAN"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Subnet Form Component
interface SubnetFormProps {
  subnet?: Subnet | null;
  vlans: Vlan[];
  onSubmit: (data: SubnetFormData) => void;
  isLoading: boolean;
}

function SubnetForm({ subnet, vlans, onSubmit, isLoading }: SubnetFormProps) {
  const form = useForm<SubnetFormData>({
    resolver: zodResolver(subnetSchema),
    defaultValues: {
      network: subnet?.network || "",
      gateway: subnet?.gateway || "",
      vlanId: subnet?.vlanId || 0,
      assignmentType: (subnet?.assignmentType as "static" | "dhcp") || "static",
      description: subnet?.description || ""
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="network"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Network</FormLabel>
              <FormControl>
                <Input {...field} placeholder="192.168.1.0/24" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="gateway"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Gateway</FormLabel>
              <FormControl>
                <Input {...field} placeholder="192.168.1.1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="vlanId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>VLAN</FormLabel>
              <Select 
                onValueChange={(value) => field.onChange(parseInt(value))}
                value={field.value?.toString()}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a VLAN" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {vlans.map((vlan) => (
                    <SelectItem key={vlan.id} value={vlan.id.toString()}>
                      VLAN {vlan.vlanId} - {vlan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="assignmentType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Assignment Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="static">Static</SelectItem>
                  <SelectItem value="dhcp">DHCP</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Description of this subnet's purpose" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex justify-end space-x-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : subnet ? "Update Subnet" : "Create Subnet"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
