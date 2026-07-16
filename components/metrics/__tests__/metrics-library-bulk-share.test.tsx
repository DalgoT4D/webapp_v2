/**
 * MetricsLibrary — M5: per-item Share + bulk-selection bar + BulkShareDialog
 * wiring, mirroring app/alerts/__tests__/page-bulk-share.test.tsx. ShareModal/
 * BulkShareDialog themselves are unit-tested elsewhere, so they're stubbed
 * here to isolate the list's own wiring: checkbox column, row Share button,
 * the bar's count/select-all/clear, and the items/onApplied contract handed
 * to the dialog.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MetricsLibrary } from '../metrics-library';
import { useMetrics, getMetricConsumers } from '@/hooks/api/useMetrics';
import { useRbac } from '@/lib/rbac';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import type { Metric } from '@/types/metrics';
import type { BulkAccessResponse } from '@/hooks/api/useResourceAccess';

jest.mock('@/hooks/useMultiSelect', () => {
  const actual = jest.requireActual('@/hooks/useMultiSelect');
  return { ...actual, useMultiSelect: jest.fn(actual.useMultiSelect) };
});
const mockUseMultiSelect = useMultiSelect as jest.Mock;
const actualUseMultiSelect = jest.requireActual('@/hooks/useMultiSelect').useMultiSelect;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/hooks/api/useMetrics', () => ({
  useMetrics: jest.fn(),
  deleteMetric: jest.fn(),
  getMetricConsumers: jest.fn(),
}));
jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('../metric-form-dialog', () => ({ MetricFormDialog: (): null => null }));
jest.mock('@/components/kpis/kpi-form', () => ({ KPIForm: (): null => null }));
jest.mock('@/components/alerts/AlertWizardModal', () => ({
  AlertWizardModal: (): null => null,
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

const mockUseMetrics = useMetrics as jest.Mock;
const mockUseRbac = useRbac as jest.Mock;
const mockGetMetricConsumers = getMetricConsumers as jest.Mock;

function makeMetric(overrides: Partial<Metric> = {}): Metric {
  return {
    id: 1,
    name: 'Retention Rate',
    description: null,
    schema_name: 's',
    table_name: 't',
    column: 'c',
    aggregation: 'sum',
    column_expression: null,
    created_by: 'admin@test.com',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function setup(metrics: Metric[], { canShare = true }: { canShare?: boolean } = {}) {
  lastShareModalProps = null;
  lastBulkShareDialogProps = null;
  pendingResponseBox.current = null;
  const mutate = jest.fn();
  mockUseMetrics.mockReturnValue({
    data: metrics,
    total: metrics.length,
    totalPages: 1,
    isLoading: false,
    isError: undefined,
    mutate,
  });
  mockGetMetricConsumers.mockResolvedValue({ charts: [], kpis: [], alerts: [] });
  mockUseRbac.mockReturnValue({
    hasPermission: (perm: string) => (perm === 'can_share_metrics' ? canShare : true),
    role: 'admin',
    isLoaded: true,
    hasRole: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
  });
  render(<MetricsLibrary />);
  return { mutate };
}

describe('MetricsLibrary — per-item Share action', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens ShareModal with entityType="metric" when the row Share button is clicked', async () => {
    const user = userEvent.setup();
    setup([makeMetric({ id: 7, name: 'Retention Rate' })]);

    await user.click(screen.getByTestId('metric-share-btn-7'));

    expect(screen.getByTestId('stub-share-modal')).toHaveTextContent('share-modal:metric');
    expect(lastShareModalProps.entityId).toBe(7);
    expect(lastShareModalProps.resourceName).toBe('Retention Rate');
  });

  it('hides the Share button and checkbox column when the viewer lacks can_share_metrics', () => {
    setup([makeMetric({ id: 7 })], { canShare: false });
    expect(screen.queryByTestId('metric-share-btn-7')).not.toBeInTheDocument();
    expect(screen.queryByTestId('metric-select-7')).not.toBeInTheDocument();
  });
});

describe('MetricsLibrary — bulk selection bar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMultiSelect.mockImplementation(actualUseMultiSelect);
  });

  it('selecting a row shows the bar with a count; clear hides it', async () => {
    const user = userEvent.setup();
    setup([makeMetric({ id: 1 }), makeMetric({ id: 2, name: 'Other Metric' })]);

    expect(screen.queryByTestId('metric-bulk-share-bar')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('metric-select-1'));
    const bar = screen.getByTestId('metric-bulk-share-bar');
    expect(bar).toHaveTextContent('1 selected');

    await user.click(screen.getByTestId('metric-bulk-clear-btn'));
    expect(screen.queryByTestId('metric-bulk-share-bar')).not.toBeInTheDocument();
  });

  it('opens BulkShareDialog with metric items, allowPublicLink=false, and revalidates + deselects applied ids on apply', async () => {
    const user = userEvent.setup();
    const { mutate } = setup([makeMetric({ id: 1 }), makeMetric({ id: 2, name: 'Other Metric' })]);

    await user.click(screen.getByTestId('metric-select-1'));
    await user.click(screen.getByTestId('metric-select-2'));
    await user.click(screen.getByTestId('metric-bulk-share-btn'));

    expect(lastBulkShareDialogProps.entityType).toBe('metric');
    expect(lastBulkShareDialogProps.allowPublicLink).toBe(false);
    expect(lastBulkShareDialogProps.items).toEqual(
      expect.arrayContaining([
        { rtype: 'metric', id: '1' },
        { rtype: 'metric', id: '2' },
      ])
    );

    const response: BulkAccessResponse = {
      applied: [{ rtype: 'metric', id: '1' }],
      skipped: [{ rtype: 'metric', id: '2', reason: 'member_grants_deferred' }],
      requires_confirmation: [],
      applied_count: 1,
      skipped_count: 1,
    };
    pendingResponseBox.current = response;
    await user.click(screen.getByTestId('stub-bulk-apply'));

    expect(mutate).toHaveBeenCalled();
    // Only the applied id (1) is deselected; the skipped id (2) stays selected.
    expect(screen.getByTestId('metric-bulk-share-bar')).toHaveTextContent('1 selected');
  });
});
