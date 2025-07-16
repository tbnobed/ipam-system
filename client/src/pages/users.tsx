import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Edit, Plus, Shield, UserCheck, Eye, Settings } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Header from "@/components/layout/header";

const userSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "user", "viewer"])
});

type User = {
  id: number;
  username: string;
  role: "admin" | "user" | "viewer";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const roleIcons = {
  admin: Shield,
  user: UserCheck,
  viewer: Eye
};

const roleColors = {
  admin: "bg-red-100 text-red-800",
  user: "bg-blue-100 text-blue-800",
  viewer: "bg-gray-100 text-gray-800"
};

type UserFormData = z.infer<typeof userSchema>;

export default function Users() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<User | null>(null);
  const [permissionChanges, setPermissionChanges] = useState<Record<string, string>>({});

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const { data: vlans = [] } = useQuery({
    queryKey: ['/api/vlans'],
  });

  const { data: subnets = [] } = useQuery({
    queryKey: ['/api/subnets'],
  });

  const { data: userPermissions = [] } = useQuery({
    queryKey: ['/api/user-permissions', selectedUserForPermissions?.id],
    enabled: !!selectedUserForPermissions?.id,
  });

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: "",
      password: "",
      role: "viewer"
    }
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: UserFormData) => {
      return apiRequest('/api/users', 'POST', userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "User created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create user",
        variant: "destructive",
      });
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, ...userData }: { id: number } & Partial<UserFormData>) => {
      return apiRequest(`/api/users/${id}`, 'PUT', userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsEditDialogOpen(false);
      setEditingUser(null);
      form.reset();
      toast({
        title: "Success",
        description: "User updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/users/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    }
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async (permissions: { userId: number; permissions: Array<{ vlanId?: number; subnetId?: number; permission: string }> }) => {
      return apiRequest('/api/user-permissions', 'POST', permissions);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-permissions'] });
      setIsPermissionDialogOpen(false);
      setPermissionChanges({});
      toast({
        title: "Success",
        description: "Permissions updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update permissions",
        variant: "destructive",
      });
    }
  });

  const handleCreateUser = (data: UserFormData) => {
    createUserMutation.mutate(data);
  };

  const handleUpdateUser = (data: UserFormData) => {
    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, ...data });
    }
  };

  const handleDeleteUser = (id: number) => {
    if (confirm("Are you sure you want to delete this user?")) {
      deleteUserMutation.mutate(id);
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    form.reset({
      username: user.username,
      password: "", // Don't prefill password
      role: user.role
    });
    setIsEditDialogOpen(true);
  };

  const closeDialog = () => {
    setIsCreateDialogOpen(false);
    setIsEditDialogOpen(false);
    setEditingUser(null);
    form.reset();
  };

  const getPermissionForResource = (resourceId: number, resourceType: 'vlan' | 'subnet') => {
    if (!userPermissions) return 'none';
    
    const permission = userPermissions.find((p: any) => 
      resourceType === 'vlan' ? p.vlanId === resourceId : p.subnetId === resourceId
    );
    
    return permission?.permission || 'none';
  };

  const handlePermissionChange = (resourceId: number, resourceType: 'vlan' | 'subnet', permission: string) => {
    const key = `${resourceType}_${resourceId}`;
    setPermissionChanges(prev => ({
      ...prev,
      [key]: permission
    }));
  };

  const handleSavePermissions = async () => {
    if (!selectedUserForPermissions) return;

    const permissions = [];
    
    // Process VLAN permissions
    for (const vlan of vlans) {
      const key = `vlan_${vlan.id}`;
      const permission = permissionChanges[key] || getPermissionForResource(vlan.id, 'vlan');
      if (permission !== 'none') {
        permissions.push({
          vlanId: vlan.id,
          permission
        });
      }
    }
    
    // Process subnet permissions
    for (const subnet of subnets) {
      const key = `subnet_${subnet.id}`;
      const permission = permissionChanges[key] || getPermissionForResource(subnet.id, 'subnet');
      if (permission !== 'none') {
        permissions.push({
          subnetId: subnet.id,
          permission
        });
      }
    }

    updatePermissionsMutation.mutate({
      userId: selectedUserForPermissions.id,
      permissions
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 pt-6">
        <Header title="User Management" />
        <div>Loading users...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 pt-6">
      <div className="flex items-center justify-between">
        <Header title="User Management" />
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create User</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateUser)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createUserMutation.isPending}>
                    Create
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleUpdateUser)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateUserMutation.isPending}>
                    Update
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => {
              const RoleIcon = roleIcons[user.role];
              return (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <RoleIcon className="h-5 w-5" />
                      <span className="font-medium">{user.username}</span>
                    </div>
                    <Badge className={roleColors[user.role]}>
                      {user.role}
                    </Badge>
                    <Badge variant={user.isActive ? "default" : "secondary"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    {(user.role === "user" || user.role === "viewer") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedUserForPermissions(user);
                          setPermissionChanges({});
                          setIsPermissionDialogOpen(true);
                        }}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(user)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteUser(user.id)}
                      disabled={deleteUserMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Permission Management Dialog */}
      <Dialog open={isPermissionDialogOpen} onOpenChange={setIsPermissionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Permissions for {selectedUserForPermissions?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">VLAN Permissions</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {vlans.map((vlan: any) => (
                    <div key={vlan.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{vlan.name}</span>
                        <Badge variant="outline">VLAN {vlan.vlanId}</Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Select 
                          value={permissionChanges[`vlan_${vlan.id}`] || getPermissionForResource(vlan.id, 'vlan')}
                          onValueChange={(value) => handlePermissionChange(vlan.id, 'vlan', value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="view">View</SelectItem>
                            <SelectItem value="edit">Edit</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3">Subnet Permissions</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {subnets.map((subnet: any) => (
                    <div key={subnet.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{subnet.network}</span>
                        <Badge variant="outline">{subnet.name}</Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Select 
                          value={permissionChanges[`subnet_${subnet.id}`] || getPermissionForResource(subnet.id, 'subnet')}
                          onValueChange={(value) => handlePermissionChange(subnet.id, 'subnet', value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="view">View</SelectItem>
                            <SelectItem value="edit">Edit</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsPermissionDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSavePermissions}
                disabled={updatePermissionsMutation.isPending}
              >
                Save Permissions
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}