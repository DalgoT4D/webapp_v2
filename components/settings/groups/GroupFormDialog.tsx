'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { GroupExistingMembers } from '@/components/settings/groups/group-existing-members';
import {
  addGroupMember,
  createGroup,
  fetchGroupDetail,
  removeGroupMember,
  renameGroup,
  useUserGroup,
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
  /** Present -> unified edit mode (rename + typeahead + Existing Members);
   * omit -> create mode (typeahead only, no Existing Members section). */
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

/** Result of flattening staged rows: the resolved add-member list, plus the
 * labels of any staged groups whose current members couldn't be fetched
 * (surfaced by the caller in the same partial-failure toast as a failed
 * addGroupMember call — see handleSubmit). */
interface ResolveMembersResult {
  resolved: ResolvedMember[];
  failedGroupLabels: string[];
}

/** Flattens staged rows into the final add-member list: users and emails
 * pass through; a staged GROUP expands to its CURRENT active members
 * (fetched fresh here, not from the list page's stale `member_preview`).
 * Deduped by the same key convention the typeahead uses (`user-{id}` /
 * `email-{email}`) so a person staged directly AND pulled in via a group
 * is only added once. A group with zero active members contributes
 * nothing. If the flatten fetch itself fails (group vanished, network
 * error), the group contributes nothing AND its label is reported back so
 * the caller can name it in the partial-failure toast — it is never a
 * silent zero. The typeahead itself excludes the group being edited from
 * its own dropdown (see GroupMemberSearch's `excludeGroupId`), so a staged
 * group here is always some OTHER group, never the one being flattened
 * into. */
async function resolveMembers(
  staged: GroupMemberEntry[],
  inviteRole: InviteRoleSlug
): Promise<ResolveMembersResult> {
  const resolved: ResolvedMember[] = [];
  const failedGroupLabels: string[] = [];
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
      failedGroupLabels.push(groupEntry.label); // fetch failed — name it, don't swallow it
      continue;
    }
    for (const member of detail.members) {
      if (member.status !== 'active' || member.orguser_id === null) continue;
      add(`user-${member.orguser_id}`, member.email ?? `member ${member.orguser_id}`, {
        orguser_id: member.orguser_id,
      });
    }
  }

  return { resolved, failedGroupLabels };
}

// Backend rejects a blank name (GroupValidationError) — checked client-side
// too so we don't round-trip for an obviously-empty field.
export function GroupFormDialog({ open, onOpenChange, group, onSuccess }: GroupFormDialogProps) {
  const isEdit = Boolean(group);
  const [name, setName] = useState(group?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingRemoveIds, setPendingRemoveIds] = useState<Set<number>>(new Set());
  const memberStaging = useGroupMemberStaging();

  // Edit mode's Existing Members list — only fetched while the dialog is
  // open in edit mode (create mode has no group id yet). Not the row list
  // page's stale member_preview: this is the live detail fetch, same one
  // GroupDetailDrawer used before this dialog absorbed its edit surface.
  const { data: detail, isLoading: detailLoading } = useUserGroup(
    open && isEdit && group ? group.id : null
  );
  const existingMembers = useMemo(() => detail?.members ?? [], [detail]);

  useEffect(() => {
    if (open) {
      setName(group?.name ?? '');
      setError(null);
      setPendingRemoveIds(new Set());
      memberStaging.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group]);

  const existingMemberRefs = useMemo(
    () =>
      existingMembers
        .filter(
          (m) => m.status === 'active' && !pendingRemoveIds.has(m.id) && typeof m.orguser_id === 'number'
        )
        .map((m) => ({ key: `user-${m.orguser_id}`, email: m.email?.toLowerCase() })),
    [existingMembers, pendingRemoveIds]
  );

  const handleToggleRemove = (memberId: number) => {
    setPendingRemoveIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Group name cannot be blank');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      let targetGroupId: number;
      if (isEdit && group) {
        // Skip the no-op PUT when the name didn't change — avoids a
        // self-collision against the group's own current name.
        if (trimmed !== group.name) {
          await renameGroup(group.id, { name: trimmed });
          trackEvent(ANALYTICS_EVENTS.GROUP_RENAMED);
        }
        targetGroupId = group.id;
      } else {
        const newGroup = await createGroup({ name: trimmed });
        trackEvent(ANALYTICS_EVENTS.GROUP_CREATED);
        targetGroupId = newGroup.id;
      }

      const { resolved: members, failedGroupLabels } = await resolveMembers(
        memberStaging.staged,
        memberStaging.inviteRole
      );

      // Sequence: create/rename -> add members -> remove members. None of
      // these steps roll back an earlier one on failure — the toast names
      // exactly who/what wasn't applied so the admin can retry.
      let addFailedLabels: string[] = [];
      if (members.length > 0) {
        const results = await Promise.allSettled(
          members.map((m) => addGroupMember(targetGroupId, m.payload))
        );
        addFailedLabels = results
          .map((result, index) => (result.status === 'rejected' ? members[index].label : null))
          .filter((label): label is string => label !== null);

        const addedCount = results.length - addFailedLabels.length;
        if (addedCount > 0) trackEvent(ANALYTICS_EVENTS.GROUP_MEMBER_ADDED);
      }

      // Removals staged via the Existing Members list's ✕ are batched here
      // (applied on Save, not immediately on click) so Cancel discards a
      // pending removal exactly like it discards an un-submitted chip.
      let removeFailedLabels: string[] = [];
      if (isEdit && pendingRemoveIds.size > 0) {
        const idsToRemove = Array.from(pendingRemoveIds);
        const results = await Promise.allSettled(
          idsToRemove.map((id) => removeGroupMember(targetGroupId, id))
        );
        removeFailedLabels = results
          .map((result, index) => {
            if (result.status !== 'rejected') return null;
            const member = existingMembers.find((m) => m.id === idsToRemove[index]);
            return member?.email || member?.pending_email || member?.name || 'a member';
          })
          .filter((label): label is string => label !== null);

        const removedCount = results.length - removeFailedLabels.length;
        if (removedCount > 0) trackEvent(ANALYTICS_EVENTS.GROUP_MEMBER_REMOVED);
      }

      const failedLabels = [...failedGroupLabels, ...addFailedLabels, ...removeFailedLabels];
      if (failedLabels.length > 0) {
        toastWarning.generic(
          `${isEdit ? 'Group updated' : 'Group created'}, but couldn't apply: ${failedLabels.join(', ')}`
        );
      } else {
        toastSuccess.generic(isEdit ? 'Group updated' : 'Group created');
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
      <DialogContent data-testid="group-form-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit group' : 'Create group'}</DialogTitle>
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
            placeholder="Add group name"
            disabled={isSubmitting}
            autoFocus
          />
          {error && (
            <p data-testid="group-form-error" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="group-member-search-input">Add people, groups, or paste emails</Label>
          <GroupMemberSearch
            staging={memberStaging}
            disabled={isSubmitting}
            existingMemberRefs={isEdit ? existingMemberRefs : undefined}
            excludeGroupId={isEdit ? group?.id : undefined}
          />
        </div>
        {isEdit && !detailLoading && (
          <GroupExistingMembers
            members={existingMembers}
            pendingRemoveIds={pendingRemoveIds}
            onToggleRemove={handleToggleRemove}
            disabled={isSubmitting}
          />
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
            {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
