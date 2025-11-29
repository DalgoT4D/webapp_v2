/**
 * Tests for ChartDeleteDialog component
 * Tests UI, dashboard usage display, and delete confirmation flow
 */

import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChartDeleteDialog } from '../ChartDeleteDialog';
import { useChartDashboards } from '@/hooks/api/useCharts';

// Mock the API hook
jest.mock('@/hooks/api/useCharts');

// Mock Next.js Link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('ChartDeleteDialog', () => {
  const mockUseChartDashboards = useChartDashboards as jest.MockedFunction<
    typeof useChartDashboards
  >;
  const mockOnConfirm = jest.fn();

  const defaultProps = {
    chartId: 1,
    chartTitle: 'Sales Dashboard',
    onConfirm: mockOnConfirm,
    isDeleting: false,
    children: <button>Delete</button>,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock: no dashboards using this chart
    mockUseChartDashboards.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      isValidating: false,
    } as any);
  });

  it('should render UI, handle dialog interactions, and display dashboard usage correctly', async () => {
    const user = userEvent.setup();

    // Initial render - trigger button present
    const { rerender } = render(<ChartDeleteDialog {...defaultProps} />);
    const triggerButton = screen.getByRole('button', { name: /delete/i });
    expect(triggerButton).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    // Open dialog - all UI elements present
    await user.click(triggerButton);
    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.getByText('Delete Chart')).toBeInTheDocument();
      expect(screen.getByText(/Sales Dashboard/i)).toBeInTheDocument();
      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
      expect(screen.getByText('Dashboard Usage')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete chart/i })).toBeInTheDocument();
      expect(screen.getByText(/this chart is not used in any dashboards/i)).toBeInTheDocument();
    });

    // Close and test with one dashboard
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    mockUseChartDashboards.mockReturnValue({
      data: [{ id: 1, title: 'Executive Dashboard', dashboard_type: 'Operational' }],
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      isValidating: false,
    } as any);
    rerender(<ChartDeleteDialog {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /delete/i }));
    await waitFor(() => {
      expect(screen.getByText(/this chart is used in 1 dashboard/i)).toBeInTheDocument();
      expect(screen.getByText('Executive Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Operational')).toBeInTheDocument();
    });

    // Test with multiple dashboards
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    mockUseChartDashboards.mockReturnValue({
      data: [
        { id: 1, title: 'Executive Dashboard', dashboard_type: 'Operational' },
        { id: 2, title: 'Analytics Dashboard', dashboard_type: 'Analytics' },
      ],
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      isValidating: false,
    } as any);
    rerender(<ChartDeleteDialog {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /delete/i }));
    await waitFor(() => {
      expect(screen.getByText(/this chart is used in 2 dashboards/i)).toBeInTheDocument();
      expect(screen.getByText('Executive Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });

    // Test with many dashboards and links
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    mockUseChartDashboards.mockReturnValue({
      data: Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        title: `Dashboard ${i + 1}`,
        dashboard_type: 'Operational',
      })),
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      isValidating: false,
    } as any);
    rerender(<ChartDeleteDialog {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /delete/i }));
    await waitFor(() => {
      expect(screen.getByText(/this chart is used in 10 dashboards/i)).toBeInTheDocument();
      expect(screen.getByText('Dashboard 1')).toBeInTheDocument();
      expect(screen.getByText('Dashboard 10')).toBeInTheDocument();
      const links = screen.getAllByRole('link');
      expect(links[0]).toHaveAttribute('href', '/dashboards/1');
    });
  });

  it('should handle delete and cancel workflows with all states', async () => {
    const user = userEvent.setup();

    // Test loading state
    mockUseChartDashboards.mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
      mutate: jest.fn(),
      isValidating: false,
    } as any);
    let result = render(<ChartDeleteDialog {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /delete/i }));
    await waitFor(() => {
      const dialog = screen.getByRole('alertdialog');
      const skeletons = dialog.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
    result.unmount();

    // Test delete action
    mockUseChartDashboards.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      isValidating: false,
    } as any);
    result = render(<ChartDeleteDialog {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(async () => {
      const deleteButton = screen.getByRole('button', { name: /delete chart/i });
      await user.click(deleteButton);
    });
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);

    // Test cancel action
    jest.clearAllMocks();
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(async () => {
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
    });
    expect(mockOnConfirm).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    result.unmount();

    // Test deleting state
    result = render(<ChartDeleteDialog {...defaultProps} isDeleting={true} />);
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /deleting.../i })).toBeInTheDocument();
    });
  });

  it('should handle edge cases and API errors', async () => {
    const user = userEvent.setup();

    // Test various chart title edge cases
    const titleCases = [
      { title: '', label: 'empty title' },
      { title: 'A'.repeat(200), label: 'very long title' },
      { title: 'Sales & Revenue (2024) - Q1 "Best" <Chart>', label: 'special characters' },
    ];

    for (const { title } of titleCases) {
      const { unmount } = render(<ChartDeleteDialog {...defaultProps} chartTitle={title} />);
      await user.click(screen.getByRole('button', { name: /^delete$/i }));
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });
      unmount();
    }

    // Test API error handling
    mockUseChartDashboards.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error('API Error'),
      mutate: jest.fn(),
      isValidating: false,
    } as any);
    render(<ChartDeleteDialog {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
  });

  it('should meet accessibility requirements and support keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<ChartDeleteDialog {...defaultProps} />);

    // Tab to trigger button and open with Enter
    await user.tab();
    expect(screen.getByRole('button', { name: /^delete$/i })).toHaveFocus();
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    // Proper alertdialog role and accessible labels
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete chart/i })).toBeInTheDocument();

    // Escape to close
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });
});
