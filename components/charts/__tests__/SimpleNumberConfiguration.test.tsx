/**
 * Tests for SimpleNumberConfiguration component
 * Tests metric column selection, aggregate functions, and filters
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { SimpleNumberConfiguration } from '../SimpleNumberConfiguration';
import type { ChartBuilderFormData, TableColumn } from '@/types/charts';

// Mock pointer capture for Radix UI Select
HTMLElement.prototype.hasPointerCapture = jest.fn();
HTMLElement.prototype.setPointerCapture = jest.fn();
HTMLElement.prototype.releasePointerCapture = jest.fn();

// Mock ChartFiltersConfiguration
jest.mock('../ChartFiltersConfiguration', () => ({
  ChartFiltersConfiguration: ({ disabled }: { disabled: boolean }) => (
    <div data-testid="chart-filters-config" data-disabled={disabled}>
      Filters Configuration Mock
    </div>
  ),
}));

describe('SimpleNumberConfiguration', () => {
  const mockColumns: TableColumn[] = [
    { column_name: 'revenue', data_type: 'numeric' },
    { column_name: 'quantity', data_type: 'integer' },
    { column_name: 'price', data_type: 'decimal' },
    { column_name: 'customer_name', data_type: 'varchar' },
    { column_name: 'order_date', data_type: 'timestamp' },
  ];

  const mockFormData: ChartBuilderFormData = {
    title: 'Test Chart',
    chart_type: 'number',
    aggregate_column: 'revenue',
    aggregate_function: 'sum',
  };

  const mockOnChange = jest.fn();

  const defaultProps = {
    formData: mockFormData,
    columns: mockColumns,
    onChange: mockOnChange,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all UI elements and handle disabled state correctly', () => {
    // Render all UI elements with correct labels and components
    let result = render(<SimpleNumberConfiguration {...defaultProps} />);

    // Labels
    expect(screen.getByText('Metric Column')).toBeInTheDocument();
    expect(screen.getByText('Aggregate Function')).toBeInTheDocument();
    expect(screen.getByText('Data Filters')).toBeInTheDocument();
    expect(
      screen.getByText('Add conditions to limit which data appears in your chart')
    ).toBeInTheDocument();

    // Components
    expect(screen.getByTestId('chart-filters-config')).toBeInTheDocument();
    let selectElements = screen.getAllByRole('combobox');
    expect(selectElements.length).toBeGreaterThanOrEqual(2); // metric column + aggregate function

    // Enabled by default
    selectElements.forEach((select) => {
      expect(select).not.toBeDisabled();
    });
    let filtersConfig = screen.getByTestId('chart-filters-config');
    expect(filtersConfig).toHaveAttribute('data-disabled', 'false');

    // Disabled when prop is true
    result.rerender(<SimpleNumberConfiguration {...defaultProps} disabled={true} />);
    selectElements = screen.getAllByRole('combobox');
    selectElements.forEach((select) => {
      expect(select).toBeDisabled();
    });
    filtersConfig = screen.getByTestId('chart-filters-config');
    expect(filtersConfig).toHaveAttribute('data-disabled', 'true');

    // Disable filters when no aggregate column is selected
    const formDataWithoutColumn = { ...mockFormData, aggregate_column: undefined };
    result.rerender(
      <SimpleNumberConfiguration {...defaultProps} formData={formDataWithoutColumn} />
    );
    filtersConfig = screen.getByTestId('chart-filters-config');
    expect(filtersConfig).toHaveAttribute('data-disabled', 'true');
  });

  it('should support all aggregate functions and handle edge cases', () => {
    // Test all aggregate functions
    const aggregateFunctions = ['sum', 'avg', 'count', 'min', 'max', 'count_distinct'];

    aggregateFunctions.forEach((func) => {
      const formDataWithFunc = { ...mockFormData, aggregate_function: func };
      const { unmount } = render(
        <SimpleNumberConfiguration {...defaultProps} formData={formDataWithFunc} />
      );

      // Component renders without errors for all aggregate functions
      expect(screen.getByText('Aggregate Function')).toBeInTheDocument();
      expect(screen.getByText('Metric Column')).toBeInTheDocument();
      unmount();
    });

    // Edge cases - empty columns
    const { rerender } = render(<SimpleNumberConfiguration {...defaultProps} columns={[]} />);
    expect(screen.getByText('Metric Column')).toBeInTheDocument();
    expect(screen.getByText('Aggregate Function')).toBeInTheDocument();

    // Undefined columns
    rerender(<SimpleNumberConfiguration {...defaultProps} columns={undefined} />);
    expect(screen.getByText('Metric Column')).toBeInTheDocument();

    // Missing aggregate_column
    const formDataWithoutColumn = { ...mockFormData, aggregate_column: undefined };
    rerender(<SimpleNumberConfiguration {...defaultProps} formData={formDataWithoutColumn} />);
    expect(screen.getByText('Metric Column')).toBeInTheDocument();

    // Missing aggregate_function
    const formDataWithoutFunction = { ...mockFormData, aggregate_function: undefined };
    rerender(<SimpleNumberConfiguration {...defaultProps} formData={formDataWithoutFunction} />);
    expect(screen.getByText('Aggregate Function')).toBeInTheDocument();

    // Various edge cases for aggregate_column
    const edgeCases = [
      { ...mockFormData, aggregate_column: null },
      { ...mockFormData, aggregate_column: '' },
    ];

    edgeCases.forEach((formData) => {
      rerender(<SimpleNumberConfiguration {...defaultProps} formData={formData} />);
      expect(screen.getByText('Metric Column')).toBeInTheDocument();
    });
  });

  it('should handle various column types and integrate with ChartFiltersConfiguration', () => {
    // Mixed data types (uppercase, lowercase, different numeric types)
    const mixedColumns: TableColumn[] = [
      { column_name: 'col1', data_type: 'INTEGER' },
      { column_name: 'col2', data_type: 'BIGINT' },
      { column_name: 'col3', data_type: 'NUMERIC' },
      { column_name: 'col4', data_type: 'Double Precision' },
      { column_name: 'col5', data_type: 'VARCHAR' },
    ];
    const { rerender } = render(
      <SimpleNumberConfiguration {...defaultProps} columns={mixedColumns} />
    );
    expect(screen.getByText('Metric Column')).toBeInTheDocument();

    // Special characters in column names
    const specialColumns: TableColumn[] = [
      { column_name: 'revenue_$', data_type: 'numeric' },
      { column_name: 'order#', data_type: 'integer' },
      { column_name: 'customer-name', data_type: 'varchar' },
    ];
    rerender(<SimpleNumberConfiguration {...defaultProps} columns={specialColumns} />);
    expect(screen.getByText('Metric Column')).toBeInTheDocument();

    // Few and many columns
    const fewColumns: TableColumn[] = [{ column_name: 'col1', data_type: 'integer' }];
    rerender(<SimpleNumberConfiguration {...defaultProps} columns={fewColumns} />);
    expect(screen.getByText('Metric Column')).toBeInTheDocument();

    const manyColumns: TableColumn[] = Array.from({ length: 50 }, (_, i) => ({
      column_name: `col${i}`,
      data_type: 'integer',
    }));
    rerender(<SimpleNumberConfiguration {...defaultProps} columns={manyColumns} />);
    expect(screen.getByText('Metric Column')).toBeInTheDocument();

    // Component integration - ChartFiltersConfiguration should be rendered
    const filtersConfig = screen.getByTestId('chart-filters-config');
    expect(filtersConfig).toBeInTheDocument();
    expect(filtersConfig).toHaveAttribute('data-disabled', 'false');

    // Accessibility - accessible labels and descriptions
    expect(screen.getByText('Metric Column')).toBeInTheDocument();
    expect(screen.getByText('Aggregate Function')).toBeInTheDocument();
    expect(screen.getByText('Data Filters')).toBeInTheDocument();
    expect(
      screen.getByText('Add conditions to limit which data appears in your chart')
    ).toBeInTheDocument();

    // Correct ARIA roles
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });
});
