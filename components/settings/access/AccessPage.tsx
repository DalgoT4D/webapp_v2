'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PERMISSIONS, useRbac } from '@/lib/rbac';
import { InviteUserDialog } from '@/components/settings/user-management/InviteUserDialog';
import { usePeople, useUserGroups } from '@/hooks/api/useAccess';
import { PeopleTab } from './PeopleTab';
import { GroupsTab } from './GroupsTab';
import { RolesTab } from './RolesTab';
import { CreateGroupDialog } from './CreateGroupDialog';
import { UserPlus, Plus } from 'lucide-react';
import { trackFeatureView } from '@/lib/analytics';
import { FEATURES } from '@/constants/analytics';

const TAB_TRIGGER_CLASS =
  'relative bg-transparent border-0 shadow-none rounded-none px-1 py-2.5 text-sm font-medium uppercase tracking-wide text-gray-500 cursor-pointer data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-primary';

export default function AccessPage() {
  const [tab, setTab] = useState('people');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);
  const { hasPermission } = useRbac();
  const { mutate: mutatePeople } = usePeople();
  const { mutate: mutateGroups } = useUserGroups();

  const canCreateInvitation = hasPermission(PERMISSIONS.CAN_CREATE_INVITATION);
  const canCreateGroup = hasPermission(PERMISSIONS.CAN_CREATE_USER_GROUP);

  return (
    <div className="h-full flex flex-col min-h-0">
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          trackFeatureView(FEATURES.SETTINGS_USER_MANAGEMENT, { tab: value });
        }}
        className="w-full flex-1 flex flex-col min-h-0"
      >
        <div className="flex-shrink-0 border-b bg-background">
          <div className="flex items-center justify-between mb-6 p-6 pb-0">
            <div>
              <h1 className="text-3xl font-bold">Access</h1>
              <p className="text-muted-foreground mt-1">
                Manage users and set organization level permission defaults
              </p>
            </div>

            {tab === 'groups' ? (
              <Button
                variant="primary"
                onClick={() => setShowCreateGroupDialog(true)}
                disabled={!canCreateGroup}
                data-testid="create-group-button"
              >
                <Plus className="h-4 w-4 mr-2" />
                CREATE GROUP
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => setShowInviteDialog(true)}
                disabled={!canCreateInvitation}
                data-testid="invite-user-button"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                INVITE USER
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 px-6 pb-0">
            <TabsList className="bg-transparent p-0 h-auto gap-4">
              <TabsTrigger value="people" className={TAB_TRIGGER_CLASS} data-testid="tab-people">
                People
              </TabsTrigger>
              <TabsTrigger value="groups" className={TAB_TRIGGER_CLASS} data-testid="tab-groups">
                Groups
              </TabsTrigger>
              <TabsTrigger value="roles" className={TAB_TRIGGER_CLASS} data-testid="tab-roles">
                Roles
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <TabsContent value="people" className="mt-0">
            <PeopleTab />
          </TabsContent>
          <TabsContent value="groups" className="mt-0">
            <GroupsTab />
          </TabsContent>
          <TabsContent value="roles" className="mt-0">
            <RolesTab />
          </TabsContent>
        </div>
      </Tabs>

      <InviteUserDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        onSuccess={() => mutatePeople()}
      />
      <CreateGroupDialog
        open={showCreateGroupDialog}
        onOpenChange={setShowCreateGroupDialog}
        onSuccess={() => {
          mutateGroups();
          mutatePeople();
        }}
      />
    </div>
  );
}
