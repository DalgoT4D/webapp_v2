'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { useUsers, useRoles, useUserActions } from '@/hooks/api/useUserManagement';
import { useAuthStore } from '@/stores/authStore';
import { MoreHorizontal, User, Info, Save, X } from 'lucide-react';
import { DeleteUserDialog } from './DeleteUserDialog';

export function UsersTable() {
  const { users, isLoading, mutate } = useUsers();
  const { roles } = useRoles();
  const { updateUserRole } = useUserActions();
  const { hasPermission } = useUserPermissions();
  const { getCurrentOrgUser } = useAuthStore();

  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [deleteUser, setDeleteUser] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const currentUser = getCurrentOrgUser();
  const canEditUser = hasPermission('can_edit_orguser');
  const canDeleteUser = hasPermission('can_delete_orguser');

  const formatRoleName = (roleSlug: string) => {
    return roleSlug.replace('-', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const handleEditRole = (userEmail: string, currentRoleSlug: string) => {
    const role = roles?.find((r) => r.slug === currentRoleSlug);
    if (role) {
      setSelectedRole(role.uuid);
      setEditingUser(userEmail);
    }
  };

  const handleSaveRole = async () => {
    if (!editingUser || !selectedRole) return;

    setIsUpdating(true);
    try {
      await updateUserRole({
        toupdate_email: editingUser,
        role_uuid: selectedRole,
      });
      mutate();
      setEditingUser(null);
      setSelectedRole('');
    } catch (error) {
      // Error is handled in the hook
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setSelectedRole('');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Users
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-2 text-sm">
                    <div>
                      <strong>Account Manager:</strong> Admin of the NGO org, responsible for user
                      management
                    </div>
                    <div>
                      <strong>Pipeline Manager:</strong> Org team member responsible for creating
                      pipelines & DBT models
                    </div>
                    <div>
                      <strong>Analyst:</strong> M&E team member working on transformation models
                    </div>
                    <div>
                      <strong>Guest:</strong> Able to view the platform and usage dashboard
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user) => (
                <TableRow key={user.email}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {editingUser === user.email ? (
                      <div className="flex items-center gap-2">
                        <Select value={selectedRole} onValueChange={setSelectedRole}>
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles?.map((role) => (
                              <SelectItem key={role.uuid} value={role.uuid}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={handleSaveRole} disabled={isUpdating}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEdit}
                          disabled={isUpdating}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="secondary">{formatRoleName(user.new_role_slug)}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {user.email !== currentUser?.email && (canEditUser || canDeleteUser) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canEditUser && (
                            <DropdownMenuItem
                              onClick={() => handleEditRole(user.email, user.new_role_slug)}
                            >
                              Edit Role
                            </DropdownMenuItem>
                          )}
                          {canDeleteUser && (
                            <DropdownMenuItem
                              onClick={() => setDeleteUser(user.email)}
                              className="text-destructive"
                            >
                              Delete User
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DeleteUserDialog
        open={!!deleteUser}
        onOpenChange={(open) => !open && setDeleteUser(null)}
        userEmail={deleteUser || ''}
        onSuccess={() => {
          mutate();
          setDeleteUser(null);
        }}
      />
    </>
  );
}
