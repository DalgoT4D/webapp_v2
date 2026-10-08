'use client';

import { Loader2, Mail, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { LegacyEmailShareState } from '@/components/share/hooks/useLegacyEmailShare';

/**
 * Legacy "Share via Email" card. Kept as dead-but-reachable code (spec R0 keep-list, R5d):
 * the modal renders it only when a caller passes onShareViaEmail, and none does today.
 */
export function LegacyEmailShareSection({ email }: { email: LegacyEmailShareState }) {
  const { emailInput, recipientEmails, personalMessage, isSending } = email;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-primary" />
            <div>
              <Label className="text-sm font-medium">Share via Email</Label>
              <p className="text-xs text-muted-foreground">
                Send a PDF and link to recipients. Public access will be enabled automatically.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Enter email address"
              value={emailInput}
              onChange={(e) => email.setEmailInput(e.target.value)}
              onKeyDown={email.handleEmailKeyDown}
              disabled={isSending}
              className="flex-1"
              data-testid="share-modal-email-input"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={email.handleAddEmail}
              disabled={isSending || !emailInput.trim()}
              data-testid="share-modal-email-add-btn"
            >
              Add
            </Button>
          </div>

          {recipientEmails.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recipientEmails.map((recipient) => (
                <span
                  key={recipient}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-xs text-primary"
                >
                  {recipient}
                  <button
                    type="button"
                    onClick={() => email.handleRemoveRecipient(recipient)}
                    disabled={isSending}
                    className="hover:text-destructive"
                    aria-label={`Remove ${recipient}`}
                    data-testid={`share-modal-email-remove-${recipient}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <Textarea
            placeholder="Add a personal message (optional)"
            value={personalMessage}
            onChange={(e) => email.setPersonalMessage(e.target.value)}
            disabled={isSending}
            rows={2}
            className="resize-none text-sm"
            data-testid="share-modal-email-message"
          />

          <Button
            onClick={email.handleSendEmails}
            disabled={isSending || recipientEmails.length === 0}
            className="w-full"
            variant="primary"
            data-testid="share-modal-email-send-btn"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            <span>
              {isSending
                ? 'Sending...'
                : `Send to ${recipientEmails.length} recipient${
                    recipientEmails.length !== 1 ? 's' : ''
                  }`}
            </span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
