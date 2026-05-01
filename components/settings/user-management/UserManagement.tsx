'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { UsersTable } from './UsersTable';
import { InvitationsTable } from './InvitationsTable';
import { InviteUserDialog } from './InviteUserDialog';
import { Info, UserPlus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const TAB_TRIGGER_CLASS =
  'relative bg-transparent border-0 shadow-none rounded-none px-1 py-2.5 text-sm font-medium uppercase tracking-wide text-gray-500 cursor-pointer data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-primary';

export default function UserManagement() {
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const { hasPermission } = useUserPermissions();

  const canCreateInvitation = hasPermission('can_create_invitation');
  const canViewInvitations = hasPermission('can_view_invitations');

  return (
    <div className="h-screen flex flex-col">
      <Tabs defaultValue="users" className="w-full h-full flex flex-col">
        <div className="w-full mx-auto px-6 pt-6 border-b  mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">User Management</h1>
              <p className="text-muted-foreground">
                Manage users and invitations for your organization
              </p>
            </div>

            <Button
              onClick={() => setShowInviteDialog(true)}
              disabled={!canCreateInvitation}
              className="flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Invite User
            </Button>
          </div>
          <div className="flex items-center gap-2 pb-0">
            <TabsList className="bg-transparent p-0 h-auto gap-4">
              <TabsTrigger value="users" className={TAB_TRIGGER_CLASS} data-testid="tab-users">
                Users
              </TabsTrigger>
              {canViewInvitations && (
                <TabsTrigger
                  value="invitations"
                  className={TAB_TRIGGER_CLASS}
                  data-testid="tab-pending"
                >
                  Pending Invitations
                </TabsTrigger>
              )}
            </TabsList>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
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
        </div>

        <div className="flex-1 w-full px-6 pb-6 overflow-hidden">
          <div className="h-full overflow-y-auto mb-10">
            <TabsContent value="users" className="mt-0 pb-6">
              <UsersTable />
            </TabsContent>

            {canViewInvitations && (
              <TabsContent value="invitations" className="mt-0 pb-6">
                <InvitationsTable />
              </TabsContent>
            )}
          </div>
        </div>
      </Tabs>

      <InviteUserDialog open={showInviteDialog} onOpenChange={setShowInviteDialog} />
    </div>
  );
}
