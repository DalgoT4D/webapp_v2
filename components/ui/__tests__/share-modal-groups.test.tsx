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
      email: '',
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
  },
  {
    id: 21,
    name: 'Field staff',
    member_count: 8,
    shared_resource_count: 2,
    created_by: { orguser_id: 1, email: 'asha@ngo.org', name: 'Asha Kumar' },
    created_at: '2026-01-01T00:00:00Z',
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

  it('removes a group grant the same way a person grant is removed', async () => {
    const user = userEvent.setup();
    renderModal();
    expect(screen.getByTestId('share-grant-remove-5')).toBeInTheDocument();
    await user.click(screen.getByTestId('share-grant-remove-5'));
  });
});

describe('ShareModal — add a group', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows candidate groups not already granted access', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId('share-add-group-combobox-input'));
    // Funders (id 20) already has a grant — only Field staff should be offered.
    expect(screen.queryByTestId('share-add-group-combobox-item-20')).not.toBeInTheDocument();
    expect(screen.getByTestId('share-add-group-combobox-item-21')).toHaveTextContent('Field staff');
  });

  it('adds a group grant via addGrant with principal_type "group"', async () => {
    const user = userEvent.setup();
    mockAddGrant.mockResolvedValue({
      id: 6,
      principal_type: 'group',
      principal_id: 21,
      email: '',
      name: 'Field staff',
      permission: 'view',
      status: 'active',
      member_count: 8,
    });
    renderModal();

    await user.click(screen.getByTestId('share-add-group-combobox-input'));
    await user.click(screen.getByTestId('share-add-group-combobox-item-21'));
    await user.click(screen.getByTestId('share-add-group-btn'));

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
  });

  it('does not render the groups picker when the viewer cannot share', () => {
    renderModal({ viewer: { effective_permission: 'view', is_owner: false } }, false);
    expect(screen.queryByTestId('share-add-group-combobox-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('share-add-group-btn')).not.toBeInTheDocument();
  });

  it('does not fetch groups when the viewer cannot share', () => {
    renderModal({ viewer: { effective_permission: 'view', is_owner: false } }, false);
    expect(mockUseUserGroups).toHaveBeenCalledWith(false);
  });
});
