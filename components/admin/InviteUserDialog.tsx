'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRoles } from '@/hooks/api/useUserManagement';
import { useAdminOrgUserActions } from '@/hooks/api/useAdminPortal';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: number;
  onSuccess: () => void;
}

const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

/**
 * Invite a user into a specific org from the admin portal. Unlike the settings
 * invite dialog (current-org, header-scoped), this takes the org id explicitly
 * and a platform admin may pick ANY role — the backend skips the inviter cap.
 */
export function InviteUserDialog({ open, onOpenChange, orgId, onSuccess }: InviteUserDialogProps) {
  const { roles } = useRoles();
  const { inviteUser } = useAdminOrgUserActions();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [roleUuid, setRoleUuid] = useState('');
  const [errors, setErrors] = useState<{ email?: string; role?: string }>({});

  const reset = () => {
    setEmail('');
    setRoleUuid('');
    setErrors({});
  };

  const validate = () => {
    const next: { email?: string; role?: string } = {};
    if (!email.trim()) next.email = 'Email is required';
    else if (!EMAIL_RE.test(email)) next.email = 'Invalid email address';
    if (!roleUuid) next.role = 'Role is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await inviteUser(orgId, { invited_email: email.trim(), invited_role_uuid: roleUuid });
      reset();
      onSuccess();
      onOpenChange(false);
    } catch {
      // toast surfaced in the hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite user</DialogTitle>
          <DialogDescription>Send an invitation to join this organization.</DialogDescription>
        </DialogHeader>

        {/* noValidate: our regex validation is authoritative — don't let the
            browser's native type=email check preempt the custom messages. */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="admin-invite-email">Email</Label>
            <Input
              id="admin-invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className={errors.email ? 'border-destructive' : ''}
              data-testid="admin-invite-email-input"
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-invite-role">Role</Label>
            <Select value={roleUuid} onValueChange={setRoleUuid}>
              <SelectTrigger
                id="admin-invite-role"
                className={errors.role ? 'border-destructive' : ''}
                data-testid="admin-invite-role-select"
              >
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles?.map((role) => (
                  <SelectItem key={role.uuid} value={role.uuid}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && <p className="text-sm text-destructive">{errors.role}</p>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} data-testid="admin-invite-submit">
              {isSubmitting ? 'Sending…' : 'Send invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
