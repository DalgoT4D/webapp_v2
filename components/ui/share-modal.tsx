'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toastSuccess, toastError } from '@/lib/toast';
import { copyUrlToClipboard } from '@/lib/clipboard';
import { Share2, Copy, Shield, AlertTriangle, Mail, X, Loader2, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ShareStatus } from '@/types/reports';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 20;

interface ShareModalProps {
  entityId: number;
  entityLabel: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
  initialShareStatus?: Partial<ShareStatus>;
  getShareStatus: (id: number) => Promise<ShareStatus>;
  updateSharing: (id: number, data: { is_public: boolean }) => Promise<ShareStatus>;
  /** When provided, enables the "Share via Email" section */
  onShareViaEmail?: (data: {
    recipient_emails: string[];
    message?: string;
  }) => Promise<{ recipients_count: number; message: string }>;
}

export function ShareModal({
  entityId,
  entityLabel,
  isOpen,
  onClose,
  onUpdate,
  initialShareStatus,
  getShareStatus,
  updateSharing,
  onShareViaEmail,
}: ShareModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [shareStatus, setShareStatus] = useState<ShareStatus>({
    is_public: initialShareStatus?.is_public ?? false,
    public_access_count: initialShareStatus?.public_access_count ?? 0,
  });

  // Email sharing state
  const [emailInput, setEmailInput] = useState('');
  const [recipientEmails, setRecipientEmails] = useState<string[]>([]);
  const [personalMessage, setPersonalMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const entityLabelLower = entityLabel.toLowerCase();

  const fetchShareStatus = useCallback(async () => {
    try {
      const status = await getShareStatus(entityId);
      setShareStatus(status);
    } catch (error) {
      console.error('Failed to fetch share status:', error);
      toastError.load(error, 'sharing status');
    }
  }, [entityId, getShareStatus]);

  useEffect(() => {
    if (isOpen && entityId) {
      fetchShareStatus();
    }
  }, [isOpen, entityId, fetchShareStatus]);

  const handleToggleSharing = useCallback(
    async (isPublic: boolean) => {
      setIsLoading(true);

      try {
        const response = await updateSharing(entityId, { is_public: isPublic });

        setShareStatus((prev) => ({
          ...prev,
          is_public: response.is_public,
          public_url: response.public_url,
        }));

        if (isPublic && response.public_url) {
          toastSuccess.generic(`${entityLabel} is now public`);
          await copyUrlToClipboard(response.public_url);
        } else {
          toastSuccess.generic(`${entityLabel} sharing disabled`);
        }

        onUpdate?.();
      } catch (error) {
        console.error('Failed to toggle sharing:', error);
        toastError.share(error);
      } finally {
        setIsLoading(false);
      }
    },
    [entityId, entityLabel, updateSharing, onUpdate]
  );

  const handleCopyUrl = useCallback(async () => {
    if (shareStatus.public_url) {
      await copyUrlToClipboard(shareStatus.public_url);
    }
  }, [shareStatus.public_url]);

  const handleAddEmail = useCallback(() => {
    const email = emailInput.trim();
    if (!email) return;
    if (!EMAIL_REGEX.test(email)) {
      toastError.api('Please enter a valid email address');
      return;
    }
    if (recipientEmails.includes(email)) {
      toastError.api('Email already added');
      return;
    }
    if (recipientEmails.length >= MAX_RECIPIENTS) {
      toastError.api(`Maximum ${MAX_RECIPIENTS} recipients allowed`);
      return;
    }
    setRecipientEmails((prev) => [...prev, email]);
    setEmailInput('');
  }, [emailInput, recipientEmails]);

  const handleRemoveEmail = useCallback((email: string) => {
    setRecipientEmails((prev) => prev.filter((e) => e !== email));
  }, []);

  const handleEmailKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddEmail();
      }
    },
    [handleAddEmail]
  );

  const handleSendEmails = useCallback(async () => {
    if (!onShareViaEmail || recipientEmails.length === 0) return;
    setIsSending(true);
    try {
      const result = await onShareViaEmail({
        recipient_emails: recipientEmails,
        message: personalMessage || undefined,
      });
      toastSuccess.generic(
        `Report is being sent to ${result.recipients_count} recipient${result.recipients_count > 1 ? 's' : ''}`
      );
      setRecipientEmails([]);
      setPersonalMessage('');
      // Refresh share status since is_public may have been enabled
      fetchShareStatus();
    } catch (error) {
      toastError.api('Failed to send emails');
    } finally {
      setIsSending(false);
    }
  }, [onShareViaEmail, recipientEmails, personalMessage, fetchShareStatus]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent data-testid="share-modal" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share {entityLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Organization Access (Default) */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <div>
                    <Label className="text-sm font-medium">Organization Access</Label>
                    <p className="text-xs text-muted-foreground">
                      Users in your organization with proper permissions can access this{' '}
                      {entityLabelLower}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">Default</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Public Sharing Toggle */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Share2 className="h-5 w-5 text-green-600" />
                    <div className="flex-1">
                      <Label className="text-sm font-medium">Public Access</Label>
                      <p className="text-xs text-muted-foreground">
                        Anyone with the link can view this {entityLabelLower}
                      </p>
                    </div>
                  </div>
                  <Switch
                    data-testid="share-toggle"
                    checked={shareStatus.is_public}
                    onCheckedChange={handleToggleSharing}
                    disabled={isLoading}
                  />
                </div>

                {/* Security Warning */}
                {shareStatus.is_public && (
                  <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-md">
                    <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-orange-800">
                      <strong>Security Notice:</strong> Your data is now exposed to the internet.
                      Anyone with this link can access your {entityLabelLower} data without
                      authentication.
                    </div>
                  </div>
                )}

                {/* Copy URL Button */}
                {shareStatus.is_public && shareStatus.public_url && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Share this {entityLabelLower}:</Label>
                    <Button
                      data-testid="copy-link-btn"
                      variant="outline"
                      onClick={handleCopyUrl}
                      className="w-full"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Public Link
                    </Button>
                  </div>
                )}

                {/* Analytics */}
                {shareStatus.is_public && shareStatus.public_access_count > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <p>Public access count: {shareStatus.public_access_count}</p>
                    {shareStatus.last_public_accessed && (
                      <p>
                        Last accessed: {new Date(shareStatus.last_public_accessed).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Share via Email (opt-in via prop) */}
          {onShareViaEmail && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-primary" />
                    <div>
                      <Label className="text-sm font-medium">Share via Email</Label>
                      <p className="text-xs text-muted-foreground">
                        Send a PDF and link to recipients. Public access will be enabled
                        automatically.
                      </p>
                    </div>
                  </div>

                  {/* Email input + Add button */}
                  <div className="flex gap-2">
                    <Input
                      data-testid="share-email-input"
                      type="email"
                      placeholder="Enter email address"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={handleEmailKeyDown}
                      disabled={isSending}
                      className="flex-1"
                    />
                    <Button
                      data-testid="share-email-add-btn"
                      variant="outline"
                      size="sm"
                      onClick={handleAddEmail}
                      disabled={isSending || !emailInput.trim()}
                    >
                      Add
                    </Button>
                  </div>

                  {/* Email chips */}
                  {recipientEmails.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {recipientEmails.map((email) => (
                        <span
                          key={email}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-xs text-primary"
                        >
                          {email}
                          <button
                            type="button"
                            data-testid={`share-email-remove-${email}`}
                            onClick={() => handleRemoveEmail(email)}
                            disabled={isSending}
                            className="hover:text-destructive"
                            aria-label={`Remove ${email}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Personal message */}
                  <Textarea
                    data-testid="share-email-message"
                    placeholder="Add a personal message (optional)"
                    value={personalMessage}
                    onChange={(e) => setPersonalMessage(e.target.value)}
                    disabled={isSending}
                    rows={2}
                    className="resize-none text-sm"
                  />

                  {/* Send button */}
                  <Button
                    data-testid="share-email-send-btn"
                    onClick={handleSendEmails}
                    disabled={isSending || recipientEmails.length === 0}
                    className="w-full"
                    variant="primary"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    <span>
                      {isSending
                        ? 'Sending...'
                        : `Send to ${recipientEmails.length} recipient${recipientEmails.length !== 1 ? 's' : ''}`}
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button data-testid="share-close-btn" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
