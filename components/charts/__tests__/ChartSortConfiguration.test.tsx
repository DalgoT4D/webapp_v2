/**
 * Tests for ChartSortConfiguration component
 * Tests sort criteria management with add, edit, remove, and reorder functionality
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChartSortConfiguration } from '../ChartSortConfiguration';
import type { ChartBuilderFormData, TableColumn } from '@/types/charts';

describe('ChartSortConfiguration', () => {
  const mockOnChange = jest.fn();

  const defaultColumns: TableColumn[] = [
    { column_name: 'name', data_type: 'text', name: 'name' },
    { column_name: 'age', data_type: 'number', name: 'age' },
    { column_name: 'email', data_type: 'text', name: 'email' },
    { column_name: 'created_at', data_type: 'timestamp', name: 'created_at' },
  ];

  const defaultFormData: ChartBuilderFormData = {
    chart_type: 'bar',
    schema_name: 'public',
    table_name: 'users',
    title: 'Test Chart',
    sort: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Collapsed View', () => {
    it('should render collapsed view by default with no sort criteria', () => {
      render(
        <ChartSortConfiguration
          formData={defaultFormData}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Sorting (0)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add sorting/i })).toBeInTheDocument();
      expect(screen.queryByText(/no sorting configured/i)).not.toBeInTheDocument();
    });

    it('should show count of sort criteria in collapsed view', () => {
      const formDataWithSort = {
        ...defaultFormData,
        sort: [
          { column: 'name', direction: 'asc' as const },
          { column: 'age', direction: 'desc' as const },
        ],
      };

      render(
        <ChartSortConfiguration
          formData={formDataWithSort}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Sorting (2)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /edit sorting/i })).toBeInTheDocument();
    });

    it('should display sort criteria summary in collapsed view', () => {
      const formDataWithSort = {
        ...defaultFormData,
        sort: [
          { column: 'name', direction: 'asc' as const },
          { column: 'age', direction: 'desc' as const },
        ],
      };

      render(
        <ChartSortConfiguration
          formData={formDataWithSort}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('name')).toBeInTheDocument();
      expect(screen.getByText('(asc)')).toBeInTheDocument();
      expect(screen.getByText('age')).toBeInTheDocument();
      expect(screen.getByText('(desc)')).toBeInTheDocument();
      expect(screen.getByText('1.')).toBeInTheDocument();
      expect(screen.getByText('2.')).toBeInTheDocument();
    });

    it('should expand configuration when clicking Add Sorting button', async () => {
      const user = userEvent.setup();
      render(
        <ChartSortConfiguration
          formData={defaultFormData}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /add sorting/i }));

      expect(screen.getByText('Chart Sorting')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
      expect(screen.getByText(/no sorting configured/i)).toBeInTheDocument();
    });

    it('should expand configuration when clicking Edit Sorting button', async () => {
      const user = userEvent.setup();
      const formDataWithSort = {
        ...defaultFormData,
        sort: [{ column: 'name', direction: 'asc' as const }],
      };

      render(
        <ChartSortConfiguration
          formData={formDataWithSort}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit sorting/i }));

      expect(screen.getByText('Chart Sorting')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
    });
  });

  describe('Expanded View - Empty State', () => {
    it('should render empty state with helpful message', async () => {
      const user = userEvent.setup();
      render(
        <ChartSortConfiguration
          formData={defaultFormData}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /add sorting/i }));

      expect(screen.getByText(/no sorting configured/i)).toBeInTheDocument();
      expect(
        screen.getByText(/add sort criteria to order the data in your chart/i)
      ).toBeInTheDocument();
    });

    it('should show helpful tips when no sort criteria exist', async () => {
      const user = userEvent.setup();
      render(
        <ChartSortConfiguration
          formData={defaultFormData}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /add sorting/i }));

      expect(
        screen.getByText(/sorting controls the order of data points in your chart/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/multiple sort criteria are applied in the order they appear/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/numerical columns sort by value, text columns sort alphabetically/i)
      ).toBeInTheDocument();
    });

    it('should have Add Sort Criteria button', async () => {
      const user = userEvent.setup();
      render(
        <ChartSortConfiguration
          formData={defaultFormData}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /add sorting/i }));

      expect(screen.getByRole('button', { name: /add sort criteria/i })).toBeInTheDocument();
    });
  });

  describe('Adding Sort Criteria', () => {
    it('should add new sort criteria when clicking Add Sort Criteria button', async () => {
      const user = userEvent.setup();
      render(
        <ChartSortConfiguration
          formData={defaultFormData}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /add sorting/i }));
      await user.click(screen.getByRole('button', { name: /add sort criteria/i }));

      expect(mockOnChange).toHaveBeenCalledWith({
        sort: [{ column: '', direction: 'asc' }],
      });
    });

    it('should add multiple sort criteria', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <ChartSortConfiguration
          formData={defaultFormData}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /add sorting/i }));
      await user.click(screen.getByRole('button', { name: /add sort criteria/i }));

      // Simulate parent updating formData
      const formDataWithOneSort = {
        ...defaultFormData,
        sort: [{ column: '', direction: 'asc' as const }],
      };
      rerender(
        <ChartSortConfiguration
          formData={formDataWithOneSort}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /add sort criteria/i }));

      expect(mockOnChange).toHaveBeenLastCalledWith({
        sort: [
          { column: '', direction: 'asc' },
          { column: '', direction: 'asc' },
        ],
      });
    });

    it('should initialize new sort with empty column and asc direction', async () => {
      const user = userEvent.setup();
      render(
        <ChartSortConfiguration
          formData={defaultFormData}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /add sorting/i }));
      await user.click(screen.getByRole('button', { name: /add sort criteria/i }));

      const call = mockOnChange.mock.calls[0][0];
      expect(call.sort[0]).toEqual({ column: '', direction: 'asc' });
    });
  });

  describe('Editing Sort Criteria', () => {
    it('should render sort criteria with labels and controls', async () => {
      const user = userEvent.setup();
      const formDataWithSort = {
        ...defaultFormData,
        sort: [{ column: 'name', direction: 'asc' as const }],
      };

      render(
        <ChartSortConfiguration
          formData={formDataWithSort}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit sorting/i }));

      expect(screen.getByText('Sort 1')).toBeInTheDocument();
      expect(screen.getByText('Column')).toBeInTheDocument();
      expect(screen.getByText('Direction')).toBeInTheDocument();
    });

    it('should show priority badge for multiple sort criteria', async () => {
      const user = userEvent.setup();
      const formDataWithSort = {
        ...defaultFormData,
        sort: [
          { column: 'name', direction: 'asc' as const },
          { column: 'age', direction: 'desc' as const },
        ],
      };

      render(
        <ChartSortConfiguration
          formData={formDataWithSort}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit sorting/i }));

      expect(screen.getByText('Priority 1')).toBeInTheDocument();
      expect(screen.getByText('Priority 2')).toBeInTheDocument();
    });

    it('should show sort priority info box for multiple criteria', async () => {
      const user = userEvent.setup();
      const formDataWithSort = {
        ...defaultFormData,
        sort: [
          { column: 'name', direction: 'asc' as const },
          { column: 'age', direction: 'desc' as const },
        ],
      };

      render(
        <ChartSortConfiguration
          formData={formDataWithSort}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit sorting/i }));

      expect(screen.getByText('Sort Priority')).toBeInTheDocument();
      expect(
        screen.getByText(
          /data will be sorted by the first criteria, then by the second, and so on/i
        )
      ).toBeInTheDocument();
    });

    it('should not show priority badge for single sort criteria', async () => {
      const user = userEvent.setup();
      const formDataWithSort = {
        ...defaultFormData,
        sort: [{ column: 'name', direction: 'asc' as const }],
      };

      render(
        <ChartSortConfiguration
          formData={formDataWithSort}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit sorting/i }));

      expect(screen.queryByText('Priority 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Sort Priority')).not.toBeInTheDocument();
    });
  });

  describe('Removing Sort Criteria', () => {
    it('should remove sort criteria when clicking delete button', async () => {
      const user = userEvent.setup();
      const formDataWithSort = {
        ...defaultFormData,
        sort: [
          { column: 'name', direction: 'asc' as const },
          { column: 'age', direction: 'desc' as const },
        ],
      };

      render(
        <ChartSortConfiguration
          formData={formDataWithSort}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit sorting/i }));

      const sortItems = screen.getAllByText(/^Sort \d+$/);
      const firstSortItem = sortItems[0].closest('.p-4');
      const buttons = within(firstSortItem!).getAllByRole('button');
      // Delete button is the last button (after move up and move down)
      const deleteButton = buttons[buttons.length - 1];

      await user.click(deleteButton);

      expect(mockOnChange).toHaveBeenCalledWith({
        sort: [{ column: 'age', direction: 'desc' }],
      });
    });

    it('should remove last sort criteria', async () => {
      const user = userEvent.setup();
      const formDataWithSort = {
        ...defaultFormData,
        sort: [{ column: 'name', direction: 'asc' as const }],
      };

      render(
        <ChartSortConfiguration
          formData={formDataWithSort}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit sorting/i }));

      const sortItems = screen.getAllByText(/^Sort \d+$/);
      const sortItem = sortItems[0].closest('.p-4');
      const buttons = within(sortItem!).getAllByRole('button');
      // Only delete button exists for single sort (no move buttons)
      const deleteButton = buttons[0];

      await user.click(deleteButton);

      expect(mockOnChange).toHaveBeenCalledWith({ sort: [] });
    });
  });

  describe('Reordering Sort Criteria', () => {
    it('should render move up/down buttons for multiple sort criteria', async () => {
      const user = userEvent.setup();
      const formDataWithSort = {
        ...defaultFormData,
        sort: [
          { column: 'name', direction: 'asc' as const },
          { column: 'age', direction: 'desc' as const },
        ],
      };

      render(
        <ChartSortConfiguration
          formData={formDataWithSort}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit sorting/i }));

      // Should have 4 arrow buttons total (2 up, 2 down)
      const sortItems = screen.getAllByText(/^Sort \d+$/);
      expect(sortItems).toHaveLength(2);
    });

    it('should not render move buttons for single sort criteria', async () => {
      const user = userEvent.setup();
      const formDataWithSort = {
        ...defaultFormData,
        sort: [{ column: 'name', direction: 'asc' as const }],
      };

      render(
        <ChartSortConfiguration
          formData={formDataWithSort}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit sorting/i }));

      // Should only have 1 button (delete), no move buttons
      const sortItems = screen.getAllByText(/^Sort \d+$/);
      const sortItem = sortItems[0].closest('.p-4');
      const buttons = within(sortItem!).getAllByRole('button');
      expect(buttons).toHaveLength(1); // Only delete button
    });

    it('should move sort criteria up', async () => {
      const user = userEvent.setup();
      const formDataWithSort = {
        ...defaultFormData,
        sort: [
          { column: 'name', direction: 'asc' as const },
          { column: 'age', direction: 'desc' as const },
        ],
      };

      render(
        <ChartSortConfiguration
          formData={formDataWithSort}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit sorting/i }));

      // Get the second sort item
      const sortItems = screen.getAllByText(/^Sort \d+$/);
      const secondSortItem = sortItems[1].closest('.p-4');
      const buttons = within(secondSortItem!).getAllByRole('button');
      const moveUpButton = buttons[0]; // First button should be move up

      await user.click(moveUpButton);

      expect(mockOnChange).toHaveBeenCalledWith({
        sort: [
          { column: 'age', direction: 'desc' },
          { column: 'name', direction: 'asc' },
        ],
      });
    });

    it('should move sort criteria down', async () => {
      const user = userEvent.setup();
      const formDataWithSort = {
        ...defaultFormData,
        sort: [
          { column: 'name', direction: 'asc' as const },
          { column: 'age', direction: 'desc' as const },
        ],
      };

      render(
        <ChartSortConfiguration
          formData={formDataWithSort}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit sorting/i }));

      // Get the first sort item
      const sortItems = screen.getAllByText(/^Sort \d+$/);
      const firstSortItem = sortItems[0].closest('.p-4');
      const buttons = within(firstSortItem!).getAllByRole('button');
      const moveDownButton = buttons[1]; // Second button should be move down

      await user.click(moveDownButton);

      expect(mockOnChange).toHaveBeenCalledWith({
        sort: [
          { column: 'age', direction: 'desc' },
          { column: 'name', direction: 'asc' },
        ],
      });
    });

    it('should disable move up button for first item', async () => {
      const user = userEvent.setup();
      const formDataWithSort = {
        ...defaultFormData,
        sort: [
          { column: 'name', direction: 'asc' as const },
          { column: 'age', direction: 'desc' as const },
        ],
      };

      render(
        <ChartSortConfiguration
          formData={formDataWithSort}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit sorting/i }));

      const sortItems = screen.getAllByText(/^Sort \d+$/);
      const firstSortItem = sortItems[0].closest('.p-4');
      const buttons = within(firstSortItem!).getAllByRole('button');
      const moveUpButton = buttons[0];

      expect(moveUpButton).toBeDisabled();
    });

    it('should disable move down button for last item', async () => {
      const user = userEvent.setup();
      const formDataWithSort = {
        ...defaultFormData,
        sort: [
          { column: 'name', direction: 'asc' as const },
          { column: 'age', direction: 'desc' as const },
        ],
      };

      render(
        <ChartSortConfiguration
          formData={formDataWithSort}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit sorting/i }));

      const sortItems = screen.getAllByText(/^Sort \d+$/);
      const lastSortItem = sortItems[1].closest('.p-4');
      const buttons = within(lastSortItem!).getAllByRole('button');
      const moveDownButton = buttons[1];

      expect(moveDownButton).toBeDisabled();
    });
  });

  describe('Column Normalization', () => {
    it('should handle columns with column_name property', () => {
      const columnsWithColumnName: TableColumn[] = [
        { column_name: 'name', data_type: 'text', name: 'display_name' },
      ];

      render(
        <ChartSortConfiguration
          formData={defaultFormData}
          columns={columnsWithColumnName}
          onChange={mockOnChange}
        />
      );

      // Should not throw error
      expect(screen.getByText('Sorting (0)')).toBeInTheDocument();
    });

    it('should handle columns with only name property', () => {
      const columnsWithName: any[] = [{ name: 'user_name', data_type: 'text' }];

      render(
        <ChartSortConfiguration
          formData={defaultFormData}
          columns={columnsWithName}
          onChange={mockOnChange}
        />
      );

      // Should not throw error - uses name property when column_name is undefined
      expect(screen.getByText('Sorting (0)')).toBeInTheDocument();
    });

    it('should handle empty columns array', () => {
      render(
        <ChartSortConfiguration formData={defaultFormData} columns={[]} onChange={mockOnChange} />
      );

      expect(screen.getByText('Sorting (0)')).toBeInTheDocument();
    });

    it('should handle undefined columns', () => {
      render(
        <ChartSortConfiguration
          formData={defaultFormData}
          columns={undefined}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Sorting (0)')).toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('should disable all buttons when disabled prop is true', async () => {
      const user = userEvent.setup();
      const formDataWithSort = {
        ...defaultFormData,
        sort: [{ column: 'name', direction: 'asc' as const }],
      };

      render(
        <ChartSortConfiguration
          formData={formDataWithSort}
          columns={defaultColumns}
          onChange={mockOnChange}
          disabled={true}
        />
      );

      const editButton = screen.getByRole('button', { name: /edit sorting/i });
      expect(editButton).toBeDisabled();
    });

    it('should disable add button in expanded view when disabled', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <ChartSortConfiguration
          formData={defaultFormData}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /add sorting/i }));

      rerender(
        <ChartSortConfiguration
          formData={defaultFormData}
          columns={defaultColumns}
          onChange={mockOnChange}
          disabled={true}
        />
      );

      const addButton = screen.getByRole('button', { name: /add sort criteria/i });
      expect(addButton).toBeDisabled();
    });
  });

  describe('Collapsing View', () => {
    it('should collapse when clicking Done button', async () => {
      const user = userEvent.setup();
      render(
        <ChartSortConfiguration
          formData={defaultFormData}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /add sorting/i }));
      expect(screen.getByText('Chart Sorting')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /done/i }));
      expect(screen.queryByText('Chart Sorting')).not.toBeInTheDocument();
      expect(screen.getByText('Sorting (0)')).toBeInTheDocument();
    });

    it('should maintain sort criteria when collapsing', async () => {
      const user = userEvent.setup();
      const formDataWithSort = {
        ...defaultFormData,
        sort: [
          { column: 'name', direction: 'asc' as const },
          { column: 'age', direction: 'desc' as const },
        ],
      };

      render(
        <ChartSortConfiguration
          formData={formDataWithSort}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit sorting/i }));
      await user.click(screen.getByRole('button', { name: /done/i }));

      expect(screen.getByText('Sorting (2)')).toBeInTheDocument();
      expect(screen.getByText('name')).toBeInTheDocument();
      expect(screen.getByText('age')).toBeInTheDocument();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow: add, edit, reorder, and remove', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <ChartSortConfiguration
          formData={defaultFormData}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      // Expand and add first sort
      await user.click(screen.getByRole('button', { name: /add sorting/i }));
      await user.click(screen.getByRole('button', { name: /add sort criteria/i }));
      expect(mockOnChange).toHaveBeenLastCalledWith({
        sort: [{ column: '', direction: 'asc' }],
      });

      // Simulate parent updating with first sort
      let currentFormData = {
        ...defaultFormData,
        sort: [{ column: 'name', direction: 'asc' as const }],
      };
      rerender(
        <ChartSortConfiguration
          formData={currentFormData}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      // Add second sort
      await user.click(screen.getByRole('button', { name: /add sort criteria/i }));

      // Simulate parent updating with both sorts
      currentFormData = {
        ...defaultFormData,
        sort: [
          { column: 'name', direction: 'asc' as const },
          { column: 'age', direction: 'desc' as const },
        ],
      };
      rerender(
        <ChartSortConfiguration
          formData={currentFormData}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      // Verify both sorts are shown
      expect(screen.getByText('Sort 1')).toBeInTheDocument();
      expect(screen.getByText('Sort 2')).toBeInTheDocument();

      // Move second sort up
      const sortItems = screen.getAllByText(/^Sort \d+$/);
      const secondSortItem = sortItems[1].closest('.p-4');
      const buttons = within(secondSortItem!).getAllByRole('button');
      await user.click(buttons[0]); // Move up button

      expect(mockOnChange).toHaveBeenLastCalledWith({
        sort: [
          { column: 'age', direction: 'desc' },
          { column: 'name', direction: 'asc' },
        ],
      });
    });

    it('should preserve state through expand/collapse cycles', async () => {
      const user = userEvent.setup();
      const formDataWithSort = {
        ...defaultFormData,
        sort: [{ column: 'name', direction: 'asc' as const }],
      };

      render(
        <ChartSortConfiguration
          formData={formDataWithSort}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      // Expand
      await user.click(screen.getByRole('button', { name: /edit sorting/i }));
      expect(screen.getByText('Sort 1')).toBeInTheDocument();

      // Collapse
      await user.click(screen.getByRole('button', { name: /done/i }));
      expect(screen.getByText('Sorting (1)')).toBeInTheDocument();

      // Expand again
      await user.click(screen.getByRole('button', { name: /edit sorting/i }));
      expect(screen.getByText('Sort 1')).toBeInTheDocument();
    });
  });
});
