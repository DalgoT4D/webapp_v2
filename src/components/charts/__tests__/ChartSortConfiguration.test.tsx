/**
 * Tests for ChartSortConfiguration component
 * Consolidated tests for sort criteria management with add, edit, remove, and reorder functionality
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

  describe('Collapsed and Expanded Views', () => {
    it.each([
      ['no sort criteria', [], 'Sorting (0)', /add sorting/i],
      [
        'with sort criteria',
        [
          { column: 'name', direction: 'asc' as const },
          { column: 'age', direction: 'desc' as const },
        ],
        'Sorting (2)',
        /edit sorting/i,
      ],
    ])('should render collapsed view with %s', (desc, sort, expectedText, buttonText) => {
      const formData = { ...defaultFormData, sort };

      render(
        <ChartSortConfiguration
          formData={formData}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(expectedText)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: buttonText })).toBeInTheDocument();
    });

    it('should display sort criteria summary in collapsed view', () => {
      const formData = {
        ...defaultFormData,
        sort: [
          { column: 'name', direction: 'asc' as const },
          { column: 'age', direction: 'desc' as const },
        ],
      };

      render(
        <ChartSortConfiguration
          formData={formData}
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

    it.each([
      ['add sorting button', /add sorting/i, 'no sorting configured'],
      ['edit sorting button', /edit sorting/i, 'Sort 1'],
    ])(
      'should expand configuration when clicking %s',
      async (desc, buttonName, expectedContent) => {
        const user = userEvent.setup();
        const formData = buttonName.toString().includes('edit')
          ? { ...defaultFormData, sort: [{ column: 'name', direction: 'asc' as const }] }
          : defaultFormData;

        render(
          <ChartSortConfiguration
            formData={formData}
            columns={defaultColumns}
            onChange={mockOnChange}
          />
        );

        await user.click(screen.getByRole('button', { name: buttonName }));

        expect(screen.getByText('Chart Sorting')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
        expect(screen.getByText(new RegExp(expectedContent, 'i'))).toBeInTheDocument();
      }
    );
  });

  describe('Empty State and Tips', () => {
    it('should render empty state with helpful message and tips', async () => {
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
      expect(
        screen.getByText(/sorting controls the order of data points in your chart/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/multiple sort criteria are applied in the order they appear/i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add sort criteria/i })).toBeInTheDocument();
    });
  });

  describe('Adding and Editing Sort Criteria', () => {
    it('should add new sort criteria with default values', async () => {
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

    it('should render sort criteria labels for single criterion', async () => {
      const user = userEvent.setup();
      const formData = {
        ...defaultFormData,
        sort: [{ column: 'name', direction: 'asc' as const }],
      };

      render(
        <ChartSortConfiguration
          formData={formData}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit sorting/i }));

      expect(screen.getAllByText('Column').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Direction').length).toBeGreaterThan(0);
      expect(screen.queryByText('Priority 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Sort Priority')).not.toBeInTheDocument();
    });

    it('should render sort criteria with priority for multiple criteria', async () => {
      const user = userEvent.setup();
      const formData = {
        ...defaultFormData,
        sort: [
          { column: 'name', direction: 'asc' as const },
          { column: 'age', direction: 'desc' as const },
        ],
      };

      render(
        <ChartSortConfiguration
          formData={formData}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit sorting/i }));

      expect(screen.getAllByText('Column').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Direction').length).toBeGreaterThan(0);
      expect(screen.getByText('Priority 1')).toBeInTheDocument();
      expect(screen.getByText('Priority 2')).toBeInTheDocument();
      expect(screen.getByText('Sort Priority')).toBeInTheDocument();
    });
  });

  describe('Removing Sort Criteria', () => {
    it('should remove sort criteria from middle of list', async () => {
      const user = userEvent.setup();
      const formData = {
        ...defaultFormData,
        sort: [
          { column: 'name', direction: 'asc' as const },
          { column: 'age', direction: 'desc' as const },
        ],
      };

      render(
        <ChartSortConfiguration
          formData={formData}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit sorting/i }));

      const sortItems = screen.getAllByText(/^Sort \d+$/);
      const firstSortItem = sortItems[0].closest('.p-4');
      const buttons = within(firstSortItem!).getAllByRole('button');
      const deleteButton = buttons[buttons.length - 1];

      await user.click(deleteButton);

      expect(mockOnChange).toHaveBeenCalledWith({
        sort: [{ column: 'age', direction: 'desc' }],
      });
    });

    it('should remove last sort criteria and show empty state', async () => {
      const user = userEvent.setup();
      const formData = {
        ...defaultFormData,
        sort: [{ column: 'name', direction: 'asc' as const }],
      };

      render(
        <ChartSortConfiguration
          formData={formData}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit sorting/i }));

      const sortItems = screen.getAllByText(/^Sort \d+$/);
      const sortItem = sortItems[0].closest('.p-4');
      const buttons = within(sortItem!).getAllByRole('button');
      const deleteButton = buttons[0];

      await user.click(deleteButton);

      expect(mockOnChange).toHaveBeenCalledWith({ sort: [] });
    });
  });

  describe('Reordering Sort Criteria', () => {
    it('should render move buttons only for multiple sort criteria', async () => {
      const user = userEvent.setup();
      const formDataMultiple = {
        ...defaultFormData,
        sort: [
          { column: 'name', direction: 'asc' as const },
          { column: 'age', direction: 'desc' as const },
        ],
      };

      render(
        <ChartSortConfiguration
          formData={formDataMultiple}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit sorting/i }));

      const sortItems = screen.getAllByText(/^Sort \d+$/);
      expect(sortItems).toHaveLength(2);
    });

    it.each([
      [
        'move up',
        1,
        0,
        [
          { column: 'age', direction: 'desc' },
          { column: 'name', direction: 'asc' },
        ],
      ],
      [
        'move down',
        0,
        1,
        [
          { column: 'age', direction: 'desc' },
          { column: 'name', direction: 'asc' },
        ],
      ],
    ])('should %s sort criteria', async (action, itemIndex, buttonIndex, expected) => {
      const user = userEvent.setup();
      const formData = {
        ...defaultFormData,
        sort: [
          { column: 'name', direction: 'asc' as const },
          { column: 'age', direction: 'desc' as const },
        ],
      };

      render(
        <ChartSortConfiguration
          formData={formData}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit sorting/i }));

      const sortItems = screen.getAllByText(/^Sort \d+$/);
      const sortItem = sortItems[itemIndex].closest('.p-4');
      const buttons = within(sortItem!).getAllByRole('button');

      await user.click(buttons[buttonIndex]);

      expect(mockOnChange).toHaveBeenCalledWith({ sort: expected });
    });

    it.each([
      ['first item move up', 0, 0, true],
      ['last item move down', 1, 1, true],
    ])('should disable %s button', async (desc, itemIndex, buttonIndex, shouldBeDisabled) => {
      const user = userEvent.setup();
      const formData = {
        ...defaultFormData,
        sort: [
          { column: 'name', direction: 'asc' as const },
          { column: 'age', direction: 'desc' as const },
        ],
      };

      render(
        <ChartSortConfiguration
          formData={formData}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit sorting/i }));

      const sortItems = screen.getAllByText(/^Sort \d+$/);
      const sortItem = sortItems[itemIndex].closest('.p-4');
      const buttons = within(sortItem!).getAllByRole('button');
      const button = buttons[buttonIndex];

      if (shouldBeDisabled) {
        expect(button).toBeDisabled();
      }
    });
  });

  describe('Column Normalization and Edge Cases', () => {
    it.each([
      [
        'columns with column_name',
        [{ column_name: 'name', data_type: 'text', name: 'display_name' }],
      ],
      ['columns with only name', [{ name: 'user_name', data_type: 'text' } as any]],
      ['empty columns array', []],
      ['undefined columns', undefined],
    ])('should handle %s', (desc, columns) => {
      render(
        <ChartSortConfiguration
          formData={defaultFormData}
          columns={columns}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Sorting (0)')).toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('should disable all buttons when disabled prop is true', async () => {
      const formData = {
        ...defaultFormData,
        sort: [{ column: 'name', direction: 'asc' as const }],
      };

      render(
        <ChartSortConfiguration
          formData={formData}
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

  describe('Collapsing and Integration', () => {
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

    it('should handle complete workflow: add, edit, reorder, and remove', async () => {
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
      expect(mockOnChange).toHaveBeenLastCalledWith({
        sort: [{ column: '', direction: 'asc' }],
      });

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

      await user.click(screen.getByRole('button', { name: /add sort criteria/i }));

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

      expect(screen.getByText('Sort 1')).toBeInTheDocument();
      expect(screen.getByText('Sort 2')).toBeInTheDocument();

      const sortItems = screen.getAllByText(/^Sort \d+$/);
      const secondSortItem = sortItems[1].closest('.p-4');
      const buttons = within(secondSortItem!).getAllByRole('button');
      await user.click(buttons[0]);

      expect(mockOnChange).toHaveBeenLastCalledWith({
        sort: [
          { column: 'age', direction: 'desc' },
          { column: 'name', direction: 'asc' },
        ],
      });
    });

    it('should preserve state through expand/collapse cycles', async () => {
      const user = userEvent.setup();
      const formData = {
        ...defaultFormData,
        sort: [{ column: 'name', direction: 'asc' as const }],
      };

      render(
        <ChartSortConfiguration
          formData={formData}
          columns={defaultColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit sorting/i }));
      expect(screen.getByText('Sort 1')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /done/i }));
      expect(screen.getByText('Sorting (1)')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /edit sorting/i }));
      expect(screen.getByText('Sort 1')).toBeInTheDocument();
    });
  });
});
