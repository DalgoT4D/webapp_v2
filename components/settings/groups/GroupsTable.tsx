'use client';

import { useMemo, useState } from 'react';
import {
  Users as UsersIcon,
  MoreVertical,
  Pencil,
  Trash2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Plus,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AvatarInitial, CreatedByCell } from '@/components/settings/AvatarInitial';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ADMIN_ROLES, PERMISSIONS, useRbac } from '@/lib/rbac';
import { useAuthStore } from '@/stores/authStore';
import type { UserGroup } from '@/hooks/api/useUserGroups';
import { LearnAccessLink } from '@/components/settings/access/LearnAccessLink';

type GroupSortColumn = 'name' | 'created_at';

interface GroupsTableProps {
  groups: UserGroup[] | undefined;
  isLoading: boolean;
  onView: (group: UserGroup) => void;
  /** Opens GroupFormDialog in edit mode (name + members). */
  onEdit: (group: UserGroup) => void;
  onDelete: (group: UserGroup) => void;
  /** Empty-state CTA opens the create-group dialog, owned by AccessPage. */
  onCreateGroup?: () => void;
}

export function GroupsTable({
  groups,
  isLoading,
  onView,
  onEdit,
  onDelete,
  onCreateGroup,
}: GroupsTableProps) {
  const { hasPermission, hasRole } = useRbac();
  const currentOrgUser = useAuthStore((state) => state.getCurrentOrgUser());
  const canManageAny = hasPermission(PERMISSIONS.CAN_MANAGE_USER_GROUPS);
  const isAdmin = hasRole(ADMIN_ROLES);

  // Object-level gate the backend enforces for real — mirrored here for UI
  // convenience. created_by is null once the creating OrgUser is deleted
  // (SET_NULL), which falls through to admin-only, same as the backend.
  const canManageGroup = (group: UserGroup) =>
    canManageAny && (isAdmin || group.created_by?.email === currentOrgUser?.email);

  // Column sorting: Name + Created only.
  const [sortBy, setSortBy] = useState<GroupSortColumn>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: GroupSortColumn) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (column: GroupSortColumn) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4 text-gray-600" />
    ) : (
      <ChevronDown className="w-4 h-4 text-gray-600" />
    );
  };

  const sortedGroups = useMemo(() => {
    if (!groups) return [];
    const sorted = [...groups].sort((a, b) => {
      let cmp: number;
      if (sortBy === 'name') {
        cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      } else {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [groups, sortBy, sortOrder]);

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
      <div
        data-testid="groups-empty"
        className="border rounded-lg bg-white flex flex-col items-center justify-center gap-4 py-16 px-6 text-center"
      >
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
          <UsersIcon className="w-10 h-10 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">No groups yet</h3>
        <p className="text-muted-foreground max-w-sm">
          Create groups of your team members to collaborate and share dashboards and reports with
          them in one go.
        </p>
        <Button variant="primary" onClick={onCreateGroup} data-testid="groups-empty-create-btn">
          <Plus className="h-4 w-4 mr-2" />
          CREATE GROUP
        </Button>
        <LearnAccessLink />
      </div>
    );
  }

  return (
    <div className="border rounded-lg bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="px-4 py-3">
              <Button
                variant="ghost"
                className="h-auto p-0 font-medium text-base hover:bg-transparent justify-start"
                onClick={() => handleSort('name')}
                data-testid="groups-sort-name"
              >
                <div className="flex items-center gap-2">
                  Name
                  {renderSortIcon('name')}
                </div>
              </Button>
            </TableHead>
            <TableHead className="px-4 py-3">Members</TableHead>
            <TableHead className="px-4 py-3">Shared with</TableHead>
            <TableHead className="px-4 py-3">Created By</TableHead>
            <TableHead className="px-4 py-3">
              <Button
                variant="ghost"
                className="h-auto p-0 font-medium text-base hover:bg-transparent justify-start"
                onClick={() => handleSort('created_at')}
                data-testid="groups-sort-created"
              >
                <div className="flex items-center gap-2">
                  Created
                  {renderSortIcon('created_at')}
                </div>
              </Button>
            </TableHead>
            <TableHead className="w-[10%] px-4 py-3">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedGroups.map((group) => (
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
              <TableCell className="px-4 py-3">
                <div
                  data-testid={`group-member-count-${group.id}`}
                  role="img"
                  aria-label={`${group.member_count} member${group.member_count === 1 ? '' : 's'}`}
                  className="flex items-center"
                >
                  {(group.member_preview ?? []).length > 0 ? (
                    <>
                      {group.member_preview.map((email, index) => (
                        <AvatarInitial
                          key={email}
                          seed={email}
                          className={index > 0 ? '-ml-2 ring-2 ring-white' : 'ring-2 ring-white'}
                        />
                      ))}
                      {group.member_count > group.member_preview.length && (
                        <span className="ml-2 text-xs font-medium text-teal-600">
                          +{group.member_count - group.member_preview.length}
                        </span>
                      )}
                    </>
                  ) : (
                    <span>{group.member_count}</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="px-4 py-3" data-testid={`group-shared-count-${group.id}`}>
                {group.shared_resource_count}
              </TableCell>
              <TableCell className="px-4 py-3" data-testid={`group-created-by-${group.id}`}>
                <CreatedByCell email={group.created_by?.email ?? null} />
              </TableCell>
              <TableCell
                className="px-4 py-3 text-muted-foreground"
                data-testid={`group-created-at-${group.id}`}
              >
                {format(new Date(group.created_at), 'MMM d, yyyy')}
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
                        data-testid={`group-edit-menu-item-${group.id}`}
                        onClick={() => onEdit(group)}
                        className="cursor-pointer"
                      >
                        <Pencil className="h-4 w-4" /> Edit
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
