'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { useInvitations, useInvitationActions } from '@/hooks/api/useUserManagement';
import { MoreHorizontal, Mail, Send, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { DeleteInvitationDialog } from './DeleteInvitationDialog';

export function InvitationsTable() {
  const { invitations, isLoading, mutate } = useInvitations();
  const { resendInvitation } = useInvitationActions();
  const { hasPermission } = useUserPermissions();

  const [deleteInvitation, setDeleteInvitation] = useState<number | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);

  const canDeleteInvitation = hasPermission('can_delete_invitation');
  const canResendInvitation = hasPermission('can_resend_email_verification');

  const handleResendInvitation = async (invitationId: number) => {
    setResendingId(invitationId);
    try {
      await resendInvitation(invitationId);
    } catch (error) {
      // Error is handled in the hook
    } finally {
      setResendingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          {!invitations || invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No pending invitations</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Sent On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{invitation.invited_email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{invitation.invited_role.name}</Badge>
                    </TableCell>
                    <TableCell>{format(new Date(invitation.invited_on), 'MMM dd, yyyy')}</TableCell>
                    <TableCell className="text-right">
                      {(canResendInvitation || canDeleteInvitation) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canResendInvitation && (
                              <DropdownMenuItem
                                onClick={() => handleResendInvitation(invitation.id)}
                                disabled={resendingId === invitation.id}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                {resendingId === invitation.id ? 'Resending...' : 'Resend'}
                              </DropdownMenuItem>
                            )}
                            {canDeleteInvitation && (
                              <DropdownMenuItem
                                onClick={() => setDeleteInvitation(invitation.id)}
                                className="text-destructive"
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
          )}
        </CardContent>
      </Card>

      <DeleteInvitationDialog
        open={!!deleteInvitation}
        onOpenChange={(open) => !open && setDeleteInvitation(null)}
        invitationId={deleteInvitation || 0}
        onSuccess={() => {
          mutate();
          setDeleteInvitation(null);
        }}
      />
    </>
  );
}
