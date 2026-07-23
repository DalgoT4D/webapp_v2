'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { copyUrlToClipboard } from '@/lib/clipboard';
import {
  AlertTriangle,
  Copy,
  Loader2,
  Mail,
  Send,
  Share2,
  Shield,
  Trash2,
  User as UserIcon,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toastError, toastSuccess } from '@/lib/toast';
import {
  usePeople,
  useResourceGrantActions,
  useResourceGrants,
  useUserGroups,
} from '@/hooks/api/useAccess';
import { useRoles } from '@/hooks/api/useUserManagement';
import type { AccessLevel, PrincipalType, ShareRow } from '@/types/access';
import type { ShareStatus } from '@/types/reports';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 20;

interface StagedChip {
  key: string;
  label: string;
  kind: 'user' | 'group' | 'email';
  principal_type: PrincipalType | null; // null for pending emails
  principal_id: number | null;
  email: string | null;
  access_level: AccessLevel;
}

interface ShareModalProps {
  /** The resource type identifier (e.g. "dashboard"). When provided, enables
   * the chip typeahead + "People with access" section that hits the grants API.
   * Legacy callers (Reports) omit this and rely on the public/email sections. */
  rtype?: string;
  entityId: number;
  entityLabel: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
  /** Public-sharing bits — kept for existing dashboard/report callers. */
  initialShareStatus?: Partial<ShareStatus>;
  getShareStatus?: (id: number) => Promise<ShareStatus>;
  updateSharing?: (id: number, data: { is_public: boolean }) => Promise<ShareStatus>;
  /** Reports still use this legacy path. */
  onShareViaEmail?: (data: {
    recipient_emails: string[];
    message?: string;
  }) => Promise<{ recipients_count: number; message: string }>;
}

export function ShareModal({
  rtype,
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
  const entityLabelLower = entityLabel.toLowerCase();

  // Data sources
  const { people } = usePeople();
  const { groups } = useUserGroups();
  const { roles } = useRoles();
  const { shares, mutate: mutateGrants } = useResourceGrants(
    isOpen && rtype ? rtype : null,
    isOpen && rtype ? entityId : null
  );
  const { addGrants, updateGrant, removeGrant } = useResourceGrantActions(rtype ?? '', entityId);

  // Grants staging
  const [chipInput, setChipInput] = useState('');
  const [chips, setChips] = useState<StagedChip[]>([]);
  const [inviteRoleUuid, setInviteRoleUuid] = useState<string>('');
  const [chipError, setChipError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<number | null>(null);

  // Public-sharing state (kept for existing callers)
  const [isPublicLoading, setIsPublicLoading] = useState(false);
  const [shareStatus, setShareStatus] = useState<ShareStatus>({
    is_public: initialShareStatus?.is_public ?? false,
    public_access_count: initialShareStatus?.public_access_count ?? 0,
  });

  // Legacy email-share state (Reports)
  const [emailInput, setEmailInput] = useState('');
  const [recipientEmails, setRecipientEmails] = useState<string[]>([]);
  const [personalMessage, setPersonalMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const fetchShareStatus = useCallback(async () => {
    if (!getShareStatus) return;
    try {
      const status = await getShareStatus(entityId);
      setShareStatus(status);
    } catch (error) {
      toastError.load(error, 'sharing status');
    }
  }, [entityId, getShareStatus]);

  useEffect(() => {
    if (isOpen && entityId) fetchShareStatus();
  }, [isOpen, entityId, fetchShareStatus]);

  // Reset staging when modal closes
  useEffect(() => {
    if (!isOpen) {
      setChips([]);
      setChipInput('');
      setInviteRoleUuid('');
      setChipError(null);
      setRoleError(null);
      setRecipientEmails([]);
      setPersonalMessage('');
      setEmailInput('');
    }
  }, [isOpen]);

  // Existing shared principals (skip in suggestions)
  const currentPrincipals = useMemo(() => {
    const set = new Set<string>();
    (shares ?? []).forEach((s) => {
      if (s.principal_type === 'user' && s.principal_id != null) set.add(`user:${s.principal_id}`);
      if (s.principal_type === 'group' && s.principal_id != null)
        set.add(`group:${s.principal_id}`);
      if (s.email) set.add(`email:${s.email.toLowerCase()}`);
    });
    return set;
  }, [shares]);

  const chippedKeys = useMemo(() => new Set(chips.map((c) => c.key)), [chips]);

  const activeUserByEmail = useMemo(() => {
    const m = new Map<string, { orguser_id: number; role_name: string }>();
    people?.forEach((p) => {
      if (p.status === 'active' && p.orguser_id != null) {
        m.set(p.email.toLowerCase(), { orguser_id: p.orguser_id, role_name: p.role_name });
      }
    });
    return m;
  }, [people]);

  const suggestions = useMemo(() => {
    const q = chipInput.trim().toLowerCase();
    if (q === '') return []; // only show suggestions after the user starts typing
    const userMatches = (people ?? [])
      .filter(
        (p) =>
          p.status === 'active' &&
          p.orguser_id != null &&
          !chippedKeys.has(`user:${p.orguser_id}`) &&
          !currentPrincipals.has(`user:${p.orguser_id}`) &&
          p.email.toLowerCase().includes(q)
      )
      .slice(0, 6)
      .map((p) => ({
        kind: 'user' as const,
        id: p.orguser_id!,
        label: p.email,
        badge: p.role_name,
      }));
    const groupMatches = (groups ?? [])
      .filter(
        (g) =>
          !chippedKeys.has(`group:${g.id}`) &&
          !currentPrincipals.has(`group:${g.id}`) &&
          g.name.toLowerCase().includes(q)
      )
      .slice(0, 4)
      .map((g) => ({ kind: 'group' as const, id: g.id, label: g.name, badge: 'Group' }));
    return [...userMatches, ...groupMatches];
  }, [chipInput, people, groups, chippedKeys, currentPrincipals]);

  const hasPendingChips = chips.some((c) => c.kind === 'email');
  const memberOption = useMemo(() => roles?.find((r) => r.slug === 'member'), [roles]);

  const clearChipError = () => setChipError(null);

  const addUserChip = (orguserId: number, email: string) => {
    const key = `user:${orguserId}`;
    if (chippedKeys.has(key) || currentPrincipals.has(key)) return;
    setChips((prev) => [
      ...prev,
      {
        key,
        label: email,
        kind: 'user',
        principal_type: 'user',
        principal_id: orguserId,
        email: null,
        access_level: 'view',
      },
    ]);
    setChipInput('');
    clearChipError();
  };

  const addGroupChip = (groupId: number, name: string) => {
    const key = `group:${groupId}`;
    if (chippedKeys.has(key) || currentPrincipals.has(key)) return;
    setChips((prev) => [
      ...prev,
      {
        key,
        label: name,
        kind: 'group',
        principal_type: 'group',
        principal_id: groupId,
        email: null,
        access_level: 'view',
      },
    ]);
    setChipInput('');
    clearChipError();
  };

  const addEmailChip = (raw: string) => {
    const email = raw.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_REGEX.test(email)) {
      setChipError('Invalid email');
      return;
    }
    // Existing orguser? Convert to user chip.
    const active = activeUserByEmail.get(email);
    if (active) {
      addUserChip(active.orguser_id, email);
      return;
    }
    const key = `email:${email}`;
    if (chippedKeys.has(key) || currentPrincipals.has(key)) {
      setChipError('Already added');
      return;
    }
    setChips((prev) => [
      ...prev,
      {
        key,
        label: email,
        kind: 'email',
        principal_type: null,
        principal_id: null,
        email,
        access_level: 'view',
      },
    ]);
    setChipInput('');
    clearChipError();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEmailChip(chipInput);
    } else if (e.key === 'Backspace' && !chipInput && chips.length > 0) {
      setChips((prev) => prev.slice(0, -1));
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (/[,;\s]/.test(text)) {
      e.preventDefault();
      text.split(/[,;\s]+/).forEach((t) => addEmailChip(t));
    }
  };

  const removeChip = (key: string) => {
    setChips((prev) => prev.filter((c) => c.key !== key));
  };

  const setChipLevel = (key: string, level: AccessLevel) => {
    setChips((prev) => prev.map((c) => (c.key === key ? { ...c, access_level: level } : c)));
  };

  const handleShareClick = async () => {
    if (chipInput.trim()) addEmailChip(chipInput);
    if (chips.length === 0) return;

    if (hasPendingChips && !inviteRoleUuid) {
      setRoleError('Choose a role for new invites');
      return;
    }
    setRoleError(null);

    setIsSubmitting(true);
    try {
      await addGrants({
        principals: chips
          .filter((c) => c.principal_type != null && c.principal_id != null)
          .map((c) => ({
            principal_type: c.principal_type as PrincipalType,
            principal_id: c.principal_id as number,
            access_level: c.access_level,
          })),
        pending_grants: chips
          .filter((c) => c.kind === 'email')
          .map((c) => ({ email: c.email as string, access_level: c.access_level })),
        invite_role_uuid: hasPendingChips ? inviteRoleUuid : null,
      });
      setChips([]);
      setInviteRoleUuid('');
      mutateGrants();
      onUpdate?.();
      onClose();
    } catch {
      // handled in hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRowLevelChange = async (share: ShareRow, level: AccessLevel) => {
    if (share.access_level === level) return;
    setRowBusyId(share.share_id);
    try {
      await updateGrant(share.share_id, level);
      mutateGrants();
      onUpdate?.();
    } catch {
      // handled in hook
    } finally {
      setRowBusyId(null);
    }
  };

  const handleRowRemove = async (share: ShareRow) => {
    setRowBusyId(share.share_id);
    try {
      await removeGrant(share.share_id);
      mutateGrants();
      onUpdate?.();
    } catch {
      // handled in hook
    } finally {
      setRowBusyId(null);
    }
  };

  // -------- Public sharing (legacy pass-through) --------

  const handleTogglePublic = useCallback(
    async (nextPublic: boolean) => {
      if (!updateSharing) return;
      setIsPublicLoading(true);
      try {
        const response = await updateSharing(entityId, { is_public: nextPublic });
        setShareStatus((prev) => ({
          ...prev,
          is_public: response.is_public,
          public_url: response.public_url,
        }));
        if (nextPublic && response.public_url) {
          toastSuccess.generic(`${entityLabel} is now public`);
          await copyUrlToClipboard(response.public_url);
        } else {
          toastSuccess.generic(`${entityLabel} sharing disabled`);
        }
        onUpdate?.();
      } catch (error) {
        toastError.share(error);
      } finally {
        setIsPublicLoading(false);
      }
    },
    [entityId, entityLabel, updateSharing, onUpdate]
  );

  const handleCopyUrl = useCallback(async () => {
    if (shareStatus.public_url) await copyUrlToClipboard(shareStatus.public_url);
  }, [shareStatus.public_url]);

  // -------- Legacy email share (Reports) --------

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

  const handleRemoveRecipient = useCallback((email: string) => {
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
        `${entityLabel} is being sent to ${result.recipients_count} recipient${
          result.recipients_count > 1 ? 's' : ''
        }`
      );
      setRecipientEmails([]);
      setPersonalMessage('');
      fetchShareStatus();
    } catch {
      toastError.api('Failed to send emails');
    } finally {
      setIsSending(false);
    }
  }, [onShareViaEmail, recipientEmails, personalMessage, fetchShareStatus, entityLabel]);

  // -------- Render --------

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent data-testid="share-modal" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share &quot;{entityLabel}&quot;
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {rtype && (
            <>
              {/* Search input */}
              <div className="space-y-2">
                <Label htmlFor="share-input">Search for people, group or add emails</Label>
                <div className="relative">
                  <Input
                    id="share-input"
                    className={chipError ? 'border-red-500' : ''}
                    value={chipInput}
                    onChange={(e) => {
                      setChipInput(e.target.value);
                      setShowSuggestions(true);
                      clearChipError();
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder="Type or paste emails…"
                    data-testid="share-chip-input"
                  />

                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-md border bg-white shadow-md max-h-64 overflow-y-auto">
                      {suggestions.map((s) => (
                        <button
                          type="button"
                          key={`${s.kind}:${s.id}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (s.kind === 'user') addUserChip(s.id, s.label);
                            else addGroupChip(s.id, s.label);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50"
                        >
                          <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary">
                            {s.kind === 'user' ? (
                              <UserIcon className="h-4 w-4" />
                            ) : (
                              <UsersIcon className="h-4 w-4" />
                            )}
                          </span>
                          <span className="flex-1 text-sm text-gray-900">{s.label}</span>
                          <Badge variant="secondary" className="text-xs">
                            {s.badge}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {chipError && <p className="text-sm text-red-500">{chipError}</p>}
              </div>

              {/* Staged items (users/groups/pending emails to be shared with on Share) */}
              {chips.length > 0 && (
                <div className="border rounded-md">
                  {chips.map((chip, idx) => (
                    <div
                      key={chip.key}
                      className={`flex items-center gap-3 px-3 py-2 ${idx > 0 ? 'border-t' : ''}`}
                    >
                      <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary">
                        {chip.kind === 'group' ? (
                          <UsersIcon className="h-4 w-4" />
                        ) : chip.kind === 'email' ? (
                          <Mail className="h-4 w-4" />
                        ) : (
                          <UserIcon className="h-4 w-4" />
                        )}
                      </span>
                      <span className="flex-1 text-sm text-gray-900 truncate">{chip.label}</span>
                      <Select
                        value={chip.access_level}
                        onValueChange={(v) => setChipLevel(chip.key, v as AccessLevel)}
                      >
                        <SelectTrigger className="w-24 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="view">View</SelectItem>
                          <SelectItem value="edit">Edit</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 p-0"
                        onClick={() => removeChip(chip.key)}
                        aria-label={`Remove ${chip.label}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Warning + invite-role selector for pending chips */}
              {hasPendingChips && (
                <>
                  <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-3">
                    <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-orange-800">
                      <strong>
                        {chips.filter((c) => c.kind === 'email').length === 1
                          ? `${chips.find((c) => c.kind === 'email')?.email} isn't on Dalgo yet.`
                          : `${chips.filter((c) => c.kind === 'email').length} emails aren't on Dalgo yet.`}
                      </strong>
                      <div>Assign new invites a role before sharing the resource.</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-role">Invite new users as</Label>
                    <Select
                      value={inviteRoleUuid}
                      onValueChange={(v) => {
                        setInviteRoleUuid(v);
                        setRoleError(null);
                      }}
                    >
                      <SelectTrigger
                        id="invite-role"
                        className={roleError ? 'border-red-500' : ''}
                        data-testid="share-invite-role"
                      >
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles?.map((role) => (
                          <SelectItem key={role.uuid} value={role.uuid}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {roleError && <p className="text-sm text-red-500">{roleError}</p>}
                    {!inviteRoleUuid && memberOption && (
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => setInviteRoleUuid(memberOption.uuid)}
                      >
                        Use Member (default)
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* People with access */}
              <div className="space-y-2">
                <Label>People with access</Label>
                <div className="border rounded-md max-h-56 overflow-y-auto">
                  {(shares ?? []).length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      Only the owner has access right now.
                    </div>
                  ) : (
                    shares!.map((s, idx) => (
                      <div
                        key={s.share_id}
                        className={`flex items-center gap-3 px-3 py-2 ${idx > 0 ? 'border-t' : ''}`}
                      >
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary">
                          {s.principal_type === 'group' ? (
                            <UsersIcon className="h-4 w-4" />
                          ) : s.status === 'pending' ? (
                            <Mail className="h-4 w-4" />
                          ) : (
                            <UserIcon className="h-4 w-4" />
                          )}
                        </span>
                        <span className="flex-1 text-sm text-gray-900 truncate">{s.label}</span>
                        {s.role_or_group && (
                          <Badge variant="secondary" className="text-xs">
                            {s.role_or_group}
                          </Badge>
                        )}
                        {s.status === 'pending' && (
                          <Badge variant="secondary" className="text-xs">
                            Pending
                          </Badge>
                        )}
                        <Select
                          value={s.access_level}
                          onValueChange={(v) => handleRowLevelChange(s, v as AccessLevel)}
                          disabled={rowBusyId === s.share_id}
                        >
                          <SelectTrigger className="w-24 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="view">View</SelectItem>
                            <SelectItem value="edit">Edit</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 p-0"
                          onClick={() => handleRowRemove(s)}
                          disabled={rowBusyId === s.share_id}
                          aria-label={`Remove ${s.label}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* Public sharing (kept for existing callers) */}
          {updateSharing && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-green-600" />
                      <div>
                        <Label className="text-sm font-medium">Public sharing</Label>
                        <p className="text-xs text-muted-foreground">
                          Anyone with the link can view this {entityLabelLower}
                        </p>
                      </div>
                    </div>
                    <Switch
                      data-testid="share-toggle"
                      checked={shareStatus.is_public}
                      onCheckedChange={handleTogglePublic}
                      disabled={isPublicLoading}
                    />
                  </div>

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

                  {shareStatus.is_public && shareStatus.public_url && (
                    <Button
                      variant="outline"
                      onClick={handleCopyUrl}
                      className="w-full"
                      data-testid="copy-link-btn"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Public Link
                    </Button>
                  )}

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

          {/* Legacy email share (Reports) */}
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

                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="Enter email address"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={handleEmailKeyDown}
                      disabled={isSending}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddEmail}
                      disabled={isSending || !emailInput.trim()}
                    >
                      Add
                    </Button>
                  </div>

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
                            onClick={() => handleRemoveRecipient(email)}
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

                  <Textarea
                    placeholder="Add a personal message (optional)"
                    value={personalMessage}
                    onChange={(e) => setPersonalMessage(e.target.value)}
                    disabled={isSending}
                    rows={2}
                    className="resize-none text-sm"
                  />

                  <Button
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
                        : `Send to ${recipientEmails.length} recipient${
                            recipientEmails.length !== 1 ? 's' : ''
                          }`}
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} data-testid="share-close-btn">
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleShareClick}
              disabled={isSubmitting || chips.length === 0}
              data-testid="share-submit-btn"
            >
              {isSubmitting ? 'Sharing…' : 'Share'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
