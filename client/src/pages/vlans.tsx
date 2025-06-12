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
import { Plus, Edit, Trash2 } from "lucide-react";
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
  const [editingVlan, setEditingVlan] = useState<Vlan | null>(null);
  const [editingSubnet, setEditingSubnet] = useState<Subnet | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: vlans, isLoading: vlansLoading } = useQuery<Vlan[]>({
    queryKey: ['/api/vlans'],
  });

  const { data: subnets, isLoading: subnetsLoading } = useQuery<Subnet[]>({
    queryKey: ['/api/subnets'],
  });

  const getSubnetsForVlan = (vlanId: number) => {
    return subnets?.filter(subnet => subnet.vlanId === vlanId) || [];
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
                  <DialogTitle>{editingSubnet ? 'Edit Subnet' : 'Add New Subnet'}</DialogTitle>
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
                              This action cannot be undone and will also delete all associated subnets.
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
                        {vlanSubnets.map((subnet) => (
                          <div key={subnet.id} className="p-4 border rounded-lg bg-gray-50">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-4">
                                <span className="font-mono text-sm font-medium">
                                  {subnet.network}
                                </span>
                                <Badge variant="outline">
                                  {subnet.assignmentType.toUpperCase()}
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
                            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                              <div>
                                <span className="font-medium">Gateway: </span>
                                <span className="font-mono">{subnet.gateway}</span>
                              </div>
                              <div>
                                <span className="font-medium">Description: </span>
                                {subnet.description}
                              </div>
                            </div>
                          </div>
                        ))}
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
      </main>
    </>
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
      assignmentType: subnet?.assignmentType || "static",
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
