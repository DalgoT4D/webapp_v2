'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAdminOrgUsers,
  useAdminOrgUserActions,
  type AdminOrgUser,
} from '@/hooks/api/useAdminPortal';
import { InviteUserDialog } from './InviteUserDialog';
import { ChangeRoleDialog } from './ChangeRoleDialog';
import { RemoveUserDialog } from './RemoveUserDialog';

interface OrgUsersTableProps {
  orgId: number;
}

/**
 * The Users tab for an org in the admin portal: current members (with per-org
 * status and role/deactivate/remove actions) plus pending invitations (with
 * cancel). All actions are org-parameterized — the org id is threaded through,
 * not read from the current-org header.
 */
export function OrgUsersTable({ orgId }: OrgUsersTableProps) {
  const { users, invitations, isLoading, mutate } = useAdminOrgUsers(orgId);
  const { deactivateUser, reactivateUser, cancelInvitation } = useAdminOrgUserActions();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<AdminOrgUser | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AdminOrgUser | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const onToggleActive = async (user: AdminOrgUser) => {
    setBusyId(user.orguser_id);
    try {
      if (user.is_active) {
        await deactivateUser(orgId, user.orguser_id);
      } else {
        await reactivateUser(orgId, user.orguser_id);
      }
      await mutate();
    } catch {
      // toast surfaced in the hook
    } finally {
      setBusyId(null);
    }
  };

  const onCancelInvite = async (invitationId: number) => {
    setBusyId(invitationId);
    try {
      await cancelInvitation(orgId, invitationId);
      await mutate();
    } catch {
      // toast surfaced in the hook
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-48 w-full" data-testid="org-users-loading" />;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Members</h2>
        <Button onClick={() => setInviteOpen(true)} data-testid="admin-invite-open">
          Invite user
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(!users || users.length === 0) && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No members yet. Invite the first user to get started.
              </TableCell>
            </TableRow>
          )}
          {users?.map((user) => (
            <TableRow key={user.orguser_id} data-testid={`org-user-row-${user.orguser_id}`}>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.new_role_slug ?? '—'}</TableCell>
              <TableCell>
                <Badge variant={user.is_active ? 'default' : 'secondary'}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRoleTarget(user)}
                    data-testid={`org-user-role-${user.orguser_id}`}
                  >
                    Change role
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === user.orguser_id}
                    onClick={() => onToggleActive(user)}
                    data-testid={`org-user-toggle-${user.orguser_id}`}
                  >
                    {user.is_active ? 'Deactivate' : 'Reactivate'}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setRemoveTarget(user)}
                    data-testid={`org-user-remove-${user.orguser_id}`}
                  >
                    Remove
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {invitations && invitations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Pending invitations</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((inv) => (
                <TableRow key={inv.id} data-testid={`org-invite-row-${inv.id}`}>
                  <TableCell>{inv.invited_email}</TableCell>
                  <TableCell>{inv.invited_role_slug ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === inv.id}
                      onClick={() => onCancelInvite(inv.id)}
                      data-testid={`org-invite-cancel-${inv.id}`}
                    >
                      Cancel invite
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        orgId={orgId}
        onSuccess={mutate}
      />
      <ChangeRoleDialog
        open={roleTarget !== null}
        onOpenChange={(open) => !open && setRoleTarget(null)}
        orgId={orgId}
        orgUser={roleTarget}
        onSuccess={mutate}
      />
      <RemoveUserDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        orgId={orgId}
        orgUser={removeTarget}
        onSuccess={() => {
          setRemoveTarget(null);
          mutate();
        }}
      />
    </div>
  );
}
