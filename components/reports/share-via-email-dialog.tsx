'use client';

import { useState, useCallback, useEffect } from 'react';
import { Mail, Loader2, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { toastSuccess, toastError } from '@/lib/toast';
import { shareReportViaEmail } from '@/hooks/api/useReports';
import { EMAIL_REGEX, MAX_RECIPIENTS } from '@/components/reports/utils';

interface ShareViaEmailDialogProps {
  snapshotId: number;
  reportTitle?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareViaEmailDialog({
  snapshotId,
  reportTitle,
  isOpen,
  onClose,
}: ShareViaEmailDialogProps) {
  const [emailInput, setEmailInput] = useState('');
  const defaultSubject = reportTitle ? `Report: ${reportTitle}` : '';
  const [subject, setSubject] = useState(defaultSubject);
  const [isSending, setIsSending] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setEmailInput('');
      setSubject(defaultSubject);
    }
  }, [isOpen, defaultSubject]);

  const handleSend = useCallback(async () => {
    const recipients = emailInput
      .split(/[,;]/)
      .map((e) => e.trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      toastError.api('Please enter at least one email address');
      return;
    }

    if (recipients.length > MAX_RECIPIENTS) {
      toastError.api(`Maximum ${MAX_RECIPIENTS} recipients allowed`);
      return;
    }

    const invalid = recipients.filter((email) => !EMAIL_REGEX.test(email));
    if (invalid.length > 0) {
      toastError.api(`Invalid email${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')}`);
      return;
    }

    setIsSending(true);
    try {
      await shareReportViaEmail(snapshotId, {
        recipient_emails: recipients,
        subject: subject.trim() || undefined,
      });
      toastSuccess.generic(
        `Report sent to ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}`
      );
      setEmailInput('');
      setSubject('');
      onClose();
    } catch (error) {
      toastError.api(error, 'Failed to send report');
    } finally {
      setIsSending(false);
    }
  }, [emailInput, subject, snapshotId, onClose]);

  const handleClose = useCallback(() => {
    setEmailInput('');
    setSubject('');
    onClose();
  }, [onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent data-testid="share-via-email-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Share Report via Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-4 space-y-4">
              {/* Subject */}
              <div className="space-y-1.5">
                <Label htmlFor="email-subject" className="text-sm font-medium">
                  Subject
                </Label>
                <Input
                  id="email-subject"
                  data-testid="share-email-subject"
                  placeholder="Email subject line"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={isSending}
                />
              </div>

              {/* Email recipients */}
              <div className="space-y-1.5">
                <Label htmlFor="email-recipients" className="text-sm font-medium">
                  Email recipients <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="email-recipients"
                  data-testid="share-email-input"
                  placeholder="name@org.com, another@org.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  disabled={isSending}
                  rows={3}
                  className="resize-none text-sm break-all [field-sizing:fixed]"
                />
                <p className="text-xs text-muted-foreground">
                  Recipients are separated by &quot;,&quot; or &quot;;&quot;
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              data-testid="share-email-cancel-btn"
              variant="outline"
              onClick={handleClose}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button
              data-testid="share-email-send-btn"
              variant="primary"
              onClick={handleSend}
              disabled={isSending || !emailInput.trim()}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {isSending ? 'Sending...' : 'SEND REPORT'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
