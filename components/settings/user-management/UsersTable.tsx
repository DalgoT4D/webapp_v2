'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { useUsers, useRoles, useUserActions } from '@/hooks/api/useUserManagement';
import { useAuthStore } from '@/stores/authStore';
import { User, Save, X, Trash2, Edit } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  DataTable,
  ColumnHeader,
  ActionsCell,
  type ActionMenuItem,
  type FilterState,
  type TextFilterValue,
  type FilterConfig,
  type SkeletonConfig,
} from '@/components/ui/data-table';
import { DeleteUserDialog } from './DeleteUserDialog';

// Hooks and utilities
import { useTableState } from '@/hooks/useTableState';
import { ErrorState } from '@/components/ui/error-state';
import {
  matchesTextFilter,
  matchesCheckboxFilter,
  extractUniqueValues,
  formatRoleName,
} from '@/lib/table-utils';

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
    { width: 'w-[35%]', cellType: 'badge' },
    { width: 'w-[15%]', cellType: 'actions' },
  ],
};

// Initial filter state
const initialFilterState: FilterState = {
  email: { text: '' } as TextFilterValue,
  role: [] as string[],
};

// Sort accessors for each sortable column
const sortAccessors: Record<string, (item: UserData) => string | number | Date | null> = {
  email: (item) => item.email.toLowerCase(),
  role: (item) => formatRoleName(item.new_role_slug).toLowerCase(),
};

export function UsersTable() {
  const { users, isLoading, error, mutate } = useUsers();
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

  const currentUser = getCurrentOrgUser();
  const canEditUser = hasPermission('can_edit_orguser');
  const canDeleteUser = hasPermission('can_delete_orguser');

  // Memoize users array
  const usersList = useMemo(() => users || [], [users]);

  // Filter function using new utilities
  const filterFn = useCallback((user: UserData, filterState: FilterState): boolean => {
    const emailFilter = filterState.email as TextFilterValue;
    const roleFilter = filterState.role as string[];

    // Email filter
    if (!matchesTextFilter(user.email, emailFilter?.text || '')) {
      return false;
    }

    // Role filter
    if (!matchesCheckboxFilter(user.new_role_slug, roleFilter)) {
      return false;
    }

    return true;
  }, []);

  // Table state hook
  const {
    sortState,
    setSortState,
    filterState,
    setFilterState,
    filteredAndSortedData: filteredAndSortedUsers,
    activeFilterCount,
    clearAllFilters,
  } = useTableState({
    data: usersList,
    initialSort: { column: 'email', direction: 'asc' },
    initialFilters: initialFilterState,
    filterConfigs,
    sortAccessors,
    filterFn,
  });

  // Get unique roles for filter options
  const uniqueRoles = useMemo(
    () => extractUniqueValues(usersList, (user) => user.new_role_slug, formatRoleName),
    [usersList]
  );

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
            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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
                  <SelectTrigger className="w-40 h-8">
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
                <Button
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={handleSaveRole}
                  disabled={isUpdating}
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
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
          headerClassName: 'w-[35%]',
        },
      },
      {
        id: 'actions',
        header: () => <span className="font-medium text-base">Actions</span>,
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
              id: 'delete',
              label: 'Delete User',
              icon: <Trash2 className="w-4 h-4" />,
              variant: 'destructive',
              onClick: () => setDeleteUser(user.email),
              hidden: !canDeleteUser,
            },
          ];

          return (
            <ActionsCell
              row={user}
              actions={actions}
              moreIconVariant="horizontal"
              renderPrimaryActions={() =>
                canEditUser ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 p-0 hover:bg-gray-100"
                    onClick={() => handleEditRole(user.email, user.new_role_slug)}
                  >
                    <Edit className="w-4 h-4 text-gray-600" />
                  </Button>
                ) : null
              }
            />
          );
        },
        meta: {
          headerClassName: 'w-[15%]',
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
      handleEditRole,
      handleSaveRole,
      handleCancelEdit,
      setSortState,
      setFilterState,
    ]
  );

  // Error state
  if (error) {
    return <ErrorState title="Failed to load users" onRetry={() => mutate()} />;
  }

  return (
    <>
      <DataTable
        data={filteredAndSortedUsers}
        columns={columns}
        isLoading={isLoading}
        getRowId={(row) => row.email}
        sortState={sortState}
        onSortChange={setSortState}
        filterState={filterState}
        onFilterChange={setFilterState}
        filterConfigs={filterConfigs}
        activeFilterCount={activeFilterCount}
        onClearAllFilters={clearAllFilters}
        emptyState={{
          icon: <User className="w-12 h-12" />,
          title: 'No users found',
          filteredTitle: 'No users match the current filters',
        }}
        skeleton={skeletonConfig}
        idPrefix="users"
      />

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
