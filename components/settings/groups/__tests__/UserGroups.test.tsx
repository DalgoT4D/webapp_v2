import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserGroups from '../UserGroups';
import { useUserGroups, useUserGroup } from '@/hooks/api/useUserGroups';
import { useUsers } from '@/hooks/api/useUserManagement';
import { useRbac } from '@/lib/rbac';
import { createMockGroup, createMockGroupDetail } from './groups-mock-data';

jest.mock('@/hooks/api/useUserGroups', () => ({
  ...jest.requireActual('@/hooks/api/useUserGroups'),
  useUserGroups: jest.fn(),
  useUserGroup: jest.fn(),
  createGroup: jest.fn(),
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
  toastError: { delete: jest.fn(), api: jest.fn() },
}));

const mockUseUserGroups = useUserGroups as jest.Mock;
const mockUseUserGroup = useUserGroup as jest.Mock;
const mockUseUsers = useUsers as jest.Mock;
const mockUseRbac = useRbac as jest.Mock;

function setup({ canManage = true, groups = [createMockGroup()] } = {}) {
  const mutate = jest.fn();
  mockUseUserGroups.mockReturnValue({ data: groups, isLoading: false, isError: undefined, mutate });
  mockUseUserGroup.mockReturnValue({
    data: createMockGroupDetail(),
    isLoading: false,
    isError: undefined,
    mutate: jest.fn(),
  });
  mockUseUsers.mockReturnValue({ users: [] });
  mockUseRbac.mockReturnValue({
    hasPermission: () => canManage,
    hasRole: () => false,
    role: 'analyst',
    isLoaded: true,
    hasAnyPermission: () => canManage,
    hasAllPermissions: () => canManage,
  });
  return { mutate };
}

describe('UserGroups page', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the groups table with counts', () => {
    setup();
    render(<UserGroups />);
    expect(screen.getByTestId('group-row-1')).toHaveTextContent('Funders');
    expect(screen.getByTestId('group-member-count-1')).toHaveTextContent('2');
    expect(screen.getByTestId('group-shared-count-1')).toHaveTextContent('3');
  });

  it('disables the create button when the viewer lacks can_manage_user_groups', () => {
    setup({ canManage: false });
    render(<UserGroups />);
    expect(screen.getByTestId('groups-create-btn')).toBeDisabled();
  });

  it('opens the create dialog and creates a group', async () => {
    const user = userEvent.setup();
    setup();
    render(<UserGroups />);

    await user.click(screen.getByTestId('groups-create-btn'));
    expect(screen.getByTestId('group-form-dialog')).toBeInTheDocument();
  });

  it('opens the detail drawer when a group name is clicked', async () => {
    const user = userEvent.setup();
    setup();
    render(<UserGroups />);

    await user.click(screen.getByTestId('group-view-btn-1'));
    await waitFor(() => {
      expect(screen.getByTestId('group-detail-drawer')).toBeInTheDocument();
    });
  });

  it('opens the delete confirmation from the row actions menu', async () => {
    const user = userEvent.setup();
    setup();
    render(<UserGroups />);

    await user.click(screen.getByTestId('group-actions-1'));
    await user.click(screen.getByTestId('group-delete-menu-item-1'));

    expect(screen.getByTestId('delete-group-dialog')).toBeInTheDocument();
  });
});
