/**
 * ShareModal tests for the entityType-driven People-with-access section
 * (backed by /api/access/*). The legacy prop-driven public-link-only path is
 * covered separately in components/reports/__tests__/ReportShareModal.test.tsx
 * and must keep passing unmodified — entityType is optional.
 *
 * General access has no single-resource UI in this modal at all (design
 * decision — it appears in no RBAC frame): it's settable only via the bulk
 * action (components/sharing/bulk-share-dialog.tsx) or the API directly.
 */
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareModal } from '@/components/ui/share-modal';
import {
  useResourceAccess,
  addGrant,
  removeGrant,
  type ResourceAccessOverview,
} from '@/hooks/api/useResourceAccess';
import { useUsers } from '@/hooks/api/useUserManagement';
import { useRbac } from '@/lib/rbac';
import { trackEvent } from '@/lib/analytics';

jest.mock('@/hooks/api/useResourceAccess');
jest.mock('@/hooks/api/useUserManagement');
jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/toast', () => ({
  toastSuccess: { generic: jest.fn() },
  toastError: { share: jest.fn(), load: jest.fn(), api: jest.fn() },
}));
jest.mock('@/lib/clipboard', () => ({
  copyUrlToClipboard: jest.fn().mockResolvedValue(undefined),
}));

const mockUseResourceAccess = useResourceAccess as jest.Mock;
const mockUseUsers = useUsers as jest.Mock;
const mockUseRbac = useRbac as jest.Mock;
const mockAddGrant = addGrant as jest.Mock;
const mockRemoveGrant = removeGrant as jest.Mock;

const baseOverview: ResourceAccessOverview = {
  resource_type: 'dashboard',
  resource_id: '1',
  capabilities: { general: true, grants: true, public_link: true, requests: true },
  owner: { orguser_id: 1, email: 'asha@ngo.org', name: 'Asha Kumar' },
  general_access: { analyst_level: 'view', member_level: 'view' },
  grants: [
    {
      id: 3,
      principal_type: 'user',
      principal_id: 9,
      email: 'meera@ngo.org',
      name: 'Meera Das',
      permission: 'view',
      status: 'active',
    },
  ],
  viewer: { effective_permission: 'edit', is_owner: false },
};

const mockGetShareStatus = jest
  .fn()
  .mockResolvedValue({ is_public: false, public_access_count: 0 });
const mockUpdateSharing = jest.fn();

function renderModal(
  overrides: Partial<ResourceAccessOverview> = {},
  canShareOverride = true,
  usersOverride?: { orguser_id: number; email: string; new_role_slug?: string }[]
) {
  mockUseResourceAccess.mockReturnValue({
    data: { ...baseOverview, ...overrides },
    isLoading: false,
    isError: undefined,
    mutate: jest.fn(),
  });
  mockUseUsers.mockReturnValue({
    users: usersOverride ?? [
      { orguser_id: 42, email: 'new.person@ngo.org', new_role_slug: 'analyst' },
      { orguser_id: 9, email: 'meera@ngo.org', new_role_slug: 'member' },
    ],
    isLoading: false,
  });
  mockUseRbac.mockReturnValue({
    hasPermission: () => canShareOverride,
    role: 'admin',
    isLoaded: true,
    hasRole: () => true,
    hasAnyPermission: () => canShareOverride,
    hasAllPermissions: () => canShareOverride,
  });

  return render(
    <ShareModal
      entityId={1}
      entityLabel="Dashboard"
      entityType="dashboard"
      isOpen
      onClose={jest.fn()}
      getShareStatus={mockGetShareStatus}
      updateSharing={mockUpdateSharing}
    />
  );
}

describe('ShareModal — People with access', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the owner row as plain text — no pill, no border, no permission control', () => {
    renderModal();
    const ownerRow = screen.getByTestId('share-owner-row');
    expect(ownerRow).toHaveTextContent('Asha Kumar');
    expect(ownerRow).toHaveTextContent('Owner');
    expect(screen.queryByTestId('share-grant-remove-1')).not.toBeInTheDocument();
    // Owner has no permission dropdown at all — plain text "Owner" only.
    expect(within(ownerRow).queryByRole('combobox')).not.toBeInTheDocument();
  });

  it("shows the owner's and each grantee's role tag joined from org users, and no tag for an unresolvable principal (a group)", () => {
    renderModal(
      {
        grants: [
          baseOverview.grants[0],
          {
            id: 5,
            principal_type: 'group',
            principal_id: 7,
            email: null,
            name: 'Funders',
            permission: 'view',
            status: 'active',
            member_count: 4,
          },
        ],
      },
      true,
      [
        { orguser_id: 1, email: 'asha@ngo.org', new_role_slug: 'admin' },
        { orguser_id: 42, email: 'new.person@ngo.org', new_role_slug: 'analyst' },
        { orguser_id: 9, email: 'meera@ngo.org', new_role_slug: 'member' },
      ]
    );

    expect(screen.getByTestId('share-owner-row')).toHaveTextContent('Admin');
    expect(screen.getByTestId('share-grant-row-3')).toHaveTextContent('Member');

    const groupRow = screen.getByTestId('share-grant-row-5');
    expect(groupRow).not.toHaveTextContent('Member');
    expect(groupRow).not.toHaveTextContent('Analyst');
    expect(groupRow).not.toHaveTextContent('Admin');
  });

  it('renders a row per active grant with a permission dropdown and remove button', () => {
    renderModal();
    const row = screen.getByTestId('share-grant-row-3');
    expect(row).toHaveTextContent('Meera Das');
    expect(screen.getByTestId('share-grant-permission-3')).toBeInTheDocument();
    expect(screen.getByTestId('share-grant-remove-3')).toBeInTheDocument();
  });

  it('renders pending grants with a working permission dropdown and remove button', () => {
    // Pending rows deliberately get the same permission dropdown as active
    // ones — changing it re-POSTs via the email path (covered in
    // share-modal-email-invite.test.tsx).
    renderModal({
      grants: [
        {
          id: 4,
          principal_type: 'user',
          principal_id: null,
          email: 'new.person@ngo.org',
          name: null,
          permission: 'view',
          status: 'pending',
        },
      ],
    });
    const row = screen.getByTestId('share-grant-row-4');
    expect(row).toHaveTextContent('new.person@ngo.org');
    expect(row).toHaveTextContent('invite pending');
    expect(screen.getByTestId('share-grant-permission-4')).toBeInTheDocument();
    // Still removable — DELETE only needs the grant id, not a resolved principal.
    expect(screen.getByTestId('share-grant-remove-4')).toBeInTheDocument();
  });

  it('opens a confirmation dialog on remove click without deleting yet', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId('share-grant-remove-3'));

    expect(screen.getByTestId('share-grant-remove-dialog-3')).toBeInTheDocument();
    expect(screen.getByText('Remove access')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Are you sure you want to remove access of "Meera Das"? This change cannot be undone.'
      )
    ).toBeInTheDocument();
    expect(mockRemoveGrant).not.toHaveBeenCalled();
  });

  it('does not remove the grant when the confirmation dialog is cancelled', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId('share-grant-remove-3'));
    await user.click(screen.getByTestId('share-grant-remove-cancel-3'));

    expect(screen.queryByTestId('share-grant-remove-dialog-3')).not.toBeInTheDocument();
    expect(mockRemoveGrant).not.toHaveBeenCalled();
  });

  it('removes a grant and revalidates when the confirmation dialog is confirmed', async () => {
    const user = userEvent.setup();
    mockRemoveGrant.mockResolvedValue(undefined);
    renderModal();

    await user.click(screen.getByTestId('share-grant-remove-3'));
    await user.click(screen.getByTestId('share-grant-remove-confirm-3'));

    await waitFor(() => {
      expect(mockRemoveGrant).toHaveBeenCalledWith('dashboard', 1, 3);
      expect(trackEvent).toHaveBeenCalledWith(
        'sharing:grant_removed',
        expect.objectContaining({ entity_type: 'dashboard' })
      );
    });
  });

  it('changes an existing grant permission via addGrant (upsert)', async () => {
    const user = userEvent.setup();
    mockAddGrant.mockResolvedValue({ ...baseOverview.grants[0], permission: 'edit' });
    renderModal();

    await user.click(screen.getByTestId('share-grant-permission-3'));
    await user.click(screen.getByRole('option', { name: 'Edit' }));

    await waitFor(() => {
      expect(mockAddGrant).toHaveBeenCalledWith('dashboard', 1, {
        principal_type: 'user',
        principal_id: 9,
        permission: 'edit',
      });
    });
  });

  it('shows the unified search with SHARE disabled while nothing is staged', () => {
    renderModal();
    expect(screen.getByTestId('share-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('share-commit-btn')).toBeDisabled();
  });

  it('stages an org user from the typeahead and SHARE commits it with the orguser_id', async () => {
    const user = userEvent.setup();
    mockAddGrant.mockResolvedValue({
      id: 7,
      principal_type: 'user',
      principal_id: 42,
      email: 'new.person@ngo.org',
      name: null,
      permission: 'view',
      status: 'active',
    });
    renderModal();

    await user.type(screen.getByTestId('share-search-input'), 'new.person');
    await user.click(screen.getByTestId('share-search-user-42'));

    // Staged, not applied: row shows with its role tag, nothing POSTed yet.
    const stagedRow = screen.getByTestId('share-staged-row-user-42');
    expect(stagedRow).toHaveTextContent('new.person@ngo.org');
    expect(stagedRow).toHaveTextContent('Analyst');
    expect(mockAddGrant).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('share-commit-btn'));

    await waitFor(() => {
      expect(mockAddGrant).toHaveBeenCalledWith('dashboard', 1, {
        principal_type: 'user',
        principal_id: 42,
        permission: 'view',
      });
      expect(trackEvent).toHaveBeenCalledWith(
        'sharing:grant_added',
        expect.objectContaining({ entity_type: 'dashboard', principal_type: 'user' })
      );
    });

    // Success clears the staged area and disables SHARE again.
    await waitFor(() => {
      expect(screen.queryByTestId('share-staged-row-user-42')).not.toBeInTheDocument();
      expect(screen.getByTestId('share-commit-btn')).toBeDisabled();
    });
  });

  it('commits a staged row at the permission picked on its pill', async () => {
    const user = userEvent.setup();
    mockAddGrant.mockResolvedValue({
      id: 7,
      principal_type: 'user',
      principal_id: 42,
      email: 'new.person@ngo.org',
      name: null,
      permission: 'edit',
      status: 'active',
    });
    renderModal();

    await user.type(screen.getByTestId('share-search-input'), 'new.person');
    await user.click(screen.getByTestId('share-search-user-42'));
    await user.click(screen.getByTestId('share-staged-permission-user-42'));
    await user.click(screen.getByRole('option', { name: 'Edit' }));
    await user.click(screen.getByTestId('share-commit-btn'));

    await waitFor(() => {
      expect(mockAddGrant).toHaveBeenCalledWith('dashboard', 1, {
        principal_type: 'user',
        principal_id: 42,
        permission: 'edit',
      });
    });
  });

  it('marks a person who already has access as unavailable in the typeahead', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId('share-search-input'), 'meera');

    const item = screen.getByTestId('share-search-user-9');
    expect(item).toBeDisabled();
    expect(item).toHaveTextContent('Already has access');
  });

  it('removes a staged row before commit, disabling SHARE again', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId('share-search-input'), 'new.person');
    await user.click(screen.getByTestId('share-search-user-42'));
    expect(screen.getByTestId('share-commit-btn')).toBeEnabled();

    await user.click(screen.getByTestId('share-staged-remove-user-42'));

    expect(screen.queryByTestId('share-staged-row-user-42')).not.toBeInTheDocument();
    expect(screen.getByTestId('share-commit-btn')).toBeDisabled();
    expect(mockAddGrant).not.toHaveBeenCalled();
  });

  it('hides add/remove/permission controls in read-only mode (viewer cannot share)', () => {
    renderModal({ viewer: { effective_permission: 'view', is_owner: false } }, false);
    expect(screen.queryByTestId('share-grant-remove-3')).not.toBeInTheDocument();
    expect(screen.queryByTestId('share-grant-permission-3')).not.toBeInTheDocument();
    expect(screen.queryByTestId('share-search-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('share-commit-btn')).not.toBeInTheDocument();
    // Read-only view still shows who has access
    expect(screen.getByTestId('share-grant-row-3')).toHaveTextContent('Meera Das');
  });
});

describe('ShareModal — capability-gated sections', () => {
  beforeEach(() => jest.clearAllMocks());

  it('hides the public-link section when capabilities.public_link is false', async () => {
    renderModal({
      capabilities: { general: true, grants: true, public_link: false, requests: true },
    });
    await waitFor(() => {
      expect(screen.queryByTestId('share-toggle')).not.toBeInTheDocument();
    });
  });

  it('hides the People section entirely when its capability flag is off', () => {
    renderModal({
      capabilities: { general: false, grants: false, public_link: true, requests: false },
    });
    expect(screen.queryByTestId('share-people-section')).not.toBeInTheDocument();
    // No grants capability → nothing can be staged → no footer SHARE either.
    expect(screen.queryByTestId('share-commit-btn')).not.toBeInTheDocument();
  });

  it('fires the modal-opened analytics event once per open', () => {
    renderModal();
    expect(trackEvent).toHaveBeenCalledWith(
      'sharing:modal_opened',
      expect.objectContaining({ entity_type: 'dashboard' })
    );
  });
});

describe('ShareModal — entityType="alert" (task-17f per-item Share, cross-task gap closure)', () => {
  // Alerts are public_link=False — the same capability gate pinned above
  // hides the section, exercised here through the real alert path.
  beforeEach(() => jest.clearAllMocks());

  it('opens with alert rtype, hides the public-link section, and still shows People with access', async () => {
    mockUseResourceAccess.mockReturnValue({
      data: {
        ...baseOverview,
        resource_type: 'alert',
        capabilities: { general: true, grants: true, public_link: false, requests: true },
      },
      isLoading: false,
      isError: undefined,
      mutate: jest.fn(),
    });
    mockUseUsers.mockReturnValue({
      users: [{ orguser_id: 42, email: 'new.person@ngo.org' }],
      isLoading: false,
    });
    mockUseRbac.mockReturnValue({
      hasPermission: () => true,
      role: 'admin',
      isLoaded: true,
      hasRole: () => true,
      hasAnyPermission: () => true,
      hasAllPermissions: () => true,
    });

    render(
      <ShareModal
        entityId={1}
        entityLabel="Alert"
        entityType="alert"
        isOpen
        onClose={jest.fn()}
        getShareStatus={mockGetShareStatus}
        updateSharing={mockUpdateSharing}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('share-toggle')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('share-people-section')).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith(
      'sharing:modal_opened',
      expect.objectContaining({ entity_type: 'alert' })
    );
  });
});
