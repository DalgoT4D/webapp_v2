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
import { usePeople } from '@/hooks/api/useAccess';
import { useUserGroupActions } from '@/hooks/api/useAccess';
import { useRoles } from '@/hooks/api/useUserManagement';
import { AlertTriangle, User as UserIcon, X } from 'lucide-react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ResolvedChip {
  email: string;
  orguserId: number | null;
}

export function CreateGroupDialog({ open, onOpenChange, onSuccess }: Props) {
  const { people } = usePeople();
  const { roles } = useRoles();
  const { createGroup } = useUserGroupActions();

  const [name, setName] = useState('');
  const [chipInput, setChipInput] = useState('');
  const [chips, setChips] = useState<ResolvedChip[]>([]);
  const [inviteRoleUuid, setInviteRoleUuid] = useState<string>('');
  const [errors, setErrors] = useState<{ name?: string; role?: string; chip?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const activeOrguserByEmail = useMemo(() => {
    const map = new Map<string, number>();
    people?.forEach((p) => {
      if (p.status === 'active' && p.orguser_id != null) {
        map.set(p.email.toLowerCase(), p.orguser_id);
      }
    });
    return map;
  }, [people]);

  const pendingChipEmails = useMemo(
    () => chips.filter((c) => c.orguserId === null).map((c) => c.email),
    [chips]
  );

  const memberOption = useMemo(() => roles?.find((r) => r.slug === 'member'), [roles]);

  const chippedEmails = useMemo(() => new Set(chips.map((c) => c.email)), [chips]);

  const suggestions = useMemo(() => {
    if (!people) return [];
    const q = chipInput.trim().toLowerCase();
    return people
      .filter(
        (p) =>
          p.status === 'active' &&
          p.orguser_id != null &&
          !chippedEmails.has(p.email.toLowerCase()) &&
          (q === '' || p.email.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [people, chipInput, chippedEmails]);

  const reset = () => {
    setName('');
    setChipInput('');
    setChips([]);
    setInviteRoleUuid('');
    setErrors({});
  };

  const handleAddChip = (raw: string) => {
    const email = raw.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_REGEX.test(email)) {
      setErrors((prev) => ({ ...prev, chip: 'Invalid email' }));
      return;
    }
    if (chips.some((c) => c.email === email)) {
      setErrors((prev) => ({ ...prev, chip: 'Already added' }));
      return;
    }
    const orguserId = activeOrguserByEmail.get(email) ?? null;
    setChips((prev) => [...prev, { email, orguserId }]);
    setChipInput('');
    setErrors((prev) => ({ ...prev, chip: undefined }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddChip(chipInput);
    } else if (e.key === 'Backspace' && !chipInput && chips.length > 0) {
      setChips((prev) => prev.slice(0, -1));
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
    setChips((prev) => prev.filter((c) => c.email !== email));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // add any pending chip content
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
      await createGroup({
        name: name.trim(),
        orguser_ids: chips.filter((c) => c.orguserId != null).map((c) => c.orguserId as number),
        pending_emails: pendingChipEmails,
        invite_role_uuid: pendingChipEmails.length > 0 ? inviteRoleUuid : null,
      });
      onSuccess?.();
      reset();
      onOpenChange(false);
    } catch {
      // handled in hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const showInviteBanner = pendingChipEmails.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Create group</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Funders"
              className={errors.name ? 'border-red-500' : ''}
              data-testid="create-group-name"
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-chips">Add people, groups, or paste emails</Label>
            <div className="relative">
              <div
                className={`flex flex-wrap gap-1.5 rounded-md border px-2 py-2 focus-within:ring-2 focus-within:ring-primary/40 ${
                  errors.chip ? 'border-red-500' : 'border-input'
                }`}
                onClick={() => document.getElementById('group-chips')?.focus()}
              >
                {chips.map((chip) => (
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
                  id="group-chips"
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
                  placeholder={chips.length === 0 ? 'Type or paste emails…' : ''}
                  data-testid="create-group-chip-input"
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
                      data-testid={`suggestion-${s.email}`}
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

          {showInviteBanner && (
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
                <Label htmlFor="invite-role">Invite new users as</Label>
                <Select
                  value={inviteRoleUuid}
                  onValueChange={(v) => {
                    setInviteRoleUuid(v);
                    if (errors.role) setErrors((prev) => ({ ...prev, role: undefined }));
                  }}
                >
                  <SelectTrigger
                    id="invite-role"
                    className={errors.role ? 'border-red-500' : ''}
                    data-testid="create-group-invite-role"
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              data-testid="create-group-submit"
            >
              {isSubmitting ? 'Creating…' : 'Create Group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
