import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardFilterWidget } from '../dashboard-filter-widgets';
import { DashboardFilterType } from '@/types/dashboard-filters';
import type { DashboardFilterConfig } from '@/types/dashboard-filters';

// Mock SWR
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn((key) => {
    // Mock different responses based on the API endpoint
    if (key && typeof key === 'string' && key.includes('filter_type=value')) {
      return {
        data: {
          options: [
            { value: 'option1', label: 'Option 1', count: 10 },
            { value: 'option2', label: 'Option 2', count: 20 },
            { value: 'option3', label: 'Option 3', count: 30 },
          ],
        },
        error: null,
        isLoading: false,
      };
    }
    return { data: null, error: null, isLoading: false };
  }),
}));

// Mock API module
jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
}));

const mockValueFilter: DashboardFilterConfig = {
  id: '1',
  name: 'Test Filter',
  schema_name: 'public',
  table_name: 'test_table',
  column_name: 'test_column',
  filter_type: DashboardFilterType.VALUE,
  settings: {
    has_default_value: false,
    can_select_multiple: false,
  },
  position: { x: 0, y: 0, w: 4, h: 3 },
};

const mockMultiSelectFilter: DashboardFilterConfig = {
  ...mockValueFilter,
  id: '2',
  name: 'Multi Select Filter',
  settings: {
    has_default_value: false,
    can_select_multiple: true,
  },
};

describe('DashboardFilterWidget - Single Select Mode', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders, displays values, handles selection, and supports search', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DashboardFilterWidget filter={mockValueFilter} value={null} onChange={mockOnChange} />
    );

    // Should show filter name and render combobox
    expect(screen.getByText('Test Filter')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    // Test selection change
    const combobox = screen.getByRole('combobox');
    await user.click(combobox);
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
    await user.click(screen.getByText('Option 2'));
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith('1', 'option2');
    });

    // Test display of selected value
    rerender(
      <DashboardFilterWidget filter={mockValueFilter} value="option1" onChange={mockOnChange} />
    );
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveValue('Option 1');
    });

    // Test value clearing
    rerender(
      <DashboardFilterWidget filter={mockValueFilter} value={null} onChange={mockOnChange} />
    );
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveValue('');
    });

    // Test search functionality
    await user.click(screen.getByRole('combobox'));
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
    await user.type(screen.getByRole('combobox'), 'Option 3');
    await waitFor(() => {
      const options = screen.getByRole('listbox').querySelectorAll('[role="option"]');
      expect(options.length).toBeGreaterThan(0);
    });
  });

  it('handles loading, error, and empty states correctly', () => {
    const useSWR = require('swr').default;

    // Test loading state
    useSWR.mockReturnValueOnce({
      data: null,
      error: null,
      isLoading: true,
    });
    const { rerender } = render(
      <DashboardFilterWidget filter={mockValueFilter} value={null} onChange={mockOnChange} />
    );
    expect(screen.getByText('Loading options...')).toBeInTheDocument();

    // Test error state
    useSWR.mockReturnValueOnce({
      data: null,
      error: new Error('Failed to load options'),
      isLoading: false,
    });
    rerender(
      <DashboardFilterWidget filter={mockValueFilter} value={null} onChange={mockOnChange} />
    );
    expect(screen.getByText('Options need attention')).toBeInTheDocument();

    // Test empty state
    useSWR.mockReturnValueOnce({
      data: { options: [] },
      error: null,
      isLoading: false,
    });
    rerender(
      <DashboardFilterWidget filter={mockValueFilter} value={null} onChange={mockOnChange} />
    );
    expect(screen.getByText('No options available')).toBeInTheDocument();
  });
});

describe('DashboardFilterWidget - Multi Select Mode', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders, displays multiple values, and handles selections', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DashboardFilterWidget filter={mockMultiSelectFilter} value={[]} onChange={mockOnChange} />
    );

    // Should show filter name and render combobox
    expect(screen.getByText('Multi Select Filter')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    // Test multiple selections
    const combobox = screen.getByRole('combobox');
    await user.click(combobox);
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
    await user.click(screen.getByText('Option 1'));
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith('2', ['option1']);
    });

    // Test displaying multiple selected values
    rerender(
      <DashboardFilterWidget
        filter={mockMultiSelectFilter}
        value={['option1', 'option2']}
        onChange={mockOnChange}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    // Test compact mode rendering
    rerender(
      <DashboardFilterWidget
        filter={mockValueFilter}
        value={null}
        onChange={mockOnChange}
        isEditMode={true}
      />
    );
    const filterNameElement = screen.getByText('Test Filter');
    expect(filterNameElement).toHaveClass('text-xs');
  });
});

describe('DashboardFilterWidget - Error Handling', () => {
  const mockOnChange = jest.fn();

  it('handles invalid and null filter data gracefully', () => {
    // Test invalid filter
    const invalidFilter = {
      id: '1',
      name: 'Invalid Filter',
      // Missing required fields
    } as any;
    const { rerender } = render(
      <DashboardFilterWidget filter={invalidFilter} value={null} onChange={mockOnChange} />
    );
    expect(screen.getByText('Invalid filter configuration')).toBeInTheDocument();

    // Test null filter
    rerender(<DashboardFilterWidget filter={null as any} value={null} onChange={mockOnChange} />);
    expect(screen.getByText('No filter data available')).toBeInTheDocument();
  });
});
