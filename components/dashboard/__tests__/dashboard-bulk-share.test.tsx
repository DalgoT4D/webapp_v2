/**
 * DashboardListV2 bulk-share wiring: checkbox column, bar count/select-all/
 * clear, gating, and the items/onApplied contract. BulkShareDialog itself is
 * unit-tested in its own suite.
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
import { useMultiSelect } from '@/hooks/useMultiSelect';
import type { Dashboard } from '@/hooks/api/useDashboards';
import type { BulkAccessResponse } from '@/hooks/api/useResourceAccess';

// Real hook by default; only the cap test overrides the return value —
// driving 100 real clicks isn't worth it, and cap enforcement is
// unit-tested in useMultiSelect's own suite.
jest.mock('@/hooks/useMultiSelect', () => {
  const actual = jest.requireActual('@/hooks/useMultiSelect');
  return { ...actual, useMultiSelect: jest.fn(actual.useMultiSelect) };
});
const mockUseMultiSelect = useMultiSelect as jest.Mock;
const actualUseMultiSelect = jest.requireActual('@/hooks/useMultiSelect').useMultiSelect;

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

// Stub BulkShareDialog — this suite only covers the props DashboardListV2
// hands it and the onApplied contract.
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
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMultiSelect.mockImplementation(actualUseMultiSelect);
  });

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

  it('selecting a row shows the bulk bar with a count (no page-local denominator); clear hides it', async () => {
    const user = userEvent.setup();
    setup([baseDashboard({ id: 1 }), baseDashboard({ id: 2 })]);

    expect(screen.queryByTestId('dashboard-bulk-share-bar')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('dashboard-select-1'));
    const bar = screen.getByTestId('dashboard-bulk-share-bar');
    expect(bar).toHaveTextContent('1 selected');
    // Regression guard for the old page-local "N of M selected" phrasing,
    // which lied once selection persisted across pagination.
    expect(bar).not.toHaveTextContent('of 2 selected');
    expect(bar).not.toHaveTextContent('other pages');

    await user.click(screen.getByTestId('dashboard-bulk-clear-btn'));
    expect(screen.queryByTestId('dashboard-bulk-share-bar')).not.toBeInTheDocument();
  });

  it('the header "select all" checkbox selects every row on the current page', async () => {
    const user = userEvent.setup();
    setup([baseDashboard({ id: 1 }), baseDashboard({ id: 2 }), baseDashboard({ id: 3 })]);

    await user.click(screen.getByTestId('dashboard-bulk-select-all-header'));
    expect(screen.getByTestId('dashboard-bulk-share-bar')).toHaveTextContent('3 selected');
  });

  it('shows the true cross-page selection count and flags off-page selections instead of contradicting the visible checkboxes (finding 1)', () => {
    // id 999 is not among the rendered rows — it stands in for a row
    // selected on a different page. The bar's count must be the TRUE
    // cross-page total, with an explicit "on other pages" hint, never a
    // page-local "N of 2" that contradicts the (all-unchecked) checkboxes.
    mockUseMultiSelect.mockReturnValue({
      selectedIds: new Set([1, 999]),
      toggle: jest.fn(),
      selectPage: jest.fn(),
      deselectPage: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
      isAtCap: false,
      maxSelection: 100,
    });
    setup([baseDashboard({ id: 1 }), baseDashboard({ id: 2 })]);

    const bar = screen.getByTestId('dashboard-bulk-share-bar');
    expect(bar).toHaveTextContent('2 selected');
    expect(bar).toHaveTextContent('1 on other pages');
    expect(bar).not.toHaveTextContent('of 2 selected');
  });

  it('the header checkbox uncheck deselects only the current page, leaving off-page selections intact (finding 3)', async () => {
    const user = userEvent.setup();
    const deselectPage = jest.fn();
    const clear = jest.fn();
    mockUseMultiSelect.mockReturnValue({
      selectedIds: new Set([1, 2, 999]), // 999 = selected on another page
      toggle: jest.fn(),
      selectPage: jest.fn(),
      deselectPage,
      remove: jest.fn(),
      clear,
      isAtCap: false,
      maxSelection: 100,
    });
    setup([baseDashboard({ id: 1 }), baseDashboard({ id: 2 })]);

    // Both visible rows are already selected, so the header checkbox is
    // checked; clicking it unchecks -> should deselect ONLY the visible ids.
    await user.click(screen.getByTestId('dashboard-bulk-select-all-header'));

    expect(deselectPage).toHaveBeenCalledWith([1, 2]);
    expect(clear).not.toHaveBeenCalled();
  });

  it('caps the selection at 100: the bar shows the hint, and an unselected row is disabled', () => {
    // Pins the WIRING (list reads MAX_BULK_SELECTION off the real selection
    // state correctly) — the cap ENFORCEMENT itself (toggle/selectPage
    // becoming no-ops past 100) is unit-tested in useMultiSelect's own suite.
    // 100 ids including dashboard #1 but not #2 — hits the real MAX_BULK_SELECTION
    // (100) that the component itself compares selectedIds.size against.
    const hundredIds = new Set(Array.from({ length: 100 }, (_, i) => i + 1));
    mockUseMultiSelect.mockReturnValue({
      selectedIds: hundredIds,
      toggle: jest.fn(),
      selectPage: jest.fn(),
      deselectPage: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
      isAtCap: true,
      maxSelection: 100,
    });
    setup([baseDashboard({ id: 1 }), baseDashboard({ id: 200 })]);

    expect(screen.getByTestId('dashboard-bulk-share-bar')).toHaveTextContent(
      '(maximum 100 reached)'
    );
    // id 200 is not in selectedIds, and the selection is at cap.
    expect(screen.getByTestId('dashboard-select-200')).toBeDisabled();
    // id 1 IS selected — stays enabled/checked so the user can deselect it.
    expect(screen.getByTestId('dashboard-select-1')).not.toBeDisabled();
  });

  it('the bar\'s "Select All" button fills in the rest of the current page', async () => {
    const user = userEvent.setup();
    setup([baseDashboard({ id: 1 }), baseDashboard({ id: 2 }), baseDashboard({ id: 3 })]);

    await user.click(screen.getByTestId('dashboard-select-1'));
    await user.click(screen.getByTestId('dashboard-bulk-select-all-btn'));
    expect(screen.getByTestId('dashboard-bulk-share-bar')).toHaveTextContent('3 selected');
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
    expect(screen.getByTestId('dashboard-bulk-share-bar')).toHaveTextContent('1 selected');
  });
});
