/**
 * ShareModal — Owner row + transfer-ownership (task-12f).
 *
 * The owner row must render for EVERY rtype, including metric/kpi
 * (capabilities.grants === false) — that's why it lives in its own always-
 * rendered section rather than inside PeopleWithAccessSection (which is
 * gated on capabilities.grants).
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareModal } from '@/components/ui/share-modal';
import {
  useResourceAccess,
  transferOwnership,
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
const mockTransferOwnership = transferOwnership as jest.Mock;

const baseOverview: ResourceAccessOverview = {
  resource_type: 'dashboard',
  resource_id: '1',
  capabilities: { general: true, grants: true, public_link: true, requests: true },
  owner: { orguser_id: 1, email: 'asha@ngo.org', name: 'Asha Kumar' },
  general_access: { audience: 'analysts_plus', level: 'view' },
  grants: [],
  viewer: { effective_permission: 'edit', is_owner: false },
};

const mockGetShareStatus = jest
  .fn()
  .mockResolvedValue({ is_public: false, public_access_count: 0 });
const mockUpdateSharing = jest.fn();

function renderModal(
  overrides: Partial<ResourceAccessOverview> = {},
  rbacOverrides: { role?: string; hasRole?: () => boolean } = {}
) {
  const mutate = jest.fn();
  mockUseResourceAccess.mockReturnValue({
    data: { ...baseOverview, ...overrides },
    isLoading: false,
    isError: undefined,
    mutate,
  });
  mockUseUsers.mockReturnValue({
    users: [
      { orguser_id: 1, email: 'asha@ngo.org' },
      { orguser_id: 42, email: 'priya@ngo.org' },
    ],
    isLoading: false,
  });
  mockUseRbac.mockReturnValue({
    hasPermission: () => true,
    role: rbacOverrides.role ?? 'analyst',
    isLoaded: true,
    hasRole: rbacOverrides.hasRole ?? (() => false),
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
  });

  render(
    <ShareModal
      entityId={1}
      entityLabel="Dashboard"
      entityType={overrides.resource_type ?? 'dashboard'}
      isOpen
      onClose={jest.fn()}
      getShareStatus={mockGetShareStatus}
      updateSharing={mockUpdateSharing}
    />
  );

  return { mutate };
}

describe('ShareModal — owner row', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the owner name/chip', () => {
    renderModal();
    const row = screen.getByTestId('share-owner-row');
    expect(row).toHaveTextContent('Asha Kumar');
    expect(row).toHaveTextContent('Owner');
  });

  it('hides the transfer action for a non-owner, non-admin viewer', () => {
    renderModal({ viewer: { effective_permission: 'edit', is_owner: false } });
    expect(screen.queryByTestId('share-transfer-owner-btn')).not.toBeInTheDocument();
  });

  it('shows the transfer action when the viewer is the owner', () => {
    renderModal({ viewer: { effective_permission: 'edit', is_owner: true } });
    expect(screen.getByTestId('share-transfer-owner-btn')).toBeInTheDocument();
  });

  it('shows the transfer action for a non-owner admin', () => {
    renderModal(
      { viewer: { effective_permission: 'edit', is_owner: false } },
      { role: 'admin', hasRole: () => true }
    );
    expect(screen.getByTestId('share-transfer-owner-btn')).toBeInTheDocument();
  });

  it('still renders the owner row and transfer action for grantless rtypes (metric/kpi)', () => {
    renderModal({
      resource_type: 'metric',
      capabilities: { general: false, grants: false, public_link: false, requests: false },
      viewer: { effective_permission: 'edit', is_owner: true },
    });
    expect(screen.getByTestId('share-owner-row')).toHaveTextContent('Asha Kumar');
    expect(screen.getByTestId('share-transfer-owner-btn')).toBeInTheDocument();
    // But People/General sections themselves are absent for a grantless rtype.
    expect(screen.queryByTestId('share-people-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('share-general-section')).not.toBeInTheDocument();
  });
});

describe('ShareModal — transfer ownership flow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('walks through pick -> confirm -> POST -> revalidate + toast', async () => {
    const user = userEvent.setup();
    const { mutate } = renderModal({ viewer: { effective_permission: 'edit', is_owner: true } });
    mockTransferOwnership.mockResolvedValue({
      orguser_id: 42,
      email: 'priya@ngo.org',
      name: 'Priya Sharma',
    });

    await user.click(screen.getByTestId('share-transfer-owner-btn'));
    await user.click(screen.getByTestId('share-transfer-owner-combobox-input'));
    await user.click(screen.getByTestId('share-transfer-owner-combobox-item-42'));
    await user.click(screen.getByTestId('share-transfer-owner-next-btn'));

    // Confirm copy: actor IS the owner -> "You keep Edit access"
    expect(screen.getByTestId('share-transfer-owner-confirm')).toHaveTextContent(
      'You keep Edit access'
    );

    await user.click(screen.getByTestId('share-transfer-owner-confirm-btn'));

    await waitFor(() => {
      expect(mockTransferOwnership).toHaveBeenCalledWith('dashboard', 1, 42);
      expect(mutate).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith(
        'sharing:ownership_transferred',
        expect.objectContaining({ entity_type: 'dashboard' })
      );
    });
  });

  it('shows the current-owner-keeps-access copy when a non-owner admin transfers', async () => {
    const user = userEvent.setup();
    renderModal(
      { viewer: { effective_permission: 'edit', is_owner: false } },
      { role: 'admin', hasRole: () => true }
    );

    await user.click(screen.getByTestId('share-transfer-owner-btn'));
    await user.click(screen.getByTestId('share-transfer-owner-combobox-input'));
    await user.click(screen.getByTestId('share-transfer-owner-combobox-item-42'));
    await user.click(screen.getByTestId('share-transfer-owner-next-btn'));

    expect(screen.getByTestId('share-transfer-owner-confirm')).toHaveTextContent(
      'Asha Kumar keeps Edit access'
    );
  });

  it('surfaces a toast on a 400 (already-owner) error', async () => {
    const user = userEvent.setup();
    renderModal({ viewer: { effective_permission: 'edit', is_owner: true } });
    mockTransferOwnership.mockRejectedValue(new Error('resource is already owned by this user'));

    await user.click(screen.getByTestId('share-transfer-owner-btn'));
    await user.click(screen.getByTestId('share-transfer-owner-combobox-input'));
    await user.click(screen.getByTestId('share-transfer-owner-combobox-item-42'));
    await user.click(screen.getByTestId('share-transfer-owner-next-btn'));
    await user.click(screen.getByTestId('share-transfer-owner-confirm-btn'));

    const { toastError } = jest.requireMock('@/lib/toast');
    await waitFor(() => {
      expect(toastError.api).toHaveBeenCalled();
    });
  });
});
