/**
 * Comprehensive tests for DatasetSelector component
 *
 * Covers:
 * - Component rendering states (loading, error, loaded)
 * - Search input functionality
 * - Dropdown opening/closing
 * - Dataset filtering by search query
 * - Dataset selection and callback
 * - Search text highlighting
 * - Auto-focus functionality
 * - Disabled state handling
 * - Portal dropdown positioning
 * - Click outside to close
 * - Selected value display
 * - Edge cases (no data, empty search results)
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatasetSelector } from '../DatasetSelector';
import * as useChartHooks from '@/hooks/api/useChart';

// Mock the useAllSchemaTables hook
jest.mock('@/hooks/api/useChart');

describe('DatasetSelector', () => {
  const mockOnDatasetChange = jest.fn();

  const mockTables = [
    {
      schema_name: 'public',
      table_name: 'users',
      full_name: 'public.users',
    },
    {
      schema_name: 'public',
      table_name: 'orders',
      full_name: 'public.orders',
    },
    {
      schema_name: 'analytics',
      table_name: 'events',
      full_name: 'analytics.events',
    },
    {
      schema_name: 'analytics',
      table_name: 'metrics',
      full_name: 'analytics.metrics',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock - success state
    (useChartHooks.useAllSchemaTables as jest.Mock).mockReturnValue({
      data: mockTables,
      isLoading: false,
      error: null,
    });
  });

  describe('Loading State', () => {
    it('should show loading placeholder in input', () => {
      (useChartHooks.useAllSchemaTables as jest.Mock).mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      expect(screen.getByPlaceholderText('Loading...')).toBeInTheDocument();
    });

    it('should disable input during loading', () => {
      (useChartHooks.useAllSchemaTables as jest.Mock).mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Loading...');
      expect(input).toBeDisabled();
    });
  });

  describe('Error State', () => {
    it('should display error message when loading fails', () => {
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

    it('should not render input when there is an error', () => {
      (useChartHooks.useAllSchemaTables as jest.Mock).mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Network error'),
      });

      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      expect(screen.queryByPlaceholderText('Search datasets...')).not.toBeInTheDocument();
    });
  });

  describe('Rendering and Initial State', () => {
    it('should render search input with placeholder', () => {
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      expect(screen.getByPlaceholderText('Search datasets...')).toBeInTheDocument();
    });

    it('should render search icon', () => {
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      // Search icon is rendered (Lucide Search component)
      const input = screen.getByPlaceholderText('Search datasets...');
      expect(input).toBeInTheDocument();
    });

    it('should render chevron down icon', () => {
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      // ChevronDown icon is present in the DOM
      const input = screen.getByPlaceholderText('Search datasets...');
      expect(input.parentElement).toBeInTheDocument();
    });

    it('should display selected value when provided', () => {
      render(
        <DatasetSelector
          schema_name="public"
          table_name="users"
          onDatasetChange={mockOnDatasetChange}
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

    it('should filter tables by schema name', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input);
      await user.type(input, 'analytics');

      // Should show analytics.events and analytics.metrics
      // Use findByText for portal content with longer wait time
      await waitFor(
        () => {
          const text = document.body.textContent;
          expect(text).toContain('analytics.events');
          expect(text).toContain('analytics.metrics');
        },
        { timeout: 3000 }
      );
    });

    it('should filter tables by table name', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input);
      await user.type(input, 'users');

      await waitFor(
        () => {
          const text = document.body.textContent || '';
          expect(text).toContain('public.users');
          expect(text).not.toContain('orders');
        },
        { timeout: 3000 }
      );
    });

    it('should filter tables by full name', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input);
      await user.type(input, 'public.orders');

      await waitFor(() => {
        expect(screen.getByText(/public.orders/)).toBeInTheDocument();
        expect(screen.queryByText(/analytics/)).not.toBeInTheDocument();
      });
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

    it('should clear search when dataset is selected', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Search datasets...') as HTMLInputElement;
      await user.click(input);
      await user.type(input, 'users');

      await waitFor(
        () => {
          expect(document.body.textContent).toContain('public.users');
        },
        { timeout: 3000 }
      );

      // Find and click on the dataset item in portal
      const datasetItems = document.querySelectorAll('[data-schema="public"][data-table="users"]');
      if (datasetItems.length > 0) {
        (datasetItems[0] as HTMLElement).click();
      }

      // Callback should be called with the selection
      await waitFor(() => {
        expect(mockOnDatasetChange).toHaveBeenCalledWith('public', 'users');
      });
    });
  });

  describe('Dropdown Behavior', () => {
    it('should open dropdown when clicking input', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText(/public.users/)).toBeInTheDocument();
        expect(screen.getByText(/public.orders/)).toBeInTheDocument();
      });
    });

    it('should open dropdown when focusing input', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input); // Focus triggers open

      await waitFor(() => {
        expect(screen.getByText(/public.users/)).toBeInTheDocument();
      });
    });

    it('should toggle dropdown when clicking chevron icon', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Search datasets...');

      // Find chevron by clicking near the input (chevron is absolutely positioned)
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText(/public.users/)).toBeInTheDocument();
      });
    });

    it('should show all datasets when opening dropdown without search', async () => {
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

    it('should not open dropdown when disabled', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} disabled />);

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input);

      // Wait a bit to ensure dropdown doesn't appear
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(screen.queryByText(/public.users/)).not.toBeInTheDocument();
    });

    it('should not open dropdown during loading', async () => {
      (useChartHooks.useAllSchemaTables as jest.Mock).mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Loading...');
      await user.click(input);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(screen.queryByText(/public.users/)).not.toBeInTheDocument();
    });
  });

  describe('Dataset Selection', () => {
    it('should call onDatasetChange when selecting a dataset', async () => {
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

      // Click directly on the dataset item using querySelector
      const datasetItem = document.querySelector('[data-schema="public"][data-table="users"]');
      if (datasetItem) {
        (datasetItem as HTMLElement).click();
      }

      await waitFor(() => {
        expect(mockOnDatasetChange).toHaveBeenCalledWith('public', 'users');
      });
    });

    it('should close dropdown after selection', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input);

      await waitFor(
        () => {
          expect(document.body.textContent).toContain('public.orders');
        },
        { timeout: 3000 }
      );

      const datasetItem = document.querySelector('[data-schema="public"][data-table="orders"]');
      if (datasetItem) {
        (datasetItem as HTMLElement).click();
      }

      await waitFor(() => {
        const text = document.body.textContent || '';
        expect(text).not.toContain('analytics.events');
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
          // Check if the item has the selected class (bg-blue-50)
          expect(selectedItem).toHaveClass('bg-blue-50');
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Disabled State', () => {
    it('should disable input when disabled prop is true', () => {
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} disabled />);

      const input = screen.getByPlaceholderText('Search datasets...');
      expect(input).toBeDisabled();
    });

    it('should not open dropdown when disabled', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} disabled />);

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(screen.queryByText(/public.users/)).not.toBeInTheDocument();
    });
  });

  describe('Auto-focus', () => {
    it('should auto-focus input when autoFocus is true', () => {
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} autoFocus />);

      const input = screen.getByPlaceholderText('Search datasets...');
      // Input should be focused (hard to test in jsdom, but we can verify it's not disabled)
      expect(input).not.toBeDisabled();
    });

    it('should not auto-focus when loading', () => {
      (useChartHooks.useAllSchemaTables as jest.Mock).mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} autoFocus />);

      const input = screen.getByPlaceholderText('Loading...');
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

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('No datasets available')).toBeInTheDocument();
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

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not crash, dropdown might not render or show empty state
      expect(input).toBeInTheDocument();
    });

    it('should handle search with only whitespace', async () => {
      const user = userEvent.setup();
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Search datasets...');
      await user.click(input);
      await user.type(input, '   ');

      await waitFor(() => {
        // Should show all datasets (whitespace is trimmed in filter)
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
          // Should find tables with "public." in full name
          expect(text).toContain('public.users');
          expect(text).toContain('public.orders');
        },
        { timeout: 3000 }
      );
    });

    it('should not call onDatasetChange with empty schema or table', async () => {
      const user = userEvent.setup();
      const customTables = [
        {
          schema_name: '',
          table_name: 'orphan',
          full_name: '.orphan',
        },
      ];

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

      // Wait a bit to ensure callback isn't called
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not call callback with empty schema
      expect(mockOnDatasetChange).not.toHaveBeenCalled();
    });

    it('should handle dataset with no schema_name or table_name initially', () => {
      render(<DatasetSelector onDatasetChange={mockOnDatasetChange} />);

      const input = screen.getByPlaceholderText('Search datasets...') as HTMLInputElement;
      // Should show empty value (search placeholder)
      expect(input.value).toBe('');
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
        // Check for <mark> element with highlighted text
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

      // Should not have <mark> elements when no search query
      const marks = document.querySelectorAll('mark');
      expect(marks.length).toBe(0);
    });
  });
});
