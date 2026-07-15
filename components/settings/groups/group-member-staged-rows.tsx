'use client';

/**
 * Staged-row list for the Create-group dialog's typeahead: icon · label ·
 * tag · remove — no permission control (groups don't have per-member
 * permissions, unlike ShareModal's staged rows). Split out of
 * group-member-typeahead.tsx per the repo's ~300-lines guidance.
 */

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { principalRowIcon } from '@/components/ui/principal-search-shared';
import type { GroupMemberStaging } from '@/components/settings/groups/group-member-staging';

interface GroupMemberStagedRowsProps {
  staging: GroupMemberStaging;
  disabled?: boolean;
}

export function GroupMemberStagedRows({ staging, disabled }: GroupMemberStagedRowsProps) {
  if (staging.staged.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="group-member-staged-rows">
      {staging.staged.map((entry) => (
        <div
          key={entry.key}
          data-testid={`group-member-staged-row-${entry.key}`}
          data-status={entry.status}
          className="flex items-center justify-between gap-2 text-sm"
        >
          <span className="flex-1 truncate inline-flex items-center gap-1.5 min-w-0">
            {principalRowIcon(entry.kind)}
            <span className={cn('truncate', entry.status === 'invalid' && 'text-destructive')}>
              {entry.label}
            </span>
            {entry.status === 'invalid' && (
              <span className="text-xs flex-shrink-0 text-destructive">
                Not a valid email address
              </span>
            )}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Badge variant="secondary">{entry.tag}</Badge>
            <button
              type="button"
              data-testid={`group-member-staged-remove-${entry.key}`}
              onClick={() => staging.remove(entry.key)}
              disabled={disabled}
              className="p-1 hover:text-destructive"
              aria-label={`Remove ${entry.label}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
