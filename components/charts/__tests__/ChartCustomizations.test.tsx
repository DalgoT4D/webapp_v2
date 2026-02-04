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
          formData={createFormData('table')}
          onChange={mockOnChange}
        />
      );
      expect(
        screen.getByText('Table charts are configured through the data configuration panel.')
      ).toBeInTheDocument();
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
