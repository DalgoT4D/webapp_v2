/**
 * SnapshotViewerPage — 403 interception (Milestone 9 request-access) and
 * the summary CommentPopover's fixed gating (previously locked behind
 * canEdit/CAN_EDIT_DASHBOARDS, which blocked Members from commenting at
 * all — Task 14 relaxed comment creation to resolver-View).
 *
 * `DashboardNativeView` is heavy (grid layout, chart rendering, filters) and
 * is covered by its own suites — stubbed here so this file only asserts the
 * page-level branching this task changed.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import SnapshotViewerPage from '../page';
import { useSnapshotView } from '@/hooks/api/useReports';
import { useCommentStates } from '@/hooks/api/useComments';
import { useResourceAccess } from '@/hooks/api/useResourceAccess';
import { useRbac } from '@/lib/rbac';

jest.mock('next/navigation', () => ({
  useParams: () => ({ snapshotId: '42' }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/hooks/api/useReports', () => ({
  useSnapshotView: jest.fn(),
  updateSnapshot: jest.fn(),
}));
jest.mock('@/hooks/api/useComments', () => ({
  useCommentStates: jest.fn(),
}));
jest.mock('@/hooks/api/useResourceAccess');
jest.mock('@/hooks/usePdfDownload', () => ({
  usePdfDownload: () => ({ isExporting: false, download: jest.fn() }),
}));
jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/components/dashboard/dashboard-native-view', () => ({
  DashboardNativeView: ({ topRightContent }: any) => (
    <div data-testid="stub-dashboard-native-view">{topRightContent}</div>
  ),
}));
jest.mock('@/components/reports/report-share-menu', () => ({
  ReportShareMenu: () => <div data-testid="stub-share-menu" />,
}));
jest.mock('@/components/reports/comment-popover', () => ({
  CommentPopover: ({ targetType, chartId }: any) => (
    <div data-testid={`comment-trigger-${targetType}${chartId ? `-${chartId}` : ''}`} />
  ),
}));
jest.mock('@/components/sharing/request-access-screen', () => ({
  RequestAccessScreen: ({ rtype, resourceId, resourceLabel }: any) => (
    <div data-testid="stub-request-access-screen">
      {rtype}:{resourceId}:{resourceLabel}
    </div>
  ),
}));

const mockUseSnapshotView = useSnapshotView as jest.Mock;
const mockUseCommentStates = useCommentStates as jest.Mock;
const mockUseResourceAccess = useResourceAccess as jest.Mock;
const mockUseRbac = useRbac as jest.Mock;

const baseViewData = {
  dashboard_data: { id: 1, filters: [] as unknown[] },
  report_metadata: {
    snapshot_id: 42,
    title: 'Q1 report',
    period_end: '2026-03-31',
    dashboard_title: 'Field ops',
  },
  frozen_chart_configs: {},
};

function setup({
  snapshotOverrides = {},
  canEdit = false,
  effectivePermission = 'view',
}: {
  snapshotOverrides?: Partial<ReturnType<typeof useSnapshotView>>;
  canEdit?: boolean;
  effectivePermission?: 'view' | 'edit' | null;
} = {}) {
  mockUseRbac.mockReturnValue({
    hasPermission: (perm: string) => (perm.includes('edit') ? canEdit : true),
    role: 'member',
    isLoaded: true,
    hasRole: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
  });
  mockUseSnapshotView.mockReturnValue({
    viewData: baseViewData,
    isLoading: false,
    isError: undefined,
    mutate: jest.fn(),
    ...snapshotOverrides,
  });
  mockUseCommentStates.mockReturnValue({ states: [], mutate: jest.fn() });
  mockUseResourceAccess.mockReturnValue({
    data: { viewer: { effective_permission: effectivePermission, is_owner: false } },
    isLoading: false,
    isError: undefined,
    mutate: jest.fn(),
  });
}

describe('SnapshotViewerPage — 403 interception', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders RequestAccessScreen when the snapshot fetch 403s', () => {
    const apiError = Object.assign(new Error('You do not have access to this report'), {
      status: 403,
    });
    setup({ snapshotOverrides: { viewData: undefined, isError: apiError } });

    render(<SnapshotViewerPage />);

    expect(screen.getByTestId('stub-request-access-screen')).toHaveTextContent('report:42:report');
    expect(screen.queryByTestId('stub-dashboard-native-view')).not.toBeInTheDocument();
  });

  it('renders the report normally on a non-403 load', () => {
    setup();

    render(<SnapshotViewerPage />);

    expect(screen.getByTestId('stub-dashboard-native-view')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-request-access-screen')).not.toBeInTheDocument();
  });

  it('does not treat a non-403 error as a request-access case', () => {
    const apiError = Object.assign(new Error('Snapshot not found'), { status: 404 });
    setup({ snapshotOverrides: { viewData: undefined, isError: apiError } });

    render(<SnapshotViewerPage />);

    expect(screen.queryByTestId('stub-request-access-screen')).not.toBeInTheDocument();
  });
});

describe('SnapshotViewerPage — summary comment trigger gating', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the summary comment trigger for a viewer without CAN_EDIT_DASHBOARDS (Member)', () => {
    setup({ canEdit: false, effectivePermission: 'view' });

    render(<SnapshotViewerPage />);

    // Previously this was locked behind `canEdit &&`, hiding it from Members.
    expect(screen.getByTestId('comment-trigger-summary')).toBeInTheDocument();
    // The summary-edit pencil is a separate (role-gated) affordance, unaffected.
    expect(screen.queryByTestId('summary-edit-btn')).not.toBeInTheDocument();
  });

  it('still shows the summary-edit pencil for a viewer with CAN_EDIT_DASHBOARDS', () => {
    setup({ canEdit: true, effectivePermission: 'edit' });

    render(<SnapshotViewerPage />);

    expect(screen.getByTestId('comment-trigger-summary')).toBeInTheDocument();
    expect(screen.getByTestId('summary-edit-btn')).toBeInTheDocument();
  });
});
