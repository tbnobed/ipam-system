import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Trash2, Edit, Plus, Minus, Shield, UserCheck, Eye, Settings, Users as UsersIcon, User, UserPlus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Header from "@/components/layout/header";
import type { UserGroup } from "@shared/schema";

const userSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "user", "viewer"])
});

const groupSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  description: z.string().optional(),
  isActive: z.boolean().default(true)
});

type User = {
  id: number;
  username: string;
  role: "admin" | "user" | "viewer";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

interface GroupFormData {
  name: string;
  description: string;
  isActive: boolean;
}

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
  
  // User state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<User | null>(null);
  const [permissionChanges, setPermissionChanges] = useState<Record<string, string>>({});
  
  // Group state
  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false);
  const [isEditGroupDialogOpen, setIsEditGroupDialogOpen] = useState(false);
  const [isGroupPermissionDialogOpen, setIsGroupPermissionDialogOpen] = useState(false);
  const [isGroupMembersDialogOpen, setIsGroupMembersDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
  const [selectedGroupForPermissions, setSelectedGroupForPermissions] = useState<UserGroup | null>(null);
  const [selectedGroupForMembers, setSelectedGroupForMembers] = useState<UserGroup | null>(null);
  const [groupPermissionChanges, setGroupPermissionChanges] = useState<Record<string, string>>({});
  const [groupFormData, setGroupFormData] = useState<GroupFormData>({
    name: "",
    description: "",
    isActive: true
  });

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const { data: groups = [], isLoading: isGroupsLoading } = useQuery<UserGroup[]>({
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

  const { data: groupPermissions = [] } = useQuery({
    queryKey: ['/api/group-permissions', selectedGroupForPermissions?.id],
    queryFn: () => selectedGroupForPermissions?.id 
      ? fetch(`/api/group-permissions/${selectedGroupForPermissions.id}`).then(res => res.json())
      : Promise.resolve([]),
    enabled: !!selectedGroupForPermissions?.id,
  });

  const { data: groupMembers = [] } = useQuery({
    queryKey: ['/api/group-members', selectedGroupForMembers?.id],
    queryFn: () => selectedGroupForMembers?.id 
      ? fetch(`/api/group-members/${selectedGroupForMembers.id}`).then(res => res.json())
      : Promise.resolve([]),
    enabled: !!selectedGroupForMembers?.id,
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

  // Group mutations
  const createGroupMutation = useMutation({
    mutationFn: async (data: GroupFormData) => {
      return await apiRequest("/api/user-groups", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Group created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups"] });
      setIsCreateGroupDialogOpen(false);
      setGroupFormData({ name: "", description: "", isActive: true });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create group",
        variant: "destructive",
      });
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async (data: GroupFormData) => {
      return await apiRequest(`/api/user-groups/${selectedGroup?.id}`, "PUT", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Group updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups"] });
      setIsEditGroupDialogOpen(false);
      setSelectedGroup(null);
      setGroupFormData({ name: "", description: "", isActive: true });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update group",
        variant: "destructive",
      });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: number) => {
      return await apiRequest(`/api/user-groups/${groupId}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Group deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete group",
        variant: "destructive",
      });
    },
  });

  const updateGroupPermissionsMutation = useMutation({
    mutationFn: async (permissions: { groupId: number; permissions: Array<{ vlanId?: number; subnetId?: number; permission: string }> }) => {
      return apiRequest('/api/group-permissions', 'POST', permissions);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/group-permissions'] });
      setIsGroupPermissionDialogOpen(false);
      setGroupPermissionChanges({});
      toast({
        title: "Success",
        description: "Group permissions updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update group permissions",
        variant: "destructive",
      });
    }
  });

  const addGroupMemberMutation = useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: number; userId: number }) => {
      return apiRequest('/api/group-members', 'POST', { groupId, userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/group-members'] });
      toast({
        title: "Success",
        description: "User added to group successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error", 
        description: "Failed to add user to group",
        variant: "destructive",
      });
    }
  });

  const removeGroupMemberMutation = useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: number; userId: number }) => {
      return apiRequest(`/api/group-members/${groupId}/${userId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/group-members'] });
      toast({
        title: "Success",
        description: "User removed from group successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to remove user from group",
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

  // Group handler functions
  const handleCreateGroup = () => {
    createGroupMutation.mutate(groupFormData);
  };

  const handleUpdateGroup = () => {
    updateGroupMutation.mutate(groupFormData);
  };

  const handleDeleteGroup = (groupId: number) => {
    if (confirm("Are you sure you want to delete this group?")) {
      deleteGroupMutation.mutate(groupId);
    }
  };

  const handleEditGroup = (group: UserGroup) => {
    setSelectedGroup(group);
    setGroupFormData({
      name: group.name,
      description: group.description || "",
      isActive: group.isActive
    });
    setIsEditGroupDialogOpen(true);
  };

  const handleOpenGroupPermissions = (group: UserGroup) => {
    setSelectedGroupForPermissions(group);
    setGroupPermissionChanges({});
    setIsGroupPermissionDialogOpen(true);
  };

  const handleOpenGroupMembers = (group: UserGroup) => {
    setSelectedGroupForMembers(group);
    setIsGroupMembersDialogOpen(true);
  };

  const handleAddUserToGroup = (userId: number) => {
    if (!selectedGroupForMembers) return;
    addGroupMemberMutation.mutate({ groupId: selectedGroupForMembers.id, userId });
  };

  const handleRemoveUserFromGroup = (userId: number) => {
    if (!selectedGroupForMembers) return;
    removeGroupMemberMutation.mutate({ groupId: selectedGroupForMembers.id, userId });
  };

  const isUserInGroup = (userId: number) => {
    return groupMembers.some((member: any) => member.userId === userId);
  };

  const getGroupPermissionForResource = (resourceId: number, resourceType: 'vlan' | 'subnet') => {
    if (!groupPermissions) return 'none';
    
    const permission = groupPermissions.find((p: any) => 
      resourceType === 'vlan' ? p.vlanId === resourceId : p.subnetId === resourceId
    );
    
    return permission?.permission || 'none';
  };

  const handleGroupPermissionChange = (resourceId: number, resourceType: 'vlan' | 'subnet', permission: string) => {
    const key = `${resourceType}_${resourceId}`;
    setGroupPermissionChanges(prev => ({
      ...prev,
      [key]: permission
    }));
  };

  const handleSaveGroupPermissions = async () => {
    if (!selectedGroupForPermissions) return;

    const permissions = [];
    
    // Process VLAN permissions
    for (const vlan of vlans) {
      const key = `vlan_${vlan.id}`;
      const permission = groupPermissionChanges[key] || getGroupPermissionForResource(vlan.id, 'vlan');
      // Always include the permission, even if it's 'none' - the backend will handle deletion
      permissions.push({
        vlanId: vlan.id,
        permission
      });
    }
    
    // Process subnet permissions
    for (const subnet of subnets) {
      const key = `subnet_${subnet.id}`;
      const permission = groupPermissionChanges[key] || getGroupPermissionForResource(subnet.id, 'subnet');
      // Always include the permission, even if it's 'none' - the backend will handle deletion
      permissions.push({
        subnetId: subnet.id,
        permission
      });
    }

    updateGroupPermissionsMutation.mutate({
      groupId: selectedGroupForPermissions.id,
      permissions
    });
  };

  const handleSavePermissions = async () => {
    if (!selectedUserForPermissions) return;

    const permissions = [];
    
    // Process subnet permissions only (simplified model)
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
      <Header title="User Management" />
      
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <UsersIcon className="h-4 w-4" />
            Groups
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Users</h2>
              <p className="text-sm text-gray-600">Manage individual user accounts and permissions</p>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
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
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Manage Permissions for {selectedUserForPermissions?.username}</DialogTitle>
                <div className="text-sm text-muted-foreground">
                  Set subnet-level permissions to control network access
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

                {/* Simplified Network Access Control */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Network Access Control</h3>
                  
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {vlans.map((vlan: any) => {
                      const vlanSubnets = subnets.filter((subnet: any) => subnet.vlanId === vlan.id);
                  
                      return (
                        <div key={vlan.id} className="border rounded-lg p-4 space-y-3">
                          {/* VLAN Header - Just as label, no permissions */}
                          <div className="flex items-center space-x-3 pb-2 border-b">
                            <div className="w-4 h-4 bg-blue-500 rounded"></div>
                            <span className="font-semibold text-base">VLAN {vlan.vlanId}</span>
                            <span className="text-muted-foreground">{vlan.name}</span>
                          </div>
                          
                          {/* Subnets with permissions */}
                          {vlanSubnets.length > 0 && (
                            <div className="space-y-2">
                              {vlanSubnets.map((subnet: any) => (
                                <div key={subnet.id} className="flex items-center justify-between p-3 bg-muted/20 rounded">
                                  <div className="flex items-center space-x-3">
                                    <span className="font-mono text-sm font-medium">S</span>
                                    <span className="font-mono text-sm">{subnet.network}</span>
                                  </div>
                                  
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
                              ))}
                            </div>
                          )}
                          
                          {/* Show message if no subnets */}
                          {vlanSubnets.length === 0 && (
                            <div className="text-sm text-muted-foreground italic p-3 bg-muted/10 rounded">
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
            <div>
              <h2 className="text-lg font-semibold">Groups</h2>
              <p className="text-sm text-gray-600">Manage user groups and their permissions</p>
            </div>
            <Button onClick={() => setIsCreateGroupDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Group
            </Button>
          </div>

          <Dialog open={isCreateGroupDialogOpen} onOpenChange={setIsCreateGroupDialogOpen}>
            <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Group</DialogTitle>
                  <DialogDescription>
                    Create a new user group to organize permissions.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Group Name</Label>
                    <Input
                      id="name"
                      value={groupFormData.name}
                      onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                      placeholder="Enter group name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={groupFormData.description}
                      onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                      placeholder="Enter group description"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="active"
                      checked={groupFormData.isActive}
                      onCheckedChange={(checked) => setGroupFormData({ ...groupFormData, isActive: checked })}
                    />
                    <Label htmlFor="active">Active</Label>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsCreateGroupDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateGroup} disabled={createGroupMutation.isPending}>
                      {createGroupMutation.isPending ? "Creating..." : "Create Group"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groups?.map((group: UserGroup) => (
              <Card key={group.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UsersIcon className="h-5 w-5 text-gray-500" />
                      <CardTitle className="text-lg">{group.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={group.isActive ? "default" : "secondary"}>
                        {group.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditGroup(group)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteGroup(group.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-600 mb-3">
                    {group.description || "No description provided"}
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>Created: {new Date(group.createdAt).toLocaleDateString()}</span>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-1"
                        onClick={() => handleOpenGroupMembers(group)}
                      >
                        <Users className="h-3 w-3" />
                        Members
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-1"
                        onClick={() => handleOpenGroupPermissions(group)}
                      >
                        <Settings className="h-3 w-3" />
                        Permissions
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Edit Group Dialog */}
          <Dialog open={isEditGroupDialogOpen} onOpenChange={setIsEditGroupDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Group</DialogTitle>
                <DialogDescription>
                  Update the group information.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-name">Group Name</Label>
                  <Input
                    id="edit-name"
                    value={groupFormData.name}
                    onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                    placeholder="Enter group name"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={groupFormData.description}
                    onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                    placeholder="Enter group description"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="edit-active"
                    checked={groupFormData.isActive}
                    onCheckedChange={(checked) => setGroupFormData({ ...groupFormData, isActive: checked })}
                  />
                  <Label htmlFor="edit-active">Active</Label>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsEditGroupDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateGroup} disabled={updateGroupMutation.isPending}>
                    {updateGroupMutation.isPending ? "Updating..." : "Update Group"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Group Permission Management Dialog */}
          <Dialog open={isGroupPermissionDialogOpen} onOpenChange={setIsGroupPermissionDialogOpen}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Manage Permissions for Group: {selectedGroupForPermissions?.name}</DialogTitle>
                <div className="text-sm text-muted-foreground">
                  Configure granular access permissions for VLANs and their associated subnets for this group
                </div>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Legend */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-400 rounded"></div>
                    <span className="text-sm">None</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <span className="text-sm">View Only</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                    <span className="text-sm">Edit Access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded"></div>
                    <span className="text-sm">Admin Access</span>
                  </div>
                </div>
                
                <div className="space-y-6">
                  {vlans.map((vlan: any) => {
                    const vlanSubnets = subnets.filter((subnet: any) => subnet.vlanId === vlan.id);
                    
                    return (
                      <div key={vlan.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                              <h3 className="font-medium text-lg">VLAN {vlan.vlanId}</h3>
                            </div>
                            <span className="text-sm text-muted-foreground">({vlan.name})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Permission:</span>
                            <Select 
                              value={groupPermissionChanges[`vlan_${vlan.id}`] || getGroupPermissionForResource(vlan.id, 'vlan')}
                              onValueChange={(value) => handleGroupPermissionChange(vlan.id, 'vlan', value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="read">View</SelectItem>
                                <SelectItem value="write">Edit</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        {vlanSubnets.length > 0 && (
                          <div className="ml-6 space-y-3">
                            <div className="text-sm font-medium text-muted-foreground border-b pb-2">
                              Associated Subnets
                            </div>
                            {vlanSubnets.map((subnet: any) => (
                              <div key={subnet.id} className="flex items-center justify-between p-3 bg-muted/10 rounded border-l-4 border-l-blue-200">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                  <div>
                                    <div className="font-medium">{subnet.network}</div>
                                    <div className="text-xs text-muted-foreground">
                                      Gateway: {subnet.gateway || 'Not specified'}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground">Permission:</span>
                                  <Select 
                                    value={groupPermissionChanges[`subnet_${subnet.id}`] || getGroupPermissionForResource(subnet.id, 'subnet')}
                                    onValueChange={(value) => handleGroupPermissionChange(subnet.id, 'subnet', value)}
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">None</SelectItem>
                                      <SelectItem value="read">View</SelectItem>
                                      <SelectItem value="write">Edit</SelectItem>
                                      <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                  </Select>
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
                
                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsGroupPermissionDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSaveGroupPermissions}
                    disabled={updateGroupPermissionsMutation.isPending}
                    className="min-w-24"
                  >
                    {updateGroupPermissionsMutation.isPending ? "Saving..." : "Save Permissions"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Group Members Management Dialog */}
          <Dialog open={isGroupMembersDialogOpen} onOpenChange={setIsGroupMembersDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Manage Members for Group: {selectedGroupForMembers?.name}</DialogTitle>
                <div className="text-sm text-muted-foreground">
                  Add or remove users from this group. Users in this group will inherit all group permissions.
                </div>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-3">All Users</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {users.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {roleIcons[user.role] && (() => {
                              const Icon = roleIcons[user.role];
                              return <Icon className="h-4 w-4" />;
                            })()}
                            <span className="font-medium">{user.username}</span>
                          </div>
                          <Badge className={`${roleColors[user.role]} text-xs`}>
                            {user.role}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {isUserInGroup(user.id) ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                Member
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveUserFromGroup(user.id)}
                                disabled={removeGroupMemberMutation.isPending}
                              >
                                <Minus className="h-3 w-3" />
                                Remove
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddUserToGroup(user.id)}
                              disabled={addGroupMemberMutation.isPending}
                            >
                              <Plus className="h-3 w-3" />
                              Add
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-3">
                    Current Members ({groupMembers.length})
                  </h3>
                  {groupMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      No members in this group yet. Add users above to apply group permissions.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {groupMembers.map((member: any) => {
                        const user = users.find(u => u.id === member.userId);
                        if (!user) return null;
                        return (
                          <div key={member.id} className="flex items-center justify-between p-2 bg-muted/20 rounded">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                {roleIcons[user.role] && (() => {
                                  const Icon = roleIcons[user.role];
                                  return <Icon className="h-4 w-4" />;
                                })()}
                                <span className="font-medium">{user.username}</span>
                              </div>
                              <Badge className={`${roleColors[user.role]} text-xs`}>
                                {user.role}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Added: {new Date(member.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsGroupMembersDialogOpen(false)}>
                    Done
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}