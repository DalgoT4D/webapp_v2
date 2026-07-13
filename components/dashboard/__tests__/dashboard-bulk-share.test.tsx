/**
 * DashboardListV2 — bulk-selection bar + BulkShareDialog wiring (task-17f).
 * BulkShareDialog itself is unit-tested in
 * components/sharing/__tests__/bulk-share-dialog.test.tsx; this suite only
 * covers the list-side wiring: checkbox column, the bar's count/select-all/
 * clear, gating, and the items/onApplied contract handed to the dialog.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet } from '@/test-utils/api';
import { DashboardListV2 } from '../dashboard-list-v2';
import { useDashboards } from '@/hooks/api/useDashboards';
import { useRbac } from '@/lib/rbac';
import { useLandingPage } from '@/hooks/api/useLandingPage';
import type { Dashboard } from '@/hooks/api/useDashboards';
import type { BulkAccessResponse } from '@/hooks/api/useResourceAccess';

jest.mock('@/hooks/api/useDashboards', () => ({
  ...jest.requireActual('@/hooks/api/useDashboards'),
  useDashboards: jest.fn(),
}));
jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));
jest.mock('@/hooks/api/useLandingPage');
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({
      getCurrentOrgUser: () => ({ email: 'asha@ngo.org' }),
      selectedOrgSlug: 'test-org',
    }),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// Isolate the wiring: stub BulkShareDialog so this suite doesn't re-cover
// its own internals (add-grant/general/public-link/confirm), just the props
// DashboardListV2 hands it and the onApplied contract.
let lastBulkShareDialogProps: any = null;
const pendingResponseBox: { current: any } = { current: null };
jest.mock('@/components/sharing/bulk-share-dialog', () => ({
  BulkShareDialog: (props: any) => {
    lastBulkShareDialogProps = props;
    if (!props.isOpen) return null;
    return (
      <div data-testid="stub-bulk-share-dialog">
        <button
          data-testid="stub-bulk-apply"
          onClick={() => props.onApplied(pendingResponseBox.current)}
        >
          apply
        </button>
        <button data-testid="stub-bulk-close" onClick={props.onClose}>
          close
        </button>
      </div>
    );
  },
}));

const mockUseDashboards = useDashboards as jest.Mock;
const mockUseRbac = useRbac as jest.Mock;
const mockUseLandingPage = useLandingPage as jest.Mock;

function baseDashboard(overrides: Partial<Dashboard> = {}): Dashboard {
  return {
    id: 1,
    title: 'Field Performance',
    dashboard_type: 'native',
    grid_columns: 12,
    tabs: [],
    is_published: true,
    is_locked: false,
    created_by: 'Asha Kumar',
    org_id: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    filters: [],
    is_public: false,
    public_access_count: 0,
    ...overrides,
  } as Dashboard;
}

function setup(dashboards: Dashboard[], { canShare = true }: { canShare?: boolean } = {}) {
  lastBulkShareDialogProps = null;
  pendingResponseBox.current = null;
  const mutate = jest.fn();
  mockUseDashboards.mockReturnValue({
    data: dashboards,
    total: dashboards.length,
    page: 1,
    pageSize: 10,
    totalPages: 1,
    isLoading: false,
    isError: undefined,
    mutate,
  });
  mockUseRbac.mockReturnValue({
    hasPermission: (perm: string) => (perm === 'can_share_dashboards' ? canShare : true),
    role: 'admin',
    isLoaded: true,
    hasRole: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
  });
  mockUseLandingPage.mockReturnValue({
    setPersonalLanding: jest.fn(),
    removePersonalLanding: jest.fn(),
    setOrgDefault: jest.fn(),
    isLoading: false,
  });
  mockApiGet.mockResolvedValue([]);

  const view = render(<DashboardListV2 />, { wrapper: TestWrapper });
  return { mutate, view };
}

describe('DashboardListV2 — bulk selection bar', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows a checkbox per row when the viewer can share dashboards', () => {
    setup([baseDashboard({ id: 1 }), baseDashboard({ id: 2 })]);
    expect(screen.getByTestId('dashboard-select-1')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-select-2')).toBeInTheDocument();
  });

  it('hides checkboxes and the bar entirely when the viewer cannot share dashboards', () => {
    setup([baseDashboard({ id: 1 })], { canShare: false });
    expect(screen.queryByTestId('dashboard-select-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-bulk-share-bar')).not.toBeInTheDocument();
  });

  it('selecting a row shows the bulk bar with a count; clear hides it', async () => {
    const user = userEvent.setup();
    setup([baseDashboard({ id: 1 }), baseDashboard({ id: 2 })]);

    expect(screen.queryByTestId('dashboard-bulk-share-bar')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('dashboard-select-1'));
    expect(screen.getByTestId('dashboard-bulk-share-bar')).toHaveTextContent('1 of 2 selected');

    await user.click(screen.getByTestId('dashboard-bulk-clear-btn'));
    expect(screen.queryByTestId('dashboard-bulk-share-bar')).not.toBeInTheDocument();
  });

  it('the header "select all" checkbox selects every row on the current page', async () => {
    const user = userEvent.setup();
    setup([baseDashboard({ id: 1 }), baseDashboard({ id: 2 }), baseDashboard({ id: 3 })]);

    await user.click(screen.getByTestId('dashboard-bulk-select-all-header'));
    expect(screen.getByTestId('dashboard-bulk-share-bar')).toHaveTextContent('3 of 3 selected');
  });

  it('the bar\'s "Select All" button fills in the rest of the current page', async () => {
    const user = userEvent.setup();
    setup([baseDashboard({ id: 1 }), baseDashboard({ id: 2 }), baseDashboard({ id: 3 })]);

    await user.click(screen.getByTestId('dashboard-select-1'));
    await user.click(screen.getByTestId('dashboard-bulk-select-all-btn'));
    expect(screen.getByTestId('dashboard-bulk-share-bar')).toHaveTextContent('3 of 3 selected');
  });

  it('opens BulkShareDialog with dashboard items (string ids) and allowPublicLink, and revalidates on apply', async () => {
    const user = userEvent.setup();
    const { mutate } = setup([baseDashboard({ id: 1 }), baseDashboard({ id: 2 })]);

    await user.click(screen.getByTestId('dashboard-select-1'));
    await user.click(screen.getByTestId('dashboard-select-2'));
    await user.click(screen.getByTestId('dashboard-bulk-share-btn'));

    expect(lastBulkShareDialogProps.entityType).toBe('dashboard');
    expect(lastBulkShareDialogProps.allowPublicLink).toBe(true);
    expect(lastBulkShareDialogProps.items).toEqual(
      expect.arrayContaining([
        { rtype: 'dashboard', id: '1' },
        { rtype: 'dashboard', id: '2' },
      ])
    );

    const response: BulkAccessResponse = {
      applied: [{ rtype: 'dashboard', id: '1' }],
      skipped: [{ rtype: 'dashboard', id: '2', reason: 'edit_access_denied' }],
      requires_confirmation: [],
      applied_count: 1,
      skipped_count: 1,
    };
    pendingResponseBox.current = response;
    await user.click(screen.getByTestId('stub-bulk-apply'));

    // Revalidates the list so badges (audience chips) reflect the change.
    expect(mutate).toHaveBeenCalled();
    // Applied id (1) is deselected; skipped id (2) stays selected so the
    // user can see which one needs attention.
    expect(screen.getByTestId('dashboard-bulk-share-bar')).toHaveTextContent('1 of 2 selected');
  });
});
