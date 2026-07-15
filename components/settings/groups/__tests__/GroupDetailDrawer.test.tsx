import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GroupDetailDrawer } from '../GroupDetailDrawer';
import { useUserGroup, removeGroupMember, addGroupMember } from '@/hooks/api/useUserGroups';
import { useUsers } from '@/hooks/api/useUserManagement';
import { useRbac } from '@/lib/rbac';
import { trackEvent } from '@/lib/analytics';
import { createMockGroupDetail } from './groups-mock-data';

jest.mock('@/hooks/api/useUserGroups', () => ({
  ...jest.requireActual('@/hooks/api/useUserGroups'),
  useUserGroup: jest.fn(),
  removeGroupMember: jest.fn(),
  addGroupMember: jest.fn(),
}));
jest.mock('@/hooks/api/useUserManagement');
jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({ getCurrentOrgUser: () => ({ email: 'asha@ngo.org' }) }),
}));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/toast', () => ({
  toastSuccess: { generic: jest.fn() },
  toastError: { api: jest.fn() },
}));

const mockUseUserGroup = useUserGroup as jest.Mock;
const mockUseUsers = useUsers as jest.Mock;
const mockUseRbac = useRbac as jest.Mock;
const mockRemoveGroupMember = removeGroupMember as jest.Mock;
const mockAddGroupMember = addGroupMember as jest.Mock;

function setup({
  canManage = true,
  isAdmin = false,
  group = createMockGroupDetail(),
  mutate = jest.fn(),
} = {}) {
  mockUseUserGroup.mockReturnValue({ data: group, isLoading: false, isError: undefined, mutate });
  mockUseUsers.mockReturnValue({ users: [{ orguser_id: 42, email: 'new.person@ngo.org' }] });
  mockUseRbac.mockReturnValue({
    hasPermission: () => canManage,
    hasRole: () => isAdmin,
    role: isAdmin ? 'admin' : 'analyst',
    isLoaded: true,
    hasAnyPermission: () => canManage,
    hasAllPermissions: () => canManage,
  });
  return { mutate };
}

describe('GroupDetailDrawer', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists members by name', () => {
    setup();
    render(
      <GroupDetailDrawer
        groupId={1}
        open
        onOpenChange={jest.fn()}
        onGroupsListChanged={jest.fn()}
      />
    );
    expect(screen.getByTestId('group-member-row-10')).toHaveTextContent('Asha Kumar');
    expect(screen.getByTestId('group-member-row-11')).toHaveTextContent('Meera Das');
  });

  it('shows the add-member picker with Add disabled until a member is selected', () => {
    setup({ canManage: true, isAdmin: false });
    render(
      <GroupDetailDrawer
        groupId={1}
        open
        onOpenChange={jest.fn()}
        onGroupsListChanged={jest.fn()}
      />
    );
    expect(screen.getByTestId('group-add-member-btn')).toBeDisabled();
    expect(screen.queryByTestId('group-add-member-hint')).not.toBeInTheDocument();
  });

  it('adds a member via addGroupMember with the selected orguser_id', async () => {
    const user = userEvent.setup();
    const { mutate } = setup({ canManage: true, isAdmin: false });
    mockAddGroupMember.mockResolvedValue({
      id: 12,
      orguser_id: 42,
      email: 'new.person@ngo.org',
      name: null,
      pending_email: null,
      status: 'active',
    });
    const onGroupsListChanged = jest.fn();

    render(
      <GroupDetailDrawer
        groupId={1}
        open
        onOpenChange={jest.fn()}
        onGroupsListChanged={onGroupsListChanged}
      />
    );

    await user.click(screen.getByTestId('group-add-member-combobox-input'));
    await user.click(screen.getByTestId('group-add-member-combobox-item-42'));
    await user.click(screen.getByTestId('group-add-member-btn'));

    await waitFor(() => {
      expect(mockAddGroupMember).toHaveBeenCalledWith(1, { orguser_id: 42 });
      expect(mutate).toHaveBeenCalled();
      expect(onGroupsListChanged).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith('settings:group_member_added');
    });
  });

  it('removes a member and revalidates on click for a manager', async () => {
    const user = userEvent.setup();
    const { mutate } = setup({ canManage: true, isAdmin: false });
    mockRemoveGroupMember.mockResolvedValue(undefined);
    const onGroupsListChanged = jest.fn();

    render(
      <GroupDetailDrawer
        groupId={1}
        open
        onOpenChange={jest.fn()}
        onGroupsListChanged={onGroupsListChanged}
      />
    );

    await user.click(screen.getByTestId('group-member-remove-11'));

    await waitFor(() => {
      expect(mockRemoveGroupMember).toHaveBeenCalledWith(1, 11);
      expect(mutate).toHaveBeenCalled();
      expect(onGroupsListChanged).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith('settings:group_member_removed');
    });
  });

  it('renders a read-only view — no remove/add controls — for a non-creator, non-admin member', () => {
    setup({ canManage: false, isAdmin: false });
    render(
      <GroupDetailDrawer
        groupId={1}
        open
        onOpenChange={jest.fn()}
        onGroupsListChanged={jest.fn()}
      />
    );
    expect(screen.queryByTestId('group-member-remove-10')).not.toBeInTheDocument();
    expect(screen.queryByTestId('group-add-member-btn')).not.toBeInTheDocument();
    // Still shows who the members are
    expect(screen.getByTestId('group-member-row-10')).toHaveTextContent('Asha Kumar');
  });

  it("renders read-only for an analyst with can_manage_user_groups who is not this group's creator", () => {
    const group = createMockGroupDetail({
      created_by: { orguser_id: 99, email: 'someone.else@ngo.org', name: 'Someone Else' },
    });
    setup({ canManage: true, isAdmin: false, group });
    render(
      <GroupDetailDrawer
        groupId={1}
        open
        onOpenChange={jest.fn()}
        onGroupsListChanged={jest.fn()}
      />
    );
    expect(screen.queryByTestId('group-member-remove-10')).not.toBeInTheDocument();
    expect(screen.queryByTestId('group-add-member-btn')).not.toBeInTheDocument();
  });

  it('lets an Admin manage a group they did not create', () => {
    const group = createMockGroupDetail({
      created_by: { orguser_id: 99, email: 'someone.else@ngo.org', name: 'Someone Else' },
    });
    setup({ canManage: true, isAdmin: true, group });
    render(
      <GroupDetailDrawer
        groupId={1}
        open
        onOpenChange={jest.fn()}
        onGroupsListChanged={jest.fn()}
      />
    );
    expect(screen.getByTestId('group-member-remove-10')).toBeInTheDocument();
  });
});

describe('GroupDetailDrawer — member role badges (F5)', () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows each active member's org-role as a badge", () => {
    setup();
    render(
      <GroupDetailDrawer
        groupId={1}
        open
        onOpenChange={jest.fn()}
        onGroupsListChanged={jest.fn()}
      />
    );
    // groups-mock-data.ts: asha@ngo.org = analyst, meera@ngo.org = member
    expect(screen.getByTestId('group-member-role-10')).toHaveTextContent('Analyst');
    expect(screen.getByTestId('group-member-role-11')).toHaveTextContent('Member');
  });

  it('shows no role badge, only "(invite pending)", for a pending member', () => {
    const group = createMockGroupDetail({
      members: [
        {
          id: 12,
          orguser_id: null,
          email: null,
          name: null,
          pending_email: 'new.person@ngo.org',
          status: 'pending',
          role: null,
        },
      ],
    });
    setup({ group });
    render(
      <GroupDetailDrawer
        groupId={1}
        open
        onOpenChange={jest.fn()}
        onGroupsListChanged={jest.fn()}
      />
    );
    const row = screen.getByTestId('group-member-row-12');
    expect(row).toHaveTextContent('(invite pending)');
    expect(screen.queryByTestId('group-member-role-12')).not.toBeInTheDocument();
  });
});
