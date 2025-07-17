import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Edit, Plus, Shield, UserCheck, Eye, Settings, Users as UsersIcon, UserPlus } from "lucide-react";
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
  role: z.enum(["admin", "user", "viewer"]),
  groupId: z.number().optional()
});

const groupSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  description: z.string().optional(),
  role: z.enum(["admin", "user", "viewer"])
});

type User = {
  id: number;
  username: string;
  role: "admin" | "user" | "viewer";
  groupId?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type UserGroup = {
  id: number;
  name: string;
  description?: string;
  role: "admin" | "user" | "viewer";
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
type GroupFormData = z.infer<typeof groupSchema>;

export default function Users() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<User | null>(null);
  const [permissionChanges, setPermissionChanges] = useState<Record<string, string>>({});
  
  // Group management state
  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false);
  const [isEditGroupDialogOpen, setIsEditGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  const [activeTab, setActiveTab] = useState("users");

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const { data: userGroups = [], isLoading: isGroupsLoading } = useQuery<UserGroup[]>({
    queryKey: ['/api/user-groups'],
  });

  const { data: vlans = [] } = useQuery({
    queryKey: ['/api/vlans'],
  });

  const { data: subnets = [] } = useQuery({
    queryKey: ['/api/subnets'],
  });

  const { data: userPermissions = [] } = useQuery({
    queryKey: ['/api/user-permissions', selectedUserForPermissions?.id],
    queryFn: () => selectedUserForPermissions?.id 
      ? fetch(`/api/user-permissions/${selectedUserForPermissions.id}`).then(res => res.json())
      : Promise.resolve([]),
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

  const groupForm = useForm<GroupFormData>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: "",
      description: "",
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

  // Group mutations
  const createGroupMutation = useMutation({
    mutationFn: async (groupData: GroupFormData) => {
      return apiRequest('/api/user-groups', 'POST', groupData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-groups'] });
      setIsCreateGroupDialogOpen(false);
      groupForm.reset();
      toast({
        title: "Success",
        description: "Group created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create group",
        variant: "destructive",
      });
    }
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, ...groupData }: { id: number } & Partial<GroupFormData>) => {
      return apiRequest(`/api/user-groups/${id}`, 'PUT', groupData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-groups'] });
      setIsEditGroupDialogOpen(false);
      setEditingGroup(null);
      groupForm.reset();
      toast({
        title: "Success",
        description: "Group updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update group",
        variant: "destructive",
      });
    }
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/user-groups/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-groups'] });
      toast({
        title: "Success",
        description: "Group deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete group",
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
      role: user.role,
      groupId: user.groupId
    });
    setIsEditDialogOpen(true);
  };

  const closeDialog = () => {
    setIsCreateDialogOpen(false);
    setIsEditDialogOpen(false);
    setEditingUser(null);
    form.reset();
  };

  // Group handlers
  const handleCreateGroup = (data: GroupFormData) => {
    createGroupMutation.mutate(data);
  };

  const handleUpdateGroup = (data: GroupFormData) => {
    if (editingGroup) {
      updateGroupMutation.mutate({ id: editingGroup.id, ...data });
    }
  };

  const handleDeleteGroup = (id: number) => {
    if (confirm("Are you sure you want to delete this group?")) {
      deleteGroupMutation.mutate(id);
    }
  };

  const openEditGroupDialog = (group: UserGroup) => {
    setEditingGroup(group);
    groupForm.reset({
      name: group.name,
      description: group.description || "",
      role: group.role
    });
    setIsEditGroupDialogOpen(true);
  };

  const closeGroupDialog = () => {
    setIsCreateGroupDialogOpen(false);
    setIsEditGroupDialogOpen(false);
    setEditingGroup(null);
    groupForm.reset();
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

  // Helper function to get available permission options based on user role
  const getAvailablePermissions = (userRole: string) => {
    const allPermissions = [
      { value: "none", label: "None", color: "bg-gray-400" },
      { value: "read", label: "View", color: "bg-green-500" },
      { value: "write", label: "Edit", color: "bg-yellow-500" },
      { value: "admin", label: "Admin", color: "bg-red-500" }
    ];

    // Viewers can only be assigned None or View permissions
    if (userRole === "viewer") {
      return allPermissions.filter(p => p.value === "none" || p.value === "read");
    }
    
    // Users can be assigned None, View, or Edit permissions
    if (userRole === "user") {
      return allPermissions.filter(p => p.value !== "admin");
    }
    
    // Admins can be assigned any permission level
    return allPermissions;
  };

  const handleSavePermissions = async () => {
    if (!selectedUserForPermissions) return;

    const permissions = [];
    
    // Process VLAN permissions
    for (const vlan of vlans) {
      const key = `vlan_${vlan.id}`;
      const permission = permissionChanges[key] || getPermissionForResource(vlan.id, 'vlan');
      // Always include the permission, even if it's 'none' - the backend will handle deletion
      permissions.push({
        vlanId: vlan.id,
        permission
      });
    }
    
    // Process subnet permissions
    for (const subnet of subnets) {
      const key = `subnet_${subnet.id}`;
      const permission = permissionChanges[key] || getPermissionForResource(subnet.id, 'subnet');
      // Always include the permission, even if it's 'none' - the backend will handle deletion
      permissions.push({
        subnetId: subnet.id,
        permission
      });
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
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <UsersIcon className="w-4 h-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Groups
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">User Management</h3>
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
                <FormField
                  control={form.control}
                  name="groupId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group (Optional)</FormLabel>
                      <Select onValueChange={(value) => field.onChange(value === "none" ? undefined : parseInt(value))} value={field.value?.toString() || "none"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a group" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Group</SelectItem>
                          {userGroups.map((group) => (
                            <SelectItem key={group.id} value={group.id.toString()}>
                              {group.name}
                            </SelectItem>
                          ))}
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
                <FormField
                  control={form.control}
                  name="groupId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group (Optional)</FormLabel>
                      <Select onValueChange={(value) => field.onChange(value === "none" ? undefined : parseInt(value))} value={field.value?.toString() || "none"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a group" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Group</SelectItem>
                          {userGroups.map((group) => (
                            <SelectItem key={group.id} value={group.id.toString()}>
                              {group.name}
                            </SelectItem>
                          ))}
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
                    {user.groupId && (
                      <Badge variant="outline" className="text-xs">
                        Group: {userGroups.find(g => g.id === user.groupId)?.name || 'Unknown'}
                      </Badge>
                    )}
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
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Permissions for {selectedUserForPermissions?.username}</DialogTitle>
            <div className="text-sm text-muted-foreground">
              Configure granular access permissions for VLANs and their associated subnets
            </div>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Legend */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Permission Levels:</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-400 rounded"></div>
                  <span><strong>None:</strong> No access</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span><strong>View:</strong> Read-only access</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                  <span><strong>Edit:</strong> Modify devices/settings</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span><strong>Admin:</strong> Full control</span>
                </div>
              </div>
            </div>

            {/* VLAN Hierarchy */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Network Access Control</h3>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {vlans.map((vlan: any) => {
                  const vlanSubnets = subnets.filter((subnet: any) => subnet.vlanId === vlan.id);
                  const vlanPermission = permissionChanges[`vlan_${vlan.id}`] || getPermissionForResource(vlan.id, 'vlan');
                  
                  return (
                    <div key={vlan.id} className="border rounded-lg p-4 space-y-4">
                      {/* VLAN Header */}
                      <div className="flex items-center justify-between bg-muted/30 p-3 rounded">
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-primary/10 rounded flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">V</span>
                          </div>
                          <div>
                            <span className="font-semibold text-base">{vlan.name}</span>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="outline" className="text-xs">VLAN {vlan.vlanId}</Badge>
                              {vlan.description && (
                                <span className="text-xs text-muted-foreground">({vlan.description})</span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground mb-1">VLAN Access</div>
                            <Select 
                              value={vlanPermission}
                              onValueChange={(value) => handlePermissionChange(vlan.id, 'vlan', value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {getAvailablePermissions(selectedUserForPermissions?.role || 'viewer').map((permission) => (
                                  <SelectItem key={permission.value} value={permission.value}>
                                    <div className="flex items-center space-x-2">
                                      <div className={`w-2 h-2 ${permission.color} rounded`}></div>
                                      <span>{permission.label}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      
                      {/* Subnets for this VLAN */}
                      {vlanSubnets.length > 0 && (
                        <div className="ml-6 space-y-3">
                          <div className="text-sm font-medium text-muted-foreground flex items-center space-x-2">
                            <span>Subnets in this VLAN:</span>
                            <Badge variant="secondary" className="text-xs">{vlanSubnets.length} subnet{vlanSubnets.length !== 1 ? 's' : ''}</Badge>
                          </div>
                          
                          {vlanSubnets.map((subnet: any) => (
                            <div key={subnet.id} className="flex items-center justify-between p-3 bg-muted/20 rounded border-l-4 border-l-primary/30">
                              <div className="flex items-center space-x-3">
                                <div className="w-5 h-5 bg-secondary/20 rounded flex items-center justify-center">
                                  <span className="text-xs font-bold text-secondary-foreground">S</span>
                                </div>
                                <div>
                                  <span className="font-mono text-sm font-medium">{subnet.network}</span>
                                  <div className="flex items-center space-x-2 mt-1">
                                    {subnet.gateway && (
                                      <Badge variant="outline" className="text-xs">GW: {subnet.gateway}</Badge>
                                    )}
                                    {subnet.description && (
                                      <span className="text-xs text-muted-foreground">({subnet.description})</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-4">
                                <div className="text-right">
                                  <div className="text-xs text-muted-foreground mb-1">Subnet Access</div>
                                  <Select 
                                    value={permissionChanges[`subnet_${subnet.id}`] || getPermissionForResource(subnet.id, 'subnet')}
                                    onValueChange={(value) => handlePermissionChange(subnet.id, 'subnet', value)}
                                  >
                                    <SelectTrigger className="w-28">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {getAvailablePermissions(selectedUserForPermissions?.role || 'viewer').map((permission) => (
                                        <SelectItem key={permission.value} value={permission.value}>
                                          <div className="flex items-center space-x-2">
                                            <div className={`w-2 h-2 ${permission.color} rounded`}></div>
                                            <span>{permission.label}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Show message if no subnets */}
                      {vlanSubnets.length === 0 && (
                        <div className="ml-6 text-sm text-muted-foreground italic p-3 bg-muted/20 rounded">
                          No subnets configured for this VLAN
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsPermissionDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSavePermissions}
                disabled={updatePermissionsMutation.isPending}
                className="min-w-24"
              >
                {updatePermissionsMutation.isPending ? "Saving..." : "Save Permissions"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
        </TabsContent>
        
        <TabsContent value="groups" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Group Management</h3>
            <Dialog open={isCreateGroupDialogOpen} onOpenChange={setIsCreateGroupDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Group
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Group</DialogTitle>
                </DialogHeader>
                <Form {...groupForm}>
                  <form onSubmit={groupForm.handleSubmit(handleCreateGroup)} className="space-y-4">
                    <FormField
                      control={groupForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Group Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter group name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={groupForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter group description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={groupForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Role</FormLabel>
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
                      <Button type="button" variant="outline" onClick={closeGroupDialog}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createGroupMutation.isPending}>
                        Create
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Groups</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isGroupsLoading ? (
                  <div>Loading groups...</div>
                ) : userGroups.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No groups found. Create a group to get started.
                  </div>
                ) : (
                  userGroups.map((group) => {
                    const RoleIcon = roleIcons[group.role];
                    const membersCount = users.filter(user => user.groupId === group.id).length;
                    
                    return (
                      <div key={group.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <RoleIcon className="h-5 w-5" />
                            <span className="font-medium">{group.name}</span>
                          </div>
                          <Badge className={roleColors[group.role]}>
                            {group.role}
                          </Badge>
                          <Badge variant="outline">
                            {membersCount} member{membersCount !== 1 ? 's' : ''}
                          </Badge>
                          {group.description && (
                            <span className="text-sm text-muted-foreground">
                              {group.description}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditGroupDialog(group)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteGroup(group.id)}
                            disabled={deleteGroupMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Edit Group Dialog */}
          <Dialog open={isEditGroupDialogOpen} onOpenChange={setIsEditGroupDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Group</DialogTitle>
              </DialogHeader>
              <Form {...groupForm}>
                <form onSubmit={groupForm.handleSubmit(handleUpdateGroup)} className="space-y-4">
                  <FormField
                    control={groupForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Group Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter group name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={groupForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter group description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={groupForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Role</FormLabel>
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
                    <Button type="button" variant="outline" onClick={closeGroupDialog}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={updateGroupMutation.isPending}>
                      Update
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}