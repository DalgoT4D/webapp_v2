'use client';

import { useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { User as UserIcon, Users as UsersIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export interface TypeaheadSuggestion {
  kind: 'user' | 'group';
  id: number;
  label: string;
  badge?: string | null;
  disabled?: boolean;
  disabledReason?: string;
}

interface PrincipalTypeaheadProps {
  value: string;
  onChange: (v: string) => void;
  suggestions: TypeaheadSuggestion[];
  onSelectUser: (id: number, label: string) => void;
  onSelectGroup: (id: number, label: string) => void;
  /** Fires on Enter or comma with the raw draft. Parent owns validation. */
  onCommitEmail?: (raw: string) => void;
  /** Fires on Backspace with empty input. */
  onBackspace?: () => void;
  /** Fires on paste when the pasted text contains any of `,;whitespace`. */
  onPasteEmails?: (parts: string[]) => void;
  /** When true, also fires `onCommitEmail` on blur if the draft is non-empty. */
  commitOnBlur?: boolean;
  error?: string | null;
  placeholder?: string;
  inputTestId?: string;
  inputId?: string;
}

/**
 * Shared typeahead used by ShareModal (grant staging) and RecipientPicker
 * (alert recipients). Renders an input + a suggestions dropdown of internal
 * users and groups. External emails are committed via Enter/comma (or paste
 * with a separator), never as dropdown entries.
 */
export function PrincipalTypeahead({
  value,
  onChange,
  suggestions,
  onSelectUser,
  onSelectGroup,
  onCommitEmail,
  onBackspace,
  onPasteEmails,
  commitOnBlur,
  error,
  placeholder,
  inputTestId,
  inputId,
}: PrincipalTypeaheadProps) {
  const [open, setOpen] = useState(false);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && onCommitEmail) {
      e.preventDefault();
      onCommitEmail(value);
    } else if (e.key === 'Backspace' && !value && onBackspace) {
      onBackspace();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    if (!onPasteEmails) return;
    const text = e.clipboardData.getData('text');
    if (/[,;\s]/.test(text)) {
      e.preventDefault();
      onPasteEmails(text.split(/[,;\s]+/).filter(Boolean));
    }
  };

  return (
    <div className="relative">
      <Input
        id={inputId}
        className={error ? 'border-red-500' : ''}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // delay so onMouseDown on suggestion items fires first
          setTimeout(() => {
            setOpen(false);
            if (commitOnBlur && value.trim() && onCommitEmail) {
              onCommitEmail(value);
            }
          }, 150);
        }}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        data-testid={inputTestId}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-md border bg-white shadow-md max-h-64 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              type="button"
              key={`${s.kind}:${s.id}`}
              disabled={s.disabled}
              onMouseDown={(e) => {
                e.preventDefault();
                if (s.disabled) return;
                if (s.kind === 'user') onSelectUser(s.id, s.label);
                else onSelectGroup(s.id, s.label);
              }}
              title={s.disabled ? s.disabledReason : undefined}
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary">
                {s.kind === 'user' ? (
                  <UserIcon className="h-4 w-4" />
                ) : (
                  <UsersIcon className="h-4 w-4" />
                )}
              </span>
              <span className="flex-1 text-sm text-gray-900">{s.label}</span>
              {s.badge && (
                <Badge variant="secondary" className="text-xs">
                  {s.badge}
                </Badge>
              )}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
}
