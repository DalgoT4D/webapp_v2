/**
 * Tests for DatasetSelector component (using react-select)
 * Covers rendering states, search functionality, dropdown behavior, dataset selection, and edge cases
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatasetSelector } from '../DatasetSelector';
import * as useChartHooks from '@/hooks/api/useChart';

jest.mock('@/hooks/api/useChart');

describe('DatasetSelector', () => {
  const mockOnDatasetChange = jest.fn();

  const mockTables = [
    { schema_name: 'public', table_name: 'users', full_name: 'public.users' },
    { schema_name: 'public', table_name: 'orders', full_name: 'public.orders' },
    { schema_name: 'analytics', table_name: 'events', full_name: 'analytics.events' },
    { schema_name: 'analytics', table_name: 'metrics', full_name: 'analytics.metrics' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useChartHooks.useAllSchemaTables as jest.Mock).mockReturnValue({
      data: mockTables,
      isLoading: false,
      error: null,
    });
  });

  describe('Component States', () => {
    it('should render loading state', () => {
      (useChartHooks.useAllSchemaTables as jest.Mock).mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render error state', () => {
      (useChartHooks.useAllSchemaTables as jest.Mock).mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Network error'),
      });

      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      expect(
        screen.getByText('Failed to load datasets. Please try refreshing.')
      ).toBeInTheDocument();
    });
  });

  describe('Rendering and Initial State', () => {
    it('should render select with placeholder', () => {
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      expect(screen.getByText('Search and select dataset...')).toBeInTheDocument();
    });

    it('should display selected value when provided', () => {
      render(
        <DatasetSelector
          onDatasetChange={mockOnDatasetChange}
          schema_name="public"
          table_name="users"
        />
      );

      expect(screen.getByText('public.users')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <DatasetSelector onDatasetChange={mockOnDatasetChange} className="custom-class" />
      );

      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });

  describe('Search and Selection', () => {
    it('should open dropdown and show options when clicking', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('public.users')).toBeInTheDocument();
        expect(screen.getByText('public.orders')).toBeInTheDocument();
        expect(screen.getByText('analytics.events')).toBeInTheDocument();
        expect(screen.getByText('analytics.metrics')).toBeInTheDocument();
      });
    });

    it('should filter options when typing', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, 'users');

      await waitFor(() => {
        expect(screen.getByText('public.users')).toBeInTheDocument();
        // Other options should be filtered out
        expect(screen.queryByText('public.orders')).not.toBeInTheDocument();
      });
    });

    it('should be case-insensitive when filtering', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, 'USERS');

      await waitFor(() => {
        expect(screen.getByText('public.users')).toBeInTheDocument();
      });
    });

    it('should show "No datasets found" when search has no results', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText('No datasets found')).toBeInTheDocument();
      });
    });

    it('should call onDatasetChange when selecting an option', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('public.users')).toBeInTheDocument();
      });

      await user.click(screen.getByText('public.users'));

      expect(mockOnDatasetChange).toHaveBeenCalledWith('public', 'users');
    });
  });

  describe('Disabled State', () => {
    it('should be disabled when disabled prop is true', () => {
      const { container } = render(
        <DatasetSelector onDatasetChange={mockOnDatasetChange} disabled />
      );

      // Check for the disabled class on the container
      const control = container.querySelector('.dataset-select--is-disabled');
      expect(control).toBeInTheDocument();
      // Check the input is disabled
      const input = container.querySelector('input');
      expect(input).toBeDisabled();
    });

    it('should be disabled when loading', () => {
      (useChartHooks.useAllSchemaTables as jest.Mock).mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      const { container } = render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      // Check for the disabled class on the container
      const control = container.querySelector('.dataset-select--is-disabled');
      expect(control).toBeInTheDocument();
      // Check the input is disabled
      const input = container.querySelector('input');
      expect(input).toBeDisabled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty dataset list', async () => {
      (useChartHooks.useAllSchemaTables as jest.Mock).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('No datasets found')).toBeInTheDocument();
      });
    });

    it('should handle null dataset list', async () => {
      (useChartHooks.useAllSchemaTables as jest.Mock).mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('No datasets found')).toBeInTheDocument();
      });
    });

    it('should filter by schema name', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, 'analytics');

      await waitFor(() => {
        expect(screen.getByText('analytics.events')).toBeInTheDocument();
        expect(screen.getByText('analytics.metrics')).toBeInTheDocument();
        expect(screen.queryByText('public.users')).not.toBeInTheDocument();
      });
    });

    it('should handle very long dataset names', async () => {
      const longTables = [
        {
          schema_name: 'very_long_schema_name',
          table_name: 'very_long_table_name',
          full_name: 'very_long_schema_name.very_long_table_name',
        },
      ];

      (useChartHooks.useAllSchemaTables as jest.Mock).mockReturnValue({
        data: longTables,
        isLoading: false,
        error: null,
      });

      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByRole('combobox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('very_long_schema_name.very_long_table_name')).toBeInTheDocument();
      });
    });
  });
});
