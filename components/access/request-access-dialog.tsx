'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createAccessRequest } from '@/hooks/api/useAccess';

interface RequestAccessDialogProps {
  rtype: string;
  resourceId: number;
  /** Pre-select the access level radio. `view` from the NoAccess screen; `edit`
   *  from the Request-Edit pill on a resource the caller already has View on. */
  defaultLevel?: 'view' | 'edit';
  /** When true, the level select is disabled — the user can only submit the
   *  `defaultLevel`. Used by the Request-Edit pill, where the choice is fixed
   *  (they already have View; the only meaningful request is Edit). */
  lockLevel?: boolean;
  isOpen: boolean;
  onClose: () => void;
  /** Fires after a successful POST /request-access. Parents can use this to
   *  swap the trigger UI into a "Request sent" state. */
  onSubmitted?: () => void;
}

export function RequestAccessDialog({
  rtype,
  resourceId,
  defaultLevel = 'view',
  lockLevel = false,
  isOpen,
  onClose,
  onSubmitted,
}: RequestAccessDialogProps) {
  const [level, setLevel] = useState<'view' | 'edit'>(defaultLevel);
  const [note, setNote] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async () => {
    setIsSending(true);
    try {
      await createAccessRequest(rtype, resourceId, {
        requested_level: level,
        note: note || undefined,
      });
      onSubmitted?.();
      onClose();
    } catch {
      // handled in hook
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Request Access</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="request-level">Access level</Label>
            <Select
              value={level}
              onValueChange={(v) => setLevel(v as 'view' | 'edit')}
              disabled={lockLevel}
            >
              <SelectTrigger id="request-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">View</SelectItem>
                <SelectItem value="edit">Edit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="request-note">Note (optional)</Label>
            <Textarea
              id="request-note"
              placeholder="Why do you need access?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={isSending}>
              {isSending ? 'Sending…' : 'Send Request'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
