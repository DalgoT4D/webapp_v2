'use client';

import { useState, useCallback } from 'react';
import { Share2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toastSuccess, toastError } from '@/lib/toast';
import { shareReportViaEmail } from '@/hooks/api/useReports';
import { EMAIL_REGEX, MAX_RECIPIENTS } from '@/components/reports/utils';

interface ShareViaEmailDialogProps {
  snapshotId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareViaEmailDialog({ snapshotId, isOpen, onClose }: ShareViaEmailDialogProps) {
  const [emailInput, setEmailInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = useCallback(async () => {
    const raw = emailInput
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    if (raw.length === 0) {
      toastError.api('Please enter at least one email address');
      return;
    }

    if (raw.length > MAX_RECIPIENTS) {
      toastError.api(`Maximum ${MAX_RECIPIENTS} recipients allowed`);
      return;
    }

    const invalid = raw.filter((email) => !EMAIL_REGEX.test(email));
    if (invalid.length > 0) {
      toastError.api(`Invalid email${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')}`);
      return;
    }

    setIsSending(true);
    try {
      await shareReportViaEmail(snapshotId, { recipient_emails: raw });
      toastSuccess.generic('Your report was shared successfully!');
      setEmailInput('');
      onClose();
    } catch (error) {
      toastError.api(error, 'Failed to send report');
    } finally {
      setIsSending(false);
    }
  }, [emailInput, snapshotId, onClose]);

  const handleCancel = useCallback(() => {
    setEmailInput('');
    onClose();
  }, [onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        data-testid="share-via-email-dialog"
        className="sm:max-w-md"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">
              Share with <span className="text-destructive">*</span>
            </Label>
            <Input
              data-testid="share-email-input"
              type="text"
              placeholder="add the recipients emails (name@orgname.org, abc@orgname.org)"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              disabled={isSending}
              className="mt-1.5"
            />
          </div>

          <div className="flex gap-3">
            <Button
              data-testid="share-email-cancel-btn"
              variant="cancel"
              onClick={handleCancel}
              disabled={isSending}
              className="flex-1"
            >
              CANCEL
            </Button>
            <Button
              data-testid="share-email-send-btn"
              variant="default"
              onClick={handleSend}
              disabled={isSending || !emailInput.trim()}
              className="flex-1"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              SEND REPORT
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
