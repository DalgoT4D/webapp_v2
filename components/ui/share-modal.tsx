'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toastSuccess, toastError } from '@/lib/toast';
import { copyUrlToClipboard } from '@/lib/clipboard';
import {
  Share2,
  Link,
  Copy,
  Shield,
  AlertTriangle,
  Mail,
  X,
  Loader2,
  Send,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ShareStatus } from '@/types/reports';
import {
  useResourceAccess,
  addGrant,
  removeGrant,
  transferOwnership,
  type ShareableResourceType,
  type AccessGrant,
  type AccessLevel,
} from '@/hooks/api/useResourceAccess';
import {
  useAccessRequests,
  approveAccessRequest,
  declineAccessRequest,
  type AccessRequestItem,
} from '@/hooks/api/useAccessRequests';
import { useUsers } from '@/hooks/api/useUserManagement';
import { useOrgPreferences } from '@/hooks/api/useNotifications';
import {
  EMAIL_REGEX,
  ShareAddPeopleSearch,
  useShareStaging,
  type ShareStaging,
} from '@/components/ui/share-modal-staging';
import {
  PrincipalAvatar,
  PermissionSelect,
  BORDERLESS_PERMISSION_TRIGGER_CLASSES,
  roleTagLabel,
} from '@/components/ui/principal-search-shared';
import { cn } from '@/lib/utils';
import { ADMIN_ROLES, PERMISSIONS, useRbac, type Permission } from '@/lib/rbac';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { LEVEL_LABELS, RESOURCE_NOUNS } from '@/lib/access-labels';

// EMAIL_REGEX (share-modal-staging.tsx) validates the legacy Share-via-Email
// input below; the unified add-people staging flow lives in that module too.
const MAX_RECIPIENTS = 20;

// Mirrors ddpui/core/sharing/shareable_types.py's share_permission_slug per rtype.
const SHARE_PERMISSION_BY_RTYPE: Record<ShareableResourceType, Permission> = {
  dashboard: PERMISSIONS.CAN_SHARE_DASHBOARDS,
  report: PERMISSIONS.CAN_SHARE_REPORTS,
  alert: PERMISSIONS.CAN_SHARE_ALERTS,
  metric: PERMISSIONS.CAN_SHARE_METRICS,
  kpi: PERMISSIONS.CAN_SHARE_KPIS,
};

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
  /**
   * Drives the People-with-access section via /api/access/*. Omit to keep
   * the legacy public-link-only modal (reports, until they adopt sharing).
   */
  entityType?: ShareableResourceType;
  /**
   * The resource's own name/title (e.g. a dashboard's "Untitled Dashboard",
   * a report snapshot's title, an alert's name) — when given, the dialog
   * title becomes `Share "{resourceName}"` (design: "resource sharing New
   * users" frame) instead of the generic `Share {entityLabel}`. Omit when
   * the caller has no name in hand yet; the generic title is a safe fallback.
   */
  resourceName?: string;
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
  entityType,
  resourceName,
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

  // ---- /api/access/* — People with access ----
  const {
    data: access,
    isLoading: isAccessLoading,
    mutate: mutateAccess,
  } = useResourceAccess(entityType ?? null, entityType ? entityId : null);
  const { hasPermission } = useRbac();

  // Org-wide public-sharing kill switch (task-11 backend, task-11f frontend).
  // No-row / not-yet-loaded must NOT hide the toggle — mirrors the backend's
  // own no-row-means-True default (public_sharing_gate.py).
  const { orgPreferences } = useOrgPreferences();
  const allowPublicSharing = orgPreferences?.allow_public_sharing !== false;

  const canShare = Boolean(
    entityType &&
      access &&
      access.viewer.effective_permission === 'edit' &&
      hasPermission(SHARE_PERMISSION_BY_RTYPE[entityType])
  );

  // Staged add-people rows + the footer SHARE commit (Phase C). State lives
  // here (not in the People section) because the SHARE button sits in the
  // modal footer; closing the modal discards whatever was staged.
  const staging = useShareStaging({
    entityType: entityType ?? null,
    entityId,
    isOpen,
    onCommitted: mutateAccess,
  });

  // ---- /api/access/requests/ — pending requests decidable on THIS resource ----
  // `incoming` is already filtered server-side to requests the caller can
  // decide (owner/admin) — no extra client-side permission check needed,
  // just narrow it down to this specific resource. Lazy-fetched only while
  // the modal is open, same pattern as useUserGroups(canShare) below.
  const { incoming: incomingRequests, mutate: mutateAccessRequests } = useAccessRequests(
    isOpen && Boolean(entityType)
  );
  const pendingRequestsForEntity = useMemo(
    () =>
      entityType
        ? incomingRequests.filter(
            (r) => r.resource_type === entityType && r.resource_id === String(entityId)
          )
        : [],
    [incomingRequests, entityType, entityId]
  );
  const handleRequestDecided = useCallback(() => {
    mutateAccessRequests();
    mutateAccess(); // a decision may have inserted a new grant — refresh People-with-access
  }, [mutateAccessRequests, mutateAccess]);

  // Breadth analytics — fires once per open, only for the new sharing surface.
  useEffect(() => {
    if (isOpen && entityType) {
      trackEvent(ANALYTICS_EVENTS.SHARING_MODAL_OPENED, { entity_type: entityType });
    }
  }, [isOpen, entityType]);

  // Public-link section stays visible for the legacy (no entityType) callers;
  // for rtype-driven callers it's gated off capabilities.public_link AND the
  // org-wide allow_public_sharing switch (task-11f) — same hard-hide
  // treatment as the existing capability gate, for consistency.
  const showPublicLink =
    !entityType || (access?.capabilities?.public_link !== false && allowPublicSharing);
  // Legacy-only static card (no entityType). Per-resource General access has
  // no single-resource UI here at all — see the "General access" removal
  // note above the render tree below.
  const showOrgAccessCard = !entityType;
  const showPeopleSection = Boolean(entityType && access?.capabilities?.grants);

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
      {/* Viewport-bounded with internal scroll (repo pattern: CreateOrgDialog,
          schema-change-form) — the base DialogContent is centered with a
          translate and no max-height, so a tall People section would push
          BOTH the heading and the Close/SHARE footer off small screens with
          no way to scroll to them. */}
      <DialogContent
        data-testid="share-modal"
        // Widened to match the RBAC design frames (~850px dialog on a
        // 2000px canvas) — sm:max-w-md clipped the request rows' Approve
        // buttons and forced the request note to wrap onto ragged lines at
        // 1512px viewports. sm:max-w-3xl mirrors the existing "wide dialog"
        // convention already used by AlertWizardModal/SourceForm elsewhere
        // in the app.
        className="sm:max-w-3xl max-h-[85vh] overflow-y-auto"
        // P1 merged the owner row into PeopleWithAccessSection's list, which
        // sits AFTER the add-people search input in DOM order — Radix's
        // default open-autofocus would otherwise land on that search input
        // (the first focusable descendant) and pop its browse dropdown open
        // the instant the modal appears. Redirect the initial focus to the
        // dialog surface itself instead (the documented Radix pattern) —
        // keeps focus trapped inside the modal without landing in the
        // search box.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
      >
        {/* Full-bleed hairline under the title (every RBAC frame shows one,
            independent of what's directly below it — confirmed against
            "resource sharing New users"/"-new users", which have no card
            immediately underneath either). -mx-6/px-6 bleeds it past
            DialogContent's own p-6 padding to the modal's true edges. */}
        <DialogHeader className="-mx-6 border-b px-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            {resourceName ? `Share "${resourceName}"` : `Share ${entityLabel}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {entityType && pendingRequestsForEntity.length > 0 && (
            <PendingRequestsSection
              entityType={entityType}
              requests={pendingRequestsForEntity}
              onDecided={handleRequestDecided}
            />
          )}

          {/* Grantless rtypes (metric/kpi) get no People-with-access card, but
              the owner row + transfer flow must still render — merged into
              PeopleWithAccessSection's list for every other rtype (P1). */}
          {entityType && access && !showPeopleSection && (
            <OwnerSection
              entityType={entityType}
              entityId={entityId}
              access={access}
              onChanged={mutateAccess}
            />
          )}

          {showPeopleSection && entityType && access && (
            <PeopleWithAccessSection
              entityType={entityType}
              entityId={entityId}
              access={access}
              canShare={canShare}
              staging={staging}
              onChanged={mutateAccess}
            />
          )}

          {entityType && isAccessLoading && (
            <p className="text-xs text-muted-foreground" data-testid="share-access-loading">
              Loading access…
            </p>
          )}

          {/* Organization Access (Default) — legacy static card for the
              no-entityType (public-link-only) callers only; unrelated to
              per-resource General access, which this modal no longer
              surfaces at all (see the removal note above the render tree). */}
          {showOrgAccessCard && (
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
          )}

          {/* Public Sharing Toggle */}
          {showPublicLink && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Design frames 1426:2063/2115: link icon inside a plain
                          white circle with a thin border, same in on/off states */}
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white">
                        <Link className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <Label className="text-sm font-medium">Public sharing</Label>
                        <p className="text-xs text-muted-foreground">
                          Anyone with the link can view
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
                      {/* Design frame "public toggle on-1.jpg": repeats the card
                          title as a mini-header above the copy-link button. */}
                      <Label className="text-xs font-medium">Public sharing</Label>
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
                          Last accessed:{' '}
                          {new Date(shareStatus.last_public_accessed).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

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

          {/* Actions — SHARE applies every staged add-people row in one go
              (design frames 1426:2063/2115); disabled until something is
              staged. Full-bleed hairline above the footer, matching every
              RBAC frame (same -mx-6/px-6 bleed as the header divider). */}
          <div className="-mx-6 flex justify-end gap-3 border-t px-6 pt-4">
            <Button data-testid="share-close-btn" variant="outline" onClick={onClose}>
              CANCEL
            </Button>
            {canShare && showPeopleSection && (
              <Button
                data-testid="share-commit-btn"
                variant="primary"
                onClick={staging.commit}
                // hasPendingInput: typed-but-unstaged text keeps SHARE
                // clickable so commit() can flush it into the batch.
                disabled={
                  (staging.committableCount === 0 && !staging.hasPendingInput) ||
                  staging.isCommitting
                }
              >
                {staging.isCommitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                SHARE
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Owner + transfer ownership (Milestone 5, task-12f)
// ============================================================================
//
// OwnerTransferBlock is the shared row+transfer-flow content. It renders
// TWICE depending on rtype:
//  - grantless rtypes (metric/kpi, capabilities.grants === false): wrapped in
//    its own standalone OwnerSection Card below, since there's no
//    People-with-access card to live inside.
//  - every other rtype: as the FIRST row inside PeopleWithAccessSection's
//    list (P1 — design shows the owner as row 1 of one continuous list, not
//    a separate bordered card above it).

interface OwnerTransferBlockProps {
  entityType: ShareableResourceType;
  entityId: number;
  access: NonNullable<ReturnType<typeof useResourceAccess>['data']>;
  onChanged: () => void;
}

type TransferStep = 'idle' | 'picking' | 'confirming';

function OwnerTransferBlock({ entityType, entityId, access, onChanged }: OwnerTransferBlockProps) {
  const { users: orgUsers } = useUsers();
  const { hasRole } = useRbac();
  const [step, setStep] = useState<TransferStep>('idle');
  const [selectedNewOwnerId, setSelectedNewOwnerId] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  // Mirrors the backend's require_owner_access / can_delete_resource gate:
  // the literal owner, or an org admin — general-access/grant-derived
  // "edit" is NOT enough (see task-12 backend report).
  const canTransfer = access.viewer.is_owner || hasRole(ADMIN_ROLES);

  const candidateItems: ComboboxItem[] = useMemo(
    () =>
      (orgUsers || [])
        .filter(
          (u) => u.orguser_id !== access.owner?.orguser_id && typeof u.orguser_id === 'number'
        )
        .map((u) => ({ value: String(u.orguser_id), label: u.email })),
    [orgUsers, access.owner]
  );

  const selectedNewOwnerLabel = useMemo(
    () => candidateItems.find((item) => item.value === selectedNewOwnerId)?.label ?? '',
    [candidateItems, selectedNewOwnerId]
  );

  const handleStartTransfer = useCallback(() => {
    setSelectedNewOwnerId('');
    setStep('picking');
  }, []);

  const handleCancelTransfer = useCallback(() => {
    setSelectedNewOwnerId('');
    setStep('idle');
  }, []);

  const handleNext = useCallback(() => {
    if (!selectedNewOwnerId) return;
    setStep('confirming');
  }, [selectedNewOwnerId]);

  const handleConfirmTransfer = useCallback(async () => {
    if (!selectedNewOwnerId) return;
    setIsTransferring(true);
    try {
      await transferOwnership(entityType, entityId, Number(selectedNewOwnerId));
      onChanged();
      setStep('idle');
      setSelectedNewOwnerId('');
      toastSuccess.generic('Ownership transferred');
      // rtype only — no emails/ids (rules/analytics.md: no PII).
      trackEvent(ANALYTICS_EVENTS.SHARING_OWNERSHIP_TRANSFERRED, { entity_type: entityType });
    } catch (error) {
      toastError.api(error, 'transfer ownership');
    } finally {
      setIsTransferring(false);
    }
  }, [entityType, entityId, selectedNewOwnerId, onChanged]);

  if (!access.owner) return null;

  const ownerLabel = access.owner.name || access.owner.email;

  // Plain-language confirm copy (Phase A / A4, aligned toward design frame
  // 1184:6198 but kept truthful — the design's "you can reclaim ownership
  // anytime" is false: the old owner only keeps Edit). The backend
  // unconditionally keeps the CURRENT owner on an Edit grant, not the actor
  // — an admin transferring someone ELSE's resource keeps nothing
  // themselves, so only say "you" when the actor IS the current owner.
  const transferSentence = `Ownership of this ${RESOURCE_NOUNS[entityType]} transfers to ${selectedNewOwnerLabel}. They can then delete it or transfer it again.`;
  const confirmCopy = access.viewer.is_owner
    ? `${transferSentence} You keep Edit access.`
    : `${transferSentence} ${ownerLabel} keeps Edit access.`;

  return (
    <div data-testid="share-owner-block" className="space-y-3">
      <div data-testid="share-owner-row" className="flex items-center justify-between text-sm">
        <span>{ownerLabel}</span>
        <Badge variant="secondary">Owner</Badge>
      </div>

      {canTransfer && step === 'idle' && (
        <Button
          data-testid="share-transfer-owner-btn"
          variant="outline"
          size="sm"
          onClick={handleStartTransfer}
        >
          Transfer ownership
        </Button>
      )}

      {canTransfer && step === 'picking' && (
        <div className="space-y-2 pt-2 border-t">
          <Label className="text-xs font-medium">New owner</Label>
          <div className="flex gap-2">
            <Combobox
              id="share-transfer-owner-combobox"
              items={candidateItems}
              value={selectedNewOwnerId}
              onValueChange={setSelectedNewOwnerId}
              placeholder="Select an org member"
              searchPlaceholder="Search by email"
              className="flex-1"
            />
            <Button
              data-testid="share-transfer-owner-next-btn"
              onClick={handleNext}
              disabled={!selectedNewOwnerId}
            >
              Next
            </Button>
            <Button
              data-testid="share-transfer-owner-cancel-btn"
              variant="outline"
              onClick={handleCancelTransfer}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {canTransfer && step === 'confirming' && (
        <div
          data-testid="share-transfer-owner-confirm"
          className="space-y-3 p-3 bg-orange-50 border border-orange-200 rounded-md"
        >
          <p className="text-xs text-orange-800">{confirmCopy}</p>
          <div className="flex gap-2">
            <Button
              data-testid="share-transfer-owner-confirm-btn"
              size="sm"
              variant="primary"
              onClick={handleConfirmTransfer}
              disabled={isTransferring}
            >
              {isTransferring && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Transfer ownership
            </Button>
            <Button
              data-testid="share-transfer-owner-back-btn"
              size="sm"
              variant="outline"
              onClick={() => setStep('picking')}
              disabled={isTransferring}
            >
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface OwnerSectionProps {
  entityType: ShareableResourceType;
  entityId: number;
  access: NonNullable<ReturnType<typeof useResourceAccess>['data']>;
  onChanged: () => void;
}

/** Standalone fallback for grantless rtypes (metric/kpi) — there's no
 * People-with-access card for the owner row to merge into, so it keeps its
 * own bordered card here. */
function OwnerSection({ entityType, entityId, access, onChanged }: OwnerSectionProps) {
  if (!access.owner) return null;
  return (
    <Card data-testid="share-owner-section">
      <CardContent className="p-4">
        <OwnerTransferBlock
          entityType={entityType}
          entityId={entityId}
          access={access}
          onChanged={onChanged}
        />
      </CardContent>
    </Card>
  );
}

// ============================================================================
// People with access
// ============================================================================

interface PeopleWithAccessSectionProps {
  entityType: ShareableResourceType;
  entityId: number;
  access: NonNullable<ReturnType<typeof useResourceAccess>['data']>;
  canShare: boolean;
  staging: ShareStaging;
  onChanged: () => void;
}

// Sentinel SelectItem value for the "Transfer Ownership" menu item folded
// into a grantee row's own permission control (design: "Transfer
// ownership.jpg" — the dropdown reads "Can View ✓ / Can Edit / Transfer
// Ownership" for a non-owner row). Distinct from the 'view'/'edit'
// AccessLevel values so onValueChange can branch to the transfer flow
// instead of a permission PATCH.
const TRANSFER_OWNERSHIP_VALUE = '__transfer_ownership__';

function PeopleWithAccessSection({
  entityType,
  entityId,
  access,
  canShare,
  staging,
  onChanged,
}: PeopleWithAccessSectionProps) {
  const { users: orgUsers } = useUsers();
  const { hasRole } = useRbac();
  // Mirrors the backend's require_owner_access / can_delete_resource gate:
  // the literal owner, or an org admin — general-access/grant-derived "edit"
  // is NOT enough (see task-12 backend report).
  const canTransfer = access.viewer.is_owner || hasRole(ADMIN_ROLES);

  // Reconciliation note (design-alignment task, item 6): the only frame that
  // shows a transfer affordance ("Transfer ownership.jpg") puts it INSIDE a
  // non-owner row's own permission dropdown, not as a standalone button under
  // the owner (no frame shows that, and item 4 leaves the owner row no
  // control at all). So for rtypes with a People-with-access list, "Transfer
  // Ownership" is a menu item on each eligible grantee's Select, targeting
  // THAT person — see TRANSFER_OWNERSHIP_VALUE above. This trades away the
  // old combobox's "transfer to any org member" reach for an exact frame
  // match; transferring to someone not yet granted access now means sharing
  // with them first. Grantless rtypes (metric/kpi — no frame covers them)
  // keep the broader OwnerSection/OwnerTransferBlock combobox flow untouched.
  const [transferTarget, setTransferTarget] = useState<{ orguserId: number; label: string } | null>(
    null
  );
  const [isTransferring, setIsTransferring] = useState(false);

  // Role tags (item 4): joined client-side from the org-users list the modal
  // already fetches for the typeahead — the grants/owner payload only has an
  // email/principal_id, not the person's role. A group principal, or a user
  // that isn't resolvable in that list (e.g. a pending cross-org invite),
  // gets no tag rather than a guessed one.
  const roleTagFor = useCallback(
    (principalId: number | null, email: string | null) => {
      const match = (orgUsers || []).find(
        (u) =>
          (principalId !== null && u.orguser_id === principalId) ||
          (email !== null && u.email.toLowerCase() === email.toLowerCase())
      );
      return match ? roleTagLabel(match.new_role_slug) : undefined;
    },
    [orgUsers]
  );

  const handlePermissionChange = useCallback(
    async (grant: AccessGrant, permission: AccessLevel) => {
      // Pending rows have no principal_id yet — re-POST via the email path
      // instead; the backend's update_or_create keyed on pending_email
      // updates the pending row's permission in place.
      const principalRef =
        grant.principal_id !== null
          ? { principal_id: grant.principal_id }
          : grant.email
            ? { email: grant.email }
            : null;
      if (principalRef === null) return; // defensive — shouldn't occur on the wire
      try {
        await addGrant(entityType, entityId, {
          principal_type: grant.principal_type,
          ...principalRef,
          permission,
        });
        onChanged();
        toastSuccess.generic('Permission updated');
        trackEvent(ANALYTICS_EVENTS.SHARING_GRANT_ADDED, {
          entity_type: entityType,
          action: 'permission_updated',
        });
      } catch (error) {
        toastError.api(error, 'update this person’s permission');
      }
    },
    [entityType, entityId, onChanged]
  );

  const handleRemove = useCallback(
    async (grant: AccessGrant) => {
      try {
        await removeGrant(entityType, entityId, grant.id);
        onChanged();
        toastSuccess.generic('Access removed');
        trackEvent(ANALYTICS_EVENTS.SHARING_GRANT_REMOVED, { entity_type: entityType });
      } catch (error) {
        toastError.api(error, 'remove access');
      }
    },
    [entityType, entityId, onChanged]
  );

  const handleInitiateTransfer = useCallback((grant: AccessGrant) => {
    if (grant.principal_id === null) return; // defensive — gated by transferEligible below
    setTransferTarget({ orguserId: grant.principal_id, label: grant.name || grant.email || '' });
  }, []);

  const handleCancelTransfer = useCallback(() => setTransferTarget(null), []);

  const handleConfirmTransfer = useCallback(async () => {
    if (!transferTarget) return;
    setIsTransferring(true);
    try {
      await transferOwnership(entityType, entityId, transferTarget.orguserId);
      onChanged();
      setTransferTarget(null);
      toastSuccess.generic('Ownership transferred');
      // rtype only — no emails/ids (rules/analytics.md: no PII).
      trackEvent(ANALYTICS_EVENTS.SHARING_OWNERSHIP_TRANSFERRED, { entity_type: entityType });
    } catch (error) {
      toastError.api(error, 'transfer ownership');
    } finally {
      setIsTransferring(false);
    }
  }, [entityType, entityId, transferTarget, onChanged]);

  const ownerLabel = access.owner ? access.owner.name || access.owner.email : '';
  const ownerRoleTag = access.owner
    ? roleTagFor(access.owner.orguser_id, access.owner.email)
    : undefined;

  // Same plain-language confirm copy as the grantless-rtype combobox flow
  // (OwnerTransferBlock) — kept truthful about who keeps Edit access after
  // the transfer (the backend unconditionally keeps the CURRENT owner on an
  // Edit grant, not the actor).
  const transferConfirmCopy = transferTarget
    ? (() => {
        const sentence = `Ownership of this ${RESOURCE_NOUNS[entityType]} transfers to ${transferTarget.label}. They can then delete it or transfer it again.`;
        return access.viewer.is_owner
          ? `${sentence} You keep Edit access.`
          : `${sentence} ${ownerLabel} keeps Edit access.`;
      })()
    : '';

  return (
    // Flat content, not a bordered card — every RBAC frame shows the search
    // block and People-with-access as plain sections separated by
    // whitespace; only the Public-sharing block below gets its own rounded
    // bordered card.
    <div data-testid="share-people-section" className="space-y-4">
      {/* Unified add flow (Phase C): search people/groups or paste emails,
          entries stage as rows here, the footer SHARE button applies them.
          Only ADDING is staged — the rows below stay live-editing. */}
      {canShare && <ShareAddPeopleSearch access={access} staging={staging} />}

      <Label className="text-sm font-medium">People with access</Label>

      {/* Scrolls internally when the list gets long (design: "resource
            sharing- scrollable list of people with access" — a scrollbar
            beside the rows, not a taller modal). The Select/AlertDialog
            popovers portal out, so clipping here can't cut them off; the
            transfer confirm panel renders BELOW this container so it can
            never hide behind the scrollbar. */}
      <div className="max-h-56 space-y-2 overflow-y-auto">
        {/* Owner is row 1 of this same list (P1) — not a separate bordered
              card above it. Plain text "Owner", no pill/border, no control
              (design: "resource sharing- scrollable list of people with
              access" / "resource sharing- user added" frames). */}
        {access.owner && (
          <div
            data-testid="share-owner-row"
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <PrincipalAvatar />
              <span className="min-w-0 truncate">{ownerLabel}</span>
              {ownerRoleTag && (
                <Badge variant="secondary" className="flex-shrink-0">
                  {ownerRoleTag}
                </Badge>
              )}
            </span>
            <span className="flex-shrink-0 text-muted-foreground">Owner</span>
          </div>
        )}

        {access.grants.map((grant) => {
          const roleTag =
            grant.principal_type === 'user'
              ? roleTagFor(grant.principal_id, grant.email)
              : undefined;
          const transferEligible =
            canShare &&
            canTransfer &&
            grant.principal_type === 'user' &&
            grant.principal_id !== null &&
            grant.status === 'active';
          return (
            <div
              key={grant.id}
              data-testid={`share-grant-row-${grant.id}`}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <PrincipalAvatar kind={grant.principal_type === 'group' ? 'group' : 'user'} />
                <span className="min-w-0 truncate">
                  {grant.name || grant.email}
                  {grant.principal_type === 'group' && typeof grant.member_count === 'number' && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      · {grant.member_count} member{grant.member_count === 1 ? '' : 's'}
                    </span>
                  )}
                  {grant.status === 'pending' && (
                    <span className="ml-2 text-xs text-muted-foreground">(invite pending)</span>
                  )}
                </span>
                {roleTag && (
                  <Badge variant="secondary" className="flex-shrink-0">
                    {roleTag}
                  </Badge>
                )}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                {canShare && (grant.principal_id !== null || grant.email) ? (
                  <PermissionSelect
                    testId={`share-grant-permission-${grant.id}`}
                    ariaLabel={`Change permission for ${grant.name || grant.email}`}
                    value={grant.permission}
                    onValueChange={(value) => {
                      if (value === TRANSFER_OWNERSHIP_VALUE) {
                        handleInitiateTransfer(grant);
                      } else {
                        handlePermissionChange(grant, value as AccessLevel);
                      }
                    }}
                    extraItems={
                      transferEligible ? (
                        <>
                          <SelectSeparator />
                          <SelectItem value={TRANSFER_OWNERSHIP_VALUE}>
                            Transfer Ownership
                          </SelectItem>
                        </>
                      ) : undefined
                    }
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {LEVEL_LABELS[grant.permission]}
                  </span>
                )}
                {canShare && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        data-testid={`share-grant-remove-${grant.id}`}
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${grant.name || grant.email}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent data-testid={`share-grant-remove-dialog-${grant.id}`}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove access</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove access of &quot;
                          {grant.name || grant.email}&quot;? This change cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid={`share-grant-remove-cancel-${grant.id}`}>
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          data-testid={`share-grant-remove-confirm-${grant.id}`}
                          onClick={() => handleRemove(grant)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          );
        })}

        {access.grants.length === 0 && (
          <p className="text-xs text-muted-foreground">No one else has access yet.</p>
        )}
      </div>

      {transferTarget && (
        <TransferConfirmPanel
          copy={transferConfirmCopy}
          isTransferring={isTransferring}
          onConfirm={handleConfirmTransfer}
          onCancel={handleCancelTransfer}
        />
      )}
    </div>
  );
}

/** The amber confirm step for a per-row "Transfer Ownership" pick — rendered
 * BELOW the scrollable People list so it can never hide behind its scrollbar. */
function TransferConfirmPanel({
  copy,
  isTransferring,
  onConfirm,
  onCancel,
}: {
  copy: string;
  isTransferring: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      data-testid="share-transfer-owner-confirm"
      className="space-y-3 p-3 bg-orange-50 border border-orange-200 rounded-md"
    >
      <p className="text-xs text-orange-800">{copy}</p>
      <div className="flex gap-2">
        <Button
          data-testid="share-transfer-owner-confirm-btn"
          size="sm"
          variant="primary"
          onClick={onConfirm}
          disabled={isTransferring}
        >
          {isTransferring && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Transfer ownership
        </Button>
        <Button
          data-testid="share-transfer-owner-cancel-btn"
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={isTransferring}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Pending requests (Milestone 9 — request-access, in-modal decisions)
// ============================================================================

interface PendingRequestsSectionProps {
  entityType: ShareableResourceType;
  requests: AccessRequestItem[];
  onDecided: () => void;
}

function PendingRequestsSection({ entityType, requests, onDecided }: PendingRequestsSectionProps) {
  // Collapsible header (design frames "resource sharing- multiple request"
  // /"-1"): only shown once there are 2+ requests — a single request just
  // renders its row directly, nothing to collapse ("request on sharing.jpg").
  // Defaults to expanded so incoming requests are seen immediately.
  const [isExpanded, setIsExpanded] = useState(true);
  const showHeader = requests.length >= 2;
  const showRows = !showHeader || isExpanded;

  return (
    <div data-testid="share-requests-section" className="space-y-1">
      {showHeader && (
        <button
          type="button"
          data-testid="share-requests-count-header"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm hover:bg-muted"
        >
          <span>
            <strong>{requests.length}</strong> users are requesting access
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      )}
      {showRows && (
        <div>
          {requests.map((request) => (
            <PendingRequestRow
              key={request.id}
              entityType={entityType}
              request={request}
              onDecided={onDecided}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface PendingRequestRowProps {
  entityType: ShareableResourceType;
  request: AccessRequestItem;
  onDecided: () => void;
}

function PendingRequestRow({ entityType, request, onDecided }: PendingRequestRowProps) {
  // Approve may only ever downgrade (Edit ask -> View grant), never escalate
  // — the backend 400s an attempt to grant above what was requested. Cap the
  // options offered so that 400 is unreachable from this UI: a View request
  // only ever offers View.
  const permissionOptions: AccessLevel[] =
    request.requested_permission === 'edit' ? ['edit', 'view'] : ['view'];
  const [selectedPermission, setSelectedPermission] = useState<AccessLevel>(
    request.requested_permission
  );
  const [isDeciding, setIsDeciding] = useState(false);

  const handleApprove = useCallback(async () => {
    setIsDeciding(true);
    try {
      const isDowngrade = selectedPermission !== request.requested_permission;
      await approveAccessRequest(request.id, isDowngrade ? selectedPermission : undefined);
      onDecided();
      toastSuccess.generic('Access granted');
      trackEvent(ANALYTICS_EVENTS.SHARING_ACCESS_REQUEST_APPROVED, {
        entity_type: entityType,
        downgraded: isDowngrade,
      });
    } catch (error) {
      toastError.api(error, 'approve this request');
    } finally {
      setIsDeciding(false);
    }
  }, [entityType, request.id, request.requested_permission, selectedPermission, onDecided]);

  const handleDecline = useCallback(async () => {
    setIsDeciding(true);
    try {
      await declineAccessRequest(request.id);
      onDecided();
      toastSuccess.generic('Request declined');
      trackEvent(ANALYTICS_EVENTS.SHARING_ACCESS_REQUEST_DECLINED, { entity_type: entityType });
    } catch (error) {
      toastError.api(error, 'decline this request');
    } finally {
      setIsDeciding(false);
    }
  }, [entityType, request.id, onDecided]);

  const requesterLabel = request.requester.name || request.requester.email;

  return (
    <div
      data-testid={`share-request-row-${request.id}`}
      className="flex items-center justify-between gap-2 rounded-md px-1 py-2 text-sm"
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <PrincipalAvatar />
        {/* A single non-wrapping line (design: "request on sharing" /
            "resource sharing- multiple request" — email + bold permission
            together, never split across lines). The requester's name/email
            keeps min-w-0 + truncate as a defensive backstop for very long
            values; the note is the one genuinely variable-length piece, so
            it's the flex-basis-0 "expendable" child — it takes any leftover
            space when there's room and is the first to shrink toward an
            ellipsis (or nothing) when there isn't, instead of forcing the
            whole row onto ragged wrapped lines. */}
        <span className="flex min-w-0 flex-1 items-center gap-1">
          {/* Literal space text nodes ARE needed in addition to the flex
              `gap` above: toHaveTextContent asserts on the concatenated
              textContent ("wants to view"), which only contains a real
              space character if one is actually in the DOM — gap is a
              purely visual layout property and contributes nothing to
              textContent. Conversely, gap is needed for the visible space
              because flexbox drops whitespace-only text runs between flex
              items from layout (they don't generate a rendered box), so
              the literal spaces alone produce no visual gap. */}
          <span className="min-w-0 truncate">{requesterLabel}</span>{' '}
          <span className="flex-shrink-0 text-muted-foreground">wants to</span>{' '}
          {permissionOptions.length > 1 ? (
            // Inline lowercase "edit ⌄" control (embedded mid-sentence) — the
            // same borderless chrome as PermissionSelect, but with "view"/
            // "edit" item text instead of that component's standalone
            // "View"/"Edit", so it can't reuse the component itself.
            <Select
              value={selectedPermission}
              onValueChange={(value) => setSelectedPermission(value as AccessLevel)}
            >
              <SelectTrigger
                data-testid={`share-request-permission-${request.id}`}
                aria-label={`Permission to grant ${requesterLabel}`}
                disabled={isDeciding}
                className={cn(BORDERLESS_PERMISSION_TRIGGER_CLASSES, 'flex-shrink-0 font-semibold')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {permissionOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <strong className="flex-shrink-0 font-semibold">{selectedPermission}</strong>
          )}
          {request.note && (
            <>
              {' '}
              <span
                className="min-w-0 flex-1 truncate text-xs italic text-muted-foreground"
                title={request.note}
              >
                &ldquo;{request.note}&rdquo;
              </span>
            </>
          )}
        </span>
      </span>
      <span className="flex flex-shrink-0 items-center gap-3">
        <button
          type="button"
          data-testid={`share-request-decline-${request.id}`}
          onClick={handleDecline}
          disabled={isDeciding}
          className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          Deny
        </button>
        <Button
          data-testid={`share-request-approve-${request.id}`}
          size="sm"
          variant="primary"
          onClick={handleApprove}
          disabled={isDeciding}
        >
          Approve
        </Button>
      </span>
    </div>
  );
}
