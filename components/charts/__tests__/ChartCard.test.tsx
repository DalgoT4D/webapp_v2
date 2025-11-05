/**
 * Tests for ChartCard component
 * Tests card rendering, action buttons, and chart metadata display
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChartCard from '../ChartCard';

describe('ChartCard', () => {
  const mockChart = {
    id: 1,
    title: 'Sales Dashboard',
    chart_type: 'bar',
    created_at: '2024-01-10T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    is_public: false,
  };

  const mockOnView = jest.fn();
  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();

  const defaultProps = {
    chart: mockChart,
    onView: mockOnView,
    onEdit: mockOnEdit,
    onDelete: mockOnDelete,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render complete UI with all metadata and handle button interactions', async () => {
    const user = userEvent.setup();
    const { container } = render(<ChartCard {...defaultProps} />);

    // Title and metadata
    expect(screen.getByText('Sales Dashboard')).toBeInTheDocument();
    expect(screen.getByText(/updated/i)).toBeInTheDocument();
    expect(screen.getByText(/updated/i).textContent).toMatch(/ago/i);
    expect(screen.getByText('Private')).toBeInTheDocument();
    const privateBadge = screen.getByText('Private').closest('div');
    expect(privateBadge).toBeInTheDocument();

    // Chart type icon and action buttons
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThan(3);

    // Styling
    const card = container.querySelector('.hover\\:shadow-lg');
    expect(card).toBeInTheDocument();
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    expect(deleteButton).toHaveClass('text-destructive');
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(3);

    // Button interactions
    await user.click(screen.getByRole('button', { name: /view/i }));
    expect(mockOnView).toHaveBeenCalledWith(mockChart);
    expect(mockOnView).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(mockOnEdit).toHaveBeenCalledWith(mockChart);
    expect(mockOnEdit).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(mockOnDelete).toHaveBeenCalledWith(mockChart);
    expect(mockOnDelete).toHaveBeenCalledTimes(1);

    // Rapid clicks
    await user.click(screen.getByRole('button', { name: /view/i }));
    await user.click(screen.getByRole('button', { name: /view/i }));
    expect(mockOnView).toHaveBeenCalledTimes(3);
  });

  it('should display correct states and handle all chart type variations', () => {
    // Visibility states
    const { rerender } = render(<ChartCard {...defaultProps} />);
    expect(screen.getByText('Private')).toBeInTheDocument();
    const publicChart = { ...mockChart, is_public: true };
    rerender(<ChartCard {...defaultProps} chart={publicChart} />);
    expect(screen.getByText('Public')).toBeInTheDocument();
    expect(screen.queryByText('Private')).not.toBeInTheDocument();
    const publicBadge = screen.getByText('Public').closest('div');
    expect(publicBadge).toBeInTheDocument();

    // Date formatting variations
    const recentChart = { ...mockChart, updated_at: new Date().toISOString() };
    rerender(<ChartCard {...defaultProps} chart={recentChart} />);
    expect(screen.getByText(/updated/i)).toBeInTheDocument();
    const oldChart = { ...mockChart, updated_at: '2020-01-01T10:00:00Z' };
    rerender(<ChartCard {...defaultProps} chart={oldChart} />);
    expect(screen.getByText(/updated/i)).toBeInTheDocument();

    // Chart type icons
    ['bar', 'line', 'pie', 'echarts', 'recharts', 'nivo', 'unknown'].forEach((type) => {
      const { container, unmount } = render(
        <ChartCard {...defaultProps} chart={{ ...mockChart, chart_type: type }} />
      );
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
      unmount();
    });

    // Multiple chart configurations
    [
      {
        id: 1,
        title: 'Chart 1',
        chart_type: 'bar',
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
        is_public: true,
      },
      {
        id: 2,
        title: 'Chart 2',
        chart_type: 'line',
        created_at: '2024-01-03',
        updated_at: '2024-01-04',
        is_public: false,
      },
      {
        id: 3,
        title: 'Chart 3',
        chart_type: 'pie',
        created_at: '2024-01-05',
        updated_at: '2024-01-06',
        is_public: true,
      },
    ].forEach((chart) => {
      const { unmount } = render(<ChartCard {...defaultProps} chart={chart} />);
      expect(screen.getByText(chart.title)).toBeInTheDocument();
      unmount();
    });
  });

  it('should handle edge cases correctly', async () => {
    const user = userEvent.setup();

    // Title variations
    [
      { title: '', name: 'empty title' },
      { title: 'A'.repeat(200), name: 'very long title' },
      { title: 'Sales & Revenue (2024) - Q1 "Best" <Chart>', name: 'special characters' },
    ].forEach(({ title }) => {
      const { unmount } = render(<ChartCard {...defaultProps} chart={{ ...mockChart, title }} />);
      expect(screen.getByRole('button', { name: /view/i })).toBeInTheDocument();
      if (title) {
        expect(screen.getByText(title)).toBeInTheDocument();
      }
      unmount();
    });

    // Config variations
    [{ config: undefined }, { config: { some: 'config' } }].forEach((scenario) => {
      const { unmount } = render(
        <ChartCard {...defaultProps} chart={{ ...mockChart, ...scenario }} />
      );
      expect(screen.getByText('Sales Dashboard')).toBeInTheDocument();
      unmount();
    });

    // Custom chart object passed to callbacks
    const customChart = {
      id: 999,
      title: 'Custom Chart',
      chart_type: 'custom',
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
      is_public: true,
    };
    render(<ChartCard {...defaultProps} chart={customChart} />);
    await user.click(screen.getByRole('button', { name: /view/i }));
    expect(mockOnView).toHaveBeenCalledWith(customChart);
    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(mockOnEdit).toHaveBeenCalledWith(customChart);
    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(mockOnDelete).toHaveBeenCalledWith(customChart);
  });

  it('should meet accessibility requirements with keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<ChartCard {...defaultProps} />);

    // Accessible button labels
    expect(screen.getByRole('button', { name: /view/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();

    // Tab through buttons
    await user.tab();
    expect(screen.getByRole('button', { name: /view/i })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: /edit/i })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: /delete/i })).toHaveFocus();

    // Trigger action with keyboard
    await user.keyboard('{Enter}');
    expect(mockOnDelete).toHaveBeenCalledWith(mockChart);
  });
});
