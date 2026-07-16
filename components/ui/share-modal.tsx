'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  type ChartCoverageVerdict,
} from '@/hooks/api/useResourceAccess';
import { BroadeningConfirmDialog } from '@/components/sharing/broadening-confirm-dialog';
import type { CoverageDecision } from '@/components/sharing/coverage-confirm-utils';
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
  type ShareAddPeopleSearchHandle,
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
  chart: PERMISSIONS.CAN_SHARE_CHARTS,
};

interface ShareModalProps {
  entityId: number;
  entityLabel: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
  initialShareStatus?: Partial<ShareStatus>;
  getShareStatus: (id: number) => Promise<ShareStatus>;
  /** `proceed` is only sent on the broadening-confirm re-send; callers whose
   * endpoint has no such contract (reports) never receive it. */
  updateSharing: (
    id: number,
    data: { is_public: boolean; proceed?: boolean }
  ) => Promise<ShareStatus>;
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
  /** The resource's own name/title. When given, the dialog title becomes
   * `Share "{resourceName}"` instead of the generic `Share {entityLabel}`. */
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

  // Enabling the public link can come back requires_confirmation with
  // nothing flipped server-side — the Switch stays off until YES re-sends
  // with `proceed`; CANCEL just drops the prompt.
  const [publicConfirmVerdicts, setPublicConfirmVerdicts] = useState<ChartCoverageVerdict[] | null>(
    null
  );

  const entityLabelLower = entityLabel.toLowerCase();

  // ---- /api/access/* — People with access ----
  const {
    data: access,
    isLoading: isAccessLoading,
    mutate: mutateAccess,
  } = useResourceAccess(entityType ?? null, entityType ? entityId : null);
  const { hasPermission } = useRbac();

  // Org-wide public-sharing kill switch. No-row / not-yet-loaded must NOT
  // hide the toggle — mirrors the backend's no-row-means-True default.
  const { orgPreferences } = useOrgPreferences();
  const allowPublicSharing = orgPreferences?.allow_public_sharing !== false;

  const canShare = Boolean(
    entityType &&
      access &&
      access.viewer.effective_permission === 'edit' &&
      hasPermission(SHARE_PERMISSION_BY_RTYPE[entityType])
  );

  // Staging state lives here (not in the People section) because the SHARE
  // button sits in the modal footer; closing the modal discards it.
  const staging = useShareStaging({
    entityType: entityType ?? null,
    entityId,
    isOpen,
    onCommitted: mutateAccess,
  });

  // With the add-people dropdown open, a first Escape must close only the
  // dropdown — not the dialog, which would discard every staged row.
  const shareSearchRef = useRef<ShareAddPeopleSearchHandle>(null);

  // Pending requests decidable on this resource. `incoming` is already
  // filtered server-side to what the caller can decide; only narrow it to
  // this resource. Fetched only while the modal is open.
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

  // Public-link section stays visible for legacy (no entityType) callers;
  // otherwise gated off capabilities.public_link AND the org-wide switch.
  const showPublicLink =
    !entityType || (access?.capabilities?.public_link !== false && allowPublicSharing);
  // Legacy-only static card (no entityType); the new surface has no
  // per-resource General access UI.
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

  const performToggleSharing = useCallback(
    async (isPublic: boolean, proceed?: boolean) => {
      setIsLoading(true);

      try {
        const response = await updateSharing(entityId, {
          is_public: isPublic,
          ...(proceed ? { proceed: true } : {}),
        });

        // Held behind the broadening warning — nothing flipped server-side;
        // render the confirm instead of committing state.
        if (response.requires_confirmation) {
          setPublicConfirmVerdicts(response.under_covering_charts ?? []);
          return;
        }

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

  const handleToggleSharing = useCallback(
    (isPublic: boolean) => performToggleSharing(isPublic),
    [performToggleSharing]
  );

  // YES on the public-enable confirm. Public exposure is never extendable —
  // only `proceed` rides on the re-send.
  const handlePublicConfirm = useCallback(
    async (_decision: CoverageDecision) => {
      setPublicConfirmVerdicts(null);
      await performToggleSharing(true, true);
    },
    [performToggleSharing]
  );

  // CANCEL: the switch never moved — just drop the prompt.
  const handlePublicCancel = useCallback(() => setPublicConfirmVerdicts(null), []);

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
      {/* Viewport-bounded with internal scroll — the base DialogContent has
          no max-height, so a tall People section would push the heading and
          footer off small screens. */}
      <DialogContent
        data-testid="share-modal"
        // Wide dialog: sm:max-w-md clipped the request rows' Approve buttons.
        // sm:max-w-3xl matches AlertWizardModal/SourceForm.
        className="sm:max-w-3xl max-h-[85vh] overflow-y-auto"
        // Radix's default open-autofocus would land on the search input and
        // pop its dropdown open on mount — redirect initial focus to the
        // dialog surface instead (documented Radix pattern).
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
        // First Escape closes only the add-people dropdown (Radix captures
        // Escape at the document, so the interception must live here); the
        // next Escape dismisses the dialog as usual.
        onEscapeKeyDown={(e) => {
          if (shareSearchRef.current?.closeDropdownIfOpen()) e.preventDefault();
        }}
      >
        {/* Full-bleed hairline under the title; -mx-6/px-6 bleeds it past
            DialogContent's p-6 padding to the modal's true edges. */}
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

          {/* Grantless rtypes (metric/kpi) have no People-with-access card,
              but the owner row + transfer flow must still render. */}
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
              searchRef={shareSearchRef}
              onChanged={mutateAccess}
              resourceName={resourceName || entityLabel}
            />
          )}

          {entityType && isAccessLoading && (
            <p className="text-xs text-muted-foreground" data-testid="share-access-loading">
              Loading access…
            </p>
          )}

          {/* Organization Access — legacy static card for no-entityType
              callers only; unrelated to per-resource General access. */}
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
                      {/* Link icon in a bordered white circle, same in on/off states */}
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
                      {/* Repeats the card title as a mini-header above the copy-link button */}
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

          {/* SHARE applies every staged row in one go; disabled until
              something is staged. Hairline matches the header divider. */}
          <div className="-mx-6 flex justify-end gap-3 border-t px-6 pt-4">
            <Button data-testid="share-close-btn" variant="outline" onClick={onClose}>
              CANCEL
            </Button>
            {canShare && showPeopleSection && (
              <Button
                data-testid="share-commit-btn"
                variant="primary"
                onClick={staging.commit}
                // hasPendingInput keeps SHARE clickable while text sits
                // unstaged in the search box, so commit() can flush it.
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

        {/* Broadening confirms for held grants and the public-link enable.
            Nested Radix dialogs portal out, so rendering them here is safe. */}
        {staging.pendingBroadening && staging.broadeningVerdicts.length > 0 && (
          <BroadeningConfirmDialog
            open
            resourceName={resourceName || entityLabel}
            verdicts={staging.broadeningVerdicts}
            isSubmitting={staging.isCommitting}
            onCancel={staging.cancelBroadening}
            onConfirm={() => staging.confirmBroadening()}
          />
        )}
        {publicConfirmVerdicts && publicConfirmVerdicts.length > 0 && (
          <BroadeningConfirmDialog
            open
            resourceName={resourceName || entityLabel}
            verdicts={publicConfirmVerdicts}
            isSubmitting={isLoading}
            onCancel={handlePublicCancel}
            onConfirm={handlePublicConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Owner + transfer ownership
// ============================================================================
//
// OwnerTransferBlock renders in two places: inside its own OwnerSection card
// for grantless rtypes (metric/kpi), and as the first row of
// PeopleWithAccessSection's list for everything else.

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

  // Mirrors the backend's gate: the literal owner or an org admin —
  // grant-derived "edit" is not enough.
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
      // rtype only — no emails/IDs, avoids PII.
      trackEvent(ANALYTICS_EVENTS.SHARING_OWNERSHIP_TRANSFERRED, { entity_type: entityType });
    } catch (error) {
      toastError.api(error, 'transfer ownership');
    } finally {
      setIsTransferring(false);
    }
  }, [entityType, entityId, selectedNewOwnerId, onChanged]);

  if (!access.owner) return null;

  const ownerLabel = access.owner.name || access.owner.email;

  // The backend keeps the CURRENT owner on an Edit grant, not the actor —
  // an admin transferring someone else's resource keeps nothing themselves,
  // so only say "you" when the actor is the current owner.
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

/** Standalone owner card for grantless rtypes (metric/kpi) — there's no
 * People-with-access card for the owner row to merge into. */
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
  /** Forwarded to ShareAddPeopleSearch so the dialog's onEscapeKeyDown can
   * close the dropdown first. */
  searchRef: React.Ref<ShareAddPeopleSearchHandle>;
  onChanged: () => void;
  /** Names the container in the broadening-confirm copy. */
  resourceName: string;
}

// Sentinel value for the "Transfer Ownership" item inside a grantee row's
// permission Select — distinct from 'view'/'edit' so onValueChange can
// branch to the transfer flow instead of a permission PATCH.
const TRANSFER_OWNERSHIP_VALUE = '__transfer_ownership__';

function PeopleWithAccessSection({
  entityType,
  entityId,
  access,
  canShare,
  staging,
  searchRef,
  onChanged,
  resourceName,
}: PeopleWithAccessSectionProps) {
  const { users: orgUsers } = useUsers();
  const { hasRole } = useRbac();
  // Mirrors the backend's gate: the literal owner or an org admin —
  // grant-derived "edit" is not enough.
  const canTransfer = access.viewer.is_owner || hasRole(ADMIN_ROLES);

  // "Transfer Ownership" is a menu item on each eligible grantee's Select,
  // targeting that person — transferring to someone without access means
  // sharing with them first. Grantless rtypes keep the combobox flow.
  const [transferTarget, setTransferTarget] = useState<{ orguserId: number; label: string } | null>(
    null
  );
  const [isTransferring, setIsTransferring] = useState(false);

  // Role tags are joined client-side from the org-users list (the grants
  // payload has no role). An unresolvable principal gets no tag rather than
  // a guessed one.
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

  // A permission change can come back requires_confirmation (broadening);
  // held here, nothing written until YES re-sends with the confirm fields.
  const [permChangeConfirm, setPermChangeConfirm] = useState<{
    grant: AccessGrant;
    permission: AccessLevel;
    verdicts: ChartCoverageVerdict[];
  } | null>(null);

  const handlePermissionChange = useCallback(
    async (
      grant: AccessGrant,
      permission: AccessLevel,
      confirmFields?: { extend_chart_ids?: number[]; proceed?: boolean }
    ) => {
      // Pending rows have no principal_id — re-POST via the email path; the
      // backend updates the pending row's permission in place.
      const principalRef =
        grant.principal_id !== null
          ? { principal_id: grant.principal_id }
          : grant.email
            ? { email: grant.email }
            : null;
      if (principalRef === null) return; // defensive — shouldn't occur on the wire
      try {
        const result = await addGrant(entityType, entityId, {
          principal_type: grant.principal_type,
          ...principalRef,
          permission,
          ...(confirmFields ?? {}),
        });
        if (result.requires_confirmation) {
          setPermChangeConfirm({
            grant,
            permission,
            verdicts: result.under_covering_charts ?? [],
          });
          return;
        }
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

  const handlePermChangeConfirm = useCallback(
    (decision: CoverageDecision) => {
      if (!permChangeConfirm) return;
      const { grant, permission } = permChangeConfirm;
      setPermChangeConfirm(null);
      handlePermissionChange(grant, permission, {
        ...(decision.extendChartIds.length > 0
          ? { extend_chart_ids: decision.extendChartIds }
          : {}),
        proceed: true,
      });
    },
    [permChangeConfirm, handlePermissionChange]
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
      // rtype only — no emails/IDs, avoids PII.
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

  // Same confirm copy as OwnerTransferBlock — the backend keeps the CURRENT
  // owner on an Edit grant, not the actor.
  const transferConfirmCopy = transferTarget
    ? (() => {
        const sentence = `Ownership of this ${RESOURCE_NOUNS[entityType]} transfers to ${transferTarget.label}. They can then delete it or transfer it again.`;
        return access.viewer.is_owner
          ? `${sentence} You keep Edit access.`
          : `${sentence} ${ownerLabel} keeps Edit access.`;
      })()
    : '';

  return (
    // Flat content, not a bordered card — only the Public-sharing block
    // gets its own card.
    <div data-testid="share-people-section" className="space-y-4">
      {/* Search people/groups or paste emails; entries stage as rows and the
          footer SHARE applies them. Only adding is staged — the rows below
          stay live-editing. */}
      {canShare && <ShareAddPeopleSearch ref={searchRef} access={access} staging={staging} />}

      <Label className="text-sm font-medium">People with access</Label>

      {/* Scrolls internally when the list gets long. Select/AlertDialog
          popovers portal out, so clipping can't cut them off; the transfer
          confirm renders below this container so it can't hide behind the scrollbar. */}
      <div className="max-h-56 space-y-2 overflow-y-auto">
        {/* Owner is row 1 of this same list: plain text "Owner", no control. */}
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

      {/* Broadening confirm for a held permission change. */}
      {permChangeConfirm && permChangeConfirm.verdicts.length > 0 && (
        <BroadeningConfirmDialog
          open
          resourceName={resourceName}
          verdicts={permChangeConfirm.verdicts}
          onCancel={() => setPermChangeConfirm(null)}
          onConfirm={handlePermChangeConfirm}
        />
      )}
    </div>
  );
}

/** Amber confirm step for a per-row "Transfer Ownership" pick — rendered
 * below the scrollable People list so it can't hide behind the scrollbar. */
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
// Pending requests (in-modal decisions)
// ============================================================================

interface PendingRequestsSectionProps {
  entityType: ShareableResourceType;
  requests: AccessRequestItem[];
  onDecided: () => void;
}

function PendingRequestsSection({ entityType, requests, onDecided }: PendingRequestsSectionProps) {
  // Collapsible header only appears with 2+ requests; a single request
  // renders its row directly. Defaults to expanded.
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
  // Approve may only downgrade (Edit ask -> View grant), never escalate —
  // the backend 400s a grant above what was requested, so cap the options.
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
        {/* Single non-wrapping line. The note is the expendable flex child:
            it shrinks to an ellipsis first instead of wrapping the row. */}
        <span className="flex min-w-0 flex-1 items-center gap-1">
          {/* Keep the literal space text nodes: flex gap is visual-only and
              contributes nothing to textContent, which tests assert on. */}
          <span className="min-w-0 truncate">{requesterLabel}</span>{' '}
          <span className="flex-shrink-0 text-muted-foreground">wants to</span>{' '}
          {permissionOptions.length > 1 ? (
            // Inline mid-sentence select — same borderless chrome as
            // PermissionSelect but lowercase item text, so it can't reuse it.
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
