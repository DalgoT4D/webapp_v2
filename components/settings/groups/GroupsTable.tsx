'use client';

import { Users as UsersIcon, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ADMIN_ROLES, PERMISSIONS, useRbac } from '@/lib/rbac';
import { useAuthStore } from '@/stores/authStore';
import type { UserGroup } from '@/hooks/api/useUserGroups';

interface GroupsTableProps {
  groups: UserGroup[] | undefined;
  isLoading: boolean;
  onView: (group: UserGroup) => void;
  onRename: (group: UserGroup) => void;
  onDelete: (group: UserGroup) => void;
}

export function GroupsTable({ groups, isLoading, onView, onRename, onDelete }: GroupsTableProps) {
  const { hasPermission, hasRole } = useRbac();
  const currentOrgUser = useAuthStore((state) => state.getCurrentOrgUser());
  const canManageAny = hasPermission(PERMISSIONS.CAN_MANAGE_USER_GROUPS);
  const isAdmin = hasRole(ADMIN_ROLES);

  // Object-level gate the backend enforces for real — mirrored here for UI
  // convenience. created_by is null once the creating OrgUser is deleted
  // (SET_NULL), which falls through to admin-only, same as the backend.
  const canManageGroup = (group: UserGroup) =>
    canManageAny && (isAdmin || group.created_by?.email === currentOrgUser?.email);

  if (isLoading) {
    return (
      <div className="border rounded-lg bg-white overflow-hidden p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <p
        data-testid="groups-empty"
        className="text-sm text-muted-foreground text-center py-8 border rounded-lg bg-white"
      >
        No groups yet. Create one — like &quot;Funders&quot; or &quot;Field staff&quot; — to share
        dashboards and reports with a whole team in one action.
      </p>
    );
  }

  return (
    <div className="border rounded-lg bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="px-4 py-3">Name</TableHead>
            <TableHead className="px-4 py-3">Members</TableHead>
            <TableHead className="px-4 py-3">Shared with</TableHead>
            <TableHead className="w-[10%] px-4 py-3">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <TableRow key={group.id} data-testid={`group-row-${group.id}`}>
              <TableCell className="px-4 py-3">
                <button
                  type="button"
                  data-testid={`group-view-btn-${group.id}`}
                  onClick={() => onView(group)}
                  className="flex items-center gap-2 font-medium text-primary hover:underline"
                >
                  <UsersIcon className="h-4 w-4" />
                  {group.name}
                </button>
              </TableCell>
              <TableCell className="px-4 py-3" data-testid={`group-member-count-${group.id}`}>
                {group.member_count}
              </TableCell>
              <TableCell className="px-4 py-3" data-testid={`group-shared-count-${group.id}`}>
                {group.shared_resource_count}
              </TableCell>
              <TableCell className="px-4 py-3">
                {canManageGroup(group) ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Actions for ${group.name}`}
                        data-testid={`group-actions-${group.id}`}
                      >
                        <MoreVertical className="h-4 w-4 text-gray-600" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        data-testid={`group-rename-menu-item-${group.id}`}
                        onClick={() => onRename(group)}
                        className="cursor-pointer"
                      >
                        <Pencil className="h-4 w-4" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        data-testid={`group-delete-menu-item-${group.id}`}
                        onClick={() => onDelete(group)}
                        className="cursor-pointer text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
