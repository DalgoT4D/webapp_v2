import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GroupFormDialog } from '../GroupFormDialog';
import { addGroupMember, createGroup, renameGroup } from '@/hooks/api/useUserGroups';
import { useUsers } from '@/hooks/api/useUserManagement';
import { trackEvent } from '@/lib/analytics';
import { createMockGroup } from './groups-mock-data';

jest.mock('@/hooks/api/useUserGroups', () => ({
  ...jest.requireActual('@/hooks/api/useUserGroups'),
  createGroup: jest.fn(),
  renameGroup: jest.fn(),
  addGroupMember: jest.fn(),
}));
jest.mock('@/hooks/api/useUserManagement', () => ({
  ...jest.requireActual('@/hooks/api/useUserManagement'),
  useUsers: jest.fn(),
}));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/toast', () => ({
  toastSuccess: { generic: jest.fn() },
  toastWarning: { generic: jest.fn() },
}));

const mockCreateGroup = createGroup as jest.Mock;
const mockRenameGroup = renameGroup as jest.Mock;
const mockAddGroupMember = addGroupMember as jest.Mock;
const mockUseUsers = useUsers as jest.Mock;

const ORG_USERS = [
  { orguser_id: 10, email: 'asha@ngo.org' },
  { orguser_id: 11, email: 'meera@ngo.org' },
];

describe('GroupFormDialog — create mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUsers.mockReturnValue({ users: ORG_USERS, isLoading: false, mutate: jest.fn() });
  });

  it('creates a group and fires analytics on success', async () => {
    const user = userEvent.setup();
    const onSuccess = jest.fn();
    mockCreateGroup.mockResolvedValue(createMockGroup({ name: 'Funders' }));

    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={onSuccess} />);

    await user.type(screen.getByTestId('group-form-name-input'), 'Funders');
    await user.click(screen.getByTestId('group-form-submit-btn'));

    await waitFor(() => {
      expect(mockCreateGroup).toHaveBeenCalledWith({ name: 'Funders' });
      expect(onSuccess).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith('settings:group_created');
    });
  });

  it('shows the backend collision message inline, not as a generic toast', async () => {
    const user = userEvent.setup();
    mockCreateGroup.mockRejectedValue(
      new Error("a group named 'Funders' already exists in this org")
    );

    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);

    await user.type(screen.getByTestId('group-form-name-input'), 'Funders');
    await user.click(screen.getByTestId('group-form-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('group-form-error')).toHaveTextContent(
        "a group named 'Funders' already exists in this org"
      );
    });
  });

  it('disables submit when the name is blank', () => {
    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByTestId('group-form-submit-btn')).toBeDisabled();
  });

  it('still creates a group with no members selected (two-step path unaffected)', async () => {
    const user = userEvent.setup();
    const onSuccess = jest.fn();
    mockCreateGroup.mockResolvedValue(createMockGroup({ id: 1, name: 'Funders' }));

    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={onSuccess} />);

    await user.type(screen.getByTestId('group-form-name-input'), 'Funders');
    await user.click(screen.getByTestId('group-form-submit-btn'));

    await waitFor(() => {
      expect(mockCreateGroup).toHaveBeenCalledWith({ name: 'Funders' });
      expect(mockAddGroupMember).not.toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('creates a group and adds the selected existing org users in one step', async () => {
    const user = userEvent.setup();
    const onSuccess = jest.fn();
    mockCreateGroup.mockResolvedValue(createMockGroup({ id: 1, name: 'Funders' }));
    mockAddGroupMember.mockResolvedValue({
      id: 99,
      orguser_id: 10,
      email: 'asha@ngo.org',
      name: null,
      pending_email: null,
      status: 'active',
      role: null,
    });

    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={onSuccess} />);

    await user.type(screen.getByTestId('group-form-name-input'), 'Funders');
    await user.click(screen.getByTestId('group-form-members-combobox-search'));
    await user.click(screen.getByTestId('group-form-members-combobox-item-10'));
    await user.click(screen.getByTestId('group-form-submit-btn'));

    await waitFor(() => {
      expect(mockCreateGroup).toHaveBeenCalledWith({ name: 'Funders' });
      expect(mockAddGroupMember).toHaveBeenCalledWith(1, { orguser_id: 10 });
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('creates the group even when a member-add fails, and surfaces a partial-success warning naming the failures', async () => {
    const { toastWarning, toastSuccess } = jest.requireMock('@/lib/toast');
    const user = userEvent.setup();
    const onSuccess = jest.fn();
    mockCreateGroup.mockResolvedValue(createMockGroup({ id: 1, name: 'Funders' }));
    mockAddGroupMember.mockRejectedValue(new Error('orguser not found in this organization'));

    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={onSuccess} />);

    await user.type(screen.getByTestId('group-form-name-input'), 'Funders');
    await user.click(screen.getByTestId('group-form-members-combobox-search'));
    await user.click(screen.getByTestId('group-form-members-combobox-item-10'));
    await user.click(screen.getByTestId('group-form-submit-btn'));

    await waitFor(() => {
      // Group creation still succeeds and the dialog closes normally.
      expect(onSuccess).toHaveBeenCalled();
      expect(toastWarning.generic).toHaveBeenCalledWith(
        "Group created, but couldn't add: asha@ngo.org"
      );
      expect(toastSuccess.generic).not.toHaveBeenCalledWith('Group created');
    });
  });
});

describe('GroupFormDialog — rename mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUsers.mockReturnValue({ users: ORG_USERS, isLoading: false, mutate: jest.fn() });
  });

  it('does not show the member picker in rename mode', () => {
    const group = createMockGroup({ id: 7, name: 'Funders' });
    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} group={group} />);
    expect(screen.queryByTestId('group-form-members-combobox-search')).not.toBeInTheDocument();
  });

  it('pre-fills the current name and renames on submit', async () => {
    const user = userEvent.setup();
    const onSuccess = jest.fn();
    const group = createMockGroup({ id: 7, name: 'Funders' });
    mockRenameGroup.mockResolvedValue({ ...group, name: 'Major Funders' });

    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={onSuccess} group={group} />);

    const input = screen.getByTestId('group-form-name-input') as HTMLInputElement;
    expect(input.value).toBe('Funders');

    await user.clear(input);
    await user.type(input, 'Major Funders');
    await user.click(screen.getByTestId('group-form-submit-btn'));

    await waitFor(() => {
      expect(mockRenameGroup).toHaveBeenCalledWith(7, { name: 'Major Funders' });
      expect(onSuccess).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith('settings:group_renamed');
    });
  });
});
