import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GroupFormDialog } from '../GroupFormDialog';
import {
  addGroupMember,
  createGroup,
  fetchGroupDetail,
  removeGroupMember,
  renameGroup,
  useUserGroup,
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
  removeGroupMember: jest.fn(),
  fetchGroupDetail: jest.fn(),
  useUserGroups: jest.fn(),
  useUserGroup: jest.fn(),
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
const mockRemoveGroupMember = removeGroupMember as jest.Mock;
const mockFetchGroupDetail = fetchGroupDetail as jest.Mock;
const mockUseUserGroups = useUserGroups as jest.Mock;
const mockUseUserGroup = useUserGroup as jest.Mock;
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
  // Create mode never uses this (GroupFormDialog passes a null key), but the
  // hook is a jest.fn() so it needs SOME default return regardless of args.
  mockUseUserGroup.mockReturnValue({
    data: undefined,
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

  describe('typeahead — chips-in-input staging', () => {
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

    it('stages a user picked from the dropdown as a teal (internal) chip', async () => {
      const user = userEvent.setup();
      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);

      await user.click(screen.getByTestId('group-member-search-input'));
      await user.click(screen.getByTestId('group-member-search-user-10'));

      const chip = screen.getByTestId('group-member-staged-row-user-10');
      expect(chip).toHaveTextContent('asha@ngo.org');
      expect(chip).toHaveAttribute('data-chip-variant', 'internal');
    });

    it('stages a group as a teal (internal) chip, no permission control', async () => {
      const user = userEvent.setup();
      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);

      await user.click(screen.getByTestId('group-member-search-input'));
      await user.click(screen.getByTestId('group-member-search-group-5'));

      const chip = screen.getByTestId('group-member-staged-row-group-5');
      expect(chip).toHaveTextContent('Field staff');
      expect(chip).toHaveAttribute('data-chip-variant', 'internal');
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('stages a pasted unknown email as an amber (external) chip; a non-admin sees the locked Member-only copy, no picker', async () => {
      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);

      pasteIntoSearchInput('new.person@ngo.org');

      const chip = screen.getByTestId('group-member-staged-row-email-new.person@ngo.org');
      expect(chip).toHaveTextContent('new.person@ngo.org');
      expect(chip).toHaveAttribute('data-chip-variant', 'external');
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

    it('marks an invalid pasted token as an invalid (not amber) chip and keeps it out of the committable set', async () => {
      const user = userEvent.setup();
      mockCreateGroup.mockResolvedValue(createMockGroup({ id: 1, name: 'Funders' }));
      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);

      pasteIntoSearchInput('not-an-email,');
      const chip = screen.getByTestId('group-member-staged-row-email-not-an-email');
      expect(chip).toHaveAttribute('data-status', 'invalid');
      expect(chip).toHaveAttribute('data-chip-variant', 'invalid');

      await user.type(screen.getByTestId('group-form-name-input'), 'Funders');
      await user.click(screen.getByTestId('group-form-submit-btn'));

      await waitFor(() => expect(mockCreateGroup).toHaveBeenCalled());
      expect(mockAddGroupMember).not.toHaveBeenCalled();
    });

    it('removes a staged chip via its ✕', async () => {
      const user = userEvent.setup();
      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);

      await user.click(screen.getByTestId('group-member-search-input'));
      await user.click(screen.getByTestId('group-member-search-user-10'));
      expect(screen.getByTestId('group-member-staged-row-user-10')).toBeInTheDocument();

      await user.click(screen.getByTestId('group-member-staged-remove-user-10'));
      expect(screen.queryByTestId('group-member-staged-row-user-10')).not.toBeInTheDocument();
    });

    it('removes the last staged chip on Backspace with an empty query', async () => {
      const user = userEvent.setup();
      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);

      await user.click(screen.getByTestId('group-member-search-input'));
      await user.click(screen.getByTestId('group-member-search-user-10'));
      await user.click(screen.getByTestId('group-member-search-input'));
      await user.click(screen.getByTestId('group-member-search-group-5'));

      expect(screen.getByTestId('group-member-staged-row-user-10')).toBeInTheDocument();
      expect(screen.getByTestId('group-member-staged-row-group-5')).toBeInTheDocument();

      // Query is empty (nothing typed since the last pick) — Backspace pops
      // the most-recently-staged chip (the group), not the user staged first.
      await user.type(screen.getByTestId('group-member-search-input'), '{Backspace}');
      expect(screen.queryByTestId('group-member-staged-row-group-5')).not.toBeInTheDocument();
      expect(screen.getByTestId('group-member-staged-row-user-10')).toBeInTheDocument();
    });

    it('does not remove a chip on Backspace while the query still has text', async () => {
      const user = userEvent.setup();
      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);

      await user.click(screen.getByTestId('group-member-search-input'));
      await user.click(screen.getByTestId('group-member-search-user-10'));
      await user.type(screen.getByTestId('group-member-search-input'), 'me');
      await user.type(screen.getByTestId('group-member-search-input'), '{Backspace}');

      expect(screen.getByTestId('group-member-staged-row-user-10')).toBeInTheDocument();
    });
  });

  describe('typeahead — dropdown dismissal & duplicate guard (2026-07-16 manual-testing bugs)', () => {
    it('closes the dropdown after staging a typed email with Enter (it must not keep covering the invite-role block and footer)', async () => {
      const user = userEvent.setup();
      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);

      await user.click(screen.getByTestId('group-member-search-input'));
      expect(screen.getByTestId('group-member-search-results')).toBeInTheDocument();

      await user.type(screen.getByTestId('group-member-search-input'), 'new.person@ngo.org{Enter}');

      expect(
        screen.getByTestId('group-member-staged-row-email-new.person@ngo.org')
      ).toBeInTheDocument();
      expect(screen.queryByTestId('group-member-search-results')).not.toBeInTheDocument();
    });

    it('Escape closes only the dropdown first; a second Escape closes the dialog (no staged-work loss)', async () => {
      const user = userEvent.setup();
      const onOpenChange = jest.fn();
      render(<GroupFormDialog open onOpenChange={onOpenChange} onSuccess={jest.fn()} />);

      // Stage a chip first so the first Escape's "no staged-work loss" claim
      // is actually checked, not just implied by the dropdown assertion.
      await user.click(screen.getByTestId('group-member-search-input'));
      await user.click(screen.getByTestId('group-member-search-user-10'));
      expect(screen.getByTestId('group-member-staged-row-user-10')).toBeInTheDocument();

      await user.click(screen.getByTestId('group-member-search-input'));
      expect(screen.getByTestId('group-member-search-results')).toBeInTheDocument();

      await user.keyboard('{Escape}');
      expect(screen.queryByTestId('group-member-search-results')).not.toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByTestId('group-member-staged-row-user-10')).toBeInTheDocument();

      await user.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('typing reopens a dropdown closed by Escape', async () => {
      const user = userEvent.setup();
      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);

      await user.click(screen.getByTestId('group-member-search-input'));
      await user.keyboard('{Escape}');
      expect(screen.queryByTestId('group-member-search-results')).not.toBeInTheDocument();

      await user.type(screen.getByTestId('group-member-search-input'), 'as');
      expect(screen.getByTestId('group-member-search-results')).toBeInTheDocument();
    });

    it('repeat Enter on an already-staged email shows the inline hint, stages no duplicate chip, and the hint clears on new typing', async () => {
      const user = userEvent.setup();
      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);
      const input = screen.getByTestId('group-member-search-input');

      await user.type(input, 'new.person@ngo.org{Enter}');
      await user.type(input, 'new.person@ngo.org{Enter}');

      expect(screen.getByTestId('group-member-dup-hint')).toHaveTextContent(
        'new.person@ngo.org is already added'
      );
      expect(
        screen.getAllByTestId('group-member-staged-row-email-new.person@ngo.org')
      ).toHaveLength(1);

      await user.type(input, 'x');
      expect(screen.queryByTestId('group-member-dup-hint')).not.toBeInTheDocument();
    });

    it('a paste mixing one fresh email with one already-staged email stages only the fresh one and hints only the dupe', async () => {
      const user = userEvent.setup();
      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);
      const input = screen.getByTestId('group-member-search-input');

      await user.type(input, 'new.person@ngo.org{Enter}');
      pasteIntoSearchInput('new.person@ngo.org, fresh.person@ngo.org');

      expect(
        screen.getByTestId('group-member-staged-row-email-fresh.person@ngo.org')
      ).toBeInTheDocument();
      expect(
        screen.getAllByTestId('group-member-staged-row-email-new.person@ngo.org')
      ).toHaveLength(1);
      expect(screen.getByTestId('group-member-dup-hint')).toHaveTextContent(
        'new.person@ngo.org is already added'
      );
    });

    it('pasting the same new email twice in one batch (nothing pre-staged) stages a single chip and hints the repeat', async () => {
      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);

      pasteIntoSearchInput('dup.person@ngo.org, dup.person@ngo.org');

      expect(
        screen.getAllByTestId('group-member-staged-row-email-dup.person@ngo.org')
      ).toHaveLength(1);
      expect(screen.getByTestId('group-member-dup-hint')).toHaveTextContent(
        'dup.person@ngo.org is already added'
      );
    });

    it('disables the "Invite …" dropdown row with an Added tag when that email is already staged', async () => {
      const user = userEvent.setup();
      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);
      const input = screen.getByTestId('group-member-search-input');

      await user.type(input, 'new.person@ngo.org{Enter}');
      await user.type(input, 'new.person@ngo.org');

      const row = screen.getByTestId('group-member-search-add-email');
      expect(row).toBeDisabled();
      expect(row).toHaveTextContent('Added');
    });

    it('keeps an already-staged user unselectable (row disabled + Added) and Enter on that single match hints instead of silently ignoring', async () => {
      const user = userEvent.setup();
      render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);
      const input = screen.getByTestId('group-member-search-input');

      await user.click(input);
      await user.click(screen.getByTestId('group-member-search-user-10'));

      await user.click(input);
      const row = screen.getByTestId('group-member-search-user-10');
      expect(row).toBeDisabled();
      expect(row).toHaveTextContent('Added');

      // 'asha' matches only orguser 10 — Enter takes the single-match path,
      // which bypasses the disabled row.
      await user.type(input, 'asha{Enter}');
      expect(screen.getByTestId('group-member-dup-hint')).toHaveTextContent(
        'asha@ngo.org is already added'
      );
      expect(screen.getAllByTestId('group-member-staged-row-user-10')).toHaveLength(1);
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
          "Group created, but couldn't apply: asha@ngo.org"
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
          "Group created, but couldn't apply: Field staff"
        );
        expect(toastSuccess.generic).not.toHaveBeenCalledWith('Group created');
      });
    });
  });
});

describe('GroupFormDialog — edit mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setUpHooks();
  });

  function setUpEditDetail(overrides: Parameters<typeof createMockGroupDetail>[0] = {}) {
    const detail = createMockGroupDetail({ id: 7, name: 'Funders', ...overrides });
    mockUseUserGroup.mockReturnValue({
      data: detail,
      isLoading: false,
      isError: undefined,
      mutate: jest.fn(),
    });
    return detail;
  }

  it('shows the member typeahead AND the Existing Members section (replaces the old rename-only dialog)', () => {
    setUpEditDetail();
    const group = createMockGroup({ id: 7, name: 'Funders' });
    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} group={group} />);

    expect(screen.getByTestId('group-member-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('group-existing-members')).toBeInTheDocument();
    expect(screen.getByTestId('group-form-submit-btn')).toHaveTextContent('Save changes');
    expect(screen.getByText('Edit group')).toBeInTheDocument();
  });

  it('pre-fills the current name and loads existing members with role tags', () => {
    setUpEditDetail();
    const group = createMockGroup({ id: 7, name: 'Funders' });
    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} group={group} />);

    const input = screen.getByTestId('group-form-name-input') as HTMLInputElement;
    expect(input.value).toBe('Funders');

    // groups-mock-data.ts: member 10 = asha@ngo.org (analyst), 11 = meera@ngo.org (member)
    expect(screen.getByTestId('group-existing-member-10')).toHaveTextContent('asha@ngo.org');
    expect(screen.getByTestId('group-existing-member-role-10')).toHaveTextContent('Analyst');
    expect(screen.getByTestId('group-existing-member-11')).toHaveTextContent('meera@ngo.org');
    expect(screen.getByTestId('group-existing-member-role-11')).toHaveTextContent('Member');
  });

  it('shows a pending member with the Mail/"(invite pending)" treatment and no role tag', () => {
    setUpEditDetail({
      members: [
        {
          id: 20,
          orguser_id: null,
          email: null,
          name: null,
          pending_email: 'new.person@ngo.org',
          status: 'pending',
          role: null,
        },
      ],
    });
    const group = createMockGroup({ id: 7, name: 'Funders' });
    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} group={group} />);

    const row = screen.getByTestId('group-existing-member-20');
    expect(row).toHaveTextContent('new.person@ngo.org');
    expect(row).toHaveTextContent('(invite pending)');
    expect(screen.queryByTestId('group-existing-member-role-20')).not.toBeInTheDocument();
  });

  it('renames on submit only when the name actually changed', async () => {
    const user = userEvent.setup();
    const onSuccess = jest.fn();
    setUpEditDetail();
    const group = createMockGroup({ id: 7, name: 'Funders' });
    mockRenameGroup.mockResolvedValue({ ...group, name: 'Major Funders' });

    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={onSuccess} group={group} />);

    await user.clear(screen.getByTestId('group-form-name-input'));
    await user.type(screen.getByTestId('group-form-name-input'), 'Major Funders');
    await user.click(screen.getByTestId('group-form-submit-btn'));

    await waitFor(() => {
      expect(mockRenameGroup).toHaveBeenCalledWith(7, { name: 'Major Funders' });
      expect(onSuccess).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith('settings:group_renamed');
    });
  });

  it('skips the rename call when the name is unchanged (avoids a self-collision)', async () => {
    const user = userEvent.setup();
    const onSuccess = jest.fn();
    setUpEditDetail();
    const group = createMockGroup({ id: 7, name: 'Funders' });

    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={onSuccess} group={group} />);
    await user.click(screen.getByTestId('group-form-submit-btn'));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(mockRenameGroup).not.toHaveBeenCalled();
  });

  it('shows the backend collision message inline on rename', async () => {
    const user = userEvent.setup();
    setUpEditDetail();
    const group = createMockGroup({ id: 7, name: 'Funders' });
    mockRenameGroup.mockRejectedValue(
      new Error("a group named 'Major Funders' already exists in this org")
    );

    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} group={group} />);
    await user.clear(screen.getByTestId('group-form-name-input'));
    await user.type(screen.getByTestId('group-form-name-input'), 'Major Funders');
    await user.click(screen.getByTestId('group-form-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('group-form-error')).toHaveTextContent(
        "a group named 'Major Funders' already exists in this org"
      );
    });
  });

  it('stages a member removal without calling removeGroupMember until Save', async () => {
    const user = userEvent.setup();
    setUpEditDetail();
    const group = createMockGroup({ id: 7, name: 'Funders' });

    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} group={group} />);

    await user.click(screen.getByTestId('group-existing-member-remove-11'));

    // Hidden from the visible list immediately (the ✕ click's feedback)...
    expect(screen.queryByTestId('group-existing-member-11')).not.toBeInTheDocument();
    // ...but nothing hit the backend yet — Cancel would discard this for free.
    expect(mockRemoveGroupMember).not.toHaveBeenCalled();
  });

  it('commits a staged removal on Save, tracks analytics, and leaves other members alone', async () => {
    const user = userEvent.setup();
    const onSuccess = jest.fn();
    setUpEditDetail();
    mockRemoveGroupMember.mockResolvedValue(undefined);
    const group = createMockGroup({ id: 7, name: 'Funders' });

    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={onSuccess} group={group} />);

    await user.click(screen.getByTestId('group-existing-member-remove-11'));
    await user.click(screen.getByTestId('group-form-submit-btn'));

    await waitFor(() => {
      expect(mockRemoveGroupMember).toHaveBeenCalledWith(7, 11);
      expect(mockRemoveGroupMember).not.toHaveBeenCalledWith(7, 10);
      expect(trackEvent).toHaveBeenCalledWith('settings:group_member_removed');
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('applies a rename, a new member add, and a staged removal together in one Save', async () => {
    const user = userEvent.setup();
    const onSuccess = jest.fn();
    setUpEditDetail();
    // ORG_USERS' asha/meera are already existing members of this group (see
    // groups-mock-data.ts) and so the dropdown correctly disables them — use
    // a third org user who ISN'T already a member to exercise the "add".
    mockUseUsers.mockReturnValue({
      users: [...ORG_USERS, { orguser_id: 12, email: 'ravi@ngo.org', new_role_slug: 'analyst' }],
      isLoading: false,
      mutate: jest.fn(),
    });
    mockRenameGroup.mockResolvedValue(createMockGroup({ id: 7, name: 'Major Funders' }));
    mockAddGroupMember.mockResolvedValue({
      id: 99,
      orguser_id: 12,
      email: 'ravi@ngo.org',
      name: null,
      pending_email: null,
      status: 'active',
      role: 'analyst',
    });
    mockRemoveGroupMember.mockResolvedValue(undefined);
    const group = createMockGroup({ id: 7, name: 'Funders' });

    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={onSuccess} group={group} />);

    await user.clear(screen.getByTestId('group-form-name-input'));
    await user.type(screen.getByTestId('group-form-name-input'), 'Major Funders');
    // Add a brand-new person via the typeahead.
    await user.click(screen.getByTestId('group-member-search-input'));
    await user.click(screen.getByTestId('group-member-search-user-12'));
    // Remove an existing member.
    await user.click(screen.getByTestId('group-existing-member-remove-10'));
    await user.click(screen.getByTestId('group-form-submit-btn'));

    await waitFor(() => {
      expect(mockRenameGroup).toHaveBeenCalledWith(7, { name: 'Major Funders' });
      expect(mockAddGroupMember).toHaveBeenCalledWith(7, { orguser_id: 12 });
      expect(mockRemoveGroupMember).toHaveBeenCalledWith(7, 10);
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('excludes the group being edited from its own add-members dropdown', async () => {
    const user = userEvent.setup();
    setUpEditDetail();
    // Editing group 5 ("Field staff") itself — it must not offer itself.
    const group = createMockGroup({ id: 5, name: 'Field staff' });
    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} group={group} />);

    await user.click(screen.getByTestId('group-member-search-input'));
    expect(screen.queryByTestId('group-member-search-group-5')).not.toBeInTheDocument();
  });

  it("typing an existing member's email hints 'already in this group' and stages no re-add chip", async () => {
    const user = userEvent.setup();
    // Existing member asha@ngo.org / orguser 10 (groups-mock-data.ts).
    setUpEditDetail();
    const group = createMockGroup({ id: 7, name: 'Funders' });
    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} group={group} />);

    await user.type(screen.getByTestId('group-member-search-input'), 'asha@ngo.org{Enter}');

    expect(screen.getByTestId('group-member-dup-hint')).toHaveTextContent(
      'asha@ngo.org is already in this group'
    );
    expect(screen.queryByTestId('group-member-staged-row-user-10')).not.toBeInTheDocument();
  });

  it('disables an already-existing member in the add-members dropdown instead of offering it again', async () => {
    const user = userEvent.setup();
    // Existing member 10 IS asha@ngo.org / orguser 10 (groups-mock-data.ts).
    setUpEditDetail();
    const group = createMockGroup({ id: 7, name: 'Funders' });
    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} group={group} />);

    await user.click(screen.getByTestId('group-member-search-input'));
    const row = screen.getByTestId('group-member-search-user-10');
    expect(row).toBeDisabled();
  });
});
