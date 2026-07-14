'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRoles } from '@/hooks/api/useUserManagement';
import { useAdminOrgUserActions, type AdminOrgUser } from '@/hooks/api/useAdminPortal';

interface ChangeRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: number;
  orgUser: AdminOrgUser | null;
  onSuccess: () => void;
}

/**
 * Change a user's role within an org. A platform admin may assign any role — the
 * backend skips the role-level cap for the cross-org admin.
 */
export function ChangeRoleDialog({
  open,
  onOpenChange,
  orgId,
  orgUser,
  onSuccess,
}: ChangeRoleDialogProps) {
  const { roles } = useRoles();
  const { changeRole } = useAdminOrgUserActions();

  const [roleUuid, setRoleUuid] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preselect the user's current role when the dialog opens.
  useEffect(() => {
    if (open && orgUser && roles) {
      const current = roles.find((r) => r.slug === orgUser.new_role_slug);
      setRoleUuid(current?.uuid ?? '');
    }
  }, [open, orgUser, roles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgUser || !roleUuid) return;

    setIsSubmitting(true);
    try {
      await changeRole(orgId, orgUser.orguser_id, roleUuid);
      onSuccess();
      onOpenChange(false);
    } catch {
      // toast surfaced in the hook
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Change role</DialogTitle>
          <DialogDescription>
            Change the role of <strong>{orgUser?.email}</strong> in this organization.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-change-role">Role</Label>
            <Select value={roleUuid} onValueChange={setRoleUuid}>
              <SelectTrigger id="admin-change-role" data-testid="admin-change-role-select">
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
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !roleUuid}
              data-testid="admin-change-role-submit"
            >
              {isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
