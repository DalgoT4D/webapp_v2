'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePeople, useUserGroup, useUserGroupActions } from '@/hooks/api/useAccess';
import { useRoles } from '@/hooks/api/useUserManagement';
import { AlertTriangle, Mail, User as UserIcon, X } from 'lucide-react';
import type { GroupMember } from '@/types/user-groups';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
  onSuccess?: () => void;
}

interface NewChip {
  email: string;
  orguserId: number | null;
}

export function EditGroupDialog({ open, onOpenChange, groupId, onSuccess }: Props) {
  const { group, isLoading, mutate: mutateGroup } = useUserGroup(open ? groupId : null);
  const { people } = usePeople();
  const { roles } = useRoles();
  const { renameGroup, addMembers, removeMember } = useUserGroupActions();

  const [name, setName] = useState('');
  const [chipInput, setChipInput] = useState('');
  const [newChips, setNewChips] = useState<NewChip[]>([]);
  const [removedMemberIds, setRemovedMemberIds] = useState<Set<number>>(new Set());
  const [inviteRoleUuid, setInviteRoleUuid] = useState<string>('');
  const [errors, setErrors] = useState<{ name?: string; role?: string; chip?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (open && group) {
      setName(group.name);
      setNewChips([]);
      setRemovedMemberIds(new Set());
      setChipInput('');
      setInviteRoleUuid('');
      setErrors({});
    }
  }, [open, group?.id]);

  const activeOrguserByEmail = useMemo(() => {
    const map = new Map<string, number>();
    people?.forEach((p) => {
      if (p.status === 'active' && p.orguser_id != null) {
        map.set(p.email.toLowerCase(), p.orguser_id);
      }
    });
    return map;
  }, [people]);

  const chippedEmails = useMemo(() => new Set(newChips.map((c) => c.email)), [newChips]);
  const currentMemberEmails = useMemo(
    () =>
      new Set(
        (group?.members ?? [])
          .filter((m) => !removedMemberIds.has(m.member_id))
          .map((m) => m.email.toLowerCase())
      ),
    [group, removedMemberIds]
  );

  const suggestions = useMemo(() => {
    if (!people) return [];
    const q = chipInput.trim().toLowerCase();
    return people
      .filter(
        (p) =>
          p.status === 'active' &&
          p.orguser_id != null &&
          !chippedEmails.has(p.email.toLowerCase()) &&
          !currentMemberEmails.has(p.email.toLowerCase()) &&
          (q === '' || p.email.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [people, chipInput, chippedEmails, currentMemberEmails]);

  const pendingChipEmails = useMemo(
    () => newChips.filter((c) => c.orguserId === null).map((c) => c.email),
    [newChips]
  );

  const memberOption = useMemo(() => roles?.find((r) => r.slug === 'member'), [roles]);

  const handleAddChip = (raw: string) => {
    const email = raw.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_REGEX.test(email)) {
      setErrors((prev) => ({ ...prev, chip: 'Invalid email' }));
      return;
    }
    if (chippedEmails.has(email)) {
      setErrors((prev) => ({ ...prev, chip: 'Already added' }));
      return;
    }
    if (currentMemberEmails.has(email)) {
      setErrors((prev) => ({ ...prev, chip: 'Already a member' }));
      return;
    }
    const orguserId = activeOrguserByEmail.get(email) ?? null;
    setNewChips((prev) => [...prev, { email, orguserId }]);
    setChipInput('');
    setErrors((prev) => ({ ...prev, chip: undefined }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddChip(chipInput);
    } else if (e.key === 'Backspace' && !chipInput && newChips.length > 0) {
      setNewChips((prev) => prev.slice(0, -1));
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (/[,;\s]/.test(text)) {
      e.preventDefault();
      text.split(/[,;\s]+/).forEach((t) => handleAddChip(t));
    }
  };

  const handleRemoveChip = (email: string) => {
    setNewChips((prev) => prev.filter((c) => c.email !== email));
  };

  const handleToggleRemoveExisting = (memberId: number) => {
    setRemovedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const nameChanged = group ? name.trim() !== group.name : false;
  const hasChanges = nameChanged || newChips.length > 0 || removedMemberIds.size > 0;

  const handleSave = async () => {
    if (!group) return;
    if (chipInput.trim()) handleAddChip(chipInput);

    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = 'Group name is required';
    if (pendingChipEmails.length > 0 && !inviteRoleUuid) {
      nextErrors.role = 'Choose a role for new invites';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      if (nameChanged) {
        await renameGroup(group.id, name.trim());
      }
      if (removedMemberIds.size > 0) {
        for (const memberId of removedMemberIds) {
          await removeMember(group.id, memberId);
        }
      }
      if (newChips.length > 0) {
        await addMembers(group.id, {
          orguser_ids: newChips
            .filter((c) => c.orguserId != null)
            .map((c) => c.orguserId as number),
          pending_emails: pendingChipEmails,
          invite_role_uuid: pendingChipEmails.length > 0 ? inviteRoleUuid : null,
        });
      }
      mutateGroup();
      onSuccess?.();
      onOpenChange(false);
    } catch {
      // handled in hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const visibleMembers: GroupMember[] = group?.members ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit group</DialogTitle>
        </DialogHeader>

        {isLoading || !group ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-group-name">Group name</Label>
              <Input
                id="edit-group-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                className={errors.name ? 'border-red-500' : ''}
                data-testid="edit-group-name"
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-group-chips">Add people, groups, or paste emails</Label>
              <div className="relative">
                <div
                  className={`flex flex-wrap gap-1.5 rounded-md border px-2 py-2 focus-within:ring-2 focus-within:ring-primary/40 ${
                    errors.chip ? 'border-red-500' : 'border-input'
                  }`}
                  onClick={() => document.getElementById('edit-group-chips')?.focus()}
                >
                  {newChips.map((chip) => (
                    <span
                      key={chip.email}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-xs text-primary"
                    >
                      {chip.email}
                      <button
                        type="button"
                        onClick={() => handleRemoveChip(chip.email)}
                        aria-label={`Remove ${chip.email}`}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    id="edit-group-chips"
                    className="flex-1 min-w-[160px] bg-transparent outline-none text-sm"
                    value={chipInput}
                    onChange={(e) => {
                      setChipInput(e.target.value);
                      setShowSuggestions(true);
                      if (errors.chip) setErrors((prev) => ({ ...prev, chip: undefined }));
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder={newChips.length === 0 ? 'Type or paste emails…' : ''}
                    data-testid="edit-group-chip-input"
                  />
                </div>

                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-md border bg-white shadow-md max-h-64 overflow-y-auto">
                    {suggestions.map((s) => (
                      <button
                        type="button"
                        key={s.orguser_id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleAddChip(s.email);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50"
                        data-testid={`edit-suggestion-${s.email}`}
                      >
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary">
                          <UserIcon className="h-4 w-4" />
                        </span>
                        <span className="flex-1 text-sm text-gray-900">{s.email}</span>
                        <Badge variant="secondary" className="text-xs">
                          {s.role_name}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {errors.chip && <p className="text-sm text-red-500">{errors.chip}</p>}
            </div>

            <div className="space-y-2">
              <Label>Existing Members</Label>
              <div className="border rounded-md max-h-56 overflow-y-auto">
                {visibleMembers.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No members yet.
                  </div>
                ) : (
                  visibleMembers.map((m, idx) => {
                    const isRemoved = removedMemberIds.has(m.member_id);
                    return (
                      <div
                        key={m.member_id}
                        className={`flex items-center gap-3 px-3 py-2 ${
                          idx > 0 ? 'border-t' : ''
                        } ${isRemoved ? 'opacity-40 line-through' : ''}`}
                      >
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary">
                          {m.status === 'pending' ? (
                            <Mail className="h-4 w-4" />
                          ) : (
                            <UserIcon className="h-4 w-4" />
                          )}
                        </span>
                        <span className="flex-1 text-sm text-gray-900">{m.email}</span>
                        {m.status === 'pending' ? (
                          <Badge variant="secondary" className="text-xs">
                            Pending
                          </Badge>
                        ) : m.role_name ? (
                          <Badge variant="secondary" className="text-xs">
                            {m.role_name}
                          </Badge>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 p-0"
                          onClick={() => handleToggleRemoveExisting(m.member_id)}
                          aria-label={isRemoved ? 'Undo remove' : `Remove ${m.email}`}
                          data-testid={`toggle-remove-${m.member_id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {pendingChipEmails.length > 0 && (
              <>
                <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-3">
                  <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-orange-800">
                    <strong>
                      {pendingChipEmails.length === 1
                        ? `${pendingChipEmails[0]} isn't on Dalgo yet.`
                        : `${pendingChipEmails.length} emails aren't on Dalgo yet.`}
                    </strong>
                    <div>Assign new invites a role before adding to group.</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-invite-role">Invite new users as</Label>
                  <Select
                    value={inviteRoleUuid}
                    onValueChange={(v) => {
                      setInviteRoleUuid(v);
                      if (errors.role) setErrors((prev) => ({ ...prev, role: undefined }));
                    }}
                  >
                    <SelectTrigger
                      id="edit-invite-role"
                      className={errors.role ? 'border-red-500' : ''}
                      data-testid="edit-group-invite-role"
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
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={isSubmitting || !hasChanges}
            data-testid="edit-group-save"
          >
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
