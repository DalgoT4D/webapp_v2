/**
 * KPIPageComponent — M5: per-item Share + bulk-selection bar + BulkShareDialog
 * wiring, mirroring app/alerts/__tests__/page-bulk-share.test.tsx. ShareModal/
 * BulkShareDialog themselves are unit-tested elsewhere, so they're stubbed
 * here to isolate the page's own wiring: the per-card checkbox overlay, the
 * card's Share menu item, the bar's count/select-all/clear, and the
 * items/onApplied contract handed to the dialog.
 */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KPIPageComponent } from '../kpi-page';
import { useKPIs, useKPIData, useProgramTags, deleteKPI } from '@/hooks/api/useKPIs';
import { useRbac } from '@/lib/rbac';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import type { KPI } from '@/types/kpis';
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
jest.mock('swr', () => ({
  ...jest.requireActual('swr'),
  useSWRConfig: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/hooks/api/useKPIs', () => ({
  useKPIs: jest.fn(),
  useKPIData: jest.fn(),
  useProgramTags: jest.fn(),
  deleteKPI: jest.fn(),
}));
jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('../kpi-form', () => ({ KPIForm: (): null => null }));
jest.mock('../kpi-detail-drawer', () => ({ KPIDetailDrawer: (): null => null }));
jest.mock('../kpi-delete-dialog', () => ({ KPIDeleteDialog: (): null => null }));
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

const mockUseKPIs = useKPIs as jest.Mock;
const mockUseKPIData = useKPIData as jest.Mock;
const mockUseProgramTags = useProgramTags as jest.Mock;
const mockUseRbac = useRbac as jest.Mock;

function makeKPI(overrides: Partial<KPI> = {}): KPI {
  return {
    id: 1,
    name: 'Monthly Beneficiaries',
    metric: {
      id: 1,
      name: 'Beneficiaries',
      description: null,
      schema_name: 's',
      table_name: 't',
      column: 'c',
      aggregation: 'sum',
      column_expression: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    target_value: 100,
    direction: 'increase',
    green_threshold_pct: 100,
    amber_threshold_pct: 80,
    time_grain: 'monthly',
    time_dimension_column: null,
    metric_type_tag: null,
    program_tags: [],
    display_order: 0,
    extra_config: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function setup(kpis: KPI[], { canShare = true }: { canShare?: boolean } = {}) {
  lastShareModalProps = null;
  lastBulkShareDialogProps = null;
  pendingResponseBox.current = null;
  const mutate = jest.fn();
  mockUseKPIs.mockReturnValue({
    data: kpis,
    total: kpis.length,
    totalPages: 1,
    isLoading: false,
    isError: undefined,
    mutate,
  });
  mockUseKPIData.mockReturnValue({
    chartData: undefined,
    echartsConfig: undefined,
    isLoading: false,
    isError: undefined,
  });
  mockUseProgramTags.mockReturnValue({ tags: [] });
  mockUseRbac.mockReturnValue({
    hasPermission: (perm: string) => (perm === 'can_share_kpis' ? canShare : true),
    role: 'admin',
    isLoaded: true,
    hasRole: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
  });
  render(<KPIPageComponent />);
  return { mutate };
}

describe('KPIPageComponent — per-item Share action', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens ShareModal with entityType="kpi" from a card\'s Share menu item', async () => {
    const user = userEvent.setup();
    setup([makeKPI({ id: 7, name: 'Monthly Beneficiaries' })]);

    // downloadInMenu routes Share into the card's ⋮ dropdown (menuItems).
    // The bulk-select checkbox overlay is also a <button> (Radix Checkbox),
    // and sits first in DOM order, so it must be filtered out explicitly.
    const card = screen.getByTestId('kpi-card-7');
    const buttons = within(card).getAllByRole('button');
    const menuTrigger = buttons.find((b) => b.getAttribute('role') !== 'checkbox') as HTMLElement;
    await user.click(menuTrigger);
    await user.click(screen.getByText('Share KPI'));

    expect(screen.getByTestId('stub-share-modal')).toHaveTextContent('share-modal:kpi');
    expect(lastShareModalProps.entityId).toBe(7);
    expect(lastShareModalProps.resourceName).toBe('Monthly Beneficiaries');
  });

  it('hides the checkbox overlay when the viewer lacks can_share_kpis', () => {
    setup([makeKPI({ id: 7 })], { canShare: false });
    expect(screen.queryByTestId('kpi-select-7')).not.toBeInTheDocument();
  });
});

describe('KPIPageComponent — bulk selection bar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMultiSelect.mockImplementation(actualUseMultiSelect);
  });

  it('selecting a card shows the bar with a count; clear hides it', async () => {
    const user = userEvent.setup();
    setup([makeKPI({ id: 1 }), makeKPI({ id: 2, name: 'Other KPI' })]);

    expect(screen.queryByTestId('kpi-bulk-share-bar')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('kpi-select-1'));
    const bar = screen.getByTestId('kpi-bulk-share-bar');
    expect(bar).toHaveTextContent('1 selected');

    await user.click(screen.getByTestId('kpi-bulk-clear-btn'));
    expect(screen.queryByTestId('kpi-bulk-share-bar')).not.toBeInTheDocument();
  });

  it('opens BulkShareDialog with kpi items, allowPublicLink=false, and revalidates + deselects applied ids on apply', async () => {
    const user = userEvent.setup();
    const { mutate } = setup([makeKPI({ id: 1 }), makeKPI({ id: 2, name: 'Other KPI' })]);

    await user.click(screen.getByTestId('kpi-select-1'));
    await user.click(screen.getByTestId('kpi-select-2'));
    await user.click(screen.getByTestId('kpi-bulk-share-btn'));

    expect(lastBulkShareDialogProps.entityType).toBe('kpi');
    expect(lastBulkShareDialogProps.allowPublicLink).toBe(false);
    expect(lastBulkShareDialogProps.items).toEqual(
      expect.arrayContaining([
        { rtype: 'kpi', id: '1' },
        { rtype: 'kpi', id: '2' },
      ])
    );

    const response: BulkAccessResponse = {
      applied: [{ rtype: 'kpi', id: '1' }],
      skipped: [{ rtype: 'kpi', id: '2', reason: 'member_grants_deferred' }],
      requires_confirmation: [],
      applied_count: 1,
      skipped_count: 1,
    };
    pendingResponseBox.current = response;
    await user.click(screen.getByTestId('stub-bulk-apply'));

    expect(mutate).toHaveBeenCalled();
    expect(screen.getByTestId('kpi-bulk-share-bar')).toHaveTextContent('1 selected');
  });
});
