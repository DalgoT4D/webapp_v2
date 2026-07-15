import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GroupFormDialog } from '../GroupFormDialog';
import {
  addGroupMember,
  createGroup,
  fetchGroupDetail,
  renameGroup,
  useUserGroups,
} from '@/hooks/api/useUserGroups';
import { useUsers } from '@/hooks/api/useUserManagement';
import { useRbac } from '@/lib/rbac';
import { trackEvent } from '@/lib/analytics';
import { createMockGroup, createMockGroupDetail } from './groups-mock-data';

jest.mock('@/hooks/api/useUserGroups', () => ({
  ...jest.requireActual('@/hooks/api/useUserGroups'),
  createGroup: jest.fn(),
  renameGroup: jest.fn(),
  addGroupMember: jest.fn(),
  fetchGroupDetail: jest.fn(),
  useUserGroups: jest.fn(),
}));
jest.mock('@/hooks/api/useUserManagement', () => ({
  ...jest.requireActual('@/hooks/api/useUserManagement'),
  useUsers: jest.fn(),
}));
jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/toast', () => ({
  toastSuccess: { generic: jest.fn() },
  toastWarning: { generic: jest.fn() },
}));

const mockCreateGroup = createGroup as jest.Mock;
const mockRenameGroup = renameGroup as jest.Mock;
const mockAddGroupMember = addGroupMember as jest.Mock;
const mockFetchGroupDetail = fetchGroupDetail as jest.Mock;
const mockUseUserGroups = useUserGroups as jest.Mock;
const mockUseUsers = useUsers as jest.Mock;
const mockUseRbac = useRbac as jest.Mock;

const NON_ADMIN_RBAC = {
  hasPermission: () => false,
  role: 'analyst',
  isLoaded: true,
  hasRole: () => false,
  hasAnyPermission: () => false,
  hasAllPermissions: () => false,
};

const ADMIN_RBAC = { ...NON_ADMIN_RBAC, role: 'admin', hasRole: () => true };

const ORG_USERS = [
  { orguser_id: 10, email: 'asha@ngo.org', new_role_slug: 'analyst' },
  { orguser_id: 11, email: 'meera@ngo.org', new_role_slug: 'member' },
];

const GROUPS = [
  {
    id: 5,
    name: 'Field staff',
    member_count: 2,
    shared_resource_count: 0,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    member_preview: [],
  },
];

function setUpHooks(rbac: typeof NON_ADMIN_RBAC = NON_ADMIN_RBAC) {
  mockUseUsers.mockReturnValue({ users: ORG_USERS, isLoading: false, mutate: jest.fn() });
  mockUseUserGroups.mockReturnValue({
    data: GROUPS,
    isLoading: false,
    isError: undefined,
    mutate: jest.fn(),
  });
  mockUseRbac.mockReturnValue(rbac);
}

function pasteIntoSearchInput(text: string) {
  const input = screen.getByTestId('group-member-search-input');
  fireEvent.paste(input, { clipboardData: { getData: () => text } });
}

describe('GroupFormDialog — create mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setUpHooks();
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

  it('still creates a group with no members staged (two-step path unaffected)', async () => {
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

  describe('typeahead', () => {
    it('browses org users and groups interleaved alphabetically on focus', async () => {
      const user = userEvent.setup();
      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);

      await user.click(screen.getByTestId('group-member-search-input'));

      // asha@ngo.org, "Field staff", meera@ngo.org — alphabetical merge, not
      // ShareModal's groups-first bucketing.
      const items = screen.getAllByTestId(/^group-member-search-(group|user)-/);
      expect(items.map((el) => el.getAttribute('data-testid'))).toEqual([
        'group-member-search-user-10',
        'group-member-search-group-5',
        'group-member-search-user-11',
      ]);
    });

    it('stages a user picked from the dropdown with their role tag', async () => {
      const user = userEvent.setup();
      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);

      await user.click(screen.getByTestId('group-member-search-input'));
      await user.click(screen.getByTestId('group-member-search-user-10'));

      const row = screen.getByTestId('group-member-staged-row-user-10');
      expect(row).toHaveTextContent('asha@ngo.org');
      expect(row).toHaveTextContent('Analyst');
    });

    it('stages a group with the "Group" tag, no permission control', async () => {
      const user = userEvent.setup();
      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);

      await user.click(screen.getByTestId('group-member-search-input'));
      await user.click(screen.getByTestId('group-member-search-group-5'));

      const row = screen.getByTestId('group-member-staged-row-group-5');
      expect(row).toHaveTextContent('Field staff');
      expect(row).toHaveTextContent('Group');
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('stages a pasted unknown email as an invite entry; a non-admin sees the locked Member-only copy, no picker', async () => {
      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);

      pasteIntoSearchInput('new.person@ngo.org');

      const row = screen.getByTestId('group-member-staged-row-email-new.person@ngo.org');
      expect(row).toHaveTextContent('new.person@ngo.org');
      expect(row).toHaveTextContent('New');
      expect(screen.getByTestId('group-member-invite-role-copy')).toHaveTextContent(
        "new.person@ngo.org isn't on Dalgo yet."
      );
      expect(screen.getByTestId('group-member-invite-role-block')).toHaveTextContent(
        'New member will be invited as member.'
      );
      expect(screen.queryByTestId('group-member-invite-role')).not.toBeInTheDocument();
    });

    it('an admin sees the "Invite new users as" role picker (design: "Assign new invites role before adding to group")', async () => {
      setUpHooks(ADMIN_RBAC);
      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);

      pasteIntoSearchInput('new.person@ngo.org');

      expect(screen.getByTestId('group-member-invite-role-block')).toHaveTextContent(
        'Assign new invites role before adding to group.'
      );
      expect(screen.getByTestId('group-member-invite-role')).toBeInTheDocument();
    });

    it('marks an invalid pasted token inline and keeps it out of the committable set', async () => {
      const user = userEvent.setup();
      mockCreateGroup.mockResolvedValue(createMockGroup({ id: 1, name: 'Funders' }));
      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);

      pasteIntoSearchInput('not-an-email,');
      expect(screen.getByTestId('group-member-staged-row-email-not-an-email')).toHaveAttribute(
        'data-status',
        'invalid'
      );

      await user.type(screen.getByTestId('group-form-name-input'), 'Funders');
      await user.click(screen.getByTestId('group-form-submit-btn'));

      await waitFor(() => expect(mockCreateGroup).toHaveBeenCalled());
      expect(mockAddGroupMember).not.toHaveBeenCalled();
    });

    it('removes a staged row', async () => {
      const user = userEvent.setup();
      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);

      await user.click(screen.getByTestId('group-member-search-input'));
      await user.click(screen.getByTestId('group-member-search-user-10'));
      expect(screen.getByTestId('group-member-staged-row-user-10')).toBeInTheDocument();

      await user.click(screen.getByTestId('group-member-staged-remove-user-10'));
      expect(screen.queryByTestId('group-member-staged-row-user-10')).not.toBeInTheDocument();
    });
  });

  describe('create commits all resolved rows', () => {
    it('creates the group and adds a staged user and a staged email', async () => {
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
        role: 'analyst',
      });

      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={onSuccess} />);

      await user.type(screen.getByTestId('group-form-name-input'), 'Funders');
      await user.click(screen.getByTestId('group-member-search-input'));
      await user.click(screen.getByTestId('group-member-search-user-10'));
      pasteIntoSearchInput('new.person@ngo.org');
      await user.click(screen.getByTestId('group-form-submit-btn'));

      await waitFor(() => {
        expect(mockCreateGroup).toHaveBeenCalledWith({ name: 'Funders' });
        expect(mockAddGroupMember).toHaveBeenCalledWith(1, { orguser_id: 10 });
        expect(mockAddGroupMember).toHaveBeenCalledWith(1, {
          email: 'new.person@ngo.org',
          invite_role: 'member',
        });
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('commits a typed-but-not-yet-staged email on a direct Create click (blur-stages before submit reads it)', async () => {
      const user = userEvent.setup();
      mockCreateGroup.mockResolvedValue(createMockGroup({ id: 1, name: 'Funders' }));
      mockAddGroupMember.mockResolvedValue({});

      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);

      await user.type(screen.getByTestId('group-form-name-input'), 'Funders');
      // Typed but never Enter/comma/paste-staged — Create is clicked directly.
      await user.type(screen.getByTestId('group-member-search-input'), 'typed@ngo.org');
      await user.click(screen.getByTestId('group-form-submit-btn'));

      await waitFor(() => {
        expect(mockAddGroupMember).toHaveBeenCalledWith(1, {
          email: 'typed@ngo.org',
          invite_role: 'member',
        });
      });
    });

    it('sends the admin-picked invite_role for a staged unknown email', async () => {
      const user = userEvent.setup();
      setUpHooks(ADMIN_RBAC);
      mockCreateGroup.mockResolvedValue(createMockGroup({ id: 1, name: 'Funders' }));
      mockAddGroupMember.mockResolvedValue({});

      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);

      await user.type(screen.getByTestId('group-form-name-input'), 'Funders');
      pasteIntoSearchInput('future-analyst@ngo.org');
      await user.click(screen.getByTestId('group-member-invite-role'));
      await user.click(screen.getByRole('option', { name: 'Analyst' }));
      await user.click(screen.getByTestId('group-form-submit-btn'));

      await waitFor(() => {
        expect(mockAddGroupMember).toHaveBeenCalledWith(1, {
          email: 'future-analyst@ngo.org',
          invite_role: 'analyst',
        });
      });
    });

    it('flattens a staged group to its current ACTIVE members, deduped against a directly-staged user', async () => {
      const user = userEvent.setup();
      mockCreateGroup.mockResolvedValue(createMockGroup({ id: 1, name: 'Funders' }));
      mockAddGroupMember.mockResolvedValue({});
      // Group 5's active members: orguser 10 (also staged directly below —
      // must be added only once) and orguser 20 (pending row must be
      // skipped — only active members flatten in).
      mockFetchGroupDetail.mockResolvedValue(
        createMockGroupDetail({
          id: 5,
          members: [
            {
              id: 1,
              orguser_id: 10,
              email: 'asha@ngo.org',
              name: 'Asha',
              pending_email: null,
              status: 'active',
              role: 'analyst',
            },
            {
              id: 2,
              orguser_id: 30,
              email: 'zafir@ngo.org',
              name: 'Zafir',
              pending_email: null,
              status: 'active',
              role: 'member',
            },
            {
              id: 3,
              orguser_id: null,
              email: null,
              name: null,
              pending_email: 'pending@ngo.org',
              status: 'pending',
              role: null,
            },
          ],
        })
      );

      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);

      await user.type(screen.getByTestId('group-form-name-input'), 'Funders');
      await user.click(screen.getByTestId('group-member-search-input'));
      await user.click(screen.getByTestId('group-member-search-user-10')); // direct
      await user.click(screen.getByTestId('group-member-search-input'));
      await user.click(screen.getByTestId('group-member-search-group-5')); // flattens to 10 (dup) + 30
      await user.click(screen.getByTestId('group-form-submit-btn'));

      await waitFor(() => {
        expect(mockFetchGroupDetail).toHaveBeenCalledWith(5);
        expect(mockAddGroupMember).toHaveBeenCalledTimes(2);
        expect(mockAddGroupMember).toHaveBeenCalledWith(1, { orguser_id: 10 });
        expect(mockAddGroupMember).toHaveBeenCalledWith(1, { orguser_id: 30 });
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
      await user.click(screen.getByTestId('group-member-search-input'));
      await user.click(screen.getByTestId('group-member-search-user-10'));
      await user.click(screen.getByTestId('group-form-submit-btn'));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
        expect(toastWarning.generic).toHaveBeenCalledWith(
          "Group created, but couldn't add: asha@ngo.org"
        );
        expect(toastSuccess.generic).not.toHaveBeenCalledWith('Group created');
      });
    });

    it("creates the group even when a staged group's flatten fetch fails, and surfaces a partial-success warning naming that group (not silent success)", async () => {
      const { toastWarning, toastSuccess } = jest.requireMock('@/lib/toast');
      const user = userEvent.setup();
      const onSuccess = jest.fn();
      mockCreateGroup.mockResolvedValue(createMockGroup({ id: 1, name: 'Funders' }));
      mockFetchGroupDetail.mockRejectedValue(new Error('group not found'));

      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={onSuccess} />);

      await user.type(screen.getByTestId('group-form-name-input'), 'Funders');
      await user.click(screen.getByTestId('group-member-search-input'));
      await user.click(screen.getByTestId('group-member-search-group-5')); // stages "Field staff"; flatten fetch will fail
      await user.click(screen.getByTestId('group-form-submit-btn'));

      await waitFor(() => {
        expect(mockFetchGroupDetail).toHaveBeenCalledWith(5);
        expect(onSuccess).toHaveBeenCalled();
        expect(mockAddGroupMember).not.toHaveBeenCalled();
        expect(toastWarning.generic).toHaveBeenCalledWith(
          "Group created, but couldn't add: Field staff"
        );
        expect(toastSuccess.generic).not.toHaveBeenCalledWith('Group created');
      });
    });
  });
});

describe('GroupFormDialog — rename mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setUpHooks();
  });

  it('does not show the member picker in rename mode', () => {
    const group = createMockGroup({ id: 7, name: 'Funders' });
    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} group={group} />);
    expect(screen.queryByTestId('group-member-search-input')).not.toBeInTheDocument();
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
