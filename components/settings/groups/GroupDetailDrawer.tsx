'use client';

import { useMemo, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import { useUserGroup, removeGroupMember, addGroupMember } from '@/hooks/api/useUserGroups';
import { useUsers } from '@/hooks/api/useUserManagement';
import { ADMIN_ROLES, PERMISSIONS, useRbac } from '@/lib/rbac';
import { useAuthStore } from '@/stores/authStore';
import { toastSuccess, toastError } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { formatRoleLabel } from '@/lib/access-labels';

interface GroupDetailDrawerProps {
  groupId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Notifies the groups list to revalidate (member_count changed). */
  onGroupsListChanged: () => void;
}

export function GroupDetailDrawer({
  groupId,
  open,
  onOpenChange,
  onGroupsListChanged,
}: GroupDetailDrawerProps) {
  const { data: group, mutate } = useUserGroup(groupId);
  const { users: orgUsers } = useUsers();
  const { hasPermission, hasRole } = useRbac();
  const currentOrgUser = useAuthStore((state) => state.getCurrentOrgUser());
  const [selectedMemberId, setSelectedMemberId] = useState('');

  const canManage = Boolean(
    group &&
      hasPermission(PERMISSIONS.CAN_MANAGE_USER_GROUPS) &&
      (hasRole(ADMIN_ROLES) || group.created_by?.email === currentOrgUser?.email)
  );

  const memberEmails = useMemo(
    () =>
      new Set((group?.members ?? []).map((m) => m.email).filter((e): e is string => Boolean(e))),
    [group]
  );

  // Candidate value is the OrgUser PK (orguser_id) — what POST
  // /api/groups/{id}/members/ wants (Task 6b Part B). Org members without a
  // resolved orguser_id are excluded rather than offered as an unusable
  // candidate.
  const candidateItems: ComboboxItem[] = useMemo(
    () =>
      (orgUsers || [])
        .filter((u) => !memberEmails.has(u.email) && typeof u.orguser_id === 'number')
        .map((u) => ({ value: String(u.orguser_id), label: u.email })),
    [orgUsers, memberEmails]
  );

  const handleRemove = async (memberId: number) => {
    if (!group) return;
    try {
      await removeGroupMember(group.id, memberId);
      trackEvent(ANALYTICS_EVENTS.GROUP_MEMBER_REMOVED);
      toastSuccess.generic('Member removed');
      mutate();
      onGroupsListChanged();
    } catch (error) {
      toastError.api(error, 'remove this member');
    }
  };

  const handleAddMember = async () => {
    if (!group || !selectedMemberId) return;
    try {
      await addGroupMember(group.id, { orguser_id: Number(selectedMemberId) });
      trackEvent(ANALYTICS_EVENTS.GROUP_MEMBER_ADDED);
      toastSuccess.generic('Member added');
      setSelectedMemberId('');
      mutate();
      onGroupsListChanged();
    } catch (error) {
      toastError.api(error, 'add this member');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent data-testid="group-detail-drawer" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{group?.name ?? 'Group'}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4 space-y-4 overflow-y-auto">
          {group && !canManage && (
            <p data-testid="group-detail-readonly-hint" className="text-xs text-muted-foreground">
              Only {group.created_by?.name || group.created_by?.email || 'the creator'} or an Admin
              can manage this group.
            </p>
          )}

          <div className="space-y-2">
            {(group?.members ?? []).map((member) => (
              <div
                key={member.id}
                data-testid={`group-member-row-${member.id}`}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="truncate">
                    {member.name || member.email || member.pending_email}
                  </span>
                  {member.status === 'pending' ? (
                    <span className="text-xs text-muted-foreground shrink-0">(invite pending)</span>
                  ) : (
                    member.role && (
                      <Badge
                        variant="outline"
                        data-testid={`group-member-role-${member.id}`}
                        className="shrink-0"
                      >
                        {formatRoleLabel(member.role)}
                      </Badge>
                    )
                  )}
                </span>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${member.name || member.email}`}
                    data-testid={`group-member-remove-${member.id}`}
                    onClick={() => handleRemove(member.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            {group && group.members.length === 0 && (
              <p className="text-xs text-muted-foreground">No members yet.</p>
            )}
          </div>

          {canManage && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">Add a member</span>
              </div>
              <div className="flex gap-2">
                <Combobox
                  id="group-add-member-combobox"
                  items={candidateItems}
                  value={selectedMemberId}
                  onValueChange={setSelectedMemberId}
                  placeholder="Select an org member"
                  searchPlaceholder="Search by email"
                  className="flex-1"
                />
                <Button
                  data-testid="group-add-member-btn"
                  onClick={handleAddMember}
                  disabled={!selectedMemberId}
                >
                  Add
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
