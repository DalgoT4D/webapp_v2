/**
 * ShareModal — org-wide "Allow public sharing" kill switch (task-11f).
 *
 * The backend already 403s the enable path when allow_public_sharing is
 * false (task-11 backend report); the frontend must not present a dead
 * control, so the public-link/toggle card is hidden the same way the
 * existing capabilities.public_link === false case already hides it.
 *
 * useOrgPreferences() defaults to undefined when unmocked (as in the other
 * ShareModal test files) — gating must key off `=== false` specifically, so
 * "not yet loaded" never hides the toggle for every other test in the suite.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ShareModal } from '@/components/ui/share-modal';
import { useResourceAccess, type ResourceAccessOverview } from '@/hooks/api/useResourceAccess';
import { useUsers } from '@/hooks/api/useUserManagement';
import { useRbac } from '@/lib/rbac';
import { useOrgPreferences } from '@/hooks/api/useNotifications';

jest.mock('@/hooks/api/useResourceAccess');
jest.mock('@/hooks/api/useUserManagement');
jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/hooks/api/useNotifications', () => ({
  ...jest.requireActual('@/hooks/api/useNotifications'),
  useOrgPreferences: jest.fn(),
}));
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
const mockUseOrgPreferences = useOrgPreferences as jest.Mock;

const baseOverview: ResourceAccessOverview = {
  resource_type: 'dashboard',
  resource_id: '1',
  capabilities: { general: true, grants: true, public_link: true, requests: true },
  owner: { orguser_id: 1, email: 'asha@ngo.org', name: 'Asha Kumar' },
  general_access: { audience: 'analysts_plus', level: 'view' },
  grants: [],
  viewer: { effective_permission: 'edit', is_owner: true },
};

const mockGetShareStatus = jest
  .fn()
  .mockResolvedValue({ is_public: false, public_access_count: 0 });
const mockUpdateSharing = jest.fn();

function renderModal(
  entityType: ResourceAccessOverview['resource_type'],
  allowPublicSharing: boolean | undefined
) {
  mockUseResourceAccess.mockReturnValue({
    data: { ...baseOverview, resource_type: entityType },
    isLoading: false,
    isError: undefined,
    mutate: jest.fn(),
  });
  mockUseUsers.mockReturnValue({ users: [], isLoading: false });
  mockUseRbac.mockReturnValue({
    hasPermission: () => true,
    role: 'admin',
    isLoaded: true,
    hasRole: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
  });
  mockUseOrgPreferences.mockReturnValue({
    orgPreferences:
      allowPublicSharing === undefined ? undefined : { allow_public_sharing: allowPublicSharing },
    isLoading: false,
    error: undefined,
    mutate: jest.fn(),
  });

  return render(
    <ShareModal
      entityId={1}
      entityLabel={entityType === 'report' ? 'Report' : 'Dashboard'}
      entityType={entityType}
      isOpen
      onClose={jest.fn()}
      getShareStatus={mockGetShareStatus}
      updateSharing={mockUpdateSharing}
    />
  );
}

describe('ShareModal — org-wide public-sharing gate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('hides the public-link card for a dashboard when allow_public_sharing is false', async () => {
    renderModal('dashboard', false);
    await waitFor(() => {
      expect(screen.queryByTestId('share-toggle')).not.toBeInTheDocument();
    });
  });

  it('hides the public-link card for a report when allow_public_sharing is false', async () => {
    renderModal('report', false);
    await waitFor(() => {
      expect(screen.queryByTestId('share-toggle')).not.toBeInTheDocument();
    });
  });

  it('shows the public-link card when allow_public_sharing is true', async () => {
    renderModal('dashboard', true);
    await waitFor(() => {
      expect(screen.getByTestId('share-toggle')).toBeInTheDocument();
    });
  });

  it('shows the public-link card while org preferences have not loaded yet (undefined is not false)', async () => {
    renderModal('dashboard', undefined);
    await waitFor(() => {
      expect(screen.getByTestId('share-toggle')).toBeInTheDocument();
    });
  });
});
