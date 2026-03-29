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

// Mock ShareModal
jest.mock('@/components/ui/share-modal', () => ({
  ShareModal: ({
    isOpen,
    onClose,
  }: {
    entityId: number;
    entityLabel: string;
    isOpen: boolean;
    onClose: () => void;
    getShareStatus: (id: number) => Promise<unknown>;
    updateSharing: (id: number, data: { is_public: boolean }) => Promise<unknown>;
  }) =>
    isOpen ? (
      <div data-testid="report-share-modal">
        <button data-testid="mock-close-share-modal" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

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

      // formatDateShort('2025-01-01') => '01/01/2025'
      // formatDateShort('2025-01-31') => '01/31/2025'
      expect(screen.getByText(/01\/01\/2025/)).toBeInTheDocument();
      expect(screen.getByText(/01\/31\/2025/)).toBeInTheDocument();
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

  describe('Share Modal', () => {
    it('opens share modal when share button is clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      // Share modal should not be open initially
      expect(screen.queryByTestId('report-share-modal')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('report-share-btn'));

      expect(screen.getByTestId('report-share-modal')).toBeInTheDocument();
    });

    it('closes share modal when close is triggered', async () => {
      const user = userEvent.setup();
      renderPage();

      // Open share modal
      await user.click(screen.getByTestId('report-share-btn'));
      expect(screen.getByTestId('report-share-modal')).toBeInTheDocument();

      // Close it
      await user.click(screen.getByTestId('mock-close-share-modal'));

      await waitFor(() => {
        expect(screen.queryByTestId('report-share-modal')).not.toBeInTheDocument();
      });
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
