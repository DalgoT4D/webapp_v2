/**
 * ShareModal Component Tests (Report context)
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareModal } from '@/components/ui/share-modal';
import { createMockShareStatus } from './report-mock-data';
import * as toastModule from '@/lib/toast';

// ============ Mocks ============

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

describe('ShareModal', () => {
  const mockOnClose = jest.fn();
  const mockGetShareStatus = jest.fn();
  const mockUpdateSharing = jest.fn();
  const snapshotId = 1;

  const renderShareModal = (overrides = {}) =>
    render(
      <ShareModal
        entityId={snapshotId}
        entityLabel="Report"
        isOpen={true}
        onClose={mockOnClose}
        getShareStatus={mockGetShareStatus}
        updateSharing={mockUpdateSharing}
        {...overrides}
      />
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Modal Rendering', () => {
    it('renders modal when isOpen is true', () => {
      mockGetShareStatus.mockResolvedValue(createMockShareStatus());

      renderShareModal();

      expect(screen.getByTestId('share-modal')).toBeInTheDocument();
      expect(screen.getByText('Share Report')).toBeInTheDocument();
    });

    it('does not render modal when isOpen is false', () => {
      mockGetShareStatus.mockResolvedValue(createMockShareStatus());

      renderShareModal({ isOpen: false });

      expect(screen.queryByTestId('share-modal')).not.toBeInTheDocument();
    });

    it('displays organization access section', () => {
      mockGetShareStatus.mockResolvedValue(createMockShareStatus());

      renderShareModal();

      expect(screen.getByText('Organization Access')).toBeInTheDocument();
      expect(
        screen.getByText(/Users in your organization with proper permissions/)
      ).toBeInTheDocument();
    });

    it('displays public access section', () => {
      mockGetShareStatus.mockResolvedValue(createMockShareStatus());

      renderShareModal();

      expect(screen.getByText('Public Access')).toBeInTheDocument();
      expect(screen.getByText(/Anyone with the link can view/)).toBeInTheDocument();
    });
  });

  describe('Share Status Loading', () => {
    it('fetches share status when modal opens', async () => {
      const mockStatus = createMockShareStatus({ is_public: false });
      mockGetShareStatus.mockResolvedValue(mockStatus);

      renderShareModal();

      await waitFor(() => {
        expect(mockGetShareStatus).toHaveBeenCalledWith(snapshotId);
      });
    });

    it('handles error when fetching share status', async () => {
      mockGetShareStatus.mockRejectedValue(new Error('Failed to load'));

      renderShareModal();

      await waitFor(() => {
        expect(toastModule.toastError.load).toHaveBeenCalled();
      });
    });
  });

  describe('Public Sharing Toggle', () => {
    it('shows toggle switch in unchecked state when not public', async () => {
      mockGetShareStatus.mockResolvedValue(createMockShareStatus({ is_public: false }));

      renderShareModal();

      await waitFor(() => {
        const toggle = screen.getByTestId('share-toggle');
        expect(toggle).toHaveAttribute('data-state', 'unchecked');
      });
    });

    it('shows toggle switch in checked state when public', async () => {
      mockGetShareStatus.mockResolvedValue(
        createMockShareStatus({ is_public: true, public_url: 'http://test.com/report/123' })
      );

      renderShareModal();

      await waitFor(() => {
        const toggle = screen.getByTestId('share-toggle');
        expect(toggle).toHaveAttribute('data-state', 'checked');
      });
    });

    it('enables public sharing when toggle is clicked', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockShareStatus({
        is_public: true,
        public_url: 'http://test.com/report/123',
      });

      mockGetShareStatus.mockResolvedValue(createMockShareStatus({ is_public: false }));
      mockUpdateSharing.mockResolvedValue(mockResponse);

      renderShareModal();

      await waitFor(() => {
        expect(screen.getByTestId('share-toggle')).toBeInTheDocument();
      });

      const toggle = screen.getByTestId('share-toggle');
      await user.click(toggle);

      await waitFor(() => {
        expect(mockUpdateSharing).toHaveBeenCalledWith(snapshotId, {
          is_public: true,
        });
        expect(toastModule.toastSuccess.generic).toHaveBeenCalled();
      });
    });

    it('disables public sharing when toggle is clicked', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockShareStatus({ is_public: false });

      mockGetShareStatus.mockResolvedValue(
        createMockShareStatus({ is_public: true, public_url: 'http://test.com/report/123' })
      );
      mockUpdateSharing.mockResolvedValue(mockResponse);

      renderShareModal();

      await waitFor(() => {
        expect(screen.getByTestId('share-toggle')).toBeInTheDocument();
      });

      const toggle = screen.getByTestId('share-toggle');
      await user.click(toggle);

      await waitFor(() => {
        expect(mockUpdateSharing).toHaveBeenCalledWith(snapshotId, {
          is_public: false,
        });
      });
    });

    it('handles error when toggling sharing', async () => {
      const user = userEvent.setup();

      mockGetShareStatus.mockResolvedValue(createMockShareStatus({ is_public: false }));
      mockUpdateSharing.mockRejectedValue(new Error('Failed to update'));

      renderShareModal();

      await waitFor(() => {
        expect(screen.getByTestId('share-toggle')).toBeInTheDocument();
      });

      const toggle = screen.getByTestId('share-toggle');
      await user.click(toggle);

      await waitFor(() => {
        expect(toastModule.toastError.share).toHaveBeenCalled();
      });
    });
  });

  describe('Public URL Display', () => {
    it('shows copy link button when report is public', async () => {
      mockGetShareStatus.mockResolvedValue(
        createMockShareStatus({ is_public: true, public_url: 'http://test.com/report/123' })
      );

      renderShareModal();

      await waitFor(() => {
        expect(screen.getByTestId('copy-link-btn')).toBeInTheDocument();
      });
    });

    it('hides copy link button when report is private', async () => {
      mockGetShareStatus.mockResolvedValue(createMockShareStatus({ is_public: false }));

      renderShareModal();

      await waitFor(() => {
        expect(screen.queryByTestId('copy-link-btn')).not.toBeInTheDocument();
      });
    });

    it('copies URL to clipboard when copy button is clicked', async () => {
      const user = userEvent.setup();
      const publicUrl = 'http://test.com/report/123';
      const { copyUrlToClipboard } = require('@/lib/clipboard');

      mockGetShareStatus.mockResolvedValue(
        createMockShareStatus({ is_public: true, public_url: publicUrl })
      );

      renderShareModal();

      await waitFor(() => {
        expect(screen.getByTestId('copy-link-btn')).toBeInTheDocument();
      });

      const copyBtn = screen.getByTestId('copy-link-btn');
      await user.click(copyBtn);

      await waitFor(() => {
        expect(copyUrlToClipboard).toHaveBeenCalledWith(publicUrl);
      });
    });
  });

  describe('Security Warning', () => {
    it('shows security warning when report is public', async () => {
      mockGetShareStatus.mockResolvedValue(
        createMockShareStatus({ is_public: true, public_url: 'http://test.com/report/123' })
      );

      renderShareModal();

      await waitFor(() => {
        expect(screen.getByText(/Security Notice/)).toBeInTheDocument();
        expect(screen.getByText(/Your data is now exposed to the internet/)).toBeInTheDocument();
      });
    });

    it('hides security warning when report is private', async () => {
      mockGetShareStatus.mockResolvedValue(createMockShareStatus({ is_public: false }));

      renderShareModal();

      await waitFor(() => {
        expect(screen.queryByText(/Security Notice/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Analytics Display', () => {
    it('shows access count when report is public and has been accessed', async () => {
      mockGetShareStatus.mockResolvedValue(
        createMockShareStatus({
          is_public: true,
          public_url: 'http://test.com/report/123',
          public_access_count: 42,
          last_public_accessed: '2025-02-15T14:30:00Z',
        })
      );

      renderShareModal();

      await waitFor(() => {
        expect(screen.getByText(/Public access count: 42/)).toBeInTheDocument();
        expect(screen.getByText(/Last accessed:/)).toBeInTheDocument();
      });
    });

    it('hides access count when report has not been accessed', async () => {
      mockGetShareStatus.mockResolvedValue(
        createMockShareStatus({
          is_public: true,
          public_url: 'http://test.com/report/123',
          public_access_count: 0,
        })
      );

      renderShareModal();

      await waitFor(() => {
        expect(screen.queryByText(/Public access count:/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Modal Actions', () => {
    it('closes modal when close button is clicked', async () => {
      const user = userEvent.setup();
      mockGetShareStatus.mockResolvedValue(createMockShareStatus());

      renderShareModal();

      await waitFor(() => {
        expect(screen.getByTestId('share-close-btn')).toBeInTheDocument();
      });

      const closeBtn = screen.getByTestId('share-close-btn');
      await user.click(closeBtn);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
