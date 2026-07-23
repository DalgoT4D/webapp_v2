'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { PERMISSIONS, useRbac } from '@/lib/rbac';
import { useUserGroups } from '@/hooks/api/useAccess';
import { MoreVertical, Users, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { EditGroupDialog } from './EditGroupDialog';
import { DeleteGroupDialog } from './DeleteGroupDialog';
import type { GroupListRow } from '@/types/user-groups';

export function GroupsTab() {
  const { groups, isLoading, mutate } = useUserGroups();
  const { hasPermission } = useRbac();

  const [editing, setEditing] = useState<GroupListRow | null>(null);
  const [deleting, setDeleting] = useState<GroupListRow | null>(null);

  const canEdit = hasPermission(PERMISSIONS.CAN_EDIT_USER_GROUP);
  const canDelete = hasPermission(PERMISSIONS.CAN_DELETE_USER_GROUP);

  if (isLoading) {
    return (
      <div className="border rounded-lg bg-white overflow-hidden p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-[40%]">Group Name</TableHead>
              <TableHead className="w-[15%]">Members</TableHead>
              <TableHead className="w-[25%]">Created By</TableHead>
              <TableHead className="w-[15%]">Created</TableHead>
              <TableHead className="w-[5%]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups?.map((group) => (
              <TableRow
                key={group.id}
                className="hover:bg-gray-50"
                data-testid={`group-row-${group.id}`}
              >
                <TableCell className="py-4">
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-gray-900">{group.name}</span>
                  </div>
                </TableCell>
                <TableCell className="py-4 text-gray-700">
                  {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                </TableCell>
                <TableCell className="py-4 text-gray-600">
                  {group.created_by_email ?? '—'}
                </TableCell>
                <TableCell className="py-4 text-gray-600">
                  {format(new Date(group.created_at), 'MMM dd, yyyy')}
                </TableCell>
                <TableCell className="py-4">
                  {(canEdit || canDelete) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 p-0 hover:bg-gray-100"
                          data-testid={`group-actions-${group.id}`}
                        >
                          <MoreVertical className="h-4 w-4 text-gray-600" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEdit && (
                          <DropdownMenuItem
                            onClick={() => setEditing(group)}
                            data-testid={`edit-group-${group.id}`}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <DropdownMenuItem
                            onClick={() => setDeleting(group)}
                            className="text-destructive focus:text-destructive"
                            data-testid={`delete-group-${group.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
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
        {groups && groups.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No groups yet. Create one to start sharing with a team.
          </div>
        )}
      </div>

      {editing && (
        <EditGroupDialog
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
          groupId={editing.id}
          onSuccess={() => {
            mutate();
            setEditing(null);
          }}
        />
      )}
      {deleting && (
        <DeleteGroupDialog
          open={!!deleting}
          onOpenChange={(open) => !open && setDeleting(null)}
          groupId={deleting.id}
          groupName={deleting.name}
          onSuccess={() => {
            mutate();
            setDeleting(null);
          }}
        />
      )}
    </>
  );
}
