'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ADMIN_ROLES, PERMISSIONS, useRbac } from '@/lib/rbac';
import UserManagement from '@/components/settings/user-management/UserManagement';
import UserGroups from '@/components/settings/groups/UserGroups';
import AccessManagement from '@/components/settings/access-management/AccessManagement';
import { trackFeatureView } from '@/lib/analytics';
import { FEATURES } from '@/constants/analytics';

export type AccessTab = 'people' | 'groups' | 'roles';

// Underline-style tab triggers (uppercase), matching the Figma PEOPLE | GROUPS | ROLES row.
const TAB_TRIGGER_CLASS =
  'relative bg-transparent border-0 shadow-none rounded-none px-1 py-2.5 text-sm font-medium uppercase tracking-wide text-gray-500 cursor-pointer data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-primary';

// One Settings → Access page with PEOPLE | GROUPS | ROLES tabs.
// Page access is DATA_SECTION_ROLES (guarded in app/settings/access/page.tsx);
// the People and Roles tabs are admin-only, mirroring the old standalone pages'
// RoleGuard(ADMIN_ROLES). Analysts see only the Groups tab.
export default function AccessPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasRole, hasPermission } = useRbac();

  const isAdmin = hasRole(ADMIN_ROLES);
  const visibleTabs: AccessTab[] = isAdmin ? ['people', 'groups', 'roles'] : ['groups'];

  // Deep links (?tab=people|groups|roles) land on the requested tab when it is
  // visible to the viewer; hidden or unknown tabs fall back to the first
  // visible one (groups for analysts), never an error screen.
  const requestedTab = searchParams.get('tab') as AccessTab | null;
  const [tab, setTab] = useState<AccessTab>(
    requestedTab && visibleTabs.includes(requestedTab) ? requestedTab : visibleTabs[0]
  );

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);

  const canCreateInvitation = hasPermission(PERMISSIONS.CAN_CREATE_INVITATION);
  const canManageGroups = hasPermission(PERMISSIONS.CAN_MANAGE_USER_GROUPS);

  const handleTabChange = (value: string) => {
    const next = value as AccessTab;
    setTab(next);
    // Keep the URL shareable/bookmarkable without adding history entries.
    router.replace(`${pathname}?tab=${next}`, { scroll: false });
    trackFeatureView(FEATURES.SETTINGS_ACCESS, { tab: next });
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <Tabs
        value={tab}
        onValueChange={handleTabChange}
        className="w-full flex-1 flex flex-col min-h-0 gap-0"
      >
        <div className="flex-shrink-0 border-b bg-background">
          <div className="flex items-center justify-between mb-6 p-6 pb-0">
            <div>
              <h1 className="text-3xl font-bold">Access</h1>
              <p className="text-muted-foreground mt-1">
                Manage users and set organization level permission defaults
              </p>
            </div>

            {tab === 'people' && (
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
            {tab === 'groups' && (
              <Button
                variant="primary"
                onClick={() => setShowCreateGroupDialog(true)}
                disabled={!canManageGroups}
                data-testid="groups-create-btn"
              >
                <Plus className="h-4 w-4 mr-2" />
                CREATE GROUP
              </Button>
            )}
          </div>
          <div className="px-6">
            <TabsList className="bg-transparent p-0 h-auto gap-4">
              {isAdmin && (
                <TabsTrigger
                  value="people"
                  className={TAB_TRIGGER_CLASS}
                  data-testid="access-tab-people"
                >
                  People
                </TabsTrigger>
              )}
              <TabsTrigger
                value="groups"
                className={TAB_TRIGGER_CLASS}
                data-testid="access-tab-groups"
              >
                Groups
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger
                  value="roles"
                  className={TAB_TRIGGER_CLASS}
                  data-testid="access-tab-roles"
                >
                  Roles
                </TabsTrigger>
              )}
            </TabsList>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {isAdmin && (
            <TabsContent value="people" className="mt-0 h-full">
              <UserManagement
                showInviteDialog={showInviteDialog}
                onShowInviteDialogChange={setShowInviteDialog}
              />
            </TabsContent>
          )}
          <TabsContent value="groups" className="mt-0 h-full">
            <UserGroups
              showCreateDialog={showCreateGroupDialog}
              onShowCreateDialogChange={setShowCreateGroupDialog}
            />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="roles" className="mt-0 h-full">
              <AccessManagement />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}
