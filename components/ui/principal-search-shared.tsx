'use client';

/**
 * Presentation-only pieces of the people/groups/emails typeahead, shared by
 * ShareModal's staging flow and the Create-group member picker. Knows
 * nothing about permissions or group membership — that stays in each
 * surface's own staging hook.
 */

import React from 'react';
import { Mail, User, UsersRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { InviteRoleSlug } from '@/hooks/api/useResourceAccess';

// ---- Email parsing ----

// Angle brackets excluded so leftovers of a mis-parsed "Name <email>"
// wrapper fail validation instead of being POSTed (the backend has no
// email-format check on the share-invite path).
export const EMAIL_REGEX = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

// Mail-client "Display Name <email>" wrapper (also bare "<email>").
// Anchored + no nested brackets so an unmatched bracket falls through to
// plain tokenization and then fails EMAIL_REGEX as an invalid entry.
const ANGLE_BRACKET_EMAIL_REGEX = /^[^<>]*<([^<>]+)>$/;

/** Splits pasted/typed text into email candidates: commas/semicolons/
 * newlines separate entries, "Name <email>" yields just the address,
 * anything else splits on whitespace. */
export function splitEmailTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const entry of text.split(/[,;\r\n]+/)) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const angleMatch = trimmed.match(ANGLE_BRACKET_EMAIL_REGEX);
    if (angleMatch) {
      tokens.push(angleMatch[1].trim());
    } else {
      tokens.push(...trimmed.split(/\s+/).filter(Boolean));
    }
  }
  return tokens;
}

// ---- Role tag labels ----

// Mirrors DDP_backend/seed/001_roles.json slugs → display tags.
const ROLE_TAG_LABELS: Record<string, string> = {
  'super-admin': 'Super Admin',
  admin: 'Admin',
  analyst: 'Analyst',
  member: 'Member',
};

export function roleTagLabel(slug: string | undefined): string {
  if (!slug) return 'Member';
  return ROLE_TAG_LABELS[slug] ?? slug;
}

/** The three roles an unknown-email invite can land at. */
export const INVITE_ROLE_OPTIONS: { value: InviteRoleSlug; label: string }[] = [
  { value: 'member', label: 'Member' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'admin', label: 'Admin' },
];

// ---- Dedup helper ----

/** Adds `entries` to `prev`, skipping anything whose key or email already
 * exists in `prev`. */
export function dedupeStage<T extends { key: string; email?: string }>(
  prev: T[],
  entries: T[]
): T[] {
  const seenKeys = new Set(prev.map((e) => e.key));
  const seenEmails = new Set(prev.map((e) => e.email).filter(Boolean));
  const next = [...prev];
  for (const entry of entries) {
    if (seenKeys.has(entry.key)) continue;
    if (entry.email && seenEmails.has(entry.email)) continue;
    seenKeys.add(entry.key);
    if (entry.email) seenEmails.add(entry.email);
    next.push(entry);
  }
  return next;
}

// ---- Icon per entry kind ----

export type PrincipalEntryKind = 'user' | 'group' | 'email';

export function principalRowIcon(kind: PrincipalEntryKind) {
  if (kind === 'group')
    return <UsersRound className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />;
  if (kind === 'email') return <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />;
  return <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />;
}

/** Tinted circular avatar for People-with-access and pending-request rows —
 * distinct from the plain icon `principalRowIcon` renders for typeahead rows. */
export function PrincipalAvatar({ kind = 'user' }: { kind?: PrincipalEntryKind }) {
  const Icon = kind === 'group' ? UsersRound : User;
  return (
    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
      <Icon className="h-3.5 w-3.5 text-primary" />
    </span>
  );
}

// ---- Borderless permission control ("View ⌄") ----

// Plain text + chevron instead of a bordered Select pill; still an
// accessible Select under the hood. Exported so PendingRequestRow can build
// its own inline lowercase control from the same chrome.
export const BORDERLESS_PERMISSION_TRIGGER_CLASSES =
  'h-auto w-auto gap-1 rounded-sm border-none bg-transparent p-0 text-sm font-normal text-foreground shadow-none hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=open]:[&_svg]:rotate-180';

export interface PermissionSelectProps {
  testId: string;
  ariaLabel: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  /** Extra items appended after View/Edit — e.g. "Transfer Ownership". */
  extraItems?: React.ReactNode;
}

/** Borderless View/Edit permission control shared by ShareModal's staged
 * and granted rows. */
export function PermissionSelect({
  testId,
  ariaLabel,
  value,
  onValueChange,
  disabled,
  extraItems,
}: PermissionSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        data-testid={testId}
        aria-label={ariaLabel}
        disabled={disabled}
        className={BORDERLESS_PERMISSION_TRIGGER_CLASSES}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="view">View</SelectItem>
        <SelectItem value="edit">Edit</SelectItem>
        {extraItems}
      </SelectContent>
    </Select>
  );
}

// ---- Dropdown row button ----

export interface SearchResultButtonProps {
  testId: string;
  icon: React.ReactNode;
  label: string;
  tag: string;
  alreadyStaged: boolean;
  hasAccess: boolean;
  onPick: () => void;
}

/** One row in the browse/search dropdown. `hasAccess` and `alreadyStaged`
 * both disable the row (already-granted vs. already-picked-this-session)
 * with a distinct trailing note. */
export function SearchResultButton({
  testId,
  icon,
  label,
  tag,
  alreadyStaged,
  hasAccess,
  onPick,
}: SearchResultButtonProps) {
  const unavailable = alreadyStaged || hasAccess;
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={unavailable}
      onClick={onPick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent',
        unavailable && 'cursor-not-allowed opacity-60'
      )}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {unavailable && (
        <span className="text-xs text-muted-foreground">
          {hasAccess ? 'Already has access' : 'Added'}
        </span>
      )}
      <Badge variant="secondary">{tag}</Badge>
    </button>
  );
}
