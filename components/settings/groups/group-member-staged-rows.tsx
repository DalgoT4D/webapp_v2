'use client';

/**
 * Staged chips for the group member typeahead, rendered inside the input
 * container (color follows chipVariant). Renders a bare fragment so the
 * chips lay out via the parent's flex-wrap alongside the actual <input>.
 */

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { principalRowIcon } from '@/components/ui/principal-search-shared';
import {
  chipVariant,
  type GroupMemberStaging,
} from '@/components/settings/groups/group-member-staging';

interface GroupMemberStagedRowsProps {
  staging: GroupMemberStaging;
  disabled?: boolean;
}

const CHIP_VARIANT_CLASSES: Record<string, string> = {
  internal: 'border-teal-200 bg-teal-50 text-teal-800',
  external: 'border-orange-200 bg-orange-50 text-orange-800',
  invalid: 'border-destructive/40 bg-destructive/10 text-destructive',
};

export function GroupMemberStagedRows({ staging, disabled }: GroupMemberStagedRowsProps) {
  return (
    <>
      {staging.staged.map((entry) => {
        const variant = chipVariant(entry);
        return (
          <span
            key={entry.key}
            data-testid={`group-member-staged-row-${entry.key}`}
            data-status={entry.status}
            data-chip-variant={variant}
            title={entry.status === 'invalid' ? 'Not a valid email address' : undefined}
            className={cn(
              'inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs',
              CHIP_VARIANT_CLASSES[variant]
            )}
          >
            {principalRowIcon(entry.kind)}
            <span className="truncate">{entry.label}</span>
            <button
              type="button"
              data-testid={`group-member-staged-remove-${entry.key}`}
              onClick={() => staging.remove(entry.key)}
              disabled={disabled}
              className="flex-shrink-0 rounded-full p-0.5 hover:bg-black/10"
              aria-label={`Remove ${entry.label}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}
    </>
  );
}
