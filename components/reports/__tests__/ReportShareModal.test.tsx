/**
 * ReportShareModal Component Tests
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportShareModal } from '../ReportShareModal';
import * as useReportsHook from '@/hooks/api/useReports';
import { createMockShareStatus } from './report-mock-data';
import * as toastModule from '@/lib/toast';

// ============ Mocks ============

jest.mock('@/hooks/api/useReports');

jest.mock('@/lib/toast', () => ({
  toastSuccess: { generic: jest.fn() },
  toastError: { share: jest.fn(), load: jest.fn() },
}));

jest.mock('@/lib/clipboard', () => ({
  copyUrlToClipboard: jest.fn().mockResolvedValue(undefined),
}));

// Mock navigator.clipboard for the component's internal copy
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

// ============ Test Suite ============

describe('ReportShareModal', () => {
  const mockOnClose = jest.fn();
  const snapshotId = 1;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Modal Rendering', () => {
    it('renders modal when isOpen is true', () => {
      (useReportsHook.getReportSharingStatus as jest.Mock).mockResolvedValue(
        createMockShareStatus()
      );

      render(<ReportShareModal snapshotId={snapshotId} isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByTestId('report-share-modal')).toBeInTheDocument();
      expect(screen.getByText('Share Report')).toBeInTheDocument();
    });

    it('does not render modal when isOpen is false', () => {
      (useReportsHook.getReportSharingStatus as jest.Mock).mockResolvedValue(
        createMockShareStatus()
      );

      render(<ReportShareModal snapshotId={snapshotId} isOpen={false} onClose={mockOnClose} />);

      expect(screen.queryByTestId('report-share-modal')).not.toBeInTheDocument();
    });

    it('displays organization access section', () => {
      (useReportsHook.getReportSharingStatus as jest.Mock).mockResolvedValue(
        createMockShareStatus()
      );

      render(<ReportShareModal snapshotId={snapshotId} isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Organization Access')).toBeInTheDocument();
      expect(
        screen.getByText(/Users in your organization with proper permissions/)
      ).toBeInTheDocument();
    });

    it('displays public access section', () => {
      (useReportsHook.getReportSharingStatus as jest.Mock).mockResolvedValue(
        createMockShareStatus()
      );

      render(<ReportShareModal snapshotId={snapshotId} isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Public Access')).toBeInTheDocument();
      expect(screen.getByText(/Anyone with the link can view/)).toBeInTheDocument();
    });
  });

  describe('Share Status Loading', () => {
    it('fetches share status when modal opens', async () => {
      const mockStatus = createMockShareStatus({ is_public: false });
      (useReportsHook.getReportSharingStatus as jest.Mock).mockResolvedValue(mockStatus);

      render(<ReportShareModal snapshotId={snapshotId} isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(useReportsHook.getReportSharingStatus).toHaveBeenCalledWith(snapshotId);
      });
    });

    it('handles error when fetching share status', async () => {
      (useReportsHook.getReportSharingStatus as jest.Mock).mockRejectedValue(
        new Error('Failed to load')
      );

      render(<ReportShareModal snapshotId={snapshotId} isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(toastModule.toastError.load).toHaveBeenCalled();
      });
    });
  });

  describe('Public Sharing Toggle', () => {
    it('shows toggle switch in unchecked state when not public', async () => {
      (useReportsHook.getReportSharingStatus as jest.Mock).mockResolvedValue(
        createMockShareStatus({ is_public: false })
      );

      render(<ReportShareModal snapshotId={snapshotId} isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        const toggle = screen.getByTestId('report-share-toggle');
        expect(toggle).toHaveAttribute('data-state', 'unchecked');
      });
    });

    it('shows toggle switch in checked state when public', async () => {
      (useReportsHook.getReportSharingStatus as jest.Mock).mockResolvedValue(
        createMockShareStatus({ is_public: true, public_url: 'http://test.com/report/123' })
      );

      render(<ReportShareModal snapshotId={snapshotId} isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        const toggle = screen.getByTestId('report-share-toggle');
        expect(toggle).toHaveAttribute('data-state', 'checked');
      });
    });

    it('enables public sharing when toggle is clicked', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockShareStatus({
        is_public: true,
        public_url: 'http://test.com/report/123',
      });

      (useReportsHook.getReportSharingStatus as jest.Mock).mockResolvedValue(
        createMockShareStatus({ is_public: false })
      );
      (useReportsHook.updateReportSharing as jest.Mock).mockResolvedValue(mockResponse);

      render(<ReportShareModal snapshotId={snapshotId} isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByTestId('report-share-toggle')).toBeInTheDocument();
      });

      const toggle = screen.getByTestId('report-share-toggle');
      await user.click(toggle);

      await waitFor(() => {
        expect(useReportsHook.updateReportSharing).toHaveBeenCalledWith(snapshotId, {
          is_public: true,
        });
        expect(toastModule.toastSuccess.generic).toHaveBeenCalled();
      });
    });

    it('disables public sharing when toggle is clicked', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockShareStatus({ is_public: false });

      (useReportsHook.getReportSharingStatus as jest.Mock).mockResolvedValue(
        createMockShareStatus({ is_public: true, public_url: 'http://test.com/report/123' })
      );
      (useReportsHook.updateReportSharing as jest.Mock).mockResolvedValue(mockResponse);

      render(<ReportShareModal snapshotId={snapshotId} isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByTestId('report-share-toggle')).toBeInTheDocument();
      });

      const toggle = screen.getByTestId('report-share-toggle');
      await user.click(toggle);

      await waitFor(() => {
        expect(useReportsHook.updateReportSharing).toHaveBeenCalledWith(snapshotId, {
          is_public: false,
        });
      });
    });

    it('handles error when toggling sharing', async () => {
      const user = userEvent.setup();

      (useReportsHook.getReportSharingStatus as jest.Mock).mockResolvedValue(
        createMockShareStatus({ is_public: false })
      );
      (useReportsHook.updateReportSharing as jest.Mock).mockRejectedValue(
        new Error('Failed to update')
      );

      render(<ReportShareModal snapshotId={snapshotId} isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByTestId('report-share-toggle')).toBeInTheDocument();
      });

      const toggle = screen.getByTestId('report-share-toggle');
      await user.click(toggle);

      await waitFor(() => {
        expect(toastModule.toastError.share).toHaveBeenCalled();
      });
    });
  });

  describe('Public URL Display', () => {
    it('shows copy link button when report is public', async () => {
      (useReportsHook.getReportSharingStatus as jest.Mock).mockResolvedValue(
        createMockShareStatus({ is_public: true, public_url: 'http://test.com/report/123' })
      );

      render(<ReportShareModal snapshotId={snapshotId} isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByTestId('report-copy-link-btn')).toBeInTheDocument();
      });
    });

    it('hides copy link button when report is private', async () => {
      (useReportsHook.getReportSharingStatus as jest.Mock).mockResolvedValue(
        createMockShareStatus({ is_public: false })
      );

      render(<ReportShareModal snapshotId={snapshotId} isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.queryByTestId('report-copy-link-btn')).not.toBeInTheDocument();
      });
    });

    it('copies URL to clipboard when copy button is clicked', async () => {
      const user = userEvent.setup();
      const publicUrl = 'http://test.com/report/123';
      const { copyUrlToClipboard } = require('@/lib/clipboard');

      (useReportsHook.getReportSharingStatus as jest.Mock).mockResolvedValue(
        createMockShareStatus({ is_public: true, public_url: publicUrl })
      );

      render(<ReportShareModal snapshotId={snapshotId} isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByTestId('report-copy-link-btn')).toBeInTheDocument();
      });

      const copyBtn = screen.getByTestId('report-copy-link-btn');
      await user.click(copyBtn);

      await waitFor(() => {
        expect(copyUrlToClipboard).toHaveBeenCalledWith(publicUrl);
      });
    });
  });

  describe('Security Warning', () => {
    it('shows security warning when report is public', async () => {
      (useReportsHook.getReportSharingStatus as jest.Mock).mockResolvedValue(
        createMockShareStatus({ is_public: true, public_url: 'http://test.com/report/123' })
      );

      render(<ReportShareModal snapshotId={snapshotId} isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText(/Security Notice/)).toBeInTheDocument();
        expect(screen.getByText(/Your data is now exposed to the internet/)).toBeInTheDocument();
      });
    });

    it('hides security warning when report is private', async () => {
      (useReportsHook.getReportSharingStatus as jest.Mock).mockResolvedValue(
        createMockShareStatus({ is_public: false })
      );

      render(<ReportShareModal snapshotId={snapshotId} isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.queryByText(/Security Notice/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Analytics Display', () => {
    it('shows access count when report is public and has been accessed', async () => {
      (useReportsHook.getReportSharingStatus as jest.Mock).mockResolvedValue(
        createMockShareStatus({
          is_public: true,
          public_url: 'http://test.com/report/123',
          public_access_count: 42,
          last_public_accessed: '2025-02-15T14:30:00Z',
        })
      );

      render(<ReportShareModal snapshotId={snapshotId} isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText(/Public access count: 42/)).toBeInTheDocument();
        expect(screen.getByText(/Last accessed:/)).toBeInTheDocument();
      });
    });

    it('hides access count when report has not been accessed', async () => {
      (useReportsHook.getReportSharingStatus as jest.Mock).mockResolvedValue(
        createMockShareStatus({
          is_public: true,
          public_url: 'http://test.com/report/123',
          public_access_count: 0,
        })
      );

      render(<ReportShareModal snapshotId={snapshotId} isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.queryByText(/Public access count:/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Modal Actions', () => {
    it('closes modal when close button is clicked', async () => {
      const user = userEvent.setup();
      (useReportsHook.getReportSharingStatus as jest.Mock).mockResolvedValue(
        createMockShareStatus()
      );

      render(<ReportShareModal snapshotId={snapshotId} isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByTestId('report-share-close-btn')).toBeInTheDocument();
      });

      const closeBtn = screen.getByTestId('report-share-close-btn');
      await user.click(closeBtn);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
