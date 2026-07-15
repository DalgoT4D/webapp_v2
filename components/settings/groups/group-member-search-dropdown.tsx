'use client';

/**
 * The browse/search dropdown for the Create-group dialog's typeahead.
 * Split out of group-member-typeahead.tsx per the repo's ~300-lines
 * guidance. Ordering is one alphabetical merge of users + groups (design:
 * 'group creation-1.jpg') -- deliberately NOT ShareModal's groups-first
 * bucketing.
 */

import { Mail } from 'lucide-react';
import {
  principalRowIcon,
  roleTagLabel,
  SearchResultButton,
} from '@/components/ui/principal-search-shared';
import type { UserGroup } from '@/hooks/api/useUserGroups';
import type { OrgUser } from '@/stores/authStore';

export type GroupMemberSearchRow =
  | { kind: 'user'; sortKey: string; user: OrgUser }
  | { kind: 'group'; sortKey: string; group: UserGroup };

interface GroupMemberSearchDropdownProps {
  combinedMatches: GroupMemberSearchRow[];
  emailCandidate: string | null;
  stagedKeys: Set<string>;
  stagedEmails: Set<string | undefined>;
  onPickUser: (orguserId: number, email: string, roleSlug: string | undefined) => void;
  onPickGroup: (groupId: number, name: string) => void;
  onPickEmail: (email: string) => void;
}

export function GroupMemberSearchDropdown({
  combinedMatches,
  emailCandidate,
  stagedKeys,
  stagedEmails,
  onPickUser,
  onPickGroup,
  onPickEmail,
}: GroupMemberSearchDropdownProps) {
  return (
    <div
      data-testid="group-member-search-results"
      className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md"
    >
      {combinedMatches.map((row) =>
        row.kind === 'user' ? (
          <SearchResultButton
            key={`user-${row.user.orguser_id}`}
            testId={`group-member-search-user-${row.user.orguser_id}`}
            icon={principalRowIcon('user')}
            label={row.user.email}
            tag={roleTagLabel(row.user.new_role_slug)}
            alreadyStaged={
              stagedKeys.has(`user-${row.user.orguser_id}`) ||
              stagedEmails.has(row.user.email.toLowerCase())
            }
            hasAccess={false}
            onPick={() =>
              onPickUser(row.user.orguser_id as number, row.user.email, row.user.new_role_slug)
            }
          />
        ) : (
          <SearchResultButton
            key={`group-${row.group.id}`}
            testId={`group-member-search-group-${row.group.id}`}
            icon={principalRowIcon('group')}
            label={row.group.name}
            tag="Group"
            alreadyStaged={stagedKeys.has(`group-${row.group.id}`)}
            hasAccess={false}
            onPick={() => onPickGroup(row.group.id, row.group.name)}
          />
        )
      )}

      {emailCandidate && (
        <SearchResultButton
          testId="group-member-search-add-email"
          icon={<Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
          label={`Invite ${emailCandidate}`}
          tag="New"
          alreadyStaged={false}
          hasAccess={false}
          onPick={() => onPickEmail(emailCandidate)}
        />
      )}

      {combinedMatches.length === 0 && !emailCandidate && (
        <div
          data-testid="group-member-search-empty"
          className="px-3 py-2 text-sm text-muted-foreground"
        >
          Search for people, a group, or add emails
        </div>
      )}
    </div>
  );
}
