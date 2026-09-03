'use client';

import { useMemo, useState } from 'react';
import { X, User, Users2, Mail } from 'lucide-react';
import type { RecipientIn } from '@/types/alerts';
import { useActiveMembers, useUserGroups } from '@/hooks/api/useAccess';
import { PrincipalTypeahead } from '@/components/ui/principal-typeahead';
import { cn } from '@/lib/utils';

interface RecipientPickerProps {
  value: RecipientIn[];
  onChange: (value: RecipientIn[]) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function recipientKey(r: RecipientIn): string {
  if (r.type === 'orguser') return `orguser:${r.orguser_id}`;
  if (r.type === 'user_group') return `user_group:${r.user_group_id}`;
  return `external:${r.email}`;
}

function chipClass(type: RecipientIn['type']): string {
  if (type === 'external') return 'border-gray-200 bg-gray-50 text-gray-700';
  return 'border-emerald-200 bg-emerald-50 text-emerald-800';
}

function chipRemoveClass(type: RecipientIn['type']): string {
  if (type === 'external') return 'text-gray-600 hover:bg-gray-100';
  return 'text-emerald-700 hover:bg-emerald-100';
}

function ChipIcon({ type }: { type: RecipientIn['type'] }) {
  const iconClass =
    type === 'external' ? 'h-3.5 w-3.5 text-gray-500' : 'h-3.5 w-3.5 text-emerald-600';
  if (type === 'orguser') return <User className={iconClass} />;
  if (type === 'user_group') return <Users2 className={iconClass} />;
  return <Mail className={iconClass} />;
}

function labelFor(r: RecipientIn): string {
  if (r.type === 'orguser') return r.orguser_name || r.email || `User #${r.orguser_id}`;
  if (r.type === 'user_group') return r.user_group_name || `Group #${r.user_group_id}`;
  return r.email || '';
}

export function RecipientPicker({ value, onChange }: RecipientPickerProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { people } = useActiveMembers();
  const { groups } = useUserGroups();

  const existingKeys = useMemo(() => new Set(value.map(recipientKey)), [value]);

  const suggestions = useMemo(() => {
    const q = draft.trim().toLowerCase();
    const members = (people ?? [])
      .filter((p) => p.status === 'active' && p.orguser_id != null)
      .filter((p) => !existingKeys.has(`orguser:${p.orguser_id}`))
      .filter((p) => !q || p.email.toLowerCase().includes(q))
      .slice(0, 6)
      .map((p) => ({
        kind: 'user' as const,
        id: p.orguser_id as number,
        label: p.email,
        badge: p.role_name,
      }));
    const groupItems = (groups ?? [])
      .filter((g) => !existingKeys.has(`user_group:${g.id}`))
      .filter((g) => !q || g.name.toLowerCase().includes(q))
      .slice(0, 4)
      .map((g) => ({
        kind: 'group' as const,
        id: g.id,
        label: g.name,
        badge: 'Group',
      }));
    return [...members, ...groupItems];
  }, [people, groups, draft, existingKeys]);

  const commitEmail = (raw: string) => {
    const email = raw.trim().replace(/,$/, '').trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_RE.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (existingKeys.has(`external:${email}`)) {
      setError('Already added.');
      return;
    }
    onChange([...value, { type: 'external', email }]);
    setDraft('');
    setError(null);
  };

  const addOrguser = (id: number, email: string) => {
    if (existingKeys.has(`orguser:${id}`)) return;
    onChange([...value, { type: 'orguser', orguser_id: id, orguser_name: email, email }]);
    setDraft('');
    setError(null);
  };

  const addGroup = (id: number, name: string) => {
    if (existingKeys.has(`user_group:${id}`)) return;
    onChange([...value, { type: 'user_group', user_group_id: id, user_group_name: name }]);
    setDraft('');
    setError(null);
  };

  const removeRecipient = (r: RecipientIn) => {
    onChange(value.filter((x) => recipientKey(x) !== recipientKey(r)));
  };

  return (
    <div className="space-y-2">
      <PrincipalTypeahead
        placeholder="Search for people, groups or type an email and press Enter…"
        inputTestId="recipient-add-input"
        value={draft}
        onChange={(v) => {
          setDraft(v);
          if (error) setError(null);
        }}
        suggestions={suggestions}
        onSelectUser={addOrguser}
        onSelectGroup={addGroup}
        onCommitEmail={commitEmail}
        onBackspace={() => {
          if (value.length > 0) onChange(value.slice(0, -1));
        }}
        onPasteEmails={(parts) => {
          const toAdd: RecipientIn[] = [];
          const seen = new Set(existingKeys);
          for (const p of parts) {
            const email = p.trim().replace(/,$/, '').trim().toLowerCase();
            if (!email || !EMAIL_RE.test(email) || seen.has(`external:${email}`)) continue;
            seen.add(`external:${email}`);
            toAdd.push({ type: 'external', email });
          }
          if (toAdd.length > 0) {
            onChange([...value, ...toAdd]);
            setError(null);
          }
          setDraft('');
        }}
        error={error}
      />

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((r) => (
            <span
              key={recipientKey(r)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border py-1 pl-2.5 pr-1 text-sm',
                chipClass(r.type)
              )}
              data-testid={`recipient-chip-${r.type}`}
            >
              <ChipIcon type={r.type} />
              <span>{labelFor(r)}</span>
              <button
                type="button"
                onClick={() => removeRecipient(r)}
                aria-label={`Remove ${labelFor(r)}`}
                className={cn(
                  'ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors',
                  chipRemoveClass(r.type)
                )}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
