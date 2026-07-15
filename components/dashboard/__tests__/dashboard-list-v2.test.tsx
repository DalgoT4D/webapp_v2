/**
 * DashboardListV2 — sharing badges (Task 6c)
 *
 * GET /api/dashboards/ carries analyst_level, member_level, is_owner,
 * is_creator (Task 6b DashboardResponse fields; D1 renamed the general-access
 * pair from general_audience/general_level to these two independently
 * settable per-role levels). This suite covers the derived badges: 🔒 Private
 * / analysts-only / everyone-in-org badge, and "Shared with you" — see
 * deriveGeneralAccessBadge in dashboard-list-utils.ts for how the per-role
 * pair collapses back down to one badge. The component also has grid/list
 * card renderers, but viewMode is hardcoded to 'table' (see the component's
 * viewMode const), so only the table row is reachable and tested here.
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

function setup(dashboards: Dashboard[]) {
  mockUseDashboards.mockReturnValue({
    data: dashboards,
    total: dashboards.length,
    page: 1,
    pageSize: 10,
    totalPages: 1,
    isLoading: false,
    isError: undefined,
    mutate: jest.fn(),
  });
  mockUseRbac.mockReturnValue({
    hasPermission: () => true,
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

  return render(<DashboardListV2 />, { wrapper: TestWrapper });
}

describe('DashboardListV2 — sharing badges', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows a Private badge when both analyst_level and member_level are "none"', () => {
    setup([
      baseDashboard({ id: 1, analyst_level: 'none', member_level: 'none', is_owner: true }),
    ]);
    expect(screen.getByTestId('dashboard-badge-private-1')).toHaveTextContent('Private');
    expect(screen.queryByTestId('dashboard-badge-audience-1')).not.toBeInTheDocument();
  });

  it('shows the "Everyone in org" badge when member_level is "view", with the higher (member) level in the tooltip', () => {
    setup([
      baseDashboard({
        id: 2,
        analyst_level: 'view',
        member_level: 'view',
        is_owner: true,
      }),
    ]);
    const badge = screen.getByTestId('dashboard-badge-audience-2');
    expect(badge).toHaveTextContent('Everyone in org');
    // The tooltip format is "{label} · {level}" — the same as ShareModal's
    // read-only General-access summary.
    expect(badge).toHaveAttribute('title', 'Everyone in org · Viewer');
  });

  it('shows the analysts-scoped badge when only analyst_level has access (member_level is "none")', () => {
    setup([
      baseDashboard({
        id: 11,
        analyst_level: 'view',
        member_level: 'none',
        is_owner: true,
      }),
    ]);
    const badge = screen.getByTestId('dashboard-badge-audience-11');
    expect(badge).toHaveTextContent('Analysts and up');
    expect(badge).toHaveAttribute('title', 'Analysts and up · Viewer');
  });

  it('shows the higher (Editor) level in the "Everyone in org" badge tooltip when analyst_level is Edit and member_level is View', () => {
    setup([
      baseDashboard({
        id: 9,
        analyst_level: 'edit',
        member_level: 'view',
        is_owner: true,
      }),
    ]);
    expect(screen.getByTestId('dashboard-badge-audience-9')).toHaveAttribute(
      'title',
      'Everyone in org · Editor'
    );
  });

  it('shows no audience/private badge when analyst_level and member_level are both null (predates general-access config, or an anonymous public-view caller)', () => {
    setup([
      baseDashboard({ id: 3, analyst_level: null, member_level: null, is_owner: true }),
    ]);
    expect(screen.queryByTestId('dashboard-badge-private-3')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-badge-audience-3')).not.toBeInTheDocument();
  });

  it('shows "Shared with you" when the viewer is neither owner nor creator', () => {
    setup([baseDashboard({ id: 4, is_owner: false, is_creator: false })]);
    expect(screen.getByTestId('dashboard-badge-shared-4')).toHaveTextContent('Shared with you');
  });

  it('hides "Shared with you" for the owner', () => {
    setup([baseDashboard({ id: 5, is_owner: true, is_creator: false })]);
    expect(screen.queryByTestId('dashboard-badge-shared-5')).not.toBeInTheDocument();
  });

  it('hides "Shared with you" for the creator', () => {
    setup([baseDashboard({ id: 6, is_owner: false, is_creator: true })]);
    expect(screen.queryByTestId('dashboard-badge-shared-6')).not.toBeInTheDocument();
  });

  it('filters to only shared dashboards via the "Show only shared" filter', async () => {
    const user = userEvent.setup();
    setup([
      baseDashboard({ id: 7, title: 'Mine', is_owner: true }),
      baseDashboard({ id: 8, title: 'Shared With Me', is_owner: false, is_creator: false }),
    ]);

    expect(screen.getByText('Mine')).toBeInTheDocument();
    expect(screen.getByText('Shared With Me')).toBeInTheDocument();

    await user.click(screen.getByTestId('dashboard-name-filter-trigger'));
    await user.click(screen.getByTestId('dashboard-shared-filter-checkbox'));

    expect(screen.queryByText('Mine')).not.toBeInTheDocument();
    expect(screen.getByText('Shared With Me')).toBeInTheDocument();
  });

  it('counts the shared filter as active: shows the filter banner and the filtered-empty state', async () => {
    const user = userEvent.setup();
    // Only owned dashboards — the shared filter empties the list entirely.
    setup([baseDashboard({ id: 11, title: 'Mine Alone', is_owner: true })]);

    // No banner while no filter is active.
    expect(screen.queryByText('1 filter active')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('dashboard-name-filter-trigger'));
    await user.click(screen.getByTestId('dashboard-shared-filter-checkbox'));

    // getActiveFilterCount now includes showShared → banner + Clear all render.
    expect(screen.getByText('1 filter active')).toBeInTheDocument();
    expect(screen.getByText('Clear all')).toBeInTheDocument();
    // Emptied-by-filter state, not the no-dashboards-yet state.
    expect(screen.getByText('No dashboards found')).toBeInTheDocument();
    expect(screen.queryByText('No dashboards yet')).not.toBeInTheDocument();
  });
});
