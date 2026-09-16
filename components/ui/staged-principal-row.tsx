'use client';

import { type ReactNode } from 'react';
import { User as UserIcon, Users as UsersIcon, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StagedPrincipalRowProps {
  kind: 'user' | 'group' | 'email';
  label: string;
  /** Small pill after the label (role name, "Group", etc.). */
  badge?: string | null;
  /** Additional inline tags rendered after the badge (e.g. "You", "Pending"). */
  extraTags?: ReactNode;
  /** Right-side controls — access-level select, remove button, etc. */
  actions?: ReactNode;
  className?: string;
  testId?: string;
}

/**
 * Full-width row visual used for staged chips in ShareModal + RecipientPicker.
 * Avatar circle on the left, label, optional badge/extra tags, actions slot on
 * the right. Business logic (add/remove/access-level) stays with the caller.
 */
export function StagedPrincipalRow({
  kind,
  label,
  badge,
  extraTags,
  actions,
  className,
  testId,
}: StagedPrincipalRowProps) {
  const Icon = kind === 'group' ? UsersIcon : kind === 'email' ? Mail : UserIcon;
  return (
    <div
      data-testid={testId}
      className={cn('flex items-center gap-3 rounded-md bg-gray-50 px-3 py-2', className)}
    >
      <span className="inline-flex items-center justify-center h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm text-gray-900 truncate">{label}</span>
      {badge && (
        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600 shrink-0">
          {badge}
        </span>
      )}
      {extraTags}
      {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
    </div>
  );
}
