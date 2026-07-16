/**
 * ShareModal — Owner row + transfer-ownership (task-12f; restyled per the
 * design-alignment task's reconciliation with "Transfer ownership.jpg").
 *
 * Two distinct transfer entry points now exist:
 *  - Grantless rtypes (metric/kpi, capabilities.grants === false): no
 *    People-with-access list to fold a per-row action into, so they keep the
 *    original standalone "Transfer ownership" button + "pick any org member"
 *    combobox (OwnerSection/OwnerTransferBlock) — no design frame covers
 *    these rtypes at all.
 *  - Every other rtype (People-with-access list present): the owner row is
 *    plain text (icon · email · role tag · "Owner", no control at all — see
 *    share-modal-access.test.tsx for that). Transfer now lives INSIDE a
 *    non-owner grantee's own permission dropdown as a "Transfer Ownership"
 *    item (exactly what "Transfer ownership.jpg" shows: "Can View ✓ / Can
 *    Edit / Transfer Ownership") — picking it targets that specific person
 *    and jumps straight to the confirm step, skipping the old "pick a
 *    person" combobox screen entirely (the row already identifies them).
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

// A grants-capable overview needs at least one active user grant — that
// person's own row is where "Transfer Ownership" now lives.
const baseOverview: ResourceAccessOverview = {
  resource_type: 'dashboard',
  resource_id: '1',
  capabilities: { general: true, grants: true, public_link: true, requests: true },
  owner: { orguser_id: 1, email: 'asha@ngo.org', name: 'Asha Kumar' },
  general_access: { analyst_level: 'view', member_level: 'none' },
  grants: [
    {
      id: 3,
      principal_type: 'user',
      principal_id: 42,
      email: 'priya@ngo.org',
      name: null,
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

  it('hides "Transfer Ownership" from a grantee row for a non-owner, non-admin viewer', async () => {
    const user = userEvent.setup();
    renderModal({ viewer: { effective_permission: 'edit', is_owner: false } });

    await user.click(screen.getByTestId('share-grant-permission-3'));
    expect(screen.queryByRole('option', { name: 'Transfer Ownership' })).not.toBeInTheDocument();
  });

  it('shows "Transfer Ownership" on a grantee row when the viewer is the owner', async () => {
    const user = userEvent.setup();
    renderModal({ viewer: { effective_permission: 'edit', is_owner: true } });

    await user.click(screen.getByTestId('share-grant-permission-3'));
    expect(screen.getByRole('option', { name: 'Transfer Ownership' })).toBeInTheDocument();
  });

  it('shows "Transfer Ownership" on a grantee row for a non-owner admin', async () => {
    const user = userEvent.setup();
    renderModal(
      { viewer: { effective_permission: 'edit', is_owner: false } },
      { role: 'admin', hasRole: () => true }
    );

    await user.click(screen.getByTestId('share-grant-permission-3'));
    expect(screen.getByRole('option', { name: 'Transfer Ownership' })).toBeInTheDocument();
  });

  it('still renders the owner row and the standalone transfer action for grantless rtypes (metric/kpi)', () => {
    renderModal({
      resource_type: 'metric',
      capabilities: { general: false, grants: false, public_link: false, requests: false },
      grants: [],
      viewer: { effective_permission: 'edit', is_owner: true },
    });
    expect(screen.getByTestId('share-owner-row')).toHaveTextContent('Asha Kumar');
    expect(screen.getByTestId('share-transfer-owner-btn')).toBeInTheDocument();
    // But People/General sections themselves are absent for a grantless rtype.
    expect(screen.queryByTestId('share-people-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('share-general-section')).not.toBeInTheDocument();
  });
});

describe('ShareModal — transfer ownership flow (grants-capable rtype, per-row entry point)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('walks through Transfer Ownership -> confirm -> POST -> revalidate + toast', async () => {
    const user = userEvent.setup();
    const { mutate } = renderModal({ viewer: { effective_permission: 'edit', is_owner: true } });
    mockTransferOwnership.mockResolvedValue({
      orguser_id: 42,
      email: 'priya@ngo.org',
      name: 'Priya Sharma',
    });

    await user.click(screen.getByTestId('share-grant-permission-3'));
    await user.click(screen.getByRole('option', { name: 'Transfer Ownership' }));

    // Confirm copy (Phase A / A4, design frame 1184:6198 kept truthful — no
    // "reclaim anytime"): actor IS the owner -> "You keep Edit access"
    expect(screen.getByTestId('share-transfer-owner-confirm')).toHaveTextContent(
      'Ownership of this dashboard transfers to priya@ngo.org. They can then delete it or transfer it again. You keep Edit access.'
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

    await user.click(screen.getByTestId('share-grant-permission-3'));
    await user.click(screen.getByRole('option', { name: 'Transfer Ownership' }));

    expect(screen.getByTestId('share-transfer-owner-confirm')).toHaveTextContent(
      'Ownership of this dashboard transfers to priya@ngo.org. They can then delete it or transfer it again. Asha Kumar keeps Edit access.'
    );
  });

  it('cancels back out of the confirm step without transferring', async () => {
    const user = userEvent.setup();
    renderModal({ viewer: { effective_permission: 'edit', is_owner: true } });

    await user.click(screen.getByTestId('share-grant-permission-3'));
    await user.click(screen.getByRole('option', { name: 'Transfer Ownership' }));
    expect(screen.getByTestId('share-transfer-owner-confirm')).toBeInTheDocument();

    await user.click(screen.getByTestId('share-transfer-owner-cancel-btn'));

    expect(screen.queryByTestId('share-transfer-owner-confirm')).not.toBeInTheDocument();
    expect(mockTransferOwnership).not.toHaveBeenCalled();
  });

  it('surfaces a toast on a 400 (already-owner) error', async () => {
    const user = userEvent.setup();
    renderModal({ viewer: { effective_permission: 'edit', is_owner: true } });
    mockTransferOwnership.mockRejectedValue(new Error('resource is already owned by this user'));

    await user.click(screen.getByTestId('share-grant-permission-3'));
    await user.click(screen.getByRole('option', { name: 'Transfer Ownership' }));
    await user.click(screen.getByTestId('share-transfer-owner-confirm-btn'));

    const { toastError } = jest.requireMock('@/lib/toast');
    await waitFor(() => {
      expect(toastError.api).toHaveBeenCalled();
    });
  });
});

describe('ShareModal — transfer ownership flow (grantless rtype, standalone combobox)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the human noun map in the confirm copy — a kpi reads "this KPI", not "this kpi"', async () => {
    const user = userEvent.setup();
    renderModal({
      resource_type: 'kpi',
      capabilities: { general: false, grants: false, public_link: false, requests: false },
      grants: [],
      viewer: { effective_permission: 'edit', is_owner: true },
    });

    await user.click(screen.getByTestId('share-transfer-owner-btn'));
    await user.click(screen.getByTestId('share-transfer-owner-combobox-input'));
    await user.click(screen.getByTestId('share-transfer-owner-combobox-item-42'));
    await user.click(screen.getByTestId('share-transfer-owner-next-btn'));

    expect(screen.getByTestId('share-transfer-owner-confirm')).toHaveTextContent(
      'Ownership of this KPI transfers to priya@ngo.org. They can then delete it or transfer it again. You keep Edit access.'
    );
  });
});
