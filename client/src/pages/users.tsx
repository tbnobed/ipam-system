import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Users as UsersIcon, Settings, ShieldCheck, Eye, User as UserIcon, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User, InsertUser, UserGroup, InsertUserGroup } from "@shared/schema";

export default function Users() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State for users
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState({
    username: "",
    password: "",
    role: "user" as const
  });

  // State for groups
  const [isAddGroupDialogOpen, setIsAddGroupDialogOpen] = useState(false);
  const [isEditGroupDialogOpen, setIsEditGroupDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
  const [groupFormData, setGroupFormData] = useState({
    name: "",
    description: "",
    isActive: true
  });

  // Queries
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["/api/user-groups"],
  });

  // User mutations
  const createUserMutation = useMutation({
    mutationFn: async (userData: InsertUser) => {
      await apiRequest("/api/users", {
        method: "POST",
        body: JSON.stringify(userData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsAddUserDialogOpen(false);
      setUserFormData({ username: "", password: "", role: "user" });
      toast({ title: "User created successfully" });
    },
    onError: (error) => {
      toast({ title: "Error creating user", description: error.message, variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (userData: Partial<User>) => {
      await apiRequest(`/api/users/${selectedUser?.id}`, {
        method: "PUT",
        body: JSON.stringify(userData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsEditUserDialogOpen(false);
      setSelectedUser(null);
      toast({ title: "User updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error updating user", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest(`/api/users/${userId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error deleting user", description: error.message, variant: "destructive" });
    },
  });

  // Group mutations
  const createGroupMutation = useMutation({
    mutationFn: async (groupData: InsertUserGroup) => {
      await apiRequest("/api/user-groups", {
        method: "POST",
        body: JSON.stringify(groupData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups"] });
      setIsAddGroupDialogOpen(false);
      setGroupFormData({ name: "", description: "", isActive: true });
      toast({ title: "Group created successfully" });
    },
    onError: (error) => {
      toast({ title: "Error creating group", description: error.message, variant: "destructive" });
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async (groupData: Partial<UserGroup>) => {
      await apiRequest(`/api/user-groups/${selectedGroup?.id}`, {
        method: "PUT",
        body: JSON.stringify(groupData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups"] });
      setIsEditGroupDialogOpen(false);
      setSelectedGroup(null);
      toast({ title: "Group updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error updating group", description: error.message, variant: "destructive" });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: number) => {
      await apiRequest(`/api/user-groups/${groupId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups"] });
      toast({ title: "Group deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error deleting group", description: error.message, variant: "destructive" });
    },
  });

  // Handlers
  const handleAddUser = () => {
    createUserMutation.mutate(userFormData);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setUserFormData({
      username: user.username,
      password: "",
      role: user.role
    });
    setIsEditUserDialogOpen(true);
  };

  const handleUpdateUser = () => {
    if (!selectedUser) return;
    const updateData: Partial<User> = {
      username: userFormData.username,
      role: userFormData.role
    };
    if (userFormData.password) {
      updateData.password = userFormData.password;
    }
    updateUserMutation.mutate(updateData);
  };

  const handleDeleteUser = (userId: number) => {
    if (confirm("Are you sure you want to delete this user?")) {
      deleteUserMutation.mutate(userId);
    }
  };

  const handleAddGroup = () => {
    createGroupMutation.mutate(groupFormData);
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

  const handleUpdateGroup = () => {
    if (!selectedGroup) return;
    updateGroupMutation.mutate(groupFormData);
  };

  const handleDeleteGroup = (groupId: number) => {
    if (confirm("Are you sure you want to delete this group?")) {
      deleteGroupMutation.mutate(groupId);
    }
  };

  // Role configurations
  const roleColors = {
    admin: "bg-red-100 text-red-800",
    user: "bg-blue-100 text-blue-800",
    viewer: "bg-gray-100 text-gray-800"
  };

  const roleIcons = {
    admin: Crown,
    user: UserIcon,
    viewer: Eye
  };

  if (usersLoading || groupsLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">User Management</h1>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-muted-foreground">Manage individual user accounts and permissions</p>
            <Button onClick={() => setIsAddUserDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>

          <div className="grid gap-4">
            {users.map((user: User) => (
              <Card key={user.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {roleIcons[user.role] && (() => {
                          const Icon = roleIcons[user.role];
                          return <Icon className="h-5 w-5" />;
                        })()}
                        <CardTitle className="text-lg">{user.username}</CardTitle>
                      </div>
                      <Badge className={`${roleColors[user.role]} text-sm`}>
                        {user.role}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditUser(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-500">
                    Created: {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="groups" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-muted-foreground">Manage user groups and permissions</p>
            <Button onClick={() => setIsAddGroupDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Group
            </Button>
          </div>

          <div className="grid gap-4">
            {groups.map((group: UserGroup) => (
              <Card key={group.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <UsersIcon className="h-5 w-5 text-gray-500" />
                        <CardTitle className="text-lg">{group.name}</CardTitle>
                      </div>
                      <Badge variant={group.isActive ? "default" : "secondary"}>
                        {group.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditGroup(group)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteGroup(group.id)}
                        className="text-red-600 hover:text-red-700"
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
                      <Button variant="outline" size="sm">
                        <Users className="h-3 w-3 mr-1" />
                        Members
                      </Button>
                      <Button variant="outline" size="sm">
                        <Settings className="h-3 w-3 mr-1" />
                        Permissions
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add User Dialog */}
      <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account with the specified role and permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={userFormData.username}
                onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                placeholder="Enter username"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={userFormData.password}
                onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                placeholder="Enter password"
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={userFormData.role} onValueChange={(value) => setUserFormData({ ...userFormData, role: value as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsAddUserDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddUser} disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update the user account information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={userFormData.username}
                onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                placeholder="Enter username"
              />
            </div>
            <div>
              <Label htmlFor="edit-password">Password (leave blank to keep current)</Label>
              <Input
                id="edit-password"
                type="password"
                value={userFormData.password}
                onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                placeholder="Enter new password"
              />
            </div>
            <div>
              <Label htmlFor="edit-role">Role</Label>
              <Select value={userFormData.role} onValueChange={(value) => setUserFormData({ ...userFormData, role: value as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEditUserDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateUser} disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? "Updating..." : "Update User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Group Dialog */}
      <Dialog open={isAddGroupDialogOpen} onOpenChange={setIsAddGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Group</DialogTitle>
            <DialogDescription>
              Create a new user group for managing permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                value={groupFormData.name}
                onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                placeholder="Enter group name"
              />
            </div>
            <div>
              <Label htmlFor="group-description">Description</Label>
              <Textarea
                id="group-description"
                value={groupFormData.description}
                onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                placeholder="Enter group description"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="group-active"
                checked={groupFormData.isActive}
                onCheckedChange={(checked) => setGroupFormData({ ...groupFormData, isActive: checked })}
              />
              <Label htmlFor="group-active">Active</Label>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsAddGroupDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddGroup} disabled={createGroupMutation.isPending}>
                {createGroupMutation.isPending ? "Creating..." : "Create Group"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
              <Label htmlFor="edit-group-name">Group Name</Label>
              <Input
                id="edit-group-name"
                value={groupFormData.name}
                onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                placeholder="Enter group name"
              />
            </div>
            <div>
              <Label htmlFor="edit-group-description">Description</Label>
              <Textarea
                id="edit-group-description"
                value={groupFormData.description}
                onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                placeholder="Enter group description"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-group-active"
                checked={groupFormData.isActive}
                onCheckedChange={(checked) => setGroupFormData({ ...groupFormData, isActive: checked })}
              />
              <Label htmlFor="edit-group-active">Active</Label>
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
    </div>
  );
}