/**
 * ChartCustomizations Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChartCustomizations } from '../ChartCustomizations';

describe('ChartCustomizations', () => {
  const mockOnChange = jest.fn();

  const createFormData = (
    chartType: 'bar' | 'line' | 'pie' | 'number' | 'map' | 'table' = 'bar',
    overrides = {}
  ) => ({
    chart_type: chartType,
    schema_name: 'public',
    table_name: 'sales',
    customizations: {},
    ...overrides,
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Edge Cases', () => {
    it('should handle undefined formData and unknown chart type', () => {
      const { rerender, container } = render(
        <ChartCustomizations chartType="bar" formData={undefined as any} onChange={mockOnChange} />
      );
      expect(screen.getByText('Please configure chart data first')).toBeInTheDocument();

      rerender(
        <ChartCustomizations
          chartType="unknown"
          formData={createFormData('bar')}
          onChange={mockOnChange}
        />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Chart Type Routing', () => {
    it('should render correct components for each chart type', () => {
      const { rerender } = render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByText('Display Options')).toBeInTheDocument();
      expect(screen.getByLabelText('Vertical')).toBeInTheDocument();

      rerender(
        <ChartCustomizations
          chartType="line"
          formData={createFormData('line')}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByLabelText('Smooth Curves')).toBeInTheDocument();

      rerender(
        <ChartCustomizations
          chartType="pie"
          formData={createFormData('pie')}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByLabelText('Donut Chart')).toBeInTheDocument();

      rerender(
        <ChartCustomizations
          chartType="number"
          formData={createFormData('number')}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByLabelText('Small')).toBeInTheDocument();

      rerender(
        <ChartCustomizations
          chartType="map"
          formData={createFormData('map')}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByText('Color and Styling')).toBeInTheDocument();

      rerender(
        <ChartCustomizations
          chartType="table"
          formData={createFormData('table', { table_columns: ['budget', 'revenue'] })}
          onChange={mockOnChange}
          columns={[
            { column_name: 'budget', data_type: 'numeric' },
            { column_name: 'revenue', data_type: 'integer' },
          ]}
        />
      );
      expect(screen.getByText('Number Formatting')).toBeInTheDocument();
      expect(screen.getByText('budget')).toBeInTheDocument();
      expect(screen.getByText('revenue')).toBeInTheDocument();
    });
  });

  describe('onChange and State', () => {
    it('should call onChange with updated customizations and preserve existing ones', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar', {
            customizations: { showTooltip: true, xAxisTitle: 'Time' },
          })}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByLabelText('Horizontal'));
      expect(mockOnChange).toHaveBeenCalledWith({
        customizations: expect.objectContaining({
          showTooltip: true,
          xAxisTitle: 'Time',
          orientation: 'horizontal',
        }),
      });
    });

    it('should disable all controls when disabled prop is true', () => {
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
          disabled
        />
      );

      screen.getAllByRole('switch').forEach((s) => expect(s).toBeDisabled());
      screen.getAllByRole('radio').forEach((r) => expect(r).toBeDisabled());
    });
  });

  describe('Table Chart Column Filtering', () => {
    it('should only show numeric columns for number formatting in raw mode', () => {
      render(
        <ChartCustomizations
          chartType="table"
          formData={createFormData('table', { table_columns: ['name', 'budget', 'category'] })}
          onChange={mockOnChange}
          columns={[
            { column_name: 'name', data_type: 'text' },
            { column_name: 'budget', data_type: 'numeric' },
            { column_name: 'category', data_type: 'varchar' },
          ]}
        />
      );
      expect(screen.getByText('Number Formatting')).toBeInTheDocument();
      // Only budget should be shown (numeric type)
      expect(screen.getByText('budget')).toBeInTheDocument();
      // Non-numeric columns should not be shown
      expect(screen.queryByText('name')).not.toBeInTheDocument();
      expect(screen.queryByText('category')).not.toBeInTheDocument();
    });

    it('should show metric columns and numeric dimension columns in aggregated mode', () => {
      render(
        <ChartCustomizations
          chartType="table"
          formData={createFormData('table', {
            dimensions: [{ column: 'category' }, { column: 'budget' }],
            metrics: [
              { column: 'revenue', aggregation: 'sum', alias: 'total_revenue' },
              { column: 'quantity', aggregation: 'count' },
            ],
          })}
          onChange={mockOnChange}
          columns={[
            { column_name: 'category', data_type: 'text' },
            { column_name: 'budget', data_type: 'integer' },
            { column_name: 'revenue', data_type: 'numeric' },
            { column_name: 'quantity', data_type: 'integer' },
          ]}
        />
      );
      expect(screen.getByText('Number Formatting')).toBeInTheDocument();
      // Metric columns should be shown (aggregation results are always numeric)
      expect(screen.getByText('total_revenue')).toBeInTheDocument();
      expect(screen.getByText('count_quantity')).toBeInTheDocument();
      // Numeric dimension column should be shown
      expect(screen.getByText('budget')).toBeInTheDocument();
      // Non-numeric dimension columns should not be shown
      expect(screen.queryByText('category')).not.toBeInTheDocument();
    });

    it('should show no columns when all columns are non-numeric in raw mode', () => {
      render(
        <ChartCustomizations
          chartType="table"
          formData={createFormData('table', { table_columns: ['name', 'category'] })}
          onChange={mockOnChange}
          columns={[
            { column_name: 'name', data_type: 'text' },
            { column_name: 'category', data_type: 'varchar' },
          ]}
        />
      );
      // No numeric columns available, so the component shows empty state
      expect(screen.getByText('No numeric columns to format.')).toBeInTheDocument();
      // No numeric columns, so none should be shown for formatting
      expect(screen.queryByText('name')).not.toBeInTheDocument();
      expect(screen.queryByText('category')).not.toBeInTheDocument();
    });
  });

  describe('Conditional Rendering', () => {
    it('should show stacked option only with extra dimension and legend options when enabled', () => {
      const { rerender } = render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
        />
      );
      expect(screen.queryByLabelText('Stacked Bars')).not.toBeInTheDocument();

      rerender(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar', {
            extra_dimension_column: 'category',
            customizations: { showLegend: true },
          })}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByLabelText('Stacked Bars')).toBeInTheDocument();
      expect(screen.getByText('Legend Display')).toBeInTheDocument();
      expect(screen.getByText('Legend Position')).toBeInTheDocument();
    });
  });
});
