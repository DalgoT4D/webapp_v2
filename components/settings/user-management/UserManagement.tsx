'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { UsersTable } from './UsersTable';
import { InvitationsTable } from './InvitationsTable';
import { InviteUserDialog } from './InviteUserDialog';
import { UserPlus, Info } from 'lucide-react';

export default function UserManagement() {
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const { hasPermission } = useUserPermissions();

  const canCreateInvitation = hasPermission('can_create_invitation');
  const canViewInvitations = hasPermission('can_view_invitations');

  return (
    <div id="user-management-container" className="h-full flex flex-col">
      {/* Fixed Header - Same style as Charts/Dashboard */}
      <div id="user-management-header" className="flex-shrink-0 border-b bg-background">
        <div
          id="user-management-title-section"
          className="flex items-center justify-between p-6 pb-4"
        >
          <div id="user-management-title-wrapper">
            <div className="flex items-center gap-2">
              <h1 id="user-management-page-title" className="text-3xl font-bold">
                User Management
              </h1>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs" side="right">
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
            <p id="user-management-page-description" className="text-muted-foreground mt-1">
              Manage users and invitations for your organization
            </p>
          </div>

          {canCreateInvitation && (
            <Button
              id="user-management-invite-button"
              onClick={() => setShowInviteDialog(true)}
              variant="ghost"
              className="text-white hover:opacity-90 shadow-xs"
              style={{ backgroundColor: '#06887b' }}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              INVITE USER
            </Button>
          )}
        </div>
      </div>

      {/* Tabs with content */}
      <Tabs defaultValue="users" className="flex-1 flex flex-col min-h-0">
        {/* Tabs List - Below header */}
        <div className="flex-shrink-0 px-6 py-2 bg-background">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            {canViewInvitations && (
              <TabsTrigger value="invitations">Pending Invitations</TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Tab Content */}
        <TabsContent value="users" className="flex-1 mt-0 data-[state=inactive]:hidden">
          <UsersTable />
        </TabsContent>

        {canViewInvitations && (
          <TabsContent value="invitations" className="flex-1 mt-0 data-[state=inactive]:hidden">
            <InvitationsTable />
          </TabsContent>
        )}
      </Tabs>

      <InviteUserDialog open={showInviteDialog} onOpenChange={setShowInviteDialog} />
    </div>
  );
}
