'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { UsersTable } from './UsersTable';
import { InvitationsTable } from './InvitationsTable';
import { InviteUserDialog } from './InviteUserDialog';
import { UserPlus } from 'lucide-react';

export default function UserManagement() {
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const { hasPermission } = useUserPermissions();

  const canCreateInvitation = hasPermission('can_create_invitation');
  const canViewInvitations = hasPermission('can_view_invitations');

  return (
    <div className="h-screen flex flex-col">
      <div className="w-full mx-auto px-6 pt-6 border-b  mb-6">
        <div className="flex items-center justify-between mb-6">
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
      </div>

      <div className="flex-1 overflow-hidden w-full  px-6 pb-6 ">
        <Tabs defaultValue="users" className="w-full h-full flex flex-col">
          <TabsList className="mb-4">
            <TabsTrigger value="users" className="cursor-pointer" data-testid="tab-users">
              Users
            </TabsTrigger>
            {canViewInvitations && (
              <TabsTrigger value="invitations" className="cursor-pointer" data-testid="tab-pending">
                Pending Invitations
              </TabsTrigger>
            )}
          </TabsList>

          <div className="flex-1 overflow-y-auto mb-10">
            <TabsContent value="users" className="mt-0 pb-6">
              <UsersTable />
            </TabsContent>

            {canViewInvitations && (
              <TabsContent value="invitations" className="mt-0 pb-6">
                <InvitationsTable />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </div>

      <InviteUserDialog open={showInviteDialog} onOpenChange={setShowInviteDialog} />
    </div>
  );
}
