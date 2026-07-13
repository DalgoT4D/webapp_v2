/**
 * AlertsPage — bulk-selection bar + per-item Share (task-17f).
 *
 * Unlike page.test.tsx (which stubs AlertsTable to isolate the deep-link
 * behavior), this suite renders the REAL AlertsTable so the full wiring —
 * row Share button -> ShareModal, checkboxes -> bulk bar -> BulkShareDialog
 * — is exercised end-to-end. ShareModal/BulkShareDialog themselves are
 * unit-tested elsewhere, so they're stubbed here to isolate the page/table
 * wiring this task adds.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AlertsPage from '../page';
import { useAlerts } from '@/hooks/api/useAlerts';
import { useResourceAccess } from '@/hooks/api/useResourceAccess';
import { useRbac } from '@/lib/rbac';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import type { AlertListItem } from '@/types/alerts';
import type { BulkAccessResponse } from '@/hooks/api/useResourceAccess';

// Real hook by default; overridden directly in the cross-page bar-text test
// below to pin selection state that isn't reachable through clicks alone
// (an id selected on a page that isn't currently rendered) — mirrors the
// pattern in dashboard-bulk-share.test.tsx / reports-bulk-share.test.tsx.
jest.mock('@/hooks/useMultiSelect', () => {
  const actual = jest.requireActual('@/hooks/useMultiSelect');
  return { ...actual, useMultiSelect: jest.fn(actual.useMultiSelect) };
});
const mockUseMultiSelect = useMultiSelect as jest.Mock;
const actualUseMultiSelect = jest.requireActual('@/hooks/useMultiSelect').useMultiSelect;

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/hooks/api/useAlerts', () => ({
  useAlerts: jest.fn(),
  toggleAlert: jest.fn(),
  deleteAlert: jest.fn(),
}));
jest.mock('@/hooks/api/useResourceAccess');
jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/components/alerts/AlertWizardModal', () => ({
  AlertWizardModal: (): null => null,
}));
jest.mock('@/components/alerts/AlertLogModal', () => ({
  AlertLogModal: (): null => null,
}));
jest.mock('@/components/sharing/request-access-screen', () => ({
  RequestAccessScreen: (): null => null,
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

const mockUseAlerts = useAlerts as jest.Mock;
const mockUseResourceAccess = useResourceAccess as jest.Mock;
const mockUseRbac = useRbac as jest.Mock;

function makeAlert(overrides: Partial<AlertListItem> = {}): AlertListItem {
  return {
    id: 1,
    name: 'Sample',
    alert_type: 'metric_threshold' as any,
    source_kind: 'metric',
    source_id: 10,
    source_name: 'Revenue',
    condition_pretty: 'value > 100',
    rag_states: null,
    kpi_rag_context: null,
    schedule_frequency: 'daily',
    schedule_cron: '30 3 * * *',
    is_active: true,
    last_fire_at: null,
    fire_streak: 0,
    ...overrides,
  };
}

function setup(alerts: AlertListItem[], { canShare = true }: { canShare?: boolean } = {}) {
  lastShareModalProps = null;
  lastBulkShareDialogProps = null;
  pendingResponseBox.current = null;
  const mutate = jest.fn();
  mockUseAlerts.mockReturnValue({
    data: alerts,
    total: alerts.length,
    totalPages: 1,
    isLoading: false,
    isError: undefined,
    mutate,
  });
  mockUseResourceAccess.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: undefined,
    mutate: jest.fn(),
  });
  mockUseRbac.mockReturnValue({
    hasPermission: (perm: string) => (perm === 'can_share_alerts' ? canShare : true),
    role: 'admin',
    isLoaded: true,
    hasRole: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
  });
  render(<AlertsPage />);
  return { mutate };
}

describe('AlertsPage — per-item Share action', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens ShareModal with entityType="alert" when the row Share button is clicked', async () => {
    const user = userEvent.setup();
    setup([makeAlert({ id: 7, name: 'Revenue drop' })]);

    await user.click(screen.getByTestId('alert-share-btn-7'));

    expect(screen.getByTestId('stub-share-modal')).toHaveTextContent('share-modal:alert');
    expect(lastShareModalProps.entityId).toBe(7);
  });

  it('hides the Share button when the viewer lacks can_share_alerts', () => {
    setup([makeAlert({ id: 7 })], { canShare: false });
    expect(screen.queryByTestId('alert-share-btn-7')).not.toBeInTheDocument();
  });
});

describe('AlertsPage — bulk selection bar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMultiSelect.mockImplementation(actualUseMultiSelect);
  });

  it('selecting a row shows the bar with a count (no page-local denominator); clear hides it', async () => {
    const user = userEvent.setup();
    setup([makeAlert({ id: 1 }), makeAlert({ id: 2 })]);

    expect(screen.queryByTestId('alert-bulk-share-bar')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('alert-select-1'));
    const bar = screen.getByTestId('alert-bulk-share-bar');
    expect(bar).toHaveTextContent('1 selected');
    // Regression guard for the old page-local "N of M selected" phrasing
    // that lied once selection persisted across pagination (finding 1).
    expect(bar).not.toHaveTextContent('of 2 selected');
    expect(bar).not.toHaveTextContent('other pages');

    await user.click(screen.getByTestId('alert-bulk-clear-btn'));
    expect(screen.queryByTestId('alert-bulk-share-bar')).not.toBeInTheDocument();
  });

  it('shows the true cross-page selection count and flags off-page selections instead of contradicting the visible checkboxes (finding 1)', () => {
    // id 999 stands in for an alert selected on a different page — it isn't
    // among the two rendered rows.
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
    setup([makeAlert({ id: 1 }), makeAlert({ id: 2 })]);

    const bar = screen.getByTestId('alert-bulk-share-bar');
    expect(bar).toHaveTextContent('2 selected');
    expect(bar).toHaveTextContent('1 on other pages');
    expect(bar).not.toHaveTextContent('of 2 selected');
  });

  it('opens BulkShareDialog with alert items, allowPublicLink=false, and revalidates on apply', async () => {
    const user = userEvent.setup();
    const { mutate } = setup([makeAlert({ id: 1 }), makeAlert({ id: 2 })]);

    await user.click(screen.getByTestId('alert-select-1'));
    await user.click(screen.getByTestId('alert-select-2'));
    await user.click(screen.getByTestId('alert-bulk-share-btn'));

    expect(lastBulkShareDialogProps.entityType).toBe('alert');
    expect(lastBulkShareDialogProps.allowPublicLink).toBe(false);
    expect(lastBulkShareDialogProps.items).toEqual(
      expect.arrayContaining([
        { rtype: 'alert', id: '1' },
        { rtype: 'alert', id: '2' },
      ])
    );

    const response: BulkAccessResponse = {
      applied: [{ rtype: 'alert', id: '1' }],
      skipped: [{ rtype: 'alert', id: '2', reason: 'edit_access_denied' }],
      requires_confirmation: [],
      applied_count: 1,
      skipped_count: 1,
    };
    pendingResponseBox.current = response;
    await user.click(screen.getByTestId('stub-bulk-apply'));

    expect(mutate).toHaveBeenCalled();
    expect(screen.getByTestId('alert-bulk-share-bar')).toHaveTextContent('1 selected');
  });
});
