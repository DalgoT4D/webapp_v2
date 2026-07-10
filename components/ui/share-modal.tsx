'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toastSuccess, toastError } from '@/lib/toast';
import { copyUrlToClipboard } from '@/lib/clipboard';
import {
  Share2,
  Copy,
  Shield,
  AlertTriangle,
  Mail,
  X,
  Loader2,
  Send,
  Users,
  UsersRound,
  UserPlus,
  Trash2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ShareStatus } from '@/types/reports';
import {
  useResourceAccess,
  addGrant,
  removeGrant,
  setGeneralAccess,
  type ShareableResourceType,
  type AccessGrant,
  type AccessAudience,
  type AccessLevel,
} from '@/hooks/api/useResourceAccess';
import { useUsers } from '@/hooks/api/useUserManagement';
import { useUserGroups } from '@/hooks/api/useUserGroups';
import { PERMISSIONS, useRbac, type Permission } from '@/lib/rbac';
import { useAuthStore } from '@/stores/authStore';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 20;

// Mirrors ddpui/core/sharing/shareable_types.py's share_permission_slug per rtype.
const SHARE_PERMISSION_BY_RTYPE: Record<ShareableResourceType, Permission> = {
  dashboard: PERMISSIONS.CAN_SHARE_DASHBOARDS,
  report: PERMISSIONS.CAN_SHARE_REPORTS,
  alert: PERMISSIONS.CAN_SHARE_ALERTS,
  metric: PERMISSIONS.CAN_SHARE_METRICS,
  kpi: PERMISSIONS.CAN_SHARE_KPIS,
};

const AUDIENCE_ORDER: AccessAudience[] = ['private', 'admins', 'analysts_plus', 'all_users'];

function audienceLabels(orgName: string): Record<AccessAudience, string> {
  return {
    private: 'Restricted (only people with access)',
    admins: 'Admins only',
    analysts_plus: 'Analysts and up',
    all_users: `Everyone in ${orgName || 'your organization'}`,
  };
}

const LEVEL_LABELS: Record<AccessLevel, string> = {
  view: 'Viewer',
  edit: 'Editor',
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
   * Drives the People-with-access / General-access sections via /api/access/*.
   * Omit to keep the legacy public-link-only modal (reports, until they adopt sharing).
   */
  entityType?: ShareableResourceType;
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

  // ---- /api/access/* — People with access + General access ----
  const {
    data: access,
    isLoading: isAccessLoading,
    mutate: mutateAccess,
  } = useResourceAccess(entityType ?? null, entityType ? entityId : null);
  const { hasPermission } = useRbac();
  const orgName = useAuthStore((state) => state.currentOrg?.name) || '';

  const canShare = Boolean(
    entityType &&
      access &&
      access.viewer.effective_permission === 'edit' &&
      hasPermission(SHARE_PERMISSION_BY_RTYPE[entityType])
  );

  // Breadth analytics — fires once per open, only for the new sharing surface.
  useEffect(() => {
    if (isOpen && entityType) {
      trackEvent(ANALYTICS_EVENTS.SHARING_MODAL_OPENED, { entity_type: entityType });
    }
  }, [isOpen, entityType]);

  // Public-link section stays visible for the legacy (no entityType) callers;
  // for rtype-driven callers it's gated strictly off capabilities.public_link.
  const showPublicLink = !entityType || access?.capabilities?.public_link !== false;
  const showOrgAccessCard = !entityType; // superseded by the real General-access section
  const showPeopleSection = Boolean(entityType && access?.capabilities?.grants);
  const showGeneralSection = Boolean(entityType && access?.capabilities?.general);

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
          {showPeopleSection && entityType && access && (
            <PeopleWithAccessSection
              entityType={entityType}
              entityId={entityId}
              access={access}
              canShare={canShare}
              onChanged={mutateAccess}
            />
          )}

          {showGeneralSection && entityType && access && (
            <GeneralAccessSection
              entityType={entityType}
              entityId={entityId}
              access={access}
              canShare={canShare}
              orgName={orgName}
              onChanged={mutateAccess}
            />
          )}

          {entityType && isAccessLoading && (
            <p className="text-xs text-muted-foreground" data-testid="share-access-loading">
              Loading access…
            </p>
          )}

          {/* Organization Access (Default) — legacy static card, superseded by
              General Access above once a resource adopts entityType-driven sharing */}
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

// ============================================================================
// People with access
// ============================================================================

interface PeopleWithAccessSectionProps {
  entityType: ShareableResourceType;
  entityId: number;
  access: NonNullable<ReturnType<typeof useResourceAccess>['data']>;
  canShare: boolean;
  onChanged: () => void;
}

function PeopleWithAccessSection({
  entityType,
  entityId,
  access,
  canShare,
  onChanged,
}: PeopleWithAccessSectionProps) {
  const { users: orgUsers } = useUsers();
  // Groups source for the add-principal picker (Part C). Group ids are
  // available from GET /api/groups/, so this stays enabled even while the
  // person-add path below is disabled by the T6 orguser_id gap. Only fetched
  // when this viewer can actually share — no /api/groups/ call for a
  // view-only viewer, who only ever sees the read-only grant rows.
  const { data: groups } = useUserGroups(canShare);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [pendingPermission, setPendingPermission] = useState<AccessLevel>('view');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupPendingPermission, setGroupPendingPermission] = useState<AccessLevel>('view');

  const grantedEmails = useMemo(
    () =>
      new Set([
        ...(access.owner ? [access.owner.email] : []),
        ...access.grants.map((g) => g.email),
      ]),
    [access.owner, access.grants]
  );

  const candidateItems: ComboboxItem[] = useMemo(
    () =>
      (orgUsers || [])
        .filter((u) => !grantedEmails.has(u.email))
        .map((u) => ({ value: u.email, label: u.email })),
    [orgUsers, grantedEmails]
  );

  const grantedGroupIds = useMemo(
    () =>
      new Set(access.grants.filter((g) => g.principal_type === 'group').map((g) => g.principal_id)),
    [access.grants]
  );

  const candidateGroupItems: ComboboxItem[] = useMemo(
    () =>
      (groups || [])
        .filter((g) => !grantedGroupIds.has(g.id))
        .map((g) => ({ value: String(g.id), label: g.name })),
    [groups, grantedGroupIds]
  );

  const handlePermissionChange = useCallback(
    async (grant: AccessGrant, permission: AccessLevel) => {
      if (grant.principal_id === null) return; // pending invite — not resolvable yet
      try {
        await addGrant(entityType, entityId, {
          principal_type: grant.principal_type,
          principal_id: grant.principal_id,
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

  const handleAddGroup = useCallback(async () => {
    if (!selectedGroupId) return;
    try {
      await addGrant(entityType, entityId, {
        principal_type: 'group',
        principal_id: Number(selectedGroupId),
        permission: groupPendingPermission,
      });
      onChanged();
      setSelectedGroupId('');
      toastSuccess.generic('Group added');
      trackEvent(ANALYTICS_EVENTS.SHARING_GRANT_ADDED, {
        entity_type: entityType,
        principal_type: 'group',
      });
    } catch (error) {
      toastError.api(error, 'add this group');
    }
  }, [entityType, entityId, selectedGroupId, groupPendingPermission, onChanged]);

  return (
    <Card data-testid="share-people-section">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-primary" />
          <Label className="text-sm font-medium">People with access</Label>
        </div>

        <div className="space-y-2">
          {access.owner && (
            <div
              data-testid="share-owner-row"
              className="flex items-center justify-between text-sm"
            >
              <span>{access.owner.name || access.owner.email}</span>
              <Badge variant="secondary">Owner</Badge>
            </div>
          )}

          {access.grants.map((grant) => (
            <div
              key={grant.id}
              data-testid={`share-grant-row-${grant.id}`}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="truncate inline-flex items-center gap-1.5">
                {grant.principal_type === 'group' && (
                  <UsersRound className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                )}
                <span>
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
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                {canShare && grant.principal_id !== null ? (
                  <Select
                    value={grant.permission}
                    onValueChange={(value) => handlePermissionChange(grant, value as AccessLevel)}
                  >
                    <SelectTrigger
                      data-testid={`share-grant-permission-${grant.id}`}
                      aria-label={`Change permission for ${grant.name || grant.email}`}
                      size="sm"
                      className="w-24"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">{LEVEL_LABELS.view}</SelectItem>
                      <SelectItem value="edit">{LEVEL_LABELS.edit}</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {LEVEL_LABELS[grant.permission]}
                  </span>
                )}
                {canShare && (
                  <Button
                    data-testid={`share-grant-remove-${grant.id}`}
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${grant.name || grant.email}`}
                    onClick={() => handleRemove(grant)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          {!access.owner && access.grants.length === 0 && (
            <p className="text-xs text-muted-foreground">No one else has access yet.</p>
          )}
        </div>

        {canShare && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              <Label className="text-xs font-medium">Add a person</Label>
            </div>
            <div className="flex gap-2">
              <Combobox
                id="share-add-person-combobox"
                items={candidateItems}
                value={selectedEmail}
                onValueChange={setSelectedEmail}
                placeholder="Select an org member"
                searchPlaceholder="Search by email"
                className="flex-1"
              />
              <Select
                value={pendingPermission}
                onValueChange={(value) => setPendingPermission(value as AccessLevel)}
              >
                <SelectTrigger
                  id="share-add-person-permission"
                  data-testid="share-add-person-permission"
                  size="sm"
                  className="w-24"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">{LEVEL_LABELS.view}</SelectItem>
                  <SelectItem value="edit">{LEVEL_LABELS.edit}</SelectItem>
                </SelectContent>
              </Select>
              <Button data-testid="share-add-person-btn" disabled title="Coming soon">
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground" data-testid="share-add-person-hint">
              Adding people isn’t available yet — this needs a small backend update. Removing or
              changing existing access works today.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <UsersRound className="h-4 w-4 text-muted-foreground" />
              <Label className="text-xs font-medium">Add a group</Label>
            </div>
            <div className="flex gap-2">
              <Combobox
                id="share-add-group-combobox"
                items={candidateGroupItems}
                value={selectedGroupId}
                onValueChange={setSelectedGroupId}
                placeholder="Select a group"
                searchPlaceholder="Search groups"
                className="flex-1"
              />
              <Select
                value={groupPendingPermission}
                onValueChange={(value) => setGroupPendingPermission(value as AccessLevel)}
              >
                <SelectTrigger
                  id="share-add-group-permission"
                  data-testid="share-add-group-permission"
                  size="sm"
                  className="w-24"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">{LEVEL_LABELS.view}</SelectItem>
                  <SelectItem value="edit">{LEVEL_LABELS.edit}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                data-testid="share-add-group-btn"
                onClick={handleAddGroup}
                disabled={!selectedGroupId}
              >
                Add
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// General access
// ============================================================================

interface GeneralAccessSectionProps {
  entityType: ShareableResourceType;
  entityId: number;
  access: NonNullable<ReturnType<typeof useResourceAccess>['data']>;
  canShare: boolean;
  orgName: string;
  onChanged: () => void;
}

function GeneralAccessSection({
  entityType,
  entityId,
  access,
  canShare,
  orgName,
  onChanged,
}: GeneralAccessSectionProps) {
  const currentAudience = access.general_access?.audience ?? 'private';
  const currentLevel = access.general_access?.level ?? 'view';
  const labels = audienceLabels(orgName);

  const [confirmState, setConfirmState] = useState<{
    audience: AccessAudience;
    level: AccessLevel;
    persistingGrants: AccessGrant[];
  } | null>(null);

  const applyChange = useCallback(
    async (audience: AccessAudience, level: AccessLevel, removeGrantIds?: number[]) => {
      try {
        const result = await setGeneralAccess(entityType, entityId, {
          audience,
          level,
          ...(removeGrantIds !== undefined ? { remove_grant_ids: removeGrantIds } : {}),
        });

        if (result.requires_confirmation) {
          setConfirmState({ audience, level, persistingGrants: result.persisting_grants });
          return;
        }

        setConfirmState(null);
        onChanged();
        toastSuccess.generic('General access updated');
        trackEvent(ANALYTICS_EVENTS.SHARING_GENERAL_ACCESS_UPDATED, {
          entity_type: entityType,
          audience,
          level,
        });
      } catch (error) {
        toastError.api(error, 'update general access');
      }
    },
    [entityType, entityId, onChanged]
  );

  const handleAudienceChange = (value: string) =>
    applyChange(value as AccessAudience, currentLevel);
  const handleLevelChange = (value: string) => applyChange(currentAudience, value as AccessLevel);

  const handleKeepAccess = () => {
    if (!confirmState) return;
    applyChange(confirmState.audience, confirmState.level, []);
  };

  const handleRemoveAccessToo = () => {
    if (!confirmState) return;
    applyChange(
      confirmState.audience,
      confirmState.level,
      confirmState.persistingGrants.map((g) => g.id)
    );
  };

  return (
    <Card data-testid="share-general-section">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-blue-600" />
          <Label className="text-sm font-medium">General access</Label>
        </div>

        {canShare ? (
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="share-general-audience" className="text-xs">
                Who has access
              </Label>
              <Select value={currentAudience} onValueChange={handleAudienceChange}>
                <SelectTrigger
                  id="share-general-audience"
                  data-testid="share-general-audience"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCE_ORDER.map((audience) => (
                    <SelectItem key={audience} value={audience}>
                      {labels[audience]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-28 space-y-1">
              <Label htmlFor="share-general-level" className="text-xs">
                Permission
              </Label>
              <Select value={currentLevel} onValueChange={handleLevelChange}>
                <SelectTrigger
                  id="share-general-level"
                  data-testid="share-general-level"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">{LEVEL_LABELS.view}</SelectItem>
                  <SelectItem value="edit">{LEVEL_LABELS.edit}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <p className="text-sm" data-testid="share-general-readonly">
            {labels[currentAudience]} · {LEVEL_LABELS[currentLevel]}
          </p>
        )}

        {confirmState && (
          <div
            data-testid="share-general-confirm-panel"
            className="space-y-3 p-3 bg-orange-50 border border-orange-200 rounded-md"
          >
            <p className="text-xs text-orange-800">
              {confirmState.persistingGrants.length} people still have individual access to this{' '}
              {entityType}. Keep their access, or remove it along with this change?
            </p>
            <ul className="text-xs text-orange-800 list-disc list-inside">
              {confirmState.persistingGrants.map((g) => (
                <li key={g.id}>{g.name || g.email}</li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button
                data-testid="share-general-confirm-keep-btn"
                size="sm"
                variant="outline"
                onClick={handleKeepAccess}
              >
                Keep their access
              </Button>
              <Button
                data-testid="share-general-confirm-remove-btn"
                size="sm"
                variant="outline"
                onClick={handleRemoveAccessToo}
              >
                Remove their access too
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
