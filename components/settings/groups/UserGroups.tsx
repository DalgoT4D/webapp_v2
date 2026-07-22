'use client';

import { useState } from 'react';
import { useUserGroups, type UserGroup } from '@/hooks/api/useUserGroups';
import { GroupsTable } from './GroupsTable';
import { GroupFormDialog } from './GroupFormDialog';
import { DeleteGroupDialog } from './DeleteGroupDialog';
import { GroupDetailDrawer } from './GroupDetailDrawer';

interface UserGroupsProps {
  /** The CREATE GROUP button lives on the Access page header; dialog state is lifted there. */
  showCreateDialog: boolean;
  onShowCreateDialogChange: (open: boolean) => void;
}

// Groups panel of Settings → Access. The page-level header (title, tabs,
// CREATE GROUP button) is owned by AccessPage.
export default function UserGroups({
  showCreateDialog,
  onShowCreateDialogChange,
}: UserGroupsProps) {
  const { data: groups, isLoading, mutate } = useUserGroups();

  const [editTarget, setEditTarget] = useState<UserGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserGroup | null>(null);
  const [detailGroupId, setDetailGroupId] = useState<number | null>(null);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6 pt-6">
        <div className="h-full overflow-y-auto">
          <GroupsTable
            groups={groups}
            isLoading={isLoading}
            onView={(group) => setDetailGroupId(group.id)}
            onEdit={(group) => setEditTarget(group)}
            onDelete={(group) => setDeleteTarget(group)}
            onCreateGroup={() => onShowCreateDialogChange(true)}
          />
        </div>
      </div>

      <GroupFormDialog
        open={showCreateDialog}
        onOpenChange={onShowCreateDialogChange}
        onSuccess={mutate}
      />

      <GroupFormDialog
        open={editTarget !== null}
        onOpenChange={(open) => !open && setEditTarget(null)}
        group={editTarget}
        onSuccess={() => {
          mutate();
          setEditTarget(null);
        }}
      />

      <DeleteGroupDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        group={deleteTarget}
        onSuccess={() => {
          mutate();
          setDeleteTarget(null);
        }}
      />

      <GroupDetailDrawer
        groupId={detailGroupId}
        open={detailGroupId !== null}
        onOpenChange={(open) => !open && setDetailGroupId(null)}
        onGroupsListChanged={mutate}
      />
    </div>
  );
}
