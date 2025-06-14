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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Network, Users, Eye } from "lucide-react";
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

  console.log('VLANs data:', vlans);
  console.log('Subnets data:', subnets);
  console.log('Devices data:', devices);

  const getSubnetsForVlan = (vlanId: number) => {
    const result = subnets.filter(subnet => subnet.vlanId === vlanId);
    console.log(`Subnets for VLAN ${vlanId}:`, result);
    return result;
  };

  const getDevicesForSubnet = (subnetId: number) => {
    const result = devices.filter(device => device.subnetId === subnetId);
    console.log(`Devices for subnet ${subnetId}:`, result);
    return result;
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
      <>
        <Header title="VLANs & Subnets" subtitle="Network configuration and management" />
        <main className="container mx-auto p-6">
          <div className="animate-pulse">Loading...</div>
        </main>
      </>
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
                  <Plus className="w-4 h-4 mr-2" />
                  Add Subnet
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingSubnet ? "Edit Subnet" : "Create Subnet"}</DialogTitle>
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
                          <Button variant="ghost" size="sm" className="text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete VLAN</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete VLAN {vlan.vlanId} ({vlan.name})? 
                              This action cannot be undone.
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
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Subnets</h4>
                    {vlanSubnets.length > 0 ? (
                      <div className="grid gap-3">
                        {vlanSubnets.map((subnet) => {
                          const subnetDevices = getDevicesForSubnet(subnet.id);
                          const onlineDevices = subnetDevices.filter(d => d.status === 'online').length;
                          const totalDevices = subnetDevices.length;
                          
                          return (
                            <div key={subnet.id} className="p-4 border rounded-lg bg-white">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-3">
                                  <span className="font-mono text-lg font-medium">{subnet.network}</span>
                                  <Badge variant="outline">{subnet.assignmentType.toUpperCase()}</Badge>
                                  <Badge variant="secondary">{totalDevices} devices</Badge>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleSubnetClick(subnet)}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
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

                              <div className="grid grid-cols-4 gap-3 mb-3">
                                <div className="text-center p-2 bg-blue-50 rounded">
                                  <div className="text-lg font-bold text-blue-600">254</div>
                                  <div className="text-xs text-gray-600">Total IPs</div>
                                </div>
                                <div className="text-center p-2 bg-green-50 rounded">
                                  <div className="text-lg font-bold text-green-600">{254 - totalDevices}</div>
                                  <div className="text-xs text-gray-600">Available</div>
                                </div>
                                <div className="text-center p-2 bg-orange-50 rounded">
                                  <div className="text-lg font-bold text-orange-600">{totalDevices}</div>
                                  <div className="text-xs text-gray-600">Used</div>
                                </div>
                                <div className="text-center p-2 bg-purple-50 rounded">
                                  <div className="text-lg font-bold text-purple-600">
                                    {totalDevices > 0 ? ((totalDevices / 254) * 100).toFixed(1) : '0.0'}%
                                  </div>
                                  <div className="text-xs text-gray-600">Utilization</div>
                                </div>
                              </div>

                              <div className="text-sm text-gray-600">
                                <span className="font-medium">Gateway:</span> {subnet.gateway} | 
                                <span className="font-medium"> Description:</span> {subnet.description || 'No description'}
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
              <SubnetDetailsDialog subnet={selectedSubnet} devices={getDevicesForSubnet(selectedSubnet.id)} />
            )}
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}

// Subnet Details Dialog Component
function SubnetDetailsDialog({ subnet, devices }: { subnet: Subnet; devices: any[] }) {
  const totalHosts = 254; // For /24 networks
  const usedIPs = devices.length;
  const availableIPs = totalHosts - usedIPs;
  const utilization = usedIPs > 0 ? (usedIPs / totalHosts) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700">Network Range</p>
          <p className="text-lg font-bold text-blue-600">{subnet.network}</p>
          <p className="text-xs text-gray-500">10.63.21.1 - 10.63.21.254</p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700">Available IPs</p>
          <p className="text-lg font-bold text-green-600">{availableIPs}</p>
          <p className="text-xs text-gray-500">{((availableIPs / totalHosts) * 100).toFixed(1)}% free</p>
        </div>
        <div className="p-4 bg-orange-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700">Used IPs</p>
          <p className="text-lg font-bold text-orange-600">{usedIPs}</p>
          <p className="text-xs text-gray-500">{usedIPs} devices</p>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700">Gateway</p>
          <p className="text-lg font-bold text-purple-600 font-mono">{subnet.gateway}</p>
          <p className="text-xs text-gray-500">{subnet.assignmentType.toUpperCase()}</p>
        </div>
      </div>

      {/* Device List */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3 flex items-center">
          <Users className="w-4 h-4 mr-2" />
          Used IP Addresses ({usedIPs})
        </h4>
        <div className="border rounded-lg max-h-64 overflow-y-auto">
          {devices.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">IP Address</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Device</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {devices.map((device: any) => (
                  <tr key={device.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-sm">{device.ipAddress}</td>
                    <td className="px-3 py-2 text-sm">
                      {device.hostname || 'Unknown Device'}
                      {device.vendor && (
                        <div className="text-xs text-gray-500">{device.vendor}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge 
                        variant={device.status === 'online' ? 'default' : device.status === 'unknown' ? 'secondary' : 'destructive'}
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

      {/* Network Information */}
      <div className="border-t pt-4">
        <h4 className="font-medium text-gray-900 mb-3 flex items-center">
          <Network className="w-4 h-4 mr-2" />
          Network Information
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Network Address:</span>
            <div className="font-mono">{subnet.network.split('/')[0]}</div>
          </div>
          <div>
            <span className="font-medium text-gray-700">Subnet Mask:</span>
            <div className="font-mono">/{subnet.network.split('/')[1]}</div>
          </div>
          <div>
            <span className="font-medium text-gray-700">Total Hosts:</span>
            <div>{totalHosts.toLocaleString()}</div>
          </div>
          <div>
            <span className="font-medium text-gray-700">Utilization:</span>
            <div>{utilization.toFixed(1)}%</div>
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
function VlanForm({ vlan, onSubmit, isLoading }: { vlan?: Vlan | null; onSubmit: (data: VlanFormData) => void; isLoading: boolean }) {
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
                <Input {...field} />
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
                <Textarea {...field} />
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
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Saving..." : vlan ? "Update VLAN" : "Create VLAN"}
        </Button>
      </form>
    </Form>
  );
}

// Subnet Form Component
function SubnetForm({ subnet, vlans, onSubmit, isLoading }: { subnet?: Subnet | null; vlans: Vlan[]; onSubmit: (data: SubnetFormData) => void; isLoading: boolean }) {
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
              <FormLabel>Network (CIDR)</FormLabel>
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
              <FormLabel>Gateway IP</FormLabel>
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
              <Select value={field.value.toString()} onValueChange={(value) => field.onChange(parseInt(value))}>
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
              <Select value={field.value} onValueChange={field.onChange}>
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
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Saving..." : subnet ? "Update Subnet" : "Create Subnet"}
        </Button>
      </form>
    </Form>
  );
}