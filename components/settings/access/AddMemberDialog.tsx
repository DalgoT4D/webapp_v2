'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Mail, User as UserIcon, X } from 'lucide-react';
import { usePeople, useUserGroupActions } from '@/hooks/api/useAccess';
import { useRoles } from '@/hooks/api/useUserManagement';
import type { GroupMember } from '@/types/user-groups';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
  existingMembers: GroupMember[];
  onSuccess?: () => void;
}

interface Chip {
  email: string;
  orguserId: number | null;
}

export function AddMemberDialog({
  open,
  onOpenChange,
  groupId,
  existingMembers,
  onSuccess,
}: Props) {
  const { people } = usePeople();
  const { roles } = useRoles();
  const { addMembers } = useUserGroupActions();

  const [chipInput, setChipInput] = useState('');
  const [chips, setChips] = useState<Chip[]>([]);
  const [inviteRoleUuid, setInviteRoleUuid] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [errors, setErrors] = useState<{ chip?: string; role?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const existingEmails = useMemo(
    () => new Set(existingMembers.map((m) => m.email.toLowerCase())),
    [existingMembers]
  );
  const chippedEmails = useMemo(() => new Set(chips.map((c) => c.email.toLowerCase())), [chips]);

  const activeUserByEmail = useMemo(() => {
    const m = new Map<string, number>();
    people?.forEach((p) => {
      if (p.status === 'active' && p.orguser_id != null) m.set(p.email.toLowerCase(), p.orguser_id);
    });
    return m;
  }, [people]);

  const suggestions = useMemo(() => {
    const q = chipInput.trim().toLowerCase();
    return (people ?? [])
      .filter(
        (p) =>
          p.status === 'active' &&
          p.orguser_id != null &&
          !existingEmails.has(p.email.toLowerCase()) &&
          !chippedEmails.has(p.email.toLowerCase()) &&
          (q === '' || p.email.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [chipInput, people, existingEmails, chippedEmails]);

  const hasPendingChips = chips.some((c) => c.orguserId === null);
  const memberOption = useMemo(() => roles?.find((r) => r.slug === 'member'), [roles]);

  const addChip = (email: string, orguserId: number | null) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || chippedEmails.has(normalized) || existingEmails.has(normalized)) return;
    setChips((prev) => [...prev, { email: normalized, orguserId }]);
    setChipInput('');
    setErrors({});
  };

  const addFromInput = () => {
    const email = chipInput.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_REGEX.test(email)) {
      setErrors({ chip: 'Invalid email address' });
      return;
    }
    if (existingEmails.has(email)) {
      setErrors({ chip: 'Already a member' });
      return;
    }
    const orguserId = activeUserByEmail.get(email) ?? null;
    addChip(email, orguserId);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addFromInput();
    } else if (e.key === 'Backspace' && !chipInput && chips.length > 0) {
      setChips((prev) => prev.slice(0, -1));
    }
  };

  const handleClose = () => {
    setChips([]);
    setChipInput('');
    setInviteRoleUuid('');
    setErrors({});
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (chips.length === 0) return;
    if (hasPendingChips && !inviteRoleUuid) {
      setErrors({ role: 'Choose a role for new invites' });
      return;
    }
    setIsSubmitting(true);
    try {
      await addMembers(groupId, {
        orguser_ids: chips.filter((c) => c.orguserId !== null).map((c) => c.orguserId as number),
        pending_emails: chips.filter((c) => c.orguserId === null).map((c) => c.email),
        invite_role_uuid: hasPendingChips ? inviteRoleUuid : null,
      });
      onSuccess?.();
      handleClose();
    } catch {
      // toast handled in hook
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add members</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Input */}
          <div className="space-y-2">
            <Label>Search or enter email</Label>
            <div className="relative">
              <Input
                value={chipInput}
                onChange={(e) => {
                  setChipInput(e.target.value);
                  setShowSuggestions(true);
                  setErrors({});
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onKeyDown={handleKeyDown}
                placeholder="Type name or email…"
                className={errors.chip ? 'border-red-500' : ''}
                autoFocus
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-md border bg-white shadow-md max-h-48 overflow-y-auto">
                  {suggestions.map((p) => (
                    <button
                      type="button"
                      key={p.orguser_id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addChip(p.email, p.orguser_id!);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50"
                    >
                      <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary">
                        <UserIcon className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex-1 text-sm">{p.email}</span>
                      <Badge variant="secondary" className="text-xs">
                        {p.role_name}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.chip && <p className="text-sm text-red-500">{errors.chip}</p>}
          </div>

          {/* Chips */}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <span
                  key={c.email}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary"
                >
                  {c.orguserId === null ? (
                    <Mail className="h-3 w-3" />
                  ) : (
                    <UserIcon className="h-3 w-3" />
                  )}
                  {c.email}
                  <button
                    type="button"
                    onClick={() => setChips((prev) => prev.filter((x) => x.email !== c.email))}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Pending invite role */}
          {hasPendingChips && (
            <>
              <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-3">
                <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                <p className="text-xs text-orange-800">
                  Some emails aren&apos;t on Dalgo yet. Assign them a role before adding.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Invite new users as</Label>
                <Select
                  value={inviteRoleUuid}
                  onValueChange={(v) => {
                    setInviteRoleUuid(v);
                    setErrors({});
                  }}
                >
                  <SelectTrigger className={errors.role ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles?.map((r) => (
                      <SelectItem key={r.uuid} value={r.uuid}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.role && <p className="text-sm text-red-500">{errors.role}</p>}
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
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            CANCEL
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting || chips.length === 0}
          >
            {isSubmitting ? 'ADDING…' : 'ADD'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
