'use client';

import { useMemo, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import { useUserGroup, removeGroupMember } from '@/hooks/api/useUserGroups';
import { useUsers } from '@/hooks/api/useUserManagement';
import { ADMIN_ROLES, PERMISSIONS, useRbac } from '@/lib/rbac';
import { useAuthStore } from '@/stores/authStore';
import { toastSuccess, toastError } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

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
  const [selectedMemberEmail, setSelectedMemberEmail] = useState('');

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

  const candidateItems: ComboboxItem[] = useMemo(
    () =>
      (orgUsers || [])
        .filter((u) => !memberEmails.has(u.email))
        .map((u) => ({ value: u.email, label: u.email })),
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
                <span className="truncate">
                  {member.name || member.email || member.pending_email}
                  {member.status === 'pending' && (
                    <span className="ml-2 text-xs text-muted-foreground">(invite pending)</span>
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
                  value={selectedMemberEmail}
                  onValueChange={setSelectedMemberEmail}
                  placeholder="Select an org member"
                  searchPlaceholder="Search by email"
                  className="flex-1"
                />
                <Button data-testid="group-add-member-btn" disabled title="Coming soon">
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground" data-testid="group-add-member-hint">
                Adding members isn’t available yet — this needs a small backend update. Removing
                existing members works today.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
