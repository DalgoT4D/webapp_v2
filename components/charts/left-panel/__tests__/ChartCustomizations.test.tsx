/**
 * ChartCustomizations Component Tests
 * Ultra-consolidated with minimal parameterization
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChartCustomizations } from '../ChartCustomizations';

describe('ChartCustomizations', () => {
  const mockOnChange = jest.fn();

  const createFormData = (
    chartType: 'bar' | 'line' | 'pie' | 'number' | 'map' = 'bar',
    overrides = {}
  ) => ({
    chart_type: chartType,
    schema_name: 'public',
    table_name: 'sales',
    customizations: {},
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Safety and Visibility', () => {
    it('should handle edge cases and render appropriate sections', () => {
      const { container, rerender } = render(
        <ChartCustomizations
          chartType="unknown"
          formData={undefined as any}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByText('Please configure chart data first')).toBeInTheDocument();

      rerender(
        <ChartCustomizations
          chartType="map"
          formData={{ chart_type: 'map' } as any}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByText('Configuration for map charts coming soon')).toBeInTheDocument();

      rerender(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByText('Display Options')).toBeInTheDocument();
      expect(screen.getByText('Axis Configuration')).toBeInTheDocument();
    });
  });

  describe('Customization Options', () => {
    it('should render and interact with bar chart options', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar', { extra_dimension_column: 'cat' })}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByLabelText('Show Legend'));
      expect(mockOnChange).toHaveBeenCalled();

      expect(screen.getByLabelText('Horizontal')).toBeInTheDocument();
      expect(screen.getByLabelText('Stacked Bars')).toBeInTheDocument();
    });

    it('should render line chart options', () => {
      render(
        <ChartCustomizations
          chartType="line"
          formData={createFormData('line')}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('Smooth Curves')).toBeInTheDocument();
      expect(screen.getByLabelText('Straight Lines')).toBeInTheDocument();
      expect(screen.getByLabelText('Show Data Points')).toBeInTheDocument();
    });

    it('should render pie chart options', () => {
      render(
        <ChartCustomizations
          chartType="pie"
          formData={createFormData('pie')}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('Donut Chart')).toBeInTheDocument();
      expect(screen.getByLabelText('Full Pie')).toBeInTheDocument();
      expect(screen.getByLabelText('Label Format')).toBeInTheDocument();
    });

    it('should render and interact with number chart options', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="number"
          formData={createFormData('number')}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('Large')).toBeInTheDocument();
      expect(screen.getByLabelText('Small')).toBeInTheDocument();

      await user.type(screen.getByLabelText('Subtitle'), 'Total');
      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  describe('States', () => {
    it('should disable controls when disabled', () => {
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
          disabled
        />
      );

      const switches = screen.getAllByRole('switch');
      switches.forEach((s) => expect(s).toBeDisabled());
    });

    it('should not show stacked without extra dimension', () => {
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
        />
      );
      expect(screen.queryByLabelText('Stacked Bars')).not.toBeInTheDocument();
    });
  });

  describe('Bar Chart Customizations', () => {
    it('should render orientation options and handle clicks', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('Vertical')).toBeInTheDocument();
      expect(screen.getByLabelText('Horizontal')).toBeInTheDocument();

      await user.click(screen.getByLabelText('Horizontal'));
      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should render tooltip and legend controls', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('Show Tooltip on Hover')).toBeInTheDocument();
      expect(screen.getByLabelText('Show Legend')).toBeInTheDocument();

      await user.click(screen.getByLabelText('Show Tooltip on Hover'));
      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should show legend customization when legend is visible', () => {
      const formData = createFormData('bar', { customizations: { showLegend: true } });
      render(<ChartCustomizations chartType="bar" formData={formData} onChange={mockOnChange} />);

      expect(screen.getByText('Legend Display')).toBeInTheDocument();
    });

    it('should render axis configuration section', () => {
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByText('Axis Configuration')).toBeInTheDocument();
    });
  });

  describe('Line Chart Customizations', () => {
    it('should render curve type options', () => {
      render(
        <ChartCustomizations
          chartType="line"
          formData={createFormData('line')}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('Smooth Curves')).toBeInTheDocument();
      expect(screen.getByLabelText('Straight Lines')).toBeInTheDocument();
    });

    it('should render data points option and handle toggle', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="line"
          formData={createFormData('line')}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('Show Data Points')).toBeInTheDocument();

      await user.click(screen.getByLabelText('Show Data Points'));
      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  describe('Pie Chart Customizations', () => {
    it('should render pie type options', () => {
      render(
        <ChartCustomizations
          chartType="pie"
          formData={createFormData('pie')}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('Full Pie')).toBeInTheDocument();
      expect(screen.getByLabelText('Donut Chart')).toBeInTheDocument();
    });

    it('should render label format option', () => {
      render(
        <ChartCustomizations
          chartType="pie"
          formData={createFormData('pie')}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByLabelText('Label Format')).toBeInTheDocument();
    });
  });

  describe('Number Chart Customizations', () => {
    it('should handle size changes', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="number"
          formData={createFormData('number')}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByLabelText('Small'));
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          customizations: expect.objectContaining({ numberSize: 'small' }),
        })
      );
    });

    it('should handle prefix and suffix inputs', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="number"
          formData={createFormData('number')}
          onChange={mockOnChange}
        />
      );

      const prefix = screen.getByLabelText('Prefix');
      await user.type(prefix, '$');
      expect(mockOnChange).toHaveBeenCalled();

      mockOnChange.mockClear();
      const suffix = screen.getByLabelText('Suffix');
      await user.type(suffix, 'K');
      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should handle number format dropdown', () => {
      render(
        <ChartCustomizations
          chartType="number"
          formData={createFormData('number')}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByLabelText('Number Format')).toBeInTheDocument();
    });
  });
});
