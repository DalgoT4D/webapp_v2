'use client';

import React, { useState, useEffect, useCallback, useId, useMemo } from 'react';
import { toastSuccess, toastError } from '@/lib/toast';
import { copyUrlToClipboard } from '@/lib/clipboard';
import {
  AlertTriangle,
  Copy,
  Loader2,
  Mail,
  Send,
  Shield,
  User as UserIcon,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { PrincipalTypeahead } from '@/components/ui/principal-typeahead';
import { buildDocsUrl } from '@/components/ui/docs-link';
import { StagedPrincipalRow } from '@/components/ui/staged-principal-row';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  respondToAccessRequest,
  transferOwnership,
  updateGeneralAccess,
  useAccessRequests,
  useActiveMembers,
  useResourceGrantActions,
  useResourceGrants,
  useUserGroups,
  type GeneralAccessMode,
} from '@/hooks/api/useAccess';
import { useRoles } from '@/hooks/api/useUserManagement';
import type { AccessLevel, PrincipalType, ShareRow } from '@/types/access';
import { useAuthStore } from '@/stores/authStore';
import { ADMIN_ROLES, ROLES } from '@/lib/rbac';

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
   * the chip typeahead + "People with access" + "General access" sections. */
  rtype?: string;
  entityId: number;
  entityLabel: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
  /** Called only when the public link actually reached the user's clipboard.
   * This component lives in components/ui/ and stays analytics-free, so callers
   * hang the "shared" event (and the onboarding walkthrough's final step) here. */
  onCopyLink?: () => void;
  /** Called after General access successfully flips to Public. Same reason as
   * onCopyLink: onboarding milestones belong to the caller, not to this component. */
  onMadePublic?: () => void;
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
  onCopyLink,
  onMadePublic,
  onShareViaEmail,
}: ShareModalProps) {
  const entityLabelLower = entityLabel.toLowerCase();

  // Data sources — only fetch when modal is open to avoid firing these APIs
  // on every page mount where a ShareModal is present.
  const { people } = useActiveMembers(isOpen);
  const { groups } = useUserGroups(isOpen);
  const { roles } = useRoles(isOpen);
  const getCurrentOrgUser = useAuthStore((state) => state.getCurrentOrgUser);
  const currentOrgUser = getCurrentOrgUser();
  const isAdmin = currentOrgUser
    ? ADMIN_ROLES.includes(currentOrgUser.new_role_slug as (typeof ADMIN_ROLES)[number])
    : false;

  const {
    shares,
    callerIsOwner,
    generalAccess,
    owner,
    mutate: mutateGrants,
  } = useResourceGrants(isOpen && rtype ? rtype : null, isOpen && rtype ? entityId : null);
  const isOwnerOrAdmin = callerIsOwner || isAdmin;

  const { requests, mutate: mutateRequests } = useAccessRequests(
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<number | null>(null);

  // General access
  const [modeChanging, setModeChanging] = useState(false);

  // Cascade confirmation state (dashboard grants only)
  const [pendingAction, setPendingAction] = useState<
    | { kind: 'level'; share: ShareRow; level: AccessLevel }
    | { kind: 'remove'; share: ShareRow }
    | null
  >(null);

  // Ownership transfer state
  const [transferTarget, setTransferTarget] = useState<ShareRow | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  // Admin takeover state — admin removes the current owner and becomes the
  // new owner. Uses the same transferOwnership endpoint.
  const [takeoverConfirmOpen, setTakeoverConfirmOpen] = useState(false);
  const [isTakingOver, setIsTakingOver] = useState(false);
  const canAdminTakeover = isAdmin && !callerIsOwner && !!owner;

  // Legacy email-share state (Reports)
  const [emailInput, setEmailInput] = useState('');
  const [recipientEmails, setRecipientEmails] = useState<string[]>([]);
  const [personalMessage, setPersonalMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const publicAccessId = useId();

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

  // Default the invite role to Member as soon as the roles list loads.
  // The user can still change it via the role select.
  const memberRoleUuid = useMemo(() => roles?.find((r) => r.slug === 'member')?.uuid, [roles]);
  useEffect(() => {
    if (isOpen && memberRoleUuid && !inviteRoleUuid) {
      setInviteRoleUuid(memberRoleUuid);
    }
  }, [isOpen, memberRoleUuid, inviteRoleUuid]);

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

  // Render "People with access" bucketed: owner (rendered separately above),
  // then groups, then direct user shares, then pending-email invites. Preserves
  // original order within each bucket (stable sort).
  const sortedShares = useMemo(() => {
    const rank = (s: ShareRow): number => {
      if (s.status === 'pending') return 2;
      if (s.principal_type === 'group') return 0;
      return 1;
    };
    return [...(shares ?? [])].sort((a, b) => rank(a) - rank(b));
  }, [shares]);

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
    // Empty query → show all eligible options (users + groups). Typing narrows
    // via the includes(q) filter below.
    const userMatches = (people ?? [])
      .filter(
        (p) =>
          p.status === 'active' &&
          p.orguser_id != null &&
          !chippedKeys.has(`user:${p.orguser_id}`) &&
          p.email.toLowerCase().includes(q)
      )
      .slice(0, 6)
      .map((p) => ({
        kind: 'user' as const,
        id: p.orguser_id!,
        label: p.email,
        badge: p.role_name,
        isOwner: owner != null && p.orguser_id === owner.orguser_id,
        alreadyShared: currentPrincipals.has(`user:${p.orguser_id}`),
      }));
    const groupMatches = (groups ?? [])
      .filter((g) => !chippedKeys.has(`group:${g.id}`) && g.name.toLowerCase().includes(q))
      .slice(0, 4)
      .map((g) => ({
        kind: 'group' as const,
        id: g.id,
        label: g.name,
        badge: 'Group',
        isOwner: false,
        alreadyShared: currentPrincipals.has(`group:${g.id}`),
      }));
    return [...userMatches, ...groupMatches];
  }, [chipInput, people, groups, chippedKeys, currentPrincipals, owner]);

  const hasPendingChips = chips.some((c) => c.kind === 'email');

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

  const doRowLevelChange = async (share: ShareRow, level: AccessLevel) => {
    if (share.access_level === level) return;
    setRowBusyId(share.share_id);
    try {
      await updateGrant(share.share_id, level);
      toastSuccess.generic(`Access updated to ${level}`);
      mutateGrants();
      onUpdate?.();
    } catch {
      // handled in hook
    } finally {
      setRowBusyId(null);
    }
  };

  const doRowRemove = async (share: ShareRow) => {
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

  const LEVEL_RANK: Record<string, number> = { no_access: 0, view: 1, edit: 2 };

  const cascadeBlockMessage = (share: ShareRow) => {
    const titles =
      share.cascade_sources?.map((cs) => cs.dashboard_title).join(', ') || 'a dashboard';
    return `Access on this resource is inherited from: ${titles} — change permissions from there`;
  };

  const handleRowLevelChange = async (share: ShareRow, level: AccessLevel) => {
    if (share.access_level === level) return;
    if (rtype === 'dashboard') {
      setPendingAction({ kind: 'level', share, level });
      return;
    }
    // Cascade-only row: upgrade (direct override) is allowed, downgrade is not.
    if (share.share_id === null) {
      if (LEVEL_RANK[level] <= LEVEL_RANK[share.access_level]) {
        toastError.api(
          `Inherited access already grants ${share.access_level}. Cannot assign a lower or equal level directly.`
        );
        return;
      }
      // Create a direct share at the higher level alongside the cascade row.
      // Invitation rows (pending) have no principal_id to upgrade.
      if (
        (share.principal_type === 'user' || share.principal_type === 'group') &&
        share.principal_id != null
      ) {
        setRowBusyId(share.principal_id);
        try {
          const res = await addGrants({
            principals: [
              {
                principal_type: share.principal_type,
                principal_id: share.principal_id,
                access_level: level,
              },
            ],
          });
          await mutateGrants({
            shares: res.shares,
            caller_is_owner: callerIsOwner,
            general_access: generalAccess!,
            owner,
          });
        } finally {
          setRowBusyId(null);
        }
      }
      return;
    }
    doRowLevelChange(share, level);
  };

  const handleRowRemove = (share: ShareRow) => {
    if (rtype === 'dashboard') {
      setPendingAction({ kind: 'remove', share });
      return;
    }
    if (share.share_id === null) {
      toastError.api(cascadeBlockMessage(share));
      return;
    }
    doRowRemove(share);
  };

  const handleCascadeConfirm = async () => {
    if (!pendingAction) return;
    if (pendingAction.kind === 'level') {
      await doRowLevelChange(pendingAction.share, pendingAction.level);
    } else {
      await doRowRemove(pendingAction.share);
    }
    setPendingAction(null);
  };

  // -------- Ownership transfer --------

  const handleAdminTakeoverConfirm = async () => {
    const myOrguserId = currentOrgUser?.email
      ? activeUserByEmail.get(currentOrgUser.email.toLowerCase())?.orguser_id
      : null;
    if (!rtype || !myOrguserId) return;
    setIsTakingOver(true);
    try {
      await transferOwnership(rtype, entityId, myOrguserId, true);
      mutateGrants();
      onUpdate?.();
      setTakeoverConfirmOpen(false);
    } catch {
      // handled in hook
    } finally {
      setIsTakingOver(false);
    }
  };

  const handleTransferConfirm = async () => {
    if (!transferTarget || !rtype || transferTarget.principal_id == null) return;
    setIsTransferring(true);
    try {
      await transferOwnership(rtype, entityId, transferTarget.principal_id);
      mutateGrants();
      onUpdate?.();
      setTransferTarget(null);
    } catch {
      // handled in hook
    } finally {
      setIsTransferring(false);
    }
  };

  // -------- General access (Everyone / Private / Public) --------

  const handleModeChange = async (next: GeneralAccessMode) => {
    if (!rtype || !generalAccess || next === generalAccess.mode) return;
    if (next === 'public' && !generalAccess.allow_public_sharing) return;
    setModeChanging(true);
    try {
      const res = await updateGeneralAccess(rtype, entityId, next);
      if (next === 'public' && res.public_url) {
        toastSuccess.generic(`${entityLabel} is now public`);
        await copyUrlToClipboard(res.public_url);
        // Deliberately NOT onCopyLink, even though the link did reach the clipboard: callers
        // treat that as the share act itself and end the onboarding walkthrough on it, which
        // here would skip the "copy the link" step the user hasn't reached yet. Only the
        // explicit COPY PUBLIC LINK button counts.
        onMadePublic?.();
      } else if (next === 'internal') {
        toastSuccess.generic(`${entityLabel} is now visible to everyone in your org`);
      } else if (next === 'private') {
        toastSuccess.generic(`${entityLabel} is now private`);
      }
      mutateGrants();
      onUpdate?.();
    } catch {
      // handled in hook
    } finally {
      setModeChanging(false);
    }
  };

  const handleCopyPublicUrl = useCallback(async () => {
    if (!generalAccess?.public_url) return;
    // See handleModeChange: only a successful clipboard write counts as a share.
    if (await copyUrlToClipboard(generalAccess.public_url)) onCopyLink?.();
  }, [generalAccess?.public_url, onCopyLink]);

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
    } catch {
      toastError.api('Failed to send emails');
    } finally {
      setIsSending(false);
    }
  }, [onShareViaEmail, recipientEmails, personalMessage, entityLabel]);

  // -------- Render --------

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        data-testid="share-modal"
        className="sm:max-w-xl max-h-[90vh] flex flex-col p-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Share &quot;{entityLabel}&quot;</DialogTitle>
          {rtype === 'dashboard' && (
            <p className="text-sm text-muted-foreground mt-0.5">
              All inner charts and KPIs will inherit this permission.
            </p>
          )}
        </DialogHeader>

        <div className="space-y-5 flex-1 overflow-y-auto min-h-0 px-6 pb-4">
          {/* Access Requests — surfaced at the top of the modal so an
              owner/Edit-holder sees pending requests as soon as they open it. */}
          {rtype && (requests ?? []).length > 0 && (
            <div className="border border-input rounded-md divide-y bg-background">
              {requests!.map((req) => (
                <div
                  key={req.id}
                  className="px-3 py-2 flex items-center gap-3"
                  data-testid={`access-request-row-${req.id}`}
                >
                  <span className="inline-flex items-center justify-center h-8 w-8 shrink-0 rounded-full bg-muted text-muted-foreground">
                    <UserIcon className="h-4 w-4" />
                  </span>
                  <p className="text-sm text-foreground flex-1 min-w-0 truncate">
                    <span className="font-medium">{req.requester_email}</span> wants to{' '}
                    <span className="font-semibold">{req.requested_level}</span>
                    {req.note ? <span className="text-muted-foreground"> — {req.note}</span> : null}
                  </p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      data-testid={`access-request-deny-${req.id}`}
                      onClick={async () => {
                        await respondToAccessRequest(rtype, entityId, req.id, 'declined');
                        mutateRequests();
                      }}
                    >
                      Deny
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      className="h-7 text-xs"
                      data-testid={`access-request-approve-${req.id}`}
                      onClick={async () => {
                        await respondToAccessRequest(
                          rtype,
                          entityId,
                          req.id,
                          'approved',
                          req.requested_level
                        );
                        mutateRequests();
                        mutateGrants();
                      }}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {rtype && (
            <>
              {/* Search input */}
              <div className="space-y-2">
                <Label htmlFor="share-input">Search for people, group or add emails</Label>
                <PrincipalTypeahead
                  inputId="share-input"
                  inputTestId="share-chip-input"
                  placeholder="Type or paste emails…"
                  value={chipInput}
                  onChange={(v) => {
                    setChipInput(v);
                    clearChipError();
                  }}
                  suggestions={suggestions.map((s) => ({
                    kind: s.kind,
                    id: s.id,
                    label: s.label,
                    badge: s.isOwner ? 'Owner' : s.badge,
                    disabled: s.isOwner || s.alreadyShared,
                    disabledReason: s.isOwner
                      ? 'Already the owner — has full access'
                      : s.alreadyShared
                        ? 'Already has access'
                        : undefined,
                  }))}
                  onSelectUser={addUserChip}
                  onSelectGroup={addGroupChip}
                  onCommitEmail={addEmailChip}
                  onBackspace={() => {
                    if (chips.length > 0) setChips((prev) => prev.slice(0, -1));
                  }}
                  onPasteEmails={(parts) => parts.forEach((p) => addEmailChip(p))}
                  error={chipError}
                />
              </div>

              {/* Staged items (users/groups/pending emails to be shared with on Share).
                  Capped + scrollable so a long paste doesn't push the rest of the modal
                  (People with access, General access, Share button) out of view. */}
              {chips.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {chips.map((chip) => {
                    const roleName =
                      chip.kind === 'user'
                        ? activeUserByEmail.get(chip.label.toLowerCase())?.role_name
                        : null;
                    return (
                      <StagedPrincipalRow
                        key={chip.key}
                        kind={chip.kind}
                        label={chip.label}
                        badge={roleName ?? null}
                        actions={
                          <>
                            <Select
                              value={chip.access_level}
                              onValueChange={(v) => setChipLevel(chip.key, v as AccessLevel)}
                            >
                              <SelectTrigger className="h-8 w-auto gap-1 border-0 bg-transparent px-2 text-sm text-gray-700 shadow-none hover:bg-gray-100 focus:ring-0 focus-visible:ring-0">
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
                              className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700"
                              onClick={() => removeChip(chip.key)}
                              aria-label={`Remove ${chip.label}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        }
                      />
                    );
                  })}
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
                      {isAdmin ? (
                        <div>Choose a role for new invites before sharing.</div>
                      ) : (
                        <div>
                          They will be invited as <strong>Member</strong>.
                        </div>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
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
                          {(roles ?? []).map((role) => (
                            <SelectItem key={role.uuid} value={role.uuid}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {roleError && <p className="text-sm text-red-500">{roleError}</p>}
                    </div>
                  )}
                </>
              )}

              {/* People with access */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-900">People with access</Label>
                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  {owner && (
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary">
                        <UserIcon className="h-4 w-4" />
                      </span>
                      <span className="text-sm text-gray-900 truncate">{owner.email}</span>
                      {owner.role_name && (
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {owner.role_name}
                        </span>
                      )}
                      <div className="ml-auto flex items-center gap-1">
                        <span className="text-sm text-gray-500">Owner</span>
                        {canAdminTakeover && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700"
                            onClick={() => setTakeoverConfirmOpen(true)}
                            aria-label={`Take ownership from ${owner.email}`}
                            data-testid="admin-takeover-btn"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  {(shares ?? []).length === 0 && !owner && (
                    <div className="text-sm text-muted-foreground">
                      Only the owner has access right now.
                    </div>
                  )}
                  {sortedShares.map((s, idx) => (
                    <div key={s.share_id ?? `cascade-${idx}`} className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary">
                        {s.principal_type === 'group' ? (
                          <UsersIcon className="h-4 w-4" />
                        ) : s.status === 'pending' ? (
                          <Mail className="h-4 w-4" />
                        ) : (
                          <UserIcon className="h-4 w-4" />
                        )}
                      </span>
                      <span className="text-sm text-gray-900 truncate">{s.label}</span>
                      {s.principal_type === 'user' &&
                        s.email != null &&
                        s.email.toLowerCase() === currentOrgUser?.email?.toLowerCase() && (
                          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary font-medium">
                            You
                          </span>
                        )}
                      {s.role_or_group && (
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {s.role_or_group}
                        </span>
                      )}
                      {s.status === 'pending' && (
                        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                          Pending
                        </span>
                      )}
                      <div className="ml-auto flex items-center gap-1">
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <Select
                                  value={s.access_level}
                                  onValueChange={(v) => {
                                    if (v === 'transfer') {
                                      setTransferTarget(s);
                                      return;
                                    }
                                    handleRowLevelChange(s, v as AccessLevel);
                                  }}
                                  disabled={
                                    rowBusyId != null &&
                                    (rowBusyId === s.share_id ||
                                      (s.share_id === null && rowBusyId === s.principal_id))
                                  }
                                >
                                  <SelectTrigger className="h-8 w-auto gap-1 border-0 bg-transparent px-2 text-sm text-gray-700 shadow-none hover:bg-gray-50 focus:ring-0 focus-visible:ring-0">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem
                                      value="view"
                                      disabled={
                                        s.share_id === null &&
                                        LEVEL_RANK['view'] <= LEVEL_RANK[s.access_level]
                                      }
                                    >
                                      View
                                    </SelectItem>
                                    <SelectItem
                                      value="edit"
                                      disabled={
                                        s.share_id === null &&
                                        LEVEL_RANK['edit'] <= LEVEL_RANK[s.access_level]
                                      }
                                    >
                                      Edit
                                    </SelectItem>
                                    {isOwnerOrAdmin &&
                                      s.principal_type === 'user' &&
                                      s.principal_id != null &&
                                      s.access_level === 'edit' && (
                                        <>
                                          <SelectSeparator />
                                          <SelectItem value="transfer">
                                            Transfer ownership
                                          </SelectItem>
                                        </>
                                      )}
                                  </SelectContent>
                                </Select>
                              </div>
                            </TooltipTrigger>
                            {s.share_id === null && (
                              <TooltipContent className="max-w-xs">
                                {s.access_level === 'edit'
                                  ? cascadeBlockMessage(s)
                                  : `Access inherited from a dashboard. You can upgrade to a higher level.`}
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700"
                          onClick={() => handleRowRemove(s)}
                          disabled={rowBusyId === s.share_id || s.share_id === null}
                          aria-label={`Remove ${s.label}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* General access — hidden for floor-only users (they can't change visibility) */}
          {rtype && generalAccess && !generalAccess.caller_access_via_floor && (
            <div className="rounded-md border p-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  {(() => {
                    const maxParentRank =
                      generalAccess.parent_blocks.length > 0
                        ? Math.max(
                            ...generalAccess.parent_blocks.map((b) =>
                              b.mode === 'public' ? 2 : b.mode === 'internal' ? 1 : 0
                            )
                          )
                        : -1;
                    const anyBlocked = maxParentRank > 0;
                    return (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">General access</p>
                            <p className="text-xs text-muted-foreground">
                              {generalAccess.mode === 'internal' &&
                                'Users can access this resource based on their role permissions'}
                              {generalAccess.mode === 'private' &&
                                'Only direct shares can access this resource'}
                              {generalAccess.mode === 'public' &&
                                (generalAccess.allow_public_sharing
                                  ? 'Anyone on the internet with the link can access this resource'
                                  : 'Public sharing is turned off by your admin')}
                            </p>
                          </div>
                          <Select
                            value={generalAccess.mode}
                            onValueChange={(v) => handleModeChange(v as GeneralAccessMode)}
                            disabled={modeChanging}
                          >
                            <SelectTrigger className="w-32 h-8" data-testid="general-access-select">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent position="popper">
                              <SelectItem value="internal" disabled={maxParentRank > 1}>
                                Default
                              </SelectItem>
                              <SelectItem value="private" disabled={maxParentRank > 0}>
                                Private
                              </SelectItem>
                              {generalAccess.supports_public && (
                                <SelectItem
                                  value="public"
                                  disabled={!generalAccess.allow_public_sharing}
                                >
                                  Public
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        {anyBlocked && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Some options are restricted as this resource is used in shared
                            dashboards:{' '}
                            <strong>
                              {generalAccess.parent_blocks.map((b) => b.dashboard_title).join(', ')}
                            </strong>
                          </p>
                        )}
                      </>
                    );
                  })()}

                  {generalAccess.mode === 'public' && generalAccess.allow_public_sharing && (
                    <>
                      <div className="mt-3 flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-3">
                        <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-orange-800">
                          <strong>Security Notice:</strong> Your data is now exposed to the
                          internet. Anyone with this link can access your {entityLabelLower} data
                          without authentication.
                        </div>
                      </div>

                      {generalAccess.public_url && (
                        <Button
                          variant="outline"
                          onClick={handleCopyPublicUrl}
                          className="mt-3 w-full"
                          data-testid="copy-link-btn"
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          COPY PUBLIC LINK
                        </Button>
                      )}

                      {generalAccess.public_access_count > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          <p>Public access count: {generalAccess.public_access_count}</p>
                          {generalAccess.last_public_accessed && (
                            <p>
                              Last accessed:{' '}
                              {new Date(generalAccess.last_public_accessed).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Cascade confirmation dialog (dashboard only) */}
          {pendingAction && (
            <Dialog open onOpenChange={() => setPendingAction(null)}>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Update dashboard permissions?
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Changing permissions on a dashboard may change access to its charts and KPIs.{' '}
                  {buildDocsUrl('/dashboards/sharing#permission-levels') && (
                    <a
                      href={buildDocsUrl('/dashboards/sharing#permission-levels')!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-foreground"
                    >
                      Know more
                    </a>
                  )}
                </p>
                <div className="flex justify-end gap-3 mt-2">
                  <Button variant="outline" onClick={() => setPendingAction(null)}>
                    CANCEL
                  </Button>
                  <Button variant="primary" onClick={handleCascadeConfirm}>
                    CONTINUE
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Ownership transfer confirmation dialog */}
          {transferTarget && (
            <Dialog open onOpenChange={() => setTransferTarget(null)}>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Transfer ownership to {transferTarget.label}?</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  You will lose owner status on &quot;{entityLabel}&quot;. You will retain Edit
                  access.
                </p>
                <div className="flex justify-end gap-3 mt-2">
                  <Button variant="outline" onClick={() => setTransferTarget(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleTransferConfirm}
                    disabled={isTransferring}
                  >
                    {isTransferring ? 'Transferring…' : 'Transfer'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Admin takeover confirmation dialog */}
          {takeoverConfirmOpen && owner && (
            <Dialog open onOpenChange={() => setTakeoverConfirmOpen(false)}>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Remove owner and take over?</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  You will become the owner of this {rtype ?? entityLabelLower}.{' '}
                  <strong>{owner.email}</strong> will no longer have direct access.
                </p>
                <div className="flex justify-end gap-3 mt-2">
                  <Button variant="outline" onClick={() => setTakeoverConfirmOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleAdminTakeoverConfirm}
                    disabled={isTakingOver}
                    data-testid="admin-takeover-confirm-btn"
                  >
                    {isTakingOver ? 'Transferring…' : 'Confirm'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
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
        </div>

        {/* Sticky footer — sits below the scrollable body so long chip lists
            never push the SHARE button off-screen. */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-background">
          <Button variant="outline" onClick={onClose} data-testid="share-close-btn">
            CANCEL
          </Button>
          <Button
            variant="primary"
            onClick={handleShareClick}
            disabled={isSubmitting || chips.length === 0}
            data-testid="share-submit-btn"
          >
            {isSubmitting ? 'SHARING…' : 'SHARE'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
