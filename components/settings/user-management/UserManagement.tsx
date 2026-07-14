'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PERMISSIONS, useRbac } from '@/lib/rbac';
import { UsersTable } from './UsersTable';
import { InvitationsTable } from './InvitationsTable';
import { InviteUserDialog } from './InviteUserDialog';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { trackFeatureView } from '@/lib/analytics';
import { FEATURES } from '@/constants/analytics';

interface UserManagementProps {
  /** The INVITE USER button lives on the Access page header; dialog state is lifted there. */
  showInviteDialog: boolean;
  onShowInviteDialogChange: (open: boolean) => void;
}

// People panel of Settings → Access. The page-level header (title, tabs,
// INVITE USER button) is owned by AccessPage; this renders the users /
// pending-invitations content as a secondary segmented control so it doesn't
// clash with the page-level PEOPLE | GROUPS | ROLES tab row.
export default function UserManagement({
  showInviteDialog,
  onShowInviteDialogChange,
}: UserManagementProps) {
  const { hasPermission } = useRbac();

  const canViewInvitations = hasPermission(PERMISSIONS.CAN_VIEW_INVITATIONS);

  return (
    <div className="h-full flex flex-col min-h-0">
      <Tabs
        defaultValue="users"
        onValueChange={(value) =>
          trackFeatureView(FEATURES.SETTINGS_USER_MANAGEMENT, { tab: value })
        }
        className="w-full flex-1 flex flex-col min-h-0"
      >
        <div className="flex-shrink-0 flex items-center gap-2 px-6 pt-6">
          <TabsList>
            <TabsTrigger value="users" data-testid="tab-users">
              Users
            </TabsTrigger>
            {canViewInvitations && (
              <TabsTrigger value="invitations" data-testid="tab-pending">
                Pending Invitations
              </TabsTrigger>
            )}
          </TabsList>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger aria-label="Role information" data-testid="role-info-tooltip-trigger">
                <Info className="h-5 w-5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs" side={`bottom`}>
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
        </div>

        <div className="flex-1 w-full px-6 pt-4 pb-6 overflow-y-auto min-h-0">
          <TabsContent value="users" className="mt-0">
            <UsersTable />
          </TabsContent>

          {canViewInvitations && (
            <TabsContent value="invitations" className="mt-0">
              <InvitationsTable />
            </TabsContent>
          )}
        </div>
      </Tabs>

      <InviteUserDialog open={showInviteDialog} onOpenChange={onShowInviteDialogChange} />
    </div>
  );
}
