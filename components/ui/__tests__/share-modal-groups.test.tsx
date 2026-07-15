/**
 * ShareModal tests for the Groups source in the add-principal picker
 * (Milestone 3 — group ids are available via GET /api/groups/, so group
 * shares are enabled even while person-shares stay disabled by the T6
 * orguser_id gap). Extends the People-with-access section covered in
 * share-modal-access.test.tsx, which must keep passing unmodified.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareModal } from '@/components/ui/share-modal';
import {
  useResourceAccess,
  addGrant,
  removeGrant,
  type ResourceAccessOverview,
} from '@/hooks/api/useResourceAccess';
import { useUsers } from '@/hooks/api/useUserManagement';
import { useUserGroups, type UserGroup } from '@/hooks/api/useUserGroups';
import { useRbac } from '@/lib/rbac';
import { trackEvent } from '@/lib/analytics';

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
}));
jest.mock('@/lib/clipboard', () => ({
  copyUrlToClipboard: jest.fn().mockResolvedValue(undefined),
}));

const mockUseResourceAccess = useResourceAccess as jest.Mock;
const mockUseUsers = useUsers as jest.Mock;
const mockUseUserGroups = useUserGroups as jest.Mock;
const mockUseRbac = useRbac as jest.Mock;
const mockAddGrant = addGrant as jest.Mock;
const mockRemoveGrant = removeGrant as jest.Mock;

const baseOverview: ResourceAccessOverview = {
  resource_type: 'dashboard',
  resource_id: '1',
  capabilities: { general: true, grants: true, public_link: true, requests: true },
  owner: { orguser_id: 1, email: 'asha@ngo.org', name: 'Asha Kumar' },
  general_access: { audience: 'analysts_plus', level: 'view' },
  grants: [
    {
      id: 5,
      principal_type: 'group',
      principal_id: 20,
      email: null,
      name: 'Funders',
      permission: 'view',
      status: 'active',
      member_count: 4,
    },
  ],
  viewer: { effective_permission: 'edit', is_owner: false },
};

const mockGroups: UserGroup[] = [
  {
    id: 20,
    name: 'Funders',
    member_count: 4,
    shared_resource_count: 1,
    created_by: { orguser_id: 1, email: 'asha@ngo.org', name: 'Asha Kumar' },
    created_at: '2026-01-01T00:00:00Z',
    member_preview: [],
  },
  {
    id: 21,
    name: 'Field staff',
    member_count: 8,
    shared_resource_count: 2,
    created_by: { orguser_id: 1, email: 'asha@ngo.org', name: 'Asha Kumar' },
    created_at: '2026-01-01T00:00:00Z',
    member_preview: [],
  },
];

const mockGetShareStatus = jest
  .fn()
  .mockResolvedValue({ is_public: false, public_access_count: 0 });
const mockUpdateSharing = jest.fn();

function renderModal(overrides: Partial<ResourceAccessOverview> = {}, canShareOverride = true) {
  mockUseResourceAccess.mockReturnValue({
    data: { ...baseOverview, ...overrides },
    isLoading: false,
    isError: undefined,
    mutate: jest.fn(),
  });
  mockUseUsers.mockReturnValue({ users: [], isLoading: false });
  mockUseUserGroups.mockReturnValue({
    data: mockGroups,
    isLoading: false,
    isError: undefined,
    mutate: jest.fn(),
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

describe('ShareModal — group grant rows', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders a group grant row with the group name and member count', () => {
    renderModal();
    const row = screen.getByTestId('share-grant-row-5');
    expect(row).toHaveTextContent('Funders');
    expect(row).toHaveTextContent('4');
  });

  it('opens the same confirmation dialog for a group grant as for a person grant, and only removes on confirm', async () => {
    const user = userEvent.setup();
    mockRemoveGrant.mockResolvedValue(undefined);
    renderModal();
    expect(screen.getByTestId('share-grant-remove-5')).toBeInTheDocument();

    await user.click(screen.getByTestId('share-grant-remove-5'));
    expect(screen.getByTestId('share-grant-remove-dialog-5')).toBeInTheDocument();
    expect(
      screen.getByText('Are you sure you want to remove access of "Funders"? This change cannot be undone.')
    ).toBeInTheDocument();
    expect(mockRemoveGrant).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('share-grant-remove-cancel-5'));
    expect(screen.queryByTestId('share-grant-remove-dialog-5')).not.toBeInTheDocument();
    expect(mockRemoveGrant).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('share-grant-remove-5'));
    await user.click(screen.getByTestId('share-grant-remove-confirm-5'));

    await waitFor(() => {
      expect(mockRemoveGrant).toHaveBeenCalledWith('dashboard', 1, 5);
    });
  });
});

describe('ShareModal — staging a group from the unified search', () => {
  beforeEach(() => jest.clearAllMocks());

  it('mixes groups into the typeahead, marking already-granted ones unavailable', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId('share-search-input'), 'f');

    // Funders (id 20) already has a grant — offered but not selectable.
    const funders = screen.getByTestId('share-search-group-20');
    expect(funders).toBeDisabled();
    expect(funders).toHaveTextContent('Already has access');
    const fieldStaff = screen.getByTestId('share-search-group-21');
    expect(fieldStaff).toBeEnabled();
    expect(fieldStaff).toHaveTextContent('Field staff');
    expect(fieldStaff).toHaveTextContent('Group');
  });

  it('stages a group and SHARE commits it via addGrant with principal_type "group"', async () => {
    const user = userEvent.setup();
    mockAddGrant.mockResolvedValue({
      id: 6,
      principal_type: 'group',
      principal_id: 21,
      email: null,
      name: 'Field staff',
      permission: 'view',
      status: 'active',
      member_count: 8,
    });
    renderModal();

    await user.type(screen.getByTestId('share-search-input'), 'field');
    await user.click(screen.getByTestId('share-search-group-21'));

    // Staged, not applied — tagged as a Group with a permission pill.
    const stagedRow = screen.getByTestId('share-staged-row-group-21');
    expect(stagedRow).toHaveTextContent('Field staff');
    expect(stagedRow).toHaveTextContent('Group');
    expect(mockAddGrant).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('share-commit-btn'));

    await waitFor(() => {
      expect(mockAddGrant).toHaveBeenCalledWith('dashboard', 1, {
        principal_type: 'group',
        principal_id: 21,
        permission: 'view',
      });
      expect(trackEvent).toHaveBeenCalledWith(
        'sharing:grant_added',
        expect.objectContaining({ entity_type: 'dashboard', principal_type: 'group' })
      );
    });
    await waitFor(() => {
      expect(screen.queryByTestId('share-staged-row-group-21')).not.toBeInTheDocument();
    });
  });

  it('stages the same group only once', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId('share-search-input'), 'field');
    await user.click(screen.getByTestId('share-search-group-21'));
    await user.type(screen.getByTestId('share-search-input'), 'field');

    // The already-staged group is now unavailable in the typeahead.
    expect(screen.getByTestId('share-search-group-21')).toBeDisabled();
    expect(screen.getByTestId('share-search-group-21')).toHaveTextContent('Added');
    expect(screen.getAllByTestId('share-staged-row-group-21')).toHaveLength(1);
  });

  it('does not render the unified search when the viewer cannot share', () => {
    renderModal({ viewer: { effective_permission: 'view', is_owner: false } }, false);
    expect(screen.queryByTestId('share-search-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('share-commit-btn')).not.toBeInTheDocument();
  });

  it('does not fetch groups when the viewer cannot share', () => {
    renderModal({ viewer: { effective_permission: 'view', is_owner: false } }, false);
    // The search (the only groups consumer) never mounts for read-only viewers.
    expect(mockUseUserGroups).not.toHaveBeenCalled();
  });
});
