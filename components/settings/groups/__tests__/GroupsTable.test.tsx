import React from 'react';
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

  it('renders a row per group with name, member count, and shared count', () => {
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
    expect(screen.getByTestId('group-member-count-1')).toHaveTextContent('2');
    expect(screen.getByTestId('group-shared-count-1')).toHaveTextContent('3');
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
