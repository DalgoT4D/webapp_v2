/**
 * SnapshotViewerPage Component Tests
 *
 * Tests for app/reports/[snapshotId]/page.tsx covering:
 * - Rendering: header, metadata, executive summary
 * - Summary editing and saving
 * - Loading and error states
 * - Download and share actions
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SnapshotViewerPage from '@/app/reports/[snapshotId]/page';
import * as useReportsHook from '@/hooks/api/useReports';
import * as toastModule from '@/lib/toast';
import { createMockSnapshotViewData } from './report-mock-data';
import { TestWrapper } from '@/test-utils/render';

// ============ Mocks ============

jest.mock('@/hooks/api/useReports');

jest.mock('@/lib/toast', () => ({
  toastSuccess: { saved: jest.fn(), exported: jest.fn(), generic: jest.fn() },
  toastError: { save: jest.fn(), export: jest.fn(), generic: jest.fn() },
  toastInfo: { generic: jest.fn() },
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useParams: () => ({ snapshotId: '1' }),
  useSearchParams: () => ({ get: () => null }),
}));

// Mock usePdfDownload
const mockDownload = jest.fn();
jest.mock('@/hooks/usePdfDownload', () => ({
  usePdfDownload: () => ({ isExporting: false, download: mockDownload }),
}));

// Mock DashboardNativeView to avoid complex rendering
jest.mock('@/components/dashboard/dashboard-native-view', () => ({
  DashboardNativeView: ({
    beforeContent,
  }: {
    dashboardId: number;
    dashboardData: unknown;
    isReportMode: boolean;
    frozenChartConfigs: unknown;
    hideHeader: boolean;
    beforeContent?: React.ReactNode;
  }) => (
    <div data-testid="dashboard-native-view">
      {beforeContent}
      <div>Mock Dashboard View</div>
    </div>
  ),
}));

// Mock useCommentStates
jest.mock('@/hooks/api/useComments', () => ({
  useCommentStates: () => ({ states: [], mutate: jest.fn() }),
}));

// Mock CommentPopover
jest.mock('@/components/reports/comment-popover', () => ({
  CommentPopover: () => <div data-testid="mock-comment-popover" />,
}));

// Mock useUserPermissions — default: all permissions granted
const mockHasPermission = jest.fn().mockReturnValue(true);
jest.mock('@/hooks/api/usePermissions', () => ({
  useUserPermissions: () => ({
    permissions: [],
    hasPermission: mockHasPermission,
    hasAnyPermission: jest.fn().mockReturnValue(true),
    hasAllPermissions: jest.fn().mockReturnValue(true),
    isLoading: false,
  }),
}));

// Mock useAuthStore — return current user email matching created_by in mock data
const mockGetCurrentUserEmail = jest.fn().mockReturnValue('user@test.com');
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      getCurrentOrgUser: () => ({ email: mockGetCurrentUserEmail() }),
    }),
}));

// Mock ReportShareMenu — renders a testable version with both share options
jest.mock('@/components/reports/report-share-menu', () => {
  const { useState } = require('react');
  return {
    ReportShareMenu: ({
      snapshotId,
      reportTitle,
    }: {
      snapshotId: number;
      reportTitle?: string;
    }) => {
      const [menuOpen, setMenuOpen] = useState(false);
      const [linkOpen, setLinkOpen] = useState(false);
      const [emailOpen, setEmailOpen] = useState(false);
      return (
        <div data-testid="report-share-menu">
          <button
            data-testid="report-share-btn"
            aria-label="Share report"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            Share
          </button>
          {menuOpen && (
            <div data-testid="share-menu-dropdown">
              <button
                data-testid="share-via-link-item"
                onClick={() => {
                  setLinkOpen(true);
                  setMenuOpen(false);
                }}
              >
                Share via link
              </button>
              <button
                data-testid="share-via-email-item"
                onClick={() => {
                  setEmailOpen(true);
                  setMenuOpen(false);
                }}
              >
                Embed in email
              </button>
            </div>
          )}
          {linkOpen && (
            <div data-testid="share-via-link-dialog">
              <button data-testid="close-link-dialog" onClick={() => setLinkOpen(false)}>
                Close
              </button>
            </div>
          )}
          {emailOpen && (
            <div data-testid="share-via-email-dialog">
              <button data-testid="close-email-dialog" onClick={() => setEmailOpen(false)}>
                Close
              </button>
            </div>
          )}
        </div>
      );
    },
  };
});

// ============ Helpers ============

const mockViewData = createMockSnapshotViewData({
  report_metadata: {
    snapshot_id: 1,
    title: 'Monthly Sales Report',
    date_column: { schema_name: 'public', table_name: 'sales', column_name: 'created_at' },
    period_start: '2025-01-01',
    period_end: '2025-01-31',
    summary: 'This is the initial summary.',
    created_at: '2025-01-31T10:00:00Z',
    updated_at: '2025-01-31T10:00:00Z',
    created_by: 'user@test.com',
    dashboard_title: 'Sales Dashboard',
  },
});

const mockUseSnapshotView = (
  overrides: Partial<ReturnType<typeof useReportsHook.useSnapshotView>> = {}
) => {
  (useReportsHook.useSnapshotView as jest.Mock).mockReturnValue({
    viewData: mockViewData,
    isLoading: false,
    isError: null,
    mutate: jest.fn(),
    ...overrides,
  });
};

const renderPage = () =>
  render(
    <TestWrapper>
      <SnapshotViewerPage />
    </TestWrapper>
  );

// ============ Test Suite ============

describe('SnapshotViewerPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSnapshotView();
  });

  describe('Rendering', () => {
    it('renders report title', () => {
      renderPage();

      expect(screen.getByText('Monthly Sales Report')).toBeInTheDocument();
    });

    it('renders back button', () => {
      renderPage();

      expect(screen.getByTestId('report-back-btn')).toBeInTheDocument();
    });

    it('renders date range in metadata', () => {
      renderPage();

      // formatDateShort('2025-01-01') => 'Jan 1st, 2025'
      // formatDateShort('2025-01-31') => 'Jan 31st, 2025'
      expect(screen.getByText(/Jan 1st, 2025/)).toBeInTheDocument();
      expect(screen.getByText(/Jan 31st, 2025/)).toBeInTheDocument();
    });

    it('renders created by in metadata', () => {
      renderPage();

      expect(screen.getByText(/Created by: user@test.com/)).toBeInTheDocument();
    });

    it('renders dashboard title in metadata', () => {
      renderPage();

      expect(screen.getByText('Sales Dashboard')).toBeInTheDocument();
    });

    it('renders the DashboardNativeView', () => {
      renderPage();

      expect(screen.getByTestId('dashboard-native-view')).toBeInTheDocument();
    });

    it('renders executive summary textarea', () => {
      renderPage();

      expect(screen.getByTestId('report-summary-textarea')).toBeInTheDocument();
    });

    it('pre-fills summary textarea with existing summary', () => {
      renderPage();

      const textarea = screen.getByTestId('report-summary-textarea') as HTMLTextAreaElement;
      expect(textarea.value).toBe('This is the initial summary.');
    });

    it('renders action buttons (download, share, save)', () => {
      renderPage();

      expect(screen.getByTestId('report-download-btn')).toBeInTheDocument();
      expect(screen.getByTestId('report-share-btn')).toBeInTheDocument();
      expect(screen.getByTestId('report-save-btn')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows skeleton when loading', () => {
      mockUseSnapshotView({ viewData: undefined, isLoading: true });

      const { container } = renderPage();

      const skeletons = container.querySelectorAll('[class*="skeleton"], [data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('does not render report content when loading', () => {
      mockUseSnapshotView({ viewData: undefined, isLoading: true });

      renderPage();

      expect(screen.queryByText('Monthly Sales Report')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message when data fails to load', () => {
      mockUseSnapshotView({ viewData: undefined, isError: new Error('Failed'), isLoading: false });

      renderPage();

      expect(screen.getByText('Failed to load report.')).toBeInTheDocument();
    });

    it('renders go back button on error', () => {
      mockUseSnapshotView({ viewData: undefined, isError: new Error('Failed'), isLoading: false });

      renderPage();

      expect(screen.getByTestId('report-go-back-btn')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('navigates back to reports list when back button is clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByTestId('report-back-btn'));

      expect(mockPush).toHaveBeenCalledWith('/reports');
    });
  });

  describe('Summary Editing', () => {
    it('allows editing the summary textarea', async () => {
      const user = userEvent.setup();
      renderPage();

      // Click edit button to enable editing (textarea starts readOnly)
      const editBtn = screen.getByTestId('summary-edit-btn');
      await user.click(editBtn);

      const textarea = screen.getByTestId('report-summary-textarea') as HTMLTextAreaElement;
      await user.clear(textarea);
      await user.type(textarea, 'Updated summary text.');

      expect(textarea.value).toBe('Updated summary text.');
    });

    it('calls updateSnapshot with new summary on save', async () => {
      const user = userEvent.setup();
      const mockMutate = jest.fn();
      (useReportsHook.updateSnapshot as jest.Mock).mockResolvedValue({ summary: 'New summary' });
      mockUseSnapshotView({ mutate: mockMutate });

      renderPage();

      // Click edit button to enable editing (textarea starts readOnly)
      const editBtn = screen.getByTestId('summary-edit-btn');
      await user.click(editBtn);

      const textarea = screen.getByTestId('report-summary-textarea') as HTMLTextAreaElement;
      await user.clear(textarea);
      await user.type(textarea, 'New summary');

      const saveBtn = screen.getByTestId('report-save-btn');
      await user.click(saveBtn);

      await waitFor(() => {
        expect(useReportsHook.updateSnapshot).toHaveBeenCalledWith(1, {
          summary: 'New summary',
        });
      });
    });

    it('shows success toast after successful save', async () => {
      const user = userEvent.setup();
      (useReportsHook.updateSnapshot as jest.Mock).mockResolvedValue({ summary: 'test' });

      renderPage();

      const saveBtn = screen.getByTestId('report-save-btn');
      await user.click(saveBtn);

      await waitFor(() => {
        expect(toastModule.toastSuccess.saved).toHaveBeenCalled();
      });
    });

    it('shows error toast when save fails', async () => {
      const user = userEvent.setup();
      (useReportsHook.updateSnapshot as jest.Mock).mockRejectedValue(new Error('Save failed'));

      renderPage();

      const saveBtn = screen.getByTestId('report-save-btn');
      await user.click(saveBtn);

      await waitFor(() => {
        expect(toastModule.toastError.save).toHaveBeenCalled();
      });
    });
  });

  describe('Download', () => {
    it('calls download function when download button is clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByTestId('report-download-btn'));

      expect(mockDownload).toHaveBeenCalled();
    });
  });

  describe('Share Menu', () => {
    it('renders share button when user has permission and is creator', () => {
      renderPage();

      expect(screen.getByTestId('report-share-btn')).toBeInTheDocument();
    });

    it('shows share via link and embed in email options when share button is clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      // Dropdown should not be visible initially
      expect(screen.queryByTestId('share-menu-dropdown')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('report-share-btn'));

      expect(screen.getByTestId('share-via-link-item')).toBeInTheDocument();
      expect(screen.getByTestId('share-via-email-item')).toBeInTheDocument();
    });

    it('opens share via link dialog when link option is clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByTestId('report-share-btn'));
      await user.click(screen.getByTestId('share-via-link-item'));

      expect(screen.getByTestId('share-via-link-dialog')).toBeInTheDocument();
      expect(screen.queryByTestId('share-via-email-dialog')).not.toBeInTheDocument();
    });

    it('opens embed in email dialog when email option is clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByTestId('report-share-btn'));
      await user.click(screen.getByTestId('share-via-email-item'));

      expect(screen.getByTestId('share-via-email-dialog')).toBeInTheDocument();
      expect(screen.queryByTestId('share-via-link-dialog')).not.toBeInTheDocument();
    });

    it('closes share via link dialog', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByTestId('report-share-btn'));
      await user.click(screen.getByTestId('share-via-link-item'));
      expect(screen.getByTestId('share-via-link-dialog')).toBeInTheDocument();

      await user.click(screen.getByTestId('close-link-dialog'));

      await waitFor(() => {
        expect(screen.queryByTestId('share-via-link-dialog')).not.toBeInTheDocument();
      });
    });

    it('closes embed in email dialog', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByTestId('report-share-btn'));
      await user.click(screen.getByTestId('share-via-email-item'));
      expect(screen.getByTestId('share-via-email-dialog')).toBeInTheDocument();

      await user.click(screen.getByTestId('close-email-dialog'));

      await waitFor(() => {
        expect(screen.queryByTestId('share-via-email-dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Permissions', () => {
    it('hides share button when user lacks can_share_dashboards', () => {
      mockHasPermission.mockImplementation((slug: string) => slug !== 'can_share_dashboards');
      renderPage();

      expect(screen.queryByTestId('report-share-btn')).not.toBeInTheDocument();
    });

    it('hides share button when user is not the report creator', () => {
      mockGetCurrentUserEmail.mockReturnValue('other@test.com');
      renderPage();

      expect(screen.queryByTestId('report-share-btn')).not.toBeInTheDocument();
    });

    it('hides save button when user lacks can_edit_dashboards', () => {
      mockHasPermission.mockImplementation((slug: string) => slug !== 'can_edit_dashboards');
      renderPage();

      expect(screen.queryByTestId('report-save-btn')).not.toBeInTheDocument();
    });

    it('hides edit and comment buttons when user lacks can_edit_dashboards', () => {
      mockHasPermission.mockImplementation((slug: string) => slug !== 'can_edit_dashboards');
      renderPage();

      expect(screen.queryByTestId('summary-edit-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mock-comment-popover')).not.toBeInTheDocument();
    });

    it('shows download button regardless of permissions', () => {
      mockHasPermission.mockReturnValue(false);
      renderPage();

      expect(screen.getByTestId('report-download-btn')).toBeInTheDocument();
    });

    it('shows share button when user has permission and is the creator', () => {
      mockHasPermission.mockReturnValue(true);
      mockGetCurrentUserEmail.mockReturnValue('user@test.com');
      renderPage();

      expect(screen.getByTestId('report-share-btn')).toBeInTheDocument();
    });

    it('shows all action buttons when user has full permissions and is creator', () => {
      mockHasPermission.mockReturnValue(true);
      mockGetCurrentUserEmail.mockReturnValue('user@test.com');
      renderPage();

      expect(screen.getByTestId('report-download-btn')).toBeInTheDocument();
      expect(screen.getByTestId('report-share-btn')).toBeInTheDocument();
      expect(screen.getByTestId('report-save-btn')).toBeInTheDocument();
      expect(screen.getByTestId('summary-edit-btn')).toBeInTheDocument();
      expect(screen.getByTestId('mock-comment-popover')).toBeInTheDocument();
    });
  });

  describe('Metadata - Edge Cases', () => {
    it('handles missing period_start gracefully', () => {
      const viewDataNoPeriodStart = createMockSnapshotViewData({
        report_metadata: {
          snapshot_id: 1,
          title: 'No Start Date Report',
          period_start: undefined,
          period_end: '2025-01-31',
          created_at: '2025-01-31T10:00:00Z',
          updated_at: '2025-01-31T10:00:00Z',
          dashboard_title: 'Dashboard',
        },
      });
      mockUseSnapshotView({ viewData: viewDataNoPeriodStart });

      renderPage();

      // Should show "All" for missing start date
      expect(screen.getByText(/All/)).toBeInTheDocument();
    });

    it('handles missing created_by gracefully', () => {
      const viewDataNoCreator = createMockSnapshotViewData({
        report_metadata: {
          snapshot_id: 1,
          title: 'No Creator Report',
          period_end: '2025-01-31',
          created_at: '2025-01-31T10:00:00Z',
          updated_at: '2025-01-31T10:00:00Z',
          dashboard_title: 'Dashboard',
          created_by: undefined,
        },
      });
      mockUseSnapshotView({ viewData: viewDataNoCreator });

      renderPage();

      expect(screen.queryByText(/Created by:/)).not.toBeInTheDocument();
    });
  });
});
