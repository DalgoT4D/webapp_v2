'use client';

/**
 * Generic, presentation-only pieces of the unified people/groups/emails
 * typeahead, shared by ShareModal's staging flow (share-modal-staging.tsx)
 * and the Create-group dialog's member picker
 * (components/settings/groups/group-member-typeahead.tsx) — split out so
 * neither surface copy-pastes email parsing, role-tag labels, or the
 * dropdown row button (repo convention: extract, don't duplicate, see
 * CLAUDE.md's ~300-lines-per-component guidance).
 *
 * Nothing here knows about AccessLevel/permission or about Groups' own
 * membership rules — those stay in each surface's own staging hook. Moving
 * these out changes NOTHING about share-modal-staging's behavior: it
 * re-exports every symbol that moved so its own imports (and share-modal.tsx's)
 * are unaffected.
 */

import React from 'react';
import { Mail, User, UsersRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

// ---- Email parsing ----

// Angle brackets excluded so stray leftovers of a mis-parsed mail-client
// "Name <email>" wrapper (e.g. an unmatched "<a@x.org") fail validation
// instead of being POSTed to the backend, which has no email-format check
// on the share-invite path.
export const EMAIL_REGEX = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

// Mail-client "Display Name <email>" wrapper (also bare "<email>").
// Anchored + no nested brackets so an unmatched bracket falls through to
// plain tokenization and then fails EMAIL_REGEX as an invalid entry.
const ANGLE_BRACKET_EMAIL_REGEX = /^[^<>]*<([^<>]+)>$/;

/** Splits pasted/typed text into email candidates. Entries are separated
 * by commas/semicolons/newlines; a "Name <email>" entry (the common
 * mail-client copy format) yields just the address; anything else is
 * further split on whitespace. */
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

// ---- Dedup helper ----

/** Adds `entries` to `prev`, skipping anything whose `key` OR (if present)
 * `email` already exists in `prev` — the dup guard used by every staging
 * surface (ShareModal's grants, the Create-group dialog's member list). */
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
