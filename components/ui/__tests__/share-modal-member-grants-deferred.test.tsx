/**
 * ShareModal — M5/M3a member-block states for member-grants-deferred rtypes
 * (metric/kpi from M5; chart joins here in v1.1 M3a).
 * Direct grants to a Member principal, and Member-role email invites, are
 * blocked server-side (`sharing_actions._reject_member_principal` /
 * `_reject_member_invite`); this suite pins the modal's presentational
 * mirror of that rule:
 *  - the add-people typeahead hides Member-role org users entirely
 *  - the unknown-email invite role picker never offers "Member"
 *  - the non-admin explanatory copy differs from the dashboard/report/alert
 *    "will be invited as member" default
 *
 * A parallel `dashboard` render in each test proves the SAME modal code
 * stays unaffected for rtypes outside the deferred set — the regression
 * guard the M5 brief asked for.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareModal } from '@/components/ui/share-modal';
import {
  useResourceAccess,
  type ResourceAccessOverview,
  type ShareableResourceType,
} from '@/hooks/api/useResourceAccess';
import { useUsers } from '@/hooks/api/useUserManagement';
import { useUserGroups, type UserGroup } from '@/hooks/api/useUserGroups';
import { useRbac } from '@/lib/rbac';

jest.mock('@/hooks/api/useResourceAccess');
jest.mock('@/hooks/api/useUserManagement');
jest.mock('@/hooks/api/useUserGroups', () => ({
  ...jest.requireActual('@/hooks/api/useUserGroups'),
  useUserGroups: jest.fn(),
}));
jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/toast', () => ({
  toastSuccess: { generic: jest.fn() },
  toastError: { share: jest.fn(), load: jest.fn(), api: jest.fn() },
  toastInfo: { generic: jest.fn() },
}));
jest.mock('@/lib/clipboard', () => ({
  copyUrlToClipboard: jest.fn().mockResolvedValue(undefined),
}));

const mockUseResourceAccess = useResourceAccess as jest.Mock;
const mockUseUsers = useUsers as jest.Mock;
const mockUseUserGroups = useUserGroups as jest.Mock;
const mockUseRbac = useRbac as jest.Mock;

const mockGroups: UserGroup[] = [];

// One Analyst, one Member — the Member row is the thing under test.
const mockOrgUsers = [
  { orguser_id: 42, email: 'priya.analyst@ngo.org', new_role_slug: 'analyst' },
  { orguser_id: 9, email: 'sam.member@ngo.org', new_role_slug: 'member' },
];

function baseOverview(entityType: ShareableResourceType): ResourceAccessOverview {
  return {
    resource_type: entityType,
    resource_id: '1',
    capabilities: {
      general: true,
      grants: true,
      public_link: entityType === 'dashboard',
      requests: true,
    },
    owner: { orguser_id: 1, email: 'asha@ngo.org', name: 'Asha Kumar' },
    general_access: { analyst_level: 'view', member_level: 'view' },
    grants: [],
    viewer: { effective_permission: 'edit', is_owner: true },
  };
}

function renderModal(
  entityType: ShareableResourceType,
  { isAdmin = true }: { isAdmin?: boolean } = {}
) {
  mockUseResourceAccess.mockReturnValue({
    data: baseOverview(entityType),
    isLoading: false,
    isError: undefined,
    mutate: jest.fn(),
  });
  mockUseUsers.mockReturnValue({ users: mockOrgUsers, isLoading: false });
  mockUseUserGroups.mockReturnValue({
    data: mockGroups,
    isLoading: false,
    isError: undefined,
    mutate: jest.fn(),
  });
  mockUseRbac.mockReturnValue({
    hasPermission: () => true,
    role: isAdmin ? 'admin' : 'analyst',
    isLoaded: true,
    hasRole: () => isAdmin,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
  });

  render(
    <ShareModal
      entityId={1}
      entityLabel={entityType}
      entityType={entityType}
      isOpen
      onClose={jest.fn()}
      getShareStatus={jest.fn().mockResolvedValue({ is_public: false, public_access_count: 0 })}
      updateSharing={jest.fn()}
    />
  );
}

describe.each(['metric', 'kpi', 'chart'] as const)(
  'ShareModal — member-block typeahead for %s (member-grants-deferred)',
  (entityType) => {
    beforeEach(() => jest.clearAllMocks());

    it('hides the Member-role org user from the browse/typeahead list', async () => {
      const user = userEvent.setup();
      renderModal(entityType);

      await user.click(screen.getByTestId('share-search-input'));

      expect(screen.getByTestId('share-search-user-42')).toBeInTheDocument(); // Analyst
      expect(screen.queryByTestId('share-search-user-9')).not.toBeInTheDocument(); // Member
    });

    it('never offers "Member" in the admin invite-role Select for an unknown email', async () => {
      const user = userEvent.setup();
      renderModal(entityType);

      await user.type(screen.getByTestId('share-search-input'), 'new.person@ngo.org');
      await user.keyboard('{Enter}');

      const roleSelect = screen.getByTestId('share-invite-role');
      await user.click(roleSelect);
      expect(screen.queryByRole('option', { name: 'Member' })).not.toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Analyst' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Admin' })).toBeInTheDocument();
    });

    it('defaults the invite role to Analyst, not Member', async () => {
      const user = userEvent.setup();
      renderModal(entityType);

      await user.type(screen.getByTestId('share-search-input'), 'new.person@ngo.org');
      await user.keyboard('{Enter}');

      expect(screen.getByTestId('share-invite-role')).toHaveTextContent('Analyst');
    });

    it('shows the non-admin explanatory copy instead of promising a Member invite', async () => {
      const user = userEvent.setup();
      renderModal(entityType, { isAdmin: false });

      await user.type(screen.getByTestId('share-search-input'), 'new.person@ngo.org');
      await user.keyboard('{Enter}');

      const note = screen.getByTestId('share-invite-role-note');
      expect(note).toHaveTextContent(/can't be invited directly/i);
      expect(note).not.toHaveTextContent(/invited as member/i);
      // Non-admins never see the role Select for any rtype.
      expect(screen.queryByTestId('share-invite-role')).not.toBeInTheDocument();
    });
  }
);

describe('ShareModal — dashboard (NOT member-grants-deferred) stays unaffected', () => {
  beforeEach(() => jest.clearAllMocks());

  it('still lists the Member-role org user in the typeahead', async () => {
    const user = userEvent.setup();
    renderModal('dashboard');

    await user.click(screen.getByTestId('share-search-input'));

    expect(screen.getByTestId('share-search-user-42')).toBeInTheDocument();
    expect(screen.getByTestId('share-search-user-9')).toBeInTheDocument(); // Member still shown
  });

  it('still offers "Member" in the admin invite-role Select and defaults to it', async () => {
    const user = userEvent.setup();
    renderModal('dashboard');

    await user.type(screen.getByTestId('share-search-input'), 'new.person@ngo.org');
    await user.keyboard('{Enter}');

    expect(screen.getByTestId('share-invite-role')).toHaveTextContent('Member');
    await user.click(screen.getByTestId('share-invite-role'));
    expect(screen.getByRole('option', { name: 'Member' })).toBeInTheDocument();
  });

  it('shows the plain "will be invited as member" copy for non-admins', async () => {
    const user = userEvent.setup();
    renderModal('dashboard', { isAdmin: false });

    await user.type(screen.getByTestId('share-search-input'), 'new.person@ngo.org');
    await user.keyboard('{Enter}');

    expect(screen.getByTestId('share-invite-role-note')).toHaveTextContent(/invited as member/i);
  });
});
