/**
 * ChartsPage — v1.1 M3a: per-row Share action + bulk-selection bar +
 * BulkShareDialog wiring, mirroring metrics-library-bulk-share.test.tsx /
 * kpi-page-bulk-share.test.tsx (M5). ShareModal/BulkShareDialog themselves
 * are unit-tested elsewhere, so they're stubbed here to isolate the list's
 * own wiring: checkbox column, row Share button, the bar's count/select-all/
 * clear, and the items/onApplied contract handed to the dialog.
 *
 * This selection is a SEPARATE mechanism from the page's pre-existing
 * bulk-delete "selection mode" — see app/charts/page.tsx's
 * selectedShareChartIds vs. selectedCharts.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChartsPage from '@/app/charts/page';
import { useCharts } from '@/hooks/api/useCharts';
import { useDeleteChart, useBulkDeleteCharts, useCreateChart } from '@/hooks/api/useChart';
import { useRbac } from '@/lib/rbac';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import type { Chart } from '@/hooks/api/useCharts';
import type { BulkAccessResponse } from '@/hooks/api/useResourceAccess';

jest.mock('@/hooks/useMultiSelect', () => {
  const actual = jest.requireActual('@/hooks/useMultiSelect');
  return { ...actual, useMultiSelect: jest.fn(actual.useMultiSelect) };
});
const mockUseMultiSelect = useMultiSelect as jest.Mock;
const actualUseMultiSelect = jest.requireActual('@/hooks/useMultiSelect').useMultiSelect;

jest.mock('@/hooks/api/useCharts', () => ({
  useCharts: jest.fn(),
}));
jest.mock('@/hooks/api/useChart', () => ({
  useDeleteChart: jest.fn(),
  useBulkDeleteCharts: jest.fn(),
  useCreateChart: jest.fn(),
}));
jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/components/charts/ChartDeleteDialog', () => ({
  ChartDeleteDialog: ({ children }: any) => <>{children}</>,
}));
jest.mock('@/components/charts/ChartExportDropdownForList', () => ({
  ChartExportDropdownForList: (): null => null,
}));

let lastShareModalProps: any = null;
jest.mock('@/components/ui/share-modal', () => ({
  ShareModal: (props: any) => {
    lastShareModalProps = props;
    if (!props.isOpen) return null;
    return <div data-testid="stub-share-modal">share-modal:{props.entityType}</div>;
  },
}));

let lastBulkShareDialogProps: any = null;
const pendingResponseBox: { current: any } = { current: null };
jest.mock('@/components/sharing/bulk-share-dialog', () => ({
  BulkShareDialog: (props: any) => {
    lastBulkShareDialogProps = props;
    if (!props.isOpen) return null;
    return (
      <div data-testid="stub-bulk-share-dialog">
        allowPublicLink:{String(props.allowPublicLink)}
        <button
          data-testid="stub-bulk-apply"
          onClick={() => props.onApplied(pendingResponseBox.current)}
        >
          apply
        </button>
      </div>
    );
  },
}));

const mockUseCharts = useCharts as jest.Mock;
const mockUseRbac = useRbac as jest.Mock;

function makeChart(overrides: Partial<Chart> = {}): Chart {
  return {
    id: 1,
    title: 'Sales by Region',
    chart_type: 'bar',
    computation_type: 'aggregated',
    schema_name: 's',
    table_name: 't',
    extra_config: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: 'admin@test.com',
    ...overrides,
  };
}

function setup(charts: Chart[], { canShare = true }: { canShare?: boolean } = {}) {
  lastShareModalProps = null;
  lastBulkShareDialogProps = null;
  pendingResponseBox.current = null;
  const mutate = jest.fn();
  mockUseCharts.mockReturnValue({
    data: charts,
    total: charts.length,
    page: 1,
    pageSize: 10,
    totalPages: 1,
    isLoading: false,
    isError: undefined,
    mutate,
  });
  (useDeleteChart as jest.Mock).mockReturnValue({ trigger: jest.fn() });
  (useBulkDeleteCharts as jest.Mock).mockReturnValue({ trigger: jest.fn() });
  (useCreateChart as jest.Mock).mockReturnValue({ trigger: jest.fn() });
  mockUseRbac.mockReturnValue({
    hasPermission: (perm: string) => (perm === 'can_share_charts' ? canShare : true),
    role: 'admin',
    isLoaded: true,
    hasRole: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
  });
  render(<ChartsPage />);
  return { mutate };
}

describe('ChartsPage — per-item Share action', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens ShareModal with entityType="chart" when the row Share button is clicked', async () => {
    const user = userEvent.setup();
    setup([makeChart({ id: 7, title: 'Sales by Region' })]);

    await user.click(screen.getByTestId('chart-share-btn-7'));

    expect(screen.getByTestId('stub-share-modal')).toHaveTextContent('share-modal:chart');
    expect(lastShareModalProps.entityId).toBe(7);
    expect(lastShareModalProps.resourceName).toBe('Sales by Region');
  });

  it('hides the Share button and checkbox column when the viewer lacks can_share_charts', () => {
    setup([makeChart({ id: 7 })], { canShare: false });
    expect(screen.queryByTestId('chart-share-btn-7')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chart-select-7')).not.toBeInTheDocument();
  });
});

describe('ChartsPage — bulk selection bar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMultiSelect.mockImplementation(actualUseMultiSelect);
  });

  it('selecting a row shows the bar with a count; clear hides it', async () => {
    const user = userEvent.setup();
    setup([makeChart({ id: 1 }), makeChart({ id: 2, title: 'Other Chart' })]);

    expect(screen.queryByTestId('chart-bulk-share-bar')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('chart-select-1'));
    const bar = screen.getByTestId('chart-bulk-share-bar');
    expect(bar).toHaveTextContent('1 selected');

    await user.click(screen.getByTestId('chart-bulk-clear-btn'));
    expect(screen.queryByTestId('chart-bulk-share-bar')).not.toBeInTheDocument();
  });

  it('opens BulkShareDialog with chart items, allowPublicLink=false, and revalidates + deselects applied ids on apply', async () => {
    const user = userEvent.setup();
    const { mutate } = setup([makeChart({ id: 1 }), makeChart({ id: 2, title: 'Other Chart' })]);

    await user.click(screen.getByTestId('chart-select-1'));
    await user.click(screen.getByTestId('chart-select-2'));
    await user.click(screen.getByTestId('chart-bulk-share-btn'));

    expect(lastBulkShareDialogProps.entityType).toBe('chart');
    expect(lastBulkShareDialogProps.allowPublicLink).toBe(false);
    expect(lastBulkShareDialogProps.items).toEqual(
      expect.arrayContaining([
        { rtype: 'chart', id: '1' },
        { rtype: 'chart', id: '2' },
      ])
    );

    const response: BulkAccessResponse = {
      applied: [{ rtype: 'chart', id: '1' }],
      skipped: [{ rtype: 'chart', id: '2', reason: 'member_grants_deferred' }],
      requires_confirmation: [],
      applied_count: 1,
      skipped_count: 1,
    };
    pendingResponseBox.current = response;
    await user.click(screen.getByTestId('stub-bulk-apply'));

    expect(mutate).toHaveBeenCalled();
    // Only the applied id (1) is deselected; the skipped id (2) stays selected.
    expect(screen.getByTestId('chart-bulk-share-bar')).toHaveTextContent('1 selected');
  });
});
