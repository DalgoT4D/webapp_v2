'use client';

import { useState, useMemo } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { useUsers, useRoles, useUserActions } from '@/hooks/api/useUserManagement';
import { useAuthStore } from '@/stores/authStore';
import {
  MoreHorizontal,
  User,
  Info,
  Save,
  X,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

  // Filtering and sorting state
  const [sortBy, setSortBy] = useState<'email' | 'role'>('email');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Email filter state
  const [emailFilter, setEmailFilter] = useState('');

  // Role filter state
  const [roleFilters, setRoleFilters] = useState<string[]>([]);

  // Filter dropdown states
  const [openFilters, setOpenFilters] = useState({
    email: false,
    role: false,
  });

  const currentUser = getCurrentOrgUser();
  const canEditUser = hasPermission('can_edit_orguser');
  const canDeleteUser = hasPermission('can_delete_orguser');

  const formatRoleName = (roleSlug: string) => {
    return roleSlug.replace('-', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // Handle sorting
  const handleSort = (column: 'email' | 'role') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // Render sort icon
  const renderSortIcon = (column: 'email' | 'role') => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4 text-gray-600" />
    ) : (
      <ChevronDown className="w-4 h-4 text-gray-600" />
    );
  };

  // Check if filter is active
  const hasActiveFilter = (column: 'email' | 'role') => {
    if (column === 'email') {
      return emailFilter.length > 0;
    }
    if (column === 'role') {
      return roleFilters.length > 0;
    }
    return false;
  };

  // Render filter icon
  const renderFilterIcon = (column: 'email' | 'role') => {
    const isActive = hasActiveFilter(column);
    return (
      <div className="relative">
        <Filter
          className={cn(
            'w-4 h-4 transition-colors',
            isActive ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'
          )}
        />
        {isActive && <div className="absolute -top-1 -right-1 w-2 h-2 bg-teal-600 rounded-full" />}
      </div>
    );
  };

  // Get unique roles for filtering
  const uniqueRoles = useMemo(() => {
    if (!users) return [];
    const roleSet = new Set(users.map((user) => user.new_role_slug));
    return Array.from(roleSet).sort();
  }, [users]);

  // Handle role filter change
  const handleRoleFilterChange = (roleSlug: string, checked: boolean) => {
    if (checked) {
      setRoleFilters((prev) => [...prev, roleSlug]);
    } else {
      setRoleFilters((prev) => prev.filter((r) => r !== roleSlug));
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setEmailFilter('');
    setRoleFilters([]);
  };

  // Apply filters and sort users
  const filteredAndSortedUsers = useMemo(() => {
    if (!users) return [];

    // Apply filters
    const filtered = users.filter((user) => {
      // Email filter
      if (emailFilter) {
        if (!user.email.toLowerCase().includes(emailFilter.toLowerCase())) {
          return false;
        }
      }

      // Role filter
      if (roleFilters.length > 0) {
        if (!roleFilters.includes(user.new_role_slug)) {
          return false;
        }
      }

      return true;
    });

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aValue: string;
      let bValue: string;

      if (sortBy === 'email') {
        aValue = a.email.toLowerCase();
        bValue = b.email.toLowerCase();
      } else {
        aValue = formatRoleName(a.new_role_slug).toLowerCase();
        bValue = formatRoleName(b.new_role_slug).toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });

    return sorted;
  }, [users, emailFilter, roleFilters, sortBy, sortOrder]);

  // Render email filter
  const renderEmailFilter = () => (
    <PopoverContent className="w-80" align="start">
      <div className="space-y-4">
        <div>
          <Label htmlFor="email-filter" className="text-sm font-medium">
            Filter by Email
          </Label>
          <Input
            id="email-filter"
            placeholder="Enter email to filter..."
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
            className="mt-2"
          />
        </div>
        {emailFilter && (
          <Button variant="outline" size="sm" onClick={() => setEmailFilter('')} className="w-full">
            Clear Email Filter
          </Button>
        )}
      </div>
    </PopoverContent>
  );

  // Render role filter
  const renderRoleFilter = () => (
    <PopoverContent className="w-80" align="start">
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Filter by Role</Label>
          <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
            {uniqueRoles.map((roleSlug) => (
              <div key={roleSlug} className="flex items-center space-x-2">
                <Checkbox
                  id={`role-${roleSlug}`}
                  checked={roleFilters.includes(roleSlug)}
                  onCheckedChange={(checked) =>
                    handleRoleFilterChange(roleSlug, checked as boolean)
                  }
                />
                <Label htmlFor={`role-${roleSlug}`} className="text-sm cursor-pointer">
                  {formatRoleName(roleSlug)}
                </Label>
              </div>
            ))}
          </div>
        </div>
        {roleFilters.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setRoleFilters([])} className="w-full">
            Clear Role Filters
          </Button>
        )}
      </div>
    </PopoverContent>
  );

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
              <TableRow className="bg-gray-50">
                <TableHead className="w-[50%]">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      className="h-auto p-0 font-medium text-base hover:bg-transparent flex-1"
                      onClick={() => handleSort('email')}
                    >
                      <div className="flex items-center gap-2">
                        Email
                        {renderSortIcon('email')}
                      </div>
                    </Button>
                    <Popover
                      open={openFilters.email}
                      onOpenChange={(open) => setOpenFilters((prev) => ({ ...prev, email: open }))}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 hover:bg-gray-100"
                        >
                          {renderFilterIcon('email')}
                        </Button>
                      </PopoverTrigger>
                      {renderEmailFilter()}
                    </Popover>
                  </div>
                </TableHead>
                <TableHead className="w-[30%]">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      className="h-auto p-0 font-medium text-base hover:bg-transparent flex-1"
                      onClick={() => handleSort('role')}
                    >
                      <div className="flex items-center gap-2">
                        Role
                        {renderSortIcon('role')}
                      </div>
                    </Button>
                    <Popover
                      open={openFilters.role}
                      onOpenChange={(open) => setOpenFilters((prev) => ({ ...prev, role: open }))}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 hover:bg-gray-100"
                        >
                          {renderFilterIcon('role')}
                        </Button>
                      </PopoverTrigger>
                      {renderRoleFilter()}
                    </Popover>
                  </div>
                </TableHead>
                <TableHead className="w-[20%] text-right font-medium text-base">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedUsers.map((user) => (
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
          {filteredAndSortedUsers.length === 0 && users && users.length > 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No users match the current filters.{' '}
              <Button variant="link" onClick={clearAllFilters} className="p-0 h-auto">
                Clear all filters
              </Button>
            </div>
          )}
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
