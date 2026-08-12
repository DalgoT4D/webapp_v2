'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
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

interface NoAccessProps {
  /** When provided, shows a "Request Access" button. */
  rtype?: string;
  resourceId?: number;
}

export function NoAccess({ rtype, resourceId }: NoAccessProps = {}) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [level, setLevel] = useState<'view' | 'edit'>('view');
  const [note, setNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const canRequest = !!rtype && resourceId != null;

  const handleSubmit = async () => {
    if (!rtype || resourceId == null) return;
    setIsSending(true);
    try {
      await createAccessRequest(rtype, resourceId, {
        requested_level: level,
        note: note || undefined,
      });
      setSent(true);
      setRequestOpen(false);
    } catch {
      // handled in hook
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <div data-testid="no-access" className="h-full flex items-center justify-center bg-muted/30">
        <div className="text-center max-w-sm">
          <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-destructive" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground mb-4">
            {sent
              ? 'Your access request has been sent. The owner will review it.'
              : "You don't have permission to view this. Contact your org Admin or request access."}
          </p>
          {canRequest && !sent && (
            <Button variant="primary" onClick={() => setRequestOpen(true)}>
              Request Access
            </Button>
          )}
        </div>
      </div>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Request Access</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="request-level">Access level</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as 'view' | 'edit')}>
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
              <Button variant="outline" onClick={() => setRequestOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSubmit} disabled={isSending}>
                {isSending ? 'Sending…' : 'Send Request'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
