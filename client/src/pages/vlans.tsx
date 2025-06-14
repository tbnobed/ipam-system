import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Edit, Trash2, Network, Monitor, Activity } from "lucide-react";

import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

import type { Vlan, Subnet, InsertVlan, InsertSubnet } from "@shared/schema";

// Form schemas
const vlanSchema = z.object({
  vlanId: z.coerce.number().min(1).max(4094),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  cableColor: z.string().optional(),
});

const subnetSchema = z.object({
  network: z.string().min(1, "Network is required"),
  description: z.string().optional(),
  gateway: z.string().optional(),
  vlanId: z.coerce.number(),
  assignmentType: z.enum(["static", "dhcp"]),
});

type VlanFormData = z.infer<typeof vlanSchema>;
type SubnetFormData = z.infer<typeof subnetSchema>;

export default function VlansPage() {
  const [vlanDialogOpen, setVlanDialogOpen] = useState(false);
  const [subnetDialogOpen, setSubnetDialogOpen] = useState(false);
  const [subnetDetailsOpen, setSubnetDetailsOpen] = useState(false);
  const [editingVlan, setEditingVlan] = useState<Vlan | null>(null);
  const [editingSubnet, setEditingSubnet] = useState<Subnet | null>(null);
  const [selectedSubnet, setSelectedSubnet] = useState<Subnet | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: vlans = [], isLoading: vlansLoading } = useQuery<Vlan[]>({
    queryKey: ['/api/vlans'],
  });

  const { data: subnets = [], isLoading: subnetsLoading } = useQuery<Subnet[]>({
    queryKey: ['/api/subnets'],
  });

  const { data: devicesResponse } = useQuery<{data: any[]}>({
    queryKey: ['/api/devices'],
    refetchInterval: 30000,
  });

  const devices = devicesResponse?.data || [];

  const getSubnetsForVlan = (vlanId: number) => {
    return subnets.filter(subnet => subnet.vlanId === vlanId);
  };

  const getDevicesForSubnet = (subnetId: number) => {
    return devices.filter(device => device.subnetId === subnetId);
  };

  const handleSubnetClick = (subnet: Subnet) => {
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
      apiRequest(`/api/vlans/${id}`, 'PATCH', data),
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
      apiRequest(`/api/subnets/${id}`, 'PATCH', data),
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
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading VLANs and subnets...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header title="VLANs & Subnets" subtitle="Network configuration and management" />
      <main className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">VLANs & Subnets</h1>
          <div className="flex gap-2">
            <Dialog open={vlanDialogOpen} onOpenChange={setVlanDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingVlan(null);
                  setVlanDialogOpen(true);
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add VLAN
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingVlan ? "Edit VLAN" : "Create VLAN"}</DialogTitle>
                  <DialogDescription>
                    {editingVlan ? "Update VLAN configuration" : "Create a new VLAN for network segmentation"}
                  </DialogDescription>
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
                <Button variant="outline" onClick={() => {
                  setEditingSubnet(null);
                  setSubnetDialogOpen(true);
                }}>
                  <Network className="w-4 h-4 mr-2" />
                  Add Subnet
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingSubnet ? "Edit Subnet" : "Create Subnet"}</DialogTitle>
                  <DialogDescription>
                    {editingSubnet ? "Update subnet configuration" : "Create a new subnet within a VLAN"}
                  </DialogDescription>
                </DialogHeader>
                <SubnetForm
                  subnet={editingSubnet}
                  vlans={vlans}
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
        </div>

        <div className="grid gap-6">
          {vlans.map((vlan) => {
            const vlanSubnets = getSubnetsForVlan(vlan.id);
            return (
              <Card key={vlan.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: vlan.cableColor || '#6b7280' }}
                      />
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          VLAN {vlan.vlanId} - {vlan.name}
                          <Badge variant="outline">{vlanSubnets.length} subnet{vlanSubnets.length !== 1 ? 's' : ''}</Badge>
                        </CardTitle>
                        <p className="text-sm text-gray-600 mt-1">{vlan.description}</p>
                      </div>
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
                          <Button variant="ghost" size="sm">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete VLAN</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete VLAN {vlan.vlanId} - {vlan.name}? 
                              This will also delete all associated subnets and devices.
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
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {vlanSubnets.length === 0 ? (
                      <p className="text-gray-500 text-sm">No subnets configured</p>
                    ) : (
                      vlanSubnets.map((subnet) => {
                        const subnetDevices = getDevicesForSubnet(subnet.id);
                        return (
                          <div
                            key={subnet.id}
                            className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            onClick={() => handleSubnetClick(subnet)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <Network className="w-4 h-4 text-blue-600" />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-medium">{subnet.network}</span>
                                    <Badge variant="outline">{subnet.assignmentType}</Badge>
                                    <Badge variant="secondary">
                                      <Monitor className="w-3 h-3 mr-1" />
                                      {subnetDevices.length} devices
                                    </Badge>
                                  </div>
                                  <div className="text-sm text-gray-600 mt-1 flex items-center gap-4">
                                    <span>Gateway: {subnet.gateway || 'Not configured'}</span>
                                    <span>{subnet.description}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingSubnet(subnet);
                                    setSubnetDialogOpen(true);
                                  }}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Subnet</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete subnet {subnet.network}? 
                                        This will also delete all associated devices.
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
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Subnet Details Dialog */}
        <Dialog open={subnetDetailsOpen} onOpenChange={setSubnetDetailsOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Network className="w-5 h-5" />
                Subnet Details: {selectedSubnet?.network}
              </DialogTitle>
              <DialogDescription>
                Network configuration and device information
              </DialogDescription>
            </DialogHeader>
            
            {selectedSubnet && (
              <SubnetDetails 
                subnet={selectedSubnet} 
                devices={getDevicesForSubnet(selectedSubnet.id)} 
              />
            )}
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}

// VLAN Form Component
function VlanForm({ 
  vlan, 
  onSubmit, 
  isLoading 
}: { 
  vlan: Vlan | null; 
  onSubmit: (data: VlanFormData) => void; 
  isLoading: boolean; 
}) {
  const form = useForm<VlanFormData>({
    resolver: zodResolver(vlanSchema),
    defaultValues: {
      vlanId: vlan?.vlanId || 0,
      name: vlan?.name || "",
      description: vlan?.description || "",
      cableColor: vlan?.cableColor || "#6b7280",
    },
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
                  min="1" 
                  max="4094" 
                  {...field} 
                  placeholder="e.g., 100" 
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
                <Input {...field} placeholder="e.g., Production Network" />
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
                <Textarea {...field} placeholder="Optional description" />
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
              <FormLabel>Cable Color</FormLabel>
              <FormControl>
                <Input type="color" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex justify-end space-x-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : (vlan ? "Update" : "Create")}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Subnet Form Component
function SubnetForm({ 
  subnet, 
  vlans, 
  onSubmit, 
  isLoading 
}: { 
  subnet: Subnet | null; 
  vlans: Vlan[]; 
  onSubmit: (data: any) => void; 
  isLoading: boolean; 
}) {
  const [network, setNetwork] = useState(subnet?.network || "");
  const [description, setDescription] = useState(subnet?.description || "");
  const [gateway, setGateway] = useState(subnet?.gateway || "");
  const [vlanId, setVlanId] = useState(subnet?.vlanId || (vlans[0]?.id || 0));
  const [assignmentType, setAssignmentType] = useState(subnet?.assignmentType || "static");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      network,
      description,
      gateway,
      vlanId,
      assignmentType,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Network (CIDR)</label>
        <Input 
          value={network} 
          onChange={(e) => setNetwork(e.target.value)} 
          placeholder="e.g., 192.168.1.0/24" 
          required
        />
      </div>
      
      <div>
        <label className="text-sm font-medium">Gateway IP</label>
        <Input 
          value={gateway} 
          onChange={(e) => setGateway(e.target.value)} 
          placeholder="e.g., 192.168.1.1" 
        />
      </div>
      
      <div>
        <label className="text-sm font-medium">VLAN</label>
        <Select onValueChange={(value) => setVlanId(Number(value))} value={vlanId.toString()}>
          <SelectTrigger>
            <SelectValue placeholder="Select a VLAN" />
          </SelectTrigger>
          <SelectContent>
            {vlans.map((vlan) => (
              <SelectItem key={vlan.id} value={vlan.id.toString()}>
                VLAN {vlan.vlanId} - {vlan.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <label className="text-sm font-medium">Assignment Type</label>
        <Select onValueChange={setAssignmentType} value={assignmentType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="static">Static</SelectItem>
            <SelectItem value="dhcp">DHCP</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <label className="text-sm font-medium">Description</label>
        <Textarea 
          value={description} 
          onChange={(e) => setDescription(e.target.value)} 
          placeholder="Optional description" 
        />
      </div>
      
      <div className="flex justify-end space-x-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : (subnet ? "Update" : "Create")}
        </Button>
      </div>
    </form>
  );
}

// Subnet Details Component
function SubnetDetails({ subnet, devices }: { subnet: Subnet; devices: any[] }) {
  // Calculate IP utilization
  const totalIPs = 254; // Assuming /24 subnet
  const usedIPs = devices.length;
  const utilization = (usedIPs / totalIPs) * 100;

  return (
    <div className="space-y-6">
      {/* Subnet Info */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Network Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Network:</span>
                <span className="font-mono">{subnet.network}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Gateway:</span>
                <span className="font-mono">{subnet.gateway || 'Not configured'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Assignment:</span>
                <Badge variant="outline">{subnet.assignmentType}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Used IPs:</span>
                <span>{usedIPs}/{totalIPs}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    utilization > 80 ? 'bg-red-500' : 
                    utilization > 60 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${utilization}%` }}
                />
              </div>
              <div className="text-sm text-gray-600">{utilization.toFixed(1)}% utilized</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Device List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-4 h-4" />
            Connected Devices ({devices.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <p className="text-gray-500 text-sm">No devices found in this subnet</p>
          ) : (
            <div className="space-y-2">
              {devices.map((device) => (
                <div key={device.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${device.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <div>
                      <div className="font-medium">{device.hostname || 'Unknown Device'}</div>
                      <div className="text-sm text-gray-600 font-mono">{device.ipAddress}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{device.status}</Badge>
                    {device.vendor && <Badge variant="secondary">{device.vendor}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}