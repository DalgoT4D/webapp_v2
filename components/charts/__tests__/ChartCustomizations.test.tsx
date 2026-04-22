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

    it('should keep a selected bar default swatch highlighted after the customization state updates', async () => {
      const user = userEvent.setup();

      function Wrapper() {
        const [formData, setFormData] = React.useState(
          createFormData('bar', {
            extra_dimension_column: 'state',
            dimension_column: 'region',
            customizations: {
              bar_color_target: 'primary',
              color_palette_colors: ['#ff0000', '#ffaa00', '#00aa00'],
              dimension_colors: {
                North: '#dc2626',
              },
            },
          })
        );

        return (
          <ChartCustomizations
            chartType="bar"
            formData={formData}
            onChange={(updates) => setFormData((prev) => ({ ...prev, ...updates }))}
            chartConfig={{
              xAxis: { type: 'category', data: ['North', 'South'] },
              yAxis: { type: 'value' },
              series: [
                { type: 'bar', name: 'R', data: [12, 8] },
                { type: 'bar', name: 'G', data: [5, 10] },
              ],
            }}
          />
        );
      }

      render(<Wrapper />);

      await user.click(screen.getByTestId('dimension-color-row-0'));
      expect(screen.getByText('Reset to default color')).toBeInTheDocument();

      const selectedSwatch = screen.getAllByTestId('color-swatch-00897B')[0];
      await user.click(selectedSwatch);

      expect(screen.getAllByTestId('color-swatch-00897B')[0].className).toContain(
        'border-blue-500'
      );
      expect(screen.queryByText('Reset to default color')).not.toBeInTheDocument();
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

    it('shows per-metric color rows for multi-metric bar (no extra dimension)', () => {
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar', {
            metrics: [
              { column: 'revenue', aggregation: 'SUM' },
              { column: 'cost', aggregation: 'SUM' },
            ],
          })}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByTestId('metric-color-row-0')).toBeInTheDocument();
      expect(screen.getByTestId('metric-color-row-1')).toBeInTheDocument();
    });

    it('shows an extra-dimension color selector when extra dimension is set', () => {
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar', {
            extra_dimension_column: 'region',
            metrics: [
              { column: 'revenue', aggregation: 'SUM' },
              { column: 'cost', aggregation: 'SUM' },
            ],
          })}
          onChange={mockOnChange}
          chartConfig={{
            xAxis: { type: 'category', data: ['North', 'South'] },
            yAxis: { type: 'value' },
            series: [
              { type: 'bar', name: 'R', data: [12, 8] },
              { type: 'bar', name: 'G', data: [5, 10] },
            ],
          }}
        />
      );
      expect(screen.queryByTestId('metric-color-row-0')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Color Dimension')).toBeInTheDocument();
      expect(screen.queryByText('Default Color')).not.toBeInTheDocument();
      expect(screen.getByText('Color Palette')).toBeInTheDocument();
      expect(screen.getByText('region Colors')).toBeInTheDocument();
      expect(screen.getByText('R')).toBeInTheDocument();
      expect(screen.getByText('G')).toBeInTheDocument();
    });

    it('shows category color overrides and a single default color for a simple single-series bar chart', () => {
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
          chartConfig={{
            xAxis: { type: 'category', data: ['R', 'A', 'G'] },
            yAxis: { type: 'value' },
            series: [{ type: 'bar', data: [10, 5, 20] }],
          }}
        />
      );

      expect(screen.getByText('Default Color')).toBeInTheDocument();
      expect(screen.queryByText('Color Palette')).not.toBeInTheDocument();
      expect(screen.getByText('Category Colors')).toBeInTheDocument();
      expect(screen.getByText('R')).toBeInTheDocument();
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('G')).toBeInTheDocument();
    });
  });
});
