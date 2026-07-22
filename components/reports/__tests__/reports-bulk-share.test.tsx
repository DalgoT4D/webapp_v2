/**
 * ReportsPage bulk-share wiring: checkbox column, bar count/select-all/
 * clear, gating, and the items/onApplied contract. BulkShareDialog itself is
 * unit-tested in its own suite.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestWrapper } from '@/test-utils/render';
import ReportsPage from '@/app/reports/page';
import * as useReportsHook from '@/hooks/api/useReports';
import { mockSnapshots } from './report-mock-data';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import type { BulkAccessResponse } from '@/hooks/api/useResourceAccess';

jest.mock('@/hooks/api/useReports');

// Real hook by default; overridden directly in the cross-page/header-uncheck
// tests below to pin selection state that isn't reachable through clicks
// alone (e.g. an id selected on a page that isn't currently rendered) —
// mirrors the pattern in dashboard-bulk-share.test.tsx.
jest.mock('@/hooks/useMultiSelect', () => {
  const actual = jest.requireActual('@/hooks/useMultiSelect');
  return { ...actual, useMultiSelect: jest.fn(actual.useMultiSelect) };
});
const mockUseMultiSelect = useMultiSelect as jest.Mock;
const actualUseMultiSelect = jest.requireActual('@/hooks/useMultiSelect').useMultiSelect;

jest.mock('@/lib/toast', () => ({
  toastSuccess: { deleted: jest.fn(), generic: jest.fn() },
  toastError: { delete: jest.fn(), generic: jest.fn() },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/components/reports/create-snapshot-dialog', () => ({
  CreateSnapshotDialog: ({ trigger }: { trigger?: React.ReactNode }) =>
    trigger ? <>{trigger}</> : <button data-testid="create-snapshot-trigger">Create Report</button>,
}));

jest.mock('@/components/ui/confirmation-dialog', () => ({
  useConfirmationDialog: () => ({
    confirm: jest.fn(),
    DialogComponent: (): null => null,
  }),
}));

const mockHasPermission = jest.fn().mockReturnValue(true);
jest.mock('@/lib/rbac', () => {
  const actual = jest.requireActual('@/lib/rbac');
  return {
    ...actual,
    useRbac: () => ({
      hasPermission: mockHasPermission,
      hasAnyPermission: jest.fn().mockReturnValue(true),
      hasAllPermissions: jest.fn().mockReturnValue(true),
      hasRole: jest.fn().mockReturnValue(true),
      role: actual.ROLES.ADMIN,
    }),
  };
});

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
      </div>
    );
  },
}));

const mockUseSnapshots = (overrides: { mutate?: jest.Mock } = {}) => {
  const mutate = overrides.mutate ?? jest.fn();
  (useReportsHook.useSnapshots as jest.Mock).mockReturnValue({
    snapshots: mockSnapshots.slice(0, 2),
    isLoading: false,
    isError: null,
    mutate,
  });
  return mutate;
};

const renderPage = () =>
  render(
    <TestWrapper>
      <ReportsPage />
    </TestWrapper>
  );

describe('ReportsPage — bulk selection bar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasPermission.mockReturnValue(true);
    lastBulkShareDialogProps = null;
    pendingResponseBox.current = null;
    mockUseMultiSelect.mockImplementation(actualUseMultiSelect);
  });

  it('shows a checkbox per row when the viewer can share reports', () => {
    mockUseSnapshots();
    renderPage();
    expect(screen.getByTestId(`report-select-${mockSnapshots[0].id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`report-select-${mockSnapshots[1].id}`)).toBeInTheDocument();
  });

  it('hides checkboxes and the bar when the viewer cannot share reports', () => {
    mockHasPermission.mockImplementation((perm: string) => perm !== 'can_share_reports');
    mockUseSnapshots();
    renderPage();
    expect(screen.queryByTestId(`report-select-${mockSnapshots[0].id}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId('report-bulk-share-bar')).not.toBeInTheDocument();
  });

  it('selecting a row shows the bar with a count (no page-local denominator); clear hides it', async () => {
    const user = userEvent.setup();
    mockUseSnapshots();
    renderPage();

    expect(screen.queryByTestId('report-bulk-share-bar')).not.toBeInTheDocument();

    await user.click(screen.getByTestId(`report-select-${mockSnapshots[0].id}`));
    const bar = screen.getByTestId('report-bulk-share-bar');
    expect(bar).toHaveTextContent('1 selected');
    // Regression guard for the old page-local "N of M selected" phrasing
    // that lied once selection persisted across pagination (finding 1).
    expect(bar).not.toHaveTextContent('of 2 selected');
    expect(bar).not.toHaveTextContent('other pages');

    await user.click(screen.getByTestId('report-bulk-clear-btn'));
    expect(screen.queryByTestId('report-bulk-share-bar')).not.toBeInTheDocument();
  });

  it('shows the true cross-page selection count and flags off-page selections instead of contradicting the visible checkboxes (finding 1)', () => {
    // id 999 stands in for a row selected on a different page — it isn't
    // among the two rendered rows.
    mockUseMultiSelect.mockReturnValue({
      selectedIds: new Set([mockSnapshots[0].id, 999]),
      toggle: jest.fn(),
      selectPage: jest.fn(),
      deselectPage: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
      isAtCap: false,
      maxSelection: 100,
    });
    mockUseSnapshots();
    renderPage();

    const bar = screen.getByTestId('report-bulk-share-bar');
    expect(bar).toHaveTextContent('2 selected');
    expect(bar).toHaveTextContent('1 on other pages');
    expect(bar).not.toHaveTextContent('of 2 selected');
  });

  it('the header checkbox uncheck deselects only the current page, leaving off-page selections intact (finding 3)', async () => {
    const user = userEvent.setup();
    const deselectPage = jest.fn();
    const clear = jest.fn();
    mockUseMultiSelect.mockReturnValue({
      selectedIds: new Set([mockSnapshots[0].id, mockSnapshots[1].id, 999]),
      toggle: jest.fn(),
      selectPage: jest.fn(),
      deselectPage,
      remove: jest.fn(),
      clear,
      isAtCap: false,
      maxSelection: 100,
    });
    mockUseSnapshots();
    renderPage();

    await user.click(screen.getByTestId('report-bulk-select-all-header'));

    expect(deselectPage).toHaveBeenCalledWith([mockSnapshots[0].id, mockSnapshots[1].id]);
    expect(clear).not.toHaveBeenCalled();
  });

  it('opens BulkShareDialog with report items and allowPublicLink, and revalidates on apply', async () => {
    const user = userEvent.setup();
    const mutate = mockUseSnapshots();
    renderPage();

    await user.click(screen.getByTestId(`report-select-${mockSnapshots[0].id}`));
    await user.click(screen.getByTestId(`report-select-${mockSnapshots[1].id}`));
    await user.click(screen.getByTestId('report-bulk-share-btn'));

    expect(lastBulkShareDialogProps.entityType).toBe('report');
    expect(lastBulkShareDialogProps.allowPublicLink).toBe(true);
    expect(lastBulkShareDialogProps.items).toEqual(
      expect.arrayContaining([
        { rtype: 'report', id: String(mockSnapshots[0].id) },
        { rtype: 'report', id: String(mockSnapshots[1].id) },
      ])
    );

    const response: BulkAccessResponse = {
      applied: [{ rtype: 'report', id: String(mockSnapshots[0].id) }],
      skipped: [{ rtype: 'report', id: String(mockSnapshots[1].id), reason: 'edit_access_denied' }],
      requires_confirmation: [],
      applied_count: 1,
      skipped_count: 1,
    };
    pendingResponseBox.current = response;
    await user.click(screen.getByTestId('stub-bulk-apply'));

    expect(mutate).toHaveBeenCalled();
    expect(screen.getByTestId('report-bulk-share-bar')).toHaveTextContent('1 selected');
  });
});
