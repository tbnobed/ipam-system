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
import { Plus, Edit, Edit2, Trash2, Network, Users, Activity, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
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
  const { user } = useAuth();

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
    queryKey: ['/api/devices/all'],
    refetchInterval: 30000,
  });

  const getSubnetsForVlan = (vlanId: number) => {
    return subnets?.filter(subnet => subnet.vlanId === vlanId) || [];
  };

  const getSubnetMetrics = (subnetId: number) => {
    const subnet = subnets?.find(s => s.id === subnetId);
    const utilization = subnetUtilization?.find(u => u.subnetId === subnetId);
    const allDevices = devices?.data || [];
    
    if (!subnet) {
      return {
        totalIPs: 0,
        usedIPs: 0,
        availableIPs: 0,
        utilization: 0,
        totalDevices: 0,
        onlineDevices: 0,
        offlineDevices: 0,
        healthStatus: 'inactive'
      };
    }
    
    const [network, cidr] = subnet.network.split('/');
    const cidrNum = parseInt(cidr, 10);
    const totalIPs = Math.pow(2, 32 - cidrNum) - 2;
    
    const subnetDevices = allDevices.filter(device => device.subnetId === subnetId);
    const onlineDevices = subnetDevices.filter(device => device.status === 'online').length;
    const offlineDevices = subnetDevices.length - onlineDevices;
    
    const usedIPs = utilization?.usedIPs || subnetDevices.length;
    const availableIPs = totalIPs - usedIPs;
    const utilizationPercent = (usedIPs / totalIPs) * 100;
    
    let healthStatus = 'healthy';
    if (utilizationPercent > 90) healthStatus = 'warning';
    if (utilizationPercent === 0) healthStatus = 'inactive';
    
    return {
      totalIPs,
      usedIPs,
      availableIPs,
      utilization: utilizationPercent,
      totalDevices: subnetDevices.length,
      onlineDevices,
      offlineDevices,
      healthStatus
    };
  };

  const getSubnetDetails = (subnet: Subnet) => {
    const [network, cidr] = subnet.network.split('/');
    const cidrNum = parseInt(cidr, 10);
    const totalHosts = Math.pow(2, 32 - cidrNum);
    const usableHosts = totalHosts - 2;
    
    const networkParts = network.split('.').map(Number);
    const networkInt = (networkParts[0] << 24) + (networkParts[1] << 16) + (networkParts[2] << 8) + networkParts[3];
    
    const mask = (0xFFFFFFFF << (32 - cidrNum)) >>> 0;
    const networkAddress = (networkInt & mask) >>> 0;
    const broadcastAddress = (networkAddress | (~mask >>> 0)) >>> 0;
    
    const networkAddressStr = [
      (networkAddress >>> 24) & 255,
      (networkAddress >>> 16) & 255,
      (networkAddress >>> 8) & 255,
      networkAddress & 255
    ].join('.');
    
    const broadcastAddressStr = [
      (broadcastAddress >>> 24) & 255,
      (broadcastAddress >>> 16) & 255,
      (broadcastAddress >>> 8) & 255,
      broadcastAddress & 255
    ].join('.');
    
    const firstUsableIP = [
      (networkAddress >>> 24) & 255,
      (networkAddress >>> 16) & 255,
      (networkAddress >>> 8) & 255,
      (networkAddress & 255) + 1
    ].join('.');
    
    const lastUsableIP = [
      (broadcastAddress >>> 24) & 255,
      (broadcastAddress >>> 16) & 255,
      (broadcastAddress >>> 8) & 255,
      (broadcastAddress & 255) - 1
    ].join('.');
    
    return {
      subnet,
      metrics: getSubnetMetrics(subnet.id),
      totalHosts,
      networkAddress: networkAddressStr,
      broadcastAddress: broadcastAddressStr,
      firstUsableIP,
      lastUsableIP
    };
  };

  const handleSubnetCardClick = (subnet: Subnet) => {
    setSelectedSubnet(subnet);
    setSubnetDetailsOpen(true);
  };

  const createVlanMutation = useMutation({
    mutationFn: (data: VlanFormData) => apiRequest('/api/vlans', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vlans'] });
      toast({ title: "Success", description: "VLAN created successfully" });
      setVlanDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create VLAN",
        variant: "destructive"
      });
    }
  });

  const updateVlanMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: VlanFormData }) => 
      apiRequest(`/api/vlans/${id}`, 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vlans'] });
      toast({ title: "Success", description: "VLAN updated successfully" });
      setVlanDialogOpen(false);
      setEditingVlan(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update VLAN",
        variant: "destructive"
      });
    }
  });

  const deleteVlanMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/vlans/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vlans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/subnets'] });
      toast({ title: "Success", description: "VLAN deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete VLAN",
        variant: "destructive"
      });
    }
  });

  const createSubnetMutation = useMutation({
    mutationFn: (data: SubnetFormData) => apiRequest('/api/subnets', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subnets'] });
      toast({ title: "Success", description: "Subnet created successfully" });
      setSubnetDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create subnet",
        variant: "destructive"
      });
    }
  });

  const updateSubnetMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SubnetFormData }) => 
      apiRequest(`/api/subnets/${id}`, 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subnets'] });
      toast({ title: "Success", description: "Subnet updated successfully" });
      setSubnetDialogOpen(false);
      setEditingSubnet(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update subnet",
        variant: "destructive"
      });
    }
  });

  const deleteSubnetMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/subnets/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subnets'] });
      toast({ title: "Success", description: "Subnet deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete subnet",
        variant: "destructive"
      });
    }
  });

  if (vlansLoading || subnetsLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">VLANs & Subnets</h1>
          {user?.role !== "viewer" && (
            <div className="flex items-center space-x-2">
              <Dialog open={vlanDialogOpen} onOpenChange={setVlanDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingVlan(null)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add VLAN
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingVlan ? 'Edit VLAN' : 'Create VLAN'}
                    </DialogTitle>
                  </DialogHeader>
                  <VlanForm
                    vlan={editingVlan}
                    onSubmit={(data) => {
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
                    <DialogTitle>
                      {editingSubnet ? 'Edit Subnet' : 'Create Subnet'}
                    </DialogTitle>
                  </DialogHeader>
                  <SubnetForm
                    subnet={editingSubnet}
                    vlans={vlans || []}
                    onSubmit={(data) => {
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
          )}
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
                    {user?.role !== "viewer" && (
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
                    )}
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
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-4">
                                  <span className="font-mono text-lg font-medium">
                                    {subnet.network}
                                  </span>
                                  <Badge variant="outline">
                                    DHCP
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
                                {user?.role !== "viewer" && (
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
                              )}

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

                              <div className="mb-4">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm font-medium text-gray-700">Network Utilization</span>
                                  <span className="text-sm text-gray-600">{metrics.utilization.toFixed(1)}%</span>
                                </div>
                                <Progress 
                                  value={metrics.utilization} 
                                  className="w-full"
                                />
                              </div>

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

        <Dialog open={subnetDetailsOpen} onOpenChange={setSubnetDetailsOpen}>
          <DialogContent className="max-w-6xl min-h-[85vh] max-h-[95vh] h-[85vh] overflow-y-auto !h-[85vh]">
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
