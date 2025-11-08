/**
 * Comprehensive tests for ChartFiltersConfiguration component
 *
 * Covers:
 * - Component rendering in collapsed/expanded states
 * - Filter management (add, update, remove)
 * - Column and operator selection
 * - Data type detection and operator filtering
 * - Value input rendering based on operator type
 * - Edge cases and null handling
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChartFiltersConfiguration } from '../ChartFiltersConfiguration';
import type { ChartBuilderFormData, TableColumn } from '@/types/charts';

describe('ChartFiltersConfiguration', () => {
  const mockOnChange = jest.fn();

  const baseFormData: ChartBuilderFormData = {
    title: 'Test Chart',
    chart_type: 'bar',
    schema_name: 'public',
    table_name: 'sales',
    computation_type: 'aggregated',
    filters: [],
  };

  const mockColumns: TableColumn[] = [
    { column_name: 'category', name: 'category', data_type: 'varchar' },
    { column_name: 'amount', name: 'amount', data_type: 'numeric' },
    { column_name: 'quantity', name: 'quantity', data_type: 'integer' },
    { column_name: 'created_at', name: 'created_at', data_type: 'timestamp' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering States', () => {
    it('should render collapsed state with no filters', () => {
      render(
        <ChartFiltersConfiguration
          formData={baseFormData}
          columns={mockColumns}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Filters (0)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add filters/i })).toBeInTheDocument();
    });

    it('should render collapsed state with existing filters', () => {
      const formDataWithFilters = {
        ...baseFormData,
        filters: [{ column: 'category', operator: 'equals' as const, value: 'test' }],
      };

      render(
        <ChartFiltersConfiguration
          formData={formDataWithFilters}
          columns={mockColumns}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Filters (1)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /edit filters/i })).toBeInTheDocument();
      expect(screen.getByText(/category equals test/i)).toBeInTheDocument();
    });

    it('should expand to show full configuration', async () => {
      const user = userEvent.setup();
      render(
        <ChartFiltersConfiguration
          formData={baseFormData}
          columns={mockColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /add filters/i }));

      expect(screen.getByText('Chart Filters')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
    });

    // Note: Loading state test removed because it's unreachable
    // Component has `columns = []` default parameter on line 42, making the loading
    // state check on line 57 (`!columns`) always false since [] is truthy

    it('should respect disabled prop', () => {
      render(
        <ChartFiltersConfiguration
          formData={baseFormData}
          columns={mockColumns}
          onChange={mockOnChange}
          disabled
        />
      );

      expect(screen.getByRole('button', { name: /add filters/i })).toBeDisabled();
    });
  });

  describe('Filter Management', () => {
    it('should add new filter', async () => {
      const user = userEvent.setup();
      render(
        <ChartFiltersConfiguration
          formData={baseFormData}
          columns={mockColumns}
          onChange={mockOnChange}
        />
      );

      // Expand configuration
      await user.click(screen.getByRole('button', { name: /add filters/i }));

      // Click add filter button
      await user.click(screen.getByRole('button', { name: /add filter/i }));

      expect(mockOnChange).toHaveBeenCalledWith({
        filters: [{ column: '', operator: 'equals', value: '' }],
      });
    });

    it('should remove filter', async () => {
      const user = userEvent.setup();
      const formDataWithFilters = {
        ...baseFormData,
        filters: [
          { column: 'category', operator: 'equals' as const, value: 'test' },
          { column: 'amount', operator: 'greater_than' as const, value: '100' },
        ],
      };

      render(
        <ChartFiltersConfiguration
          formData={formDataWithFilters}
          columns={mockColumns}
          onChange={mockOnChange}
        />
      );

      // Expand configuration
      await user.click(screen.getByRole('button', { name: /edit filters/i }));

      // Find and click first remove button
      const removeButtons = screen.getAllByRole('button', { name: '' });
      const trashButtons = removeButtons.filter((btn) => btn.querySelector('svg'));
      await user.click(trashButtons[0]);

      expect(mockOnChange).toHaveBeenCalledWith({
        filters: [{ column: 'amount', operator: 'greater_than', value: '100' }],
      });
    });

    it('should show empty state when no filters configured', async () => {
      const user = userEvent.setup();
      render(
        <ChartFiltersConfiguration
          formData={baseFormData}
          columns={mockColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /add filters/i }));

      expect(screen.getByText('No filters configured')).toBeInTheDocument();
      expect(
        screen.getByText('Add filters to limit the data shown in your chart')
      ).toBeInTheDocument();
    });
  });

  describe('Data Type Detection', () => {
    it('should render filters with column selection for number columns', async () => {
      const user = userEvent.setup();
      const formDataWithFilter = {
        ...baseFormData,
        filters: [{ column: 'amount', operator: 'equals' as const, value: '' }],
      };

      render(
        <ChartFiltersConfiguration
          formData={formDataWithFilter}
          columns={mockColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit filters/i }));

      // Should render filter configuration with labels
      expect(screen.getByText('Column')).toBeInTheDocument();
      expect(screen.getByText('Operator')).toBeInTheDocument();
      expect(screen.getByText('Filter 1')).toBeInTheDocument();
    });

    it('should render filters with column selection for text columns', async () => {
      const user = userEvent.setup();
      const formDataWithFilter = {
        ...baseFormData,
        filters: [{ column: 'category', operator: 'equals' as const, value: '' }],
      };

      render(
        <ChartFiltersConfiguration
          formData={formDataWithFilter}
          columns={mockColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit filters/i }));

      // Should render filter configuration
      expect(screen.getByText('Column')).toBeInTheDocument();
      expect(screen.getByText('Operator')).toBeInTheDocument();
    });

    it('should render filters with column selection for date columns', async () => {
      const user = userEvent.setup();
      const formDataWithFilter = {
        ...baseFormData,
        filters: [{ column: 'created_at', operator: 'equals' as const, value: '' }],
      };

      render(
        <ChartFiltersConfiguration
          formData={formDataWithFilter}
          columns={mockColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit filters/i }));

      // Should render filter configuration
      expect(screen.getByText('Column')).toBeInTheDocument();
      expect(screen.getByText('Operator')).toBeInTheDocument();
    });
  });

  describe('Value Input Rendering', () => {
    it('should not render value input for is_null operator', async () => {
      const user = userEvent.setup();
      const formDataWithFilter = {
        ...baseFormData,
        filters: [{ column: 'category', operator: 'is_null' as const, value: '' }],
      };

      render(
        <ChartFiltersConfiguration
          formData={formDataWithFilter}
          columns={mockColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit filters/i }));

      // Should have Value label but no input field (component renders label even when input is null)
      expect(screen.getByText('Value')).toBeInTheDocument();
      // Verify no input fields are rendered
      expect(screen.queryByPlaceholderText(/enter/i)).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/value/i)).not.toBeInTheDocument();
    });

    it('should not render value input for is_not_null operator', async () => {
      const user = userEvent.setup();
      const formDataWithFilter = {
        ...baseFormData,
        filters: [{ column: 'category', operator: 'is_not_null' as const, value: '' }],
      };

      render(
        <ChartFiltersConfiguration
          formData={formDataWithFilter}
          columns={mockColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit filters/i }));

      // Should have Value label but no input field
      expect(screen.getByText('Value')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/enter/i)).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/value/i)).not.toBeInTheDocument();
    });

    it('should render comma-separated input for "in" operator', async () => {
      const user = userEvent.setup();
      const formDataWithFilter = {
        ...baseFormData,
        filters: [{ column: 'category', operator: 'in' as const, value: '' }],
      };

      render(
        <ChartFiltersConfiguration
          formData={formDataWithFilter}
          columns={mockColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit filters/i }));

      expect(screen.getByPlaceholderText('value1, value2, value3')).toBeInTheDocument();
    });

    it('should render comma-separated input for "not_in" operator', async () => {
      const user = userEvent.setup();
      const formDataWithFilter = {
        ...baseFormData,
        filters: [{ column: 'category', operator: 'not_in' as const, value: '' }],
      };

      render(
        <ChartFiltersConfiguration
          formData={formDataWithFilter}
          columns={mockColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit filters/i }));

      expect(screen.getByPlaceholderText('value1, value2, value3')).toBeInTheDocument();
    });

    it('should render number input for number columns', async () => {
      const user = userEvent.setup();
      const formDataWithFilter = {
        ...baseFormData,
        filters: [{ column: 'amount', operator: 'equals' as const, value: '' }],
      };

      render(
        <ChartFiltersConfiguration
          formData={formDataWithFilter}
          columns={mockColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit filters/i }));

      const input = screen.getByPlaceholderText(/enter number value/i);
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'number');
    });

    it('should render date input for date columns', async () => {
      const user = userEvent.setup();
      const formDataWithFilter = {
        ...baseFormData,
        filters: [{ column: 'created_at', operator: 'equals' as const, value: '' }],
      };

      render(
        <ChartFiltersConfiguration
          formData={formDataWithFilter}
          columns={mockColumns}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /edit filters/i }));

      const input = screen.getByPlaceholderText(/enter date value/i);
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'date');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty columns array', () => {
      render(
        <ChartFiltersConfiguration formData={baseFormData} columns={[]} onChange={mockOnChange} />
      );

      expect(screen.getByText('Filters (0)')).toBeInTheDocument();
    });

    it('should handle undefined filters in formData', () => {
      const formDataWithoutFilters = {
        ...baseFormData,
        filters: undefined,
      };

      render(
        <ChartFiltersConfiguration
          formData={formDataWithoutFilters as any}
          columns={mockColumns}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Filters (0)')).toBeInTheDocument();
    });

    it('should handle columns with missing name field', () => {
      const columnsWithMissingNames = [
        { column_name: 'test', data_type: 'varchar' },
        { name: 'test2', data_type: 'integer', column_name: undefined },
      ] as any;

      render(
        <ChartFiltersConfiguration
          formData={baseFormData}
          columns={columnsWithMissingNames}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Filters (0)')).toBeInTheDocument();
    });

    it('should collapse back to summary view', async () => {
      const user = userEvent.setup();
      render(
        <ChartFiltersConfiguration
          formData={baseFormData}
          columns={mockColumns}
          onChange={mockOnChange}
        />
      );

      // Expand
      await user.click(screen.getByRole('button', { name: /add filters/i }));
      expect(screen.getByText('Chart Filters')).toBeInTheDocument();

      // Collapse
      await user.click(screen.getByRole('button', { name: /done/i }));
      expect(screen.queryByText('Chart Filters')).not.toBeInTheDocument();
      expect(screen.getByText('Filters (0)')).toBeInTheDocument();
    });

    it('should handle multiple filters display in collapsed state', () => {
      const formDataWithMultipleFilters = {
        ...baseFormData,
        filters: [
          { column: 'category', operator: 'equals' as const, value: 'electronics' },
          { column: 'amount', operator: 'greater_than' as const, value: '100' },
          { column: 'quantity', operator: 'less_than' as const, value: '50' },
        ],
      };

      render(
        <ChartFiltersConfiguration
          formData={formDataWithMultipleFilters}
          columns={mockColumns}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Filters (3)')).toBeInTheDocument();
      expect(screen.getByText(/category equals electronics/i)).toBeInTheDocument();
      expect(screen.getByText(/amount greater than 100/i)).toBeInTheDocument();
      expect(screen.getByText(/quantity less than 50/i)).toBeInTheDocument();
    });
  });
});
