'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { User, Info, Save, X, Trash2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  DataTable,
  ColumnHeader,
  ActionsCell,
  type ActionMenuItem,
  type SortState,
  type FilterState,
  type TextFilterValue,
  type FilterConfig,
  type SkeletonConfig,
} from '@/components/ui/data-table';
import { DeleteUserDialog } from './DeleteUserDialog';

// User type
interface UserData {
  email: string;
  new_role_slug: string;
}

// Filter configurations
const filterConfigs: Record<string, FilterConfig> = {
  email: {
    type: 'text',
    placeholder: 'Search email...',
  },
  role: {
    type: 'checkbox',
  },
};

// Skeleton configuration
const skeletonConfig: SkeletonConfig = {
  rowCount: 5,
  columns: [
    { width: 'w-[50%]', cellType: 'text' },
    { width: 'w-[30%]', cellType: 'badge' },
    { width: 'w-[20%]', cellType: 'actions' },
  ],
};

// Initial filter state
const initialFilterState: FilterState = {
  email: { text: '' } as TextFilterValue,
  role: [] as string[],
};

export function UsersTable() {
  const { users, isLoading, mutate } = useUsers();
  const { roles } = useRoles();
  const { updateUserRole } = useUserActions();
  const { hasPermission } = useUserPermissions();
  const { getCurrentOrgUser } = useAuthStore();

  // Editing state
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete dialog state
  const [deleteUser, setDeleteUser] = useState<string | null>(null);

  // Sorting state
  const [sortState, setSortState] = useState<SortState>({
    column: 'email',
    direction: 'asc',
  });

  // Filter state
  const [filterState, setFilterState] = useState<FilterState>(initialFilterState);

  const currentUser = getCurrentOrgUser();
  const canEditUser = hasPermission('can_edit_orguser');
  const canDeleteUser = hasPermission('can_delete_orguser');

  const formatRoleName = useCallback((roleSlug: string) => {
    return roleSlug.replace('-', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }, []);

  // Get unique roles for filter options
  const uniqueRoles = useMemo(() => {
    if (!users) return [];
    const roleSet = new Set(users.map((user: UserData) => user.new_role_slug));
    return Array.from(roleSet)
      .sort()
      .map((r) => ({ value: r, label: formatRoleName(r) }));
  }, [users, formatRoleName]);

  // Apply filters and sort users
  const filteredAndSortedUsers = useMemo(() => {
    if (!users) return [];

    const emailFilter = filterState.email as TextFilterValue;
    const roleFilter = filterState.role as string[];

    // Apply filters
    const filtered = users.filter((user: UserData) => {
      // Email filter
      if (emailFilter?.text) {
        if (!user.email.toLowerCase().includes(emailFilter.text.toLowerCase())) {
          return false;
        }
      }

      // Role filter
      if (roleFilter.length > 0) {
        if (!roleFilter.includes(user.new_role_slug)) {
          return false;
        }
      }

      return true;
    });

    // Sort
    return [...filtered].sort((a: UserData, b: UserData) => {
      let aValue: string;
      let bValue: string;

      if (sortState.column === 'email') {
        aValue = a.email.toLowerCase();
        bValue = b.email.toLowerCase();
      } else {
        aValue = formatRoleName(a.new_role_slug).toLowerCase();
        bValue = formatRoleName(b.new_role_slug).toLowerCase();
      }

      if (sortState.direction === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });
  }, [users, filterState, sortState, formatRoleName]);

  // Get active filter count
  const getActiveFilterCount = useCallback(() => {
    let count = 0;
    const emailFilter = filterState.email as TextFilterValue;
    if (emailFilter?.text) count++;
    if ((filterState.role as string[]).length > 0) count++;
    return count;
  }, [filterState]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFilterState(initialFilterState);
  }, []);

  // Edit role handlers
  const handleEditRole = useCallback(
    (userEmail: string, currentRoleSlug: string) => {
      const role = roles?.find((r: { slug: string; uuid: string }) => r.slug === currentRoleSlug);
      if (role) {
        setSelectedRole(role.uuid);
        setEditingUser(userEmail);
      }
    },
    [roles]
  );

  const handleSaveRole = useCallback(async () => {
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
    } catch {
      // Error is handled in the hook
    } finally {
      setIsUpdating(false);
    }
  }, [editingUser, selectedRole, updateUserRole, mutate]);

  const handleCancelEdit = useCallback(() => {
    setEditingUser(null);
    setSelectedRole('');
  }, []);

  // Define columns
  const columns: ColumnDef<UserData>[] = useMemo(
    () => [
      {
        id: 'email',
        accessorKey: 'email',
        header: () => (
          <ColumnHeader
            columnId="email"
            title="Email"
            sortable
            sortState={sortState}
            onSortChange={setSortState}
            filterConfig={filterConfigs.email}
            filterState={filterState}
            onFilterChange={setFilterState}
          />
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{row.original.email}</span>
          </div>
        ),
        meta: {
          headerClassName: 'w-[50%]',
        },
      },
      {
        id: 'role',
        accessorFn: (row) => formatRoleName(row.new_role_slug),
        header: () => (
          <ColumnHeader
            columnId="role"
            title="Role"
            sortable
            sortState={sortState}
            onSortChange={setSortState}
            filterConfig={filterConfigs.role}
            filterState={filterState}
            onFilterChange={setFilterState}
            filterOptions={uniqueRoles}
          />
        ),
        cell: ({ row }) => {
          const user = row.original;

          // Inline editing mode
          if (editingUser === user.email) {
            return (
              <div className="flex items-center gap-2">
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles?.map((role: { uuid: string; name: string }) => (
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
            );
          }

          return <Badge variant="secondary">{formatRoleName(user.new_role_slug)}</Badge>;
        },
        meta: {
          headerClassName: 'w-[30%]',
        },
      },
      {
        id: 'actions',
        header: () => <span className="font-medium text-base text-right block">Actions</span>,
        cell: ({ row }) => {
          const user = row.original;

          // Hide actions for current user
          if (user.email === currentUser?.email) {
            return null;
          }

          // Hide if no permissions
          if (!canEditUser && !canDeleteUser) {
            return null;
          }

          const actions: ActionMenuItem<UserData>[] = [
            {
              id: 'edit-role',
              label: 'Edit Role',
              onClick: () => handleEditRole(user.email, user.new_role_slug),
              hidden: !canEditUser,
            },
            {
              id: 'delete',
              label: 'Delete User',
              icon: <Trash2 className="w-4 h-4" />,
              variant: 'destructive',
              onClick: () => setDeleteUser(user.email),
              hidden: !canDeleteUser,
            },
          ];

          return (
            <div className="text-right">
              <ActionsCell row={user} actions={actions} moreIconVariant="horizontal" />
            </div>
          );
        },
        meta: {
          headerClassName: 'w-[20%]',
        },
      },
    ],
    [
      sortState,
      filterState,
      uniqueRoles,
      editingUser,
      selectedRole,
      isUpdating,
      roles,
      currentUser,
      canEditUser,
      canDeleteUser,
      formatRoleName,
      handleEditRole,
      handleSaveRole,
      handleCancelEdit,
    ]
  );

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
        <CardContent className="p-0">
          <DataTable
            data={filteredAndSortedUsers}
            columns={columns}
            isLoading={false}
            getRowId={(row) => row.email}
            sortState={sortState}
            onSortChange={setSortState}
            filterState={filterState}
            onFilterChange={setFilterState}
            filterConfigs={filterConfigs}
            activeFilterCount={getActiveFilterCount()}
            onClearAllFilters={clearAllFilters}
            emptyState={{
              icon: <User className="w-12 h-12" />,
              title: 'No users found',
              filteredTitle: 'No users match the current filters',
            }}
            skeleton={skeletonConfig}
            idPrefix="users"
            className="border-0"
            tableClassName="border-0 rounded-none"
          />
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
