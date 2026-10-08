import { useEffect, useMemo, useState } from 'react';
import type { OwnerInfo, useResourceGrantActions, useResourceGrants } from '@/hooks/api/useAccess';
import { EMAIL_REGEX } from '@/components/reports/utils';
import type { AccessLevel, ShareRow } from '@/types/access';
import type { PersonRow } from '@/types/user-management';
import type { GroupListRow } from '@/types/user-groups';
import {
  buildAddGrantsPayload,
  buildCurrentPrincipalKeys,
  buildShareSuggestions,
  type ActiveUser,
  type StagedChip,
} from '@/components/share/logic/share-grants';

interface UseShareChipsArgs {
  isOpen: boolean;
  people: PersonRow[] | undefined;
  groups: GroupListRow[] | undefined;
  memberRoleUuid: string | undefined;
  shares: ShareRow[] | undefined;
  owner: OwnerInfo | null;
  activeUserByEmail: Map<string, ActiveUser>;
  addGrants: ReturnType<typeof useResourceGrantActions>['addGrants'];
  mutateGrants: ReturnType<typeof useResourceGrants>['mutate'];
  onUpdate?: () => void;
  onClose: () => void;
}

/** Grant staging in the Share modal: typeahead, staged chips with View/Edit, invite role, SHARE. */
export function useShareChips({
  isOpen,
  people,
  groups,
  memberRoleUuid,
  shares,
  owner,
  activeUserByEmail,
  addGrants,
  mutateGrants,
  onUpdate,
  onClose,
}: UseShareChipsArgs) {
  const [chipInput, setChipInput] = useState('');
  const [chips, setChips] = useState<StagedChip[]>([]);
  const [inviteRoleUuid, setInviteRoleUuid] = useState<string>('');
  const [chipError, setChipError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset staging when modal closes
  useEffect(() => {
    if (!isOpen) {
      setChips([]);
      setChipInput('');
      setInviteRoleUuid('');
      setChipError(null);
      setRoleError(null);
    }
  }, [isOpen]);

  // Default the invite role to Member as soon as the roles list loads.
  // The user can still change it via the role select.
  useEffect(() => {
    if (isOpen && memberRoleUuid && !inviteRoleUuid) {
      setInviteRoleUuid(memberRoleUuid);
    }
  }, [isOpen, memberRoleUuid, inviteRoleUuid]);

  // Existing shared principals (skip in suggestions)
  const currentPrincipals = useMemo(() => buildCurrentPrincipalKeys(shares), [shares]);
  const chippedKeys = useMemo(() => new Set(chips.map((c) => c.key)), [chips]);
  const suggestions = useMemo(
    () =>
      buildShareSuggestions({
        query: chipInput,
        people,
        groups,
        chippedKeys,
        currentPrincipals,
        owner,
      }),
    [chipInput, people, groups, chippedKeys, currentPrincipals, owner]
  );

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

  const removeLastChip = () => {
    if (chips.length > 0) setChips((prev) => prev.slice(0, -1));
  };

  const setChipLevel = (key: string, level: AccessLevel) => {
    setChips((prev) => prev.map((c) => (c.key === key ? { ...c, access_level: level } : c)));
  };

  const handleChipInputChange = (v: string) => {
    setChipInput(v);
    clearChipError();
  };

  const handleInviteRoleChange = (v: string) => {
    setInviteRoleUuid(v);
    setRoleError(null);
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
      await addGrants(buildAddGrantsPayload(chips, inviteRoleUuid));
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

  return {
    chipInput,
    chips,
    suggestions,
    hasPendingChips,
    inviteRoleUuid,
    chipError,
    roleError,
    isSubmitting,
    addUserChip,
    addGroupChip,
    addEmailChip,
    removeChip,
    removeLastChip,
    setChipLevel,
    handleChipInputChange,
    handleInviteRoleChange,
    handleShareClick,
  };
}

export type ShareChipsState = ReturnType<typeof useShareChips>;
