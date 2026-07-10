'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createGroup, renameGroup, type UserGroup } from '@/hooks/api/useUserGroups';
import { toastSuccess } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

interface GroupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present -> rename mode; omit -> create mode. */
  group?: UserGroup | null;
  onSuccess: () => void;
}

// Backend rejects a blank name (GroupValidationError) — checked client-side
// too so we don't round-trip for an obviously-empty field.
export function GroupFormDialog({ open, onOpenChange, group, onSuccess }: GroupFormDialogProps) {
  const isRename = Boolean(group);
  const [name, setName] = useState(group?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(group?.name ?? '');
      setError(null);
    }
  }, [open, group]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Group name cannot be blank');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      if (isRename && group) {
        await renameGroup(group.id, { name: trimmed });
        trackEvent(ANALYTICS_EVENTS.GROUP_RENAMED);
        toastSuccess.generic('Group renamed');
      } else {
        await createGroup({ name: trimmed });
        trackEvent(ANALYTICS_EVENTS.GROUP_CREATED);
        toastSuccess.generic('Group created');
      }
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      // Name collisions (and other 400s) surface inline, next to the field
      // that caused them — not a toast the user has to connect back to the form.
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="group-form-dialog" className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isRename ? 'Rename group' : 'Create group'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="group-form-name-input">Group name</Label>
          <Input
            id="group-form-name-input"
            data-testid="group-form-name-input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="e.g. Funders"
            disabled={isSubmitting}
            autoFocus
          />
          {error && (
            <p data-testid="group-form-error" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            data-testid="group-form-cancel-btn"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            data-testid="group-form-submit-btn"
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
          >
            {isSubmitting ? 'Saving…' : isRename ? 'Rename' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
