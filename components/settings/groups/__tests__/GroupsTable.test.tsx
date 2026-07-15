import React from 'react';
import { format } from 'date-fns';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GroupsTable } from '../GroupsTable';
import { useRbac } from '@/lib/rbac';
import { createMockGroup } from './groups-mock-data';

jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({ getCurrentOrgUser: () => ({ email: 'asha@ngo.org' }) }),
}));

const mockUseRbac = useRbac as jest.Mock;

function setRbac({ canManage = true, isAdmin = false } = {}) {
  mockUseRbac.mockReturnValue({
    hasPermission: () => canManage,
    hasRole: () => isAdmin,
    role: isAdmin ? 'admin' : 'analyst',
    isLoaded: true,
    hasAnyPermission: () => canManage,
    hasAllPermissions: () => canManage,
  });
}

describe('GroupsTable', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders a row per group with name, member avatars, and shared count', () => {
    setRbac();
    const group = createMockGroup();
    render(
      <GroupsTable
        groups={[group]}
        isLoading={false}
        onView={jest.fn()}
        onRename={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    const row = screen.getByTestId('group-row-1');
    expect(row).toHaveTextContent('Funders');
    // Phase A / A2: members render as an avatar stack; the full count stays
    // accessible via aria-label
    const stack = screen.getByTestId('group-member-count-1');
    expect(stack).toHaveAccessibleName('2 members');
    expect(stack).toHaveTextContent('A'); // asha@ngo.org
    expect(stack).toHaveTextContent('M'); // meera@ngo.org
    expect(screen.getByTestId('group-shared-count-1')).toHaveTextContent('3');
  });

  it('shows a teal +N overflow when member_count exceeds the preview', () => {
    setRbac();
    const group = createMockGroup({
      member_count: 16,
      member_preview: ['a@ngo.org', 'b@ngo.org', 'c@ngo.org', 'd@ngo.org'],
    });
    render(
      <GroupsTable
        groups={[group]}
        isLoading={false}
        onView={jest.fn()}
        onRename={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    const stack = screen.getByTestId('group-member-count-1');
    expect(stack).toHaveTextContent('+12');
    expect(stack).toHaveAccessibleName('16 members');
  });

  it('shows the member count as plain text when the group has no preview', () => {
    setRbac();
    const group = createMockGroup({ member_count: 0, member_preview: [] });
    render(
      <GroupsTable
        groups={[group]}
        isLoading={false}
        onView={jest.fn()}
        onRename={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    expect(screen.getByTestId('group-member-count-1')).toHaveTextContent('0');
  });

  it('renders Created By (avatar + email) and Created date columns', () => {
    setRbac();
    const group = createMockGroup();
    render(
      <GroupsTable
        groups={[group]}
        isLoading={false}
        onView={jest.fn()}
        onRename={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    expect(screen.getByTestId('group-created-by-1')).toHaveTextContent('asha@ngo.org');
    // Same formatter as the component (local-time) — a literal like
    // 'Jan 1, 2026' would fail in negative-UTC timezones where the
    // midnight-UTC mock date lands on Dec 31 local time.
    expect(screen.getByTestId('group-created-at-1')).toHaveTextContent(
      format(new Date(group.created_at), 'MMM d, yyyy')
    );
  });

  it('shows a dash for Created By when the creator was deleted', () => {
    setRbac();
    const group = createMockGroup({ created_by: null });
    render(
      <GroupsTable
        groups={[group]}
        isLoading={false}
        onView={jest.fn()}
        onRename={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    expect(screen.getByTestId('group-created-by-1')).toHaveTextContent('—');
  });

  it('shows an empty state when there are no groups', () => {
    setRbac();
    render(
      <GroupsTable
        groups={[]}
        isLoading={false}
        onView={jest.fn()}
        onRename={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    expect(screen.getByTestId('groups-empty')).toBeInTheDocument();
  });

  it('opens the detail view on clicking a group name', async () => {
    setRbac();
    const user = userEvent.setup();
    const onView = jest.fn();
    const group = createMockGroup();
    render(
      <GroupsTable
        groups={[group]}
        isLoading={false}
        onView={onView}
        onRename={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    await user.click(screen.getByTestId('group-view-btn-1'));
    expect(onView).toHaveBeenCalledWith(group);
  });

  it('shows rename/delete actions for the group creator', () => {
    setRbac({ canManage: true, isAdmin: false });
    const group = createMockGroup({
      created_by: { orguser_id: 5, email: 'asha@ngo.org', name: 'Asha' },
    });
    render(
      <GroupsTable
        groups={[group]}
        isLoading={false}
        onView={jest.fn()}
        onRename={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    expect(screen.getByTestId('group-actions-1')).toBeInTheDocument();
  });

  it('shows rename/delete actions for an Admin even if not the creator', () => {
    setRbac({ canManage: true, isAdmin: true });
    const group = createMockGroup({
      created_by: { orguser_id: 99, email: 'someone.else@ngo.org', name: 'Someone' },
    });
    render(
      <GroupsTable
        groups={[group]}
        isLoading={false}
        onView={jest.fn()}
        onRename={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    expect(screen.getByTestId('group-actions-1')).toBeInTheDocument();
  });

  it('hides rename/delete actions for a non-creator, non-admin analyst', () => {
    setRbac({ canManage: true, isAdmin: false });
    const group = createMockGroup({
      created_by: { orguser_id: 99, email: 'someone.else@ngo.org', name: 'Someone' },
    });
    render(
      <GroupsTable
        groups={[group]}
        isLoading={false}
        onView={jest.fn()}
        onRename={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    expect(screen.queryByTestId('group-actions-1')).not.toBeInTheDocument();
  });

  it('calls onRename and onDelete from the actions menu', async () => {
    setRbac({ canManage: true, isAdmin: false });
    const user = userEvent.setup();
    const onRename = jest.fn();
    const onDelete = jest.fn();
    const group = createMockGroup();
    render(
      <GroupsTable
        groups={[group]}
        isLoading={false}
        onView={jest.fn()}
        onRename={onRename}
        onDelete={onDelete}
      />
    );

    await user.click(screen.getByTestId('group-actions-1'));
    await user.click(screen.getByTestId('group-rename-menu-item-1'));
    expect(onRename).toHaveBeenCalledWith(group);

    await user.click(screen.getByTestId('group-actions-1'));
    await user.click(screen.getByTestId('group-delete-menu-item-1'));
    expect(onDelete).toHaveBeenCalledWith(group);
  });
});
