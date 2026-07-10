'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserGroups, type UserGroup } from '@/hooks/api/useUserGroups';
import { PERMISSIONS, useRbac } from '@/lib/rbac';
import { GroupsTable } from './GroupsTable';
import { GroupFormDialog } from './GroupFormDialog';
import { DeleteGroupDialog } from './DeleteGroupDialog';
import { GroupDetailDrawer } from './GroupDetailDrawer';

export default function UserGroups() {
  const { data: groups, isLoading, mutate } = useUserGroups();
  const { hasPermission } = useRbac();
  const canManage = hasPermission(PERMISSIONS.CAN_MANAGE_USER_GROUPS);

  const [showCreate, setShowCreate] = useState(false);
  const [renameTarget, setRenameTarget] = useState<UserGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserGroup | null>(null);
  const [detailGroupId, setDetailGroupId] = useState<number | null>(null);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-shrink-0 border-b bg-background">
        <div className="flex items-center justify-between mb-6 p-6 pb-0">
          <div>
            <h1 className="text-3xl font-bold">Groups</h1>
            <p className="text-muted-foreground mt-1">
              Create a group once, then share dashboards, reports, and more with everyone in it in
              one action.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowCreate(true)}
            disabled={!canManage}
            data-testid="groups-create-btn"
          >
            <Plus className="h-4 w-4 mr-2" />
            CREATE GROUP
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6 mt-6">
        <div className="h-full overflow-y-auto">
          <GroupsTable
            groups={groups}
            isLoading={isLoading}
            onView={(group) => setDetailGroupId(group.id)}
            onRename={(group) => setRenameTarget(group)}
            onDelete={(group) => setDeleteTarget(group)}
          />
        </div>
      </div>

      <GroupFormDialog open={showCreate} onOpenChange={setShowCreate} onSuccess={mutate} />

      <GroupFormDialog
        open={renameTarget !== null}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        group={renameTarget}
        onSuccess={() => {
          mutate();
          setRenameTarget(null);
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
