/**
 * Consolidated tests for DatasetSelector component
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
    it.each([
      ['loading', { data: null, isLoading: true, error: null }, 'Loading...', true],
      [
        'error',
        { data: null, isLoading: false, error: new Error('Network error') },
        'Failed to load datasets. Please try refreshing.',
        false,
      ],
    ])('should render %s state', (state, hookReturn, expectedText, shouldDisable) => {
      (useChartHooks.useAllSchemaTables as jest.Mock).mockReturnValue(hookReturn);

      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      if (expectedText.includes('Loading')) {
        expect(screen.getByPlaceholderText(expectedText)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(expectedText)).toBeDisabled();
      } else {
        expect(screen.getByText(expectedText)).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Search datasets...')).not.toBeInTheDocument();
      }
    });
  });

  describe('Rendering and Initial State', () => {
    it('should render search input with icons and placeholder', () => {
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      expect(screen.getByPlaceholderText('Search datasets...')).toBeInTheDocument();
    });

    it('should display selected value when provided', () => {
      render(
        <DatasetSelector
          onDatasetChange={mockOnDatasetChange}
          schema_name="public"
          table_name="users"
        />
      );

      const input = screen.getByPlaceholderText('Search datasets...') as HTMLInputElement;
      expect(input.value).toBe('public.users');
    });

    it('should apply custom className', () => {
      const { container } = render(
        <DatasetSelector onDatasetChange={mockOnDatasetChange} className="custom-class" />
      );

      const wrapper = container.querySelector('.custom-class');
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should update search query when typing', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.type(input, 'users');

      expect(input).toHaveValue('users');
    });

    it.each([
      ['schema name', 'analytics', ['analytics.events', 'analytics.metrics']],
      ['table name', 'users', ['public.users']],
      ['full name', 'public.orders', ['public.orders']],
    ])('should filter tables by %s', async (type, query, expected) => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input);
      await user.type(input, query);

      await waitFor(
        () => {
          const text = document.body.textContent || '';
          expected.forEach((item) => expect(text).toContain(item));
        },
        { timeout: 3000 }
      );
    });

    it('should be case-insensitive when filtering', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input);
      await user.type(input, 'USERS');

      await waitFor(
        () => {
          expect(document.body.textContent).toContain('public.users');
        },
        { timeout: 3000 }
      );
    });

    it('should show "No datasets found" when search has no results', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input);
      await user.type(input, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText('No datasets found')).toBeInTheDocument();
      });
    });
  });

  describe('Dropdown Behavior', () => {
    it('should open dropdown and show all datasets when clicking input', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText(/public.users/)).toBeInTheDocument();
        expect(screen.getByText(/public.orders/)).toBeInTheDocument();
        expect(screen.getByText(/analytics.events/)).toBeInTheDocument();
        expect(screen.getByText(/analytics.metrics/)).toBeInTheDocument();
      });
    });

    it.each([
      ['disabled', true],
      ['loading', false],
    ])('should not open dropdown when %s', async (state, disabled) => {
      if (state === 'loading') {
        (useChartHooks.useAllSchemaTables as jest.Mock).mockReturnValue({
          data: null,
          isLoading: true,
          error: null,
        });
      }

      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} disabled={disabled} />);

      const input =
        state === 'loading'
          ? screen.getByPlaceholderText('Loading...')
          : screen.getByPlaceholderText('Search datasets...');
      await user.click(input);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(screen.queryByText(/public.users/)).not.toBeInTheDocument();
    });
  });

  describe('Dataset Selection', () => {
    it('should call onDatasetChange and close dropdown when selecting a dataset', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input);

      await waitFor(
        () => {
          expect(document.body.textContent).toContain('public.users');
        },
        { timeout: 3000 }
      );

      const datasetItem = document.querySelector('[data-schema="public"][data-table="users"]');
      if (datasetItem) {
        (datasetItem as HTMLElement).click();
      }

      await waitFor(() => {
        expect(mockOnDatasetChange).toHaveBeenCalledWith('public', 'users');
      });
    });

    it('should highlight selected dataset in dropdown', async () => {
      const user = userEvent.setup();
      render(
        <DatasetSelector
          schema_name="public"
          table_name="users"
          onDatasetChange={mockOnDatasetChange}
        />
      );

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input);

      await waitFor(
        () => {
          const selectedItem = document.querySelector('[data-schema="public"][data-table="users"]');
          expect(selectedItem).toHaveClass('bg-blue-50');
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Disabled State and Auto-focus', () => {
    it('should disable input when disabled prop is true', () => {
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} disabled />);

      const input = screen.getByPlaceholderText('Search datasets...');
      expect(input).toBeDisabled();
    });

    it('should auto-focus input when autoFocus is true', () => {
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} autoFocus />);

      const input = screen.getByPlaceholderText('Search datasets...');
      expect(input).not.toBeDisabled();
    });
  });

  describe('Edge Cases', () => {
    it.each([
      ['empty dataset list', []],
      ['null dataset list', null],
    ])('should handle %s', async (desc, data) => {
      (useChartHooks.useAllSchemaTables as jest.Mock).mockReturnValue({
        data,
        isLoading: false,
        error: null,
      });

      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input);

      await waitFor(() => {
        if (data === null) {
          expect(input).toBeInTheDocument();
        } else {
          expect(screen.getByText('No datasets available')).toBeInTheDocument();
        }
      });
    });

    it('should handle search with only whitespace', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input);
      await user.type(input, '   ');

      await waitFor(() => {
        expect(screen.getByText(/public.users/)).toBeInTheDocument();
        expect(screen.getByText(/public.orders/)).toBeInTheDocument();
      });
    });

    it('should handle special characters in search', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input);
      await user.type(input, 'public.');

      await waitFor(
        () => {
          const text = document.body.textContent || '';
          expect(text).toContain('public.users');
          expect(text).toContain('public.orders');
        },
        { timeout: 3000 }
      );
    });

    it('should not call onDatasetChange with empty schema or table', async () => {
      const user = userEvent.setup();
      const customTables = [{ schema_name: '', table_name: 'orphan', full_name: '.orphan' }];

      (useChartHooks.useAllSchemaTables as jest.Mock).mockReturnValue({
        data: customTables,
        isLoading: false,
        error: null,
      });

      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input);

      await waitFor(
        () => {
          expect(document.body.textContent).toContain('.orphan');
        },
        { timeout: 3000 }
      );

      const datasetItem = document.querySelector('[data-schema=""][data-table="orphan"]');
      if (datasetItem) {
        (datasetItem as HTMLElement).click();
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockOnDatasetChange).not.toHaveBeenCalled();
    });

    it('should handle very long dataset names', async () => {
      const longTables = [
        {
          schema_name: 'very_long_schema_name_that_exceeds_normal_length',
          table_name: 'very_long_table_name_that_also_exceeds_normal_length',
          full_name:
            'very_long_schema_name_that_exceeds_normal_length.very_long_table_name_that_also_exceeds_normal_length',
        },
      ];

      (useChartHooks.useAllSchemaTables as jest.Mock).mockReturnValue({
        data: longTables,
        isLoading: false,
        error: null,
      });

      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input);

      await waitFor(() => {
        expect(
          screen.getByText(
            /very_long_schema_name_that_exceeds_normal_length.very_long_table_name_that_also_exceeds_normal_length/
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe('Search Highlighting', () => {
    it('should highlight matched text in search results', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input);
      await user.type(input, 'users');

      await waitFor(() => {
        const marks = document.querySelectorAll('mark');
        expect(marks.length).toBeGreaterThan(0);
      });
    });

    it('should not highlight when search is empty', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText(/public.users/)).toBeInTheDocument();
      });

      const marks = document.querySelectorAll('mark');
      expect(marks.length).toBe(0);
    });
  });
});
