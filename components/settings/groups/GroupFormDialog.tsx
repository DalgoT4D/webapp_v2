'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GroupMemberSearch } from '@/components/settings/groups/group-member-typeahead';
import {
  useGroupMemberStaging,
  type GroupMemberEntry,
} from '@/components/settings/groups/group-member-staging';
import {
  addGroupMember,
  createGroup,
  fetchGroupDetail,
  renameGroup,
  type AddGroupMemberPayload,
  type UserGroup,
} from '@/hooks/api/useUserGroups';
import type { InviteRoleSlug } from '@/hooks/api/useResourceAccess';
import { toastSuccess, toastWarning } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

interface GroupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present -> rename mode; omit -> create mode. */
  group?: UserGroup | null;
  onSuccess: () => void;
}

/** One member to add once the group exists — resolved from the typeahead's
 * staged rows (users/emails directly, groups flattened to their current
 * active members). `label` is only for the partial-failure toast. */
interface ResolvedMember {
  label: string;
  payload: AddGroupMemberPayload;
}

/** Flattens staged rows into the final add-member list: users and emails
 * pass through; a staged GROUP expands to its CURRENT active members
 * (fetched fresh here, not from the list page's stale `member_preview`).
 * Deduped by the same key convention the typeahead uses (`user-{id}` /
 * `email-{email}`) so a person staged directly AND pulled in via a group
 * is only added once. A group with zero active members contributes
 * nothing. There is no "exclude the group being edited" case here — this
 * picker only renders in create mode (rename mode has no typeahead), so
 * there is no group-being-edited to exclude. */
async function resolveMembers(
  staged: GroupMemberEntry[],
  inviteRole: InviteRoleSlug
): Promise<ResolvedMember[]> {
  const resolved: ResolvedMember[] = [];
  const seenKeys = new Set<string>();

  const add = (key: string, label: string, payload: AddGroupMemberPayload) => {
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    resolved.push({ label, payload });
  };

  for (const entry of staged) {
    if (entry.kind === 'user') {
      add(entry.key, entry.label, { orguser_id: entry.principalId as number });
    } else if (entry.kind === 'email' && entry.status === 'staged') {
      // invite_role only matters here (the unknown-email path) -- the
      // backend ignores it for orguser_id rows and resolves Member unless
      // an admin caller chose more (403s a non-admin escalation attempt).
      add(entry.key, entry.label, { email: entry.email as string, invite_role: inviteRole });
    }
  }

  const stagedGroups = staged.filter((e) => e.kind === 'group');
  for (const groupEntry of stagedGroups) {
    let detail;
    try {
      detail = await fetchGroupDetail(groupEntry.principalId as number);
    } catch {
      continue; // group vanished/fetch failed — contributes nothing, not fatal
    }
    for (const member of detail.members) {
      if (member.status !== 'active' || member.orguser_id === null) continue;
      add(`user-${member.orguser_id}`, member.email ?? `member ${member.orguser_id}`, {
        orguser_id: member.orguser_id,
      });
    }
  }

  return resolved;
}

// Backend rejects a blank name (GroupValidationError) — checked client-side
// too so we don't round-trip for an obviously-empty field.
export function GroupFormDialog({ open, onOpenChange, group, onSuccess }: GroupFormDialogProps) {
  const isRename = Boolean(group);
  const [name, setName] = useState(group?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const memberStaging = useGroupMemberStaging();

  useEffect(() => {
    if (open) {
      setName(group?.name ?? '');
      setError(null);
      memberStaging.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Group name cannot be blank');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      if (isRename && group) {
        await renameGroup(group.id, { name: trimmed });
        trackEvent(ANALYTICS_EVENTS.GROUP_RENAMED);
        toastSuccess.generic('Group renamed');
      } else {
        const newGroup = await createGroup({ name: trimmed });
        trackEvent(ANALYTICS_EVENTS.GROUP_CREATED);

        const members = await resolveMembers(memberStaging.staged, memberStaging.inviteRole);

        if (members.length > 0) {
          // Sequence: create -> add members. A member-add failure never
          // rolls back the group — it stays created, and the toast names
          // exactly who wasn't added so the admin can retry from the drawer.
          const results = await Promise.allSettled(
            members.map((m) => addGroupMember(newGroup.id, m.payload))
          );
          const failedLabels = results
            .map((result, index) => (result.status === 'rejected' ? members[index].label : null))
            .filter((label): label is string => label !== null);

          const addedCount = results.length - failedLabels.length;
          if (addedCount > 0) trackEvent(ANALYTICS_EVENTS.GROUP_MEMBER_ADDED);

          if (failedLabels.length > 0) {
            toastWarning.generic(`Group created, but couldn't add: ${failedLabels.join(', ')}`);
          } else {
            toastSuccess.generic('Group created');
          }
        } else {
          toastSuccess.generic('Group created');
        }
      }
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      // Name collisions (and other 400s) surface inline, next to the field
      // that caused them — not a toast the user has to connect back to the form.
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="group-form-dialog" className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isRename ? 'Rename group' : 'Create group'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="group-form-name-input">Group name</Label>
          <Input
            id="group-form-name-input"
            data-testid="group-form-name-input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="e.g. Funders"
            disabled={isSubmitting}
            autoFocus
          />
          {error && (
            <p data-testid="group-form-error" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
        {!isRename && (
          <div className="space-y-2">
            <Label htmlFor="group-member-search-input">Add people, groups, or paste emails</Label>
            <GroupMemberSearch staging={memberStaging} disabled={isSubmitting} />
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            data-testid="group-form-cancel-btn"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            data-testid="group-form-submit-btn"
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
          >
            {isSubmitting ? 'Saving…' : isRename ? 'Rename' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
