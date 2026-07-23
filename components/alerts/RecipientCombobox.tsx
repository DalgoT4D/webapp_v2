'use client';

import { useMemo, useState, type KeyboardEvent } from 'react';
import { X, Check } from 'lucide-react';
import type { RecipientIn } from '@/types/alerts';
import { cn } from '@/lib/utils';

interface RecipientComboboxProps {
  value: RecipientIn[];
  onChange: (value: RecipientIn[]) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function recipientKey(r: RecipientIn): string {
  return r.type === 'orguser' ? `orguser:${r.orguser_id}` : `external:${r.email}`;
}

/**
 * Email-only recipient picker.
 *
 * Earlier this surface was a cmdk-powered combobox that could pick existing
 * Dalgo users *or* add free-form emails. The dropdown added complexity (Radix
 * + cmdk pointer-event quirks) for a small win — most users just want to type
 * an email and hit Enter — so we simplified to a free-form input. Every entry
 * is submitted as `type: 'external'`; the backend treats both types equivalently
 * for delivery.
 */
export function RecipientCombobox({ value, onChange }: RecipientComboboxProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const existingEmails = useMemo(
    () => new Set(value.map((r) => (r.type === 'external' ? r.email : '')).filter(Boolean)),
    [value]
  );

  const labelFor = (r: RecipientIn): string => {
    if (r.type === 'external') return r.email || '';
    return r.orguser_name || `User #${r.orguser_id}`;
  };

  const commitDraft = (): boolean => {
    const trimmed = draft.trim().replace(/,$/, '').trim();
    if (!trimmed) return false;
    if (!EMAIL_RE.test(trimmed)) {
      setError('Enter a valid email address.');
      return false;
    }
    if (existingEmails.has(trimmed)) {
      setError('Already added.');
      return false;
    }
    onChange([...value, { type: 'external', email: trimmed }]);
    setDraft('');
    setError(null);
    return true;
  };

  const remove = (r: RecipientIn) => {
    onChange(value.filter((x) => recipientKey(x) !== recipientKey(r)));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      if (draft.trim()) {
        e.preventDefault();
        commitDraft();
      }
      return;
    }
    if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      remove(value[value.length - 1]);
    }
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((r) => (
            <span
              key={recipientKey(r)}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 py-1 pl-2.5 pr-1 text-sm text-emerald-800"
              data-testid={`recipient-chip-${r.type}`}
            >
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              <span>{labelFor(r)}</span>
              <button
                type="button"
                onClick={() => remove(r)}
                aria-label={`Remove ${labelFor(r)}`}
                className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="email"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (draft.trim()) commitDraft();
        }}
        placeholder="Add recipients..."
        data-testid="recipient-add-input"
        className={cn(
          'w-full border-0 bg-transparent p-0 text-sm text-gray-700 placeholder:text-gray-400',
          'focus:outline-none focus:ring-0'
        )}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
