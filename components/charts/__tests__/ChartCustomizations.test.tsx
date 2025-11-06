/**
 * ChartCustomizations Component Tests
 *
 * Comprehensive tests for chart customization options across all chart types
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
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

  describe('Component Safety', () => {
    it('should show error when formData is undefined', () => {
      render(
        <ChartCustomizations chartType="bar" formData={undefined as any} onChange={mockOnChange} />
      );

      expect(screen.getByText('Please configure chart data first')).toBeInTheDocument();
    });

    it('should return null for unsupported chart types', () => {
      const { container } = render(
        <ChartCustomizations
          chartType={'unknown' as any}
          formData={createFormData('bar')}
          onChange={mockOnChange}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should show coming soon for map charts', () => {
      render(
        <ChartCustomizations
          chartType="map"
          formData={createFormData('map')}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Configuration for map charts coming soon')).toBeInTheDocument();
    });
  });

  describe('Bar Chart Customizations', () => {
    it('should render all bar chart sections', () => {
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Display Options')).toBeInTheDocument();
      expect(screen.getByText('Data Labels')).toBeInTheDocument();
      expect(screen.getByText('Axis Configuration')).toBeInTheDocument();
    });

    it('should change orientation to horizontal', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByLabelText('Horizontal'));

      expect(mockOnChange).toHaveBeenCalledWith({
        customizations: expect.objectContaining({ orientation: 'horizontal' }),
      });
    });

    it('should toggle stacked bars when extra dimension exists', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar', { extra_dimension_column: 'category' })}
          onChange={mockOnChange}
        />
      );

      const stackedSwitch = screen.getByLabelText('Stacked Bars');
      await user.click(stackedSwitch);

      expect(mockOnChange).toHaveBeenCalledWith({
        customizations: expect.objectContaining({ stacked: true }),
      });
    });

    it('should toggle show tooltip', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar', { customizations: { showTooltip: true } })}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByLabelText('Show Tooltip on Hover'));

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should toggle show legend', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByLabelText('Show Legend'));

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should switch legend display to all', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByLabelText('Show All Legends in Chart Area'));

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should show legend position select when display is all', () => {
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar', { customizations: { legendDisplay: 'all' } })}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('Legend Position')).toBeInTheDocument();
    });

    it('should toggle show data labels', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByLabelText('Show Data Labels'));

      expect(mockOnChange).toHaveBeenCalledWith({
        customizations: expect.objectContaining({ showDataLabels: true }),
      });
    });

    it('should show data label position when labels enabled', () => {
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar', { customizations: { showDataLabels: true } })}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('Data Label Position')).toBeInTheDocument();
    });

    it('should update X-axis title', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
        />
      );

      const xAxisTitleInput = screen.getByLabelText('X-Axis Title');
      await user.type(xAxisTitleInput, 'Month');

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should render X-axis rotation select', () => {
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('X-Axis Label Rotation')).toBeInTheDocument();
    });

    it('should update Y-axis title', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
        />
      );

      const yAxisTitleInput = screen.getByLabelText('Y-Axis Title');
      await user.type(yAxisTitleInput, 'Sales');

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should render Y-axis rotation select', () => {
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('Y-Axis Label Rotation')).toBeInTheDocument();
    });
  });

  describe('Line Chart Customizations', () => {
    it('should render all line chart sections', () => {
      render(
        <ChartCustomizations
          chartType="line"
          formData={createFormData('line')}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Display Options')).toBeInTheDocument();
      expect(screen.getByText('Data Labels')).toBeInTheDocument();
      expect(screen.getByText('Axis Configuration')).toBeInTheDocument();
    });

    it('should change line style to smooth', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="line"
          formData={createFormData('line', { customizations: { lineStyle: 'straight' } })}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByLabelText('Smooth Curves'));

      expect(mockOnChange).toHaveBeenCalledWith({
        customizations: expect.objectContaining({ lineStyle: 'smooth' }),
      });
    });

    it('should change line style to straight', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="line"
          formData={createFormData('line')}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByLabelText('Straight Lines'));

      expect(mockOnChange).toHaveBeenCalledWith({
        customizations: expect.objectContaining({ lineStyle: 'straight' }),
      });
    });

    it('should toggle show data points', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="line"
          formData={createFormData('line')}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByLabelText('Show Data Points'));

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should toggle legend in line chart', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="line"
          formData={createFormData('line')}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByLabelText('Show Legend'));

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should show legend position select when display is all in line chart', () => {
      render(
        <ChartCustomizations
          chartType="line"
          formData={createFormData('line', { customizations: { legendDisplay: 'all' } })}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('Legend Position')).toBeInTheDocument();
    });

    it('should toggle data labels in line chart', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="line"
          formData={createFormData('line')}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByLabelText('Show Data Labels'));

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should show data label position when enabled in line chart', () => {
      render(
        <ChartCustomizations
          chartType="line"
          formData={createFormData('line', { customizations: { showDataLabels: true } })}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('Data Label Position')).toBeInTheDocument();
    });
  });

  describe('Pie Chart Customizations', () => {
    it('should render all pie chart sections', () => {
      render(
        <ChartCustomizations
          chartType="pie"
          formData={createFormData('pie')}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Legend')).toBeInTheDocument();
      expect(screen.getByText('Display Options')).toBeInTheDocument();
      expect(screen.getByText('Data Labels')).toBeInTheDocument();
      expect(screen.getByText('Slice Configuration')).toBeInTheDocument();
    });

    it('should change pie style to donut', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="pie"
          formData={createFormData('pie', { customizations: { chartStyle: 'pie' } })}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByLabelText('Donut Chart'));

      expect(mockOnChange).toHaveBeenCalledWith({
        customizations: expect.objectContaining({ chartStyle: 'donut' }),
      });
    });

    it('should change pie style to full pie', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="pie"
          formData={createFormData('pie')}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByLabelText('Full Pie'));

      expect(mockOnChange).toHaveBeenCalledWith({
        customizations: expect.objectContaining({ chartStyle: 'pie' }),
      });
    });

    it('should toggle legend in pie chart', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="pie"
          formData={createFormData('pie')}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByLabelText('Show Legend'));

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should switch legend display to all in pie chart', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="pie"
          formData={createFormData('pie')}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByLabelText('Show All Legends in Chart Area'));

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should show legend position select when display is all in pie chart', () => {
      render(
        <ChartCustomizations
          chartType="pie"
          formData={createFormData('pie', { customizations: { legendDisplay: 'all' } })}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('Legend Position')).toBeInTheDocument();
    });

    it('should render label format select', () => {
      render(
        <ChartCustomizations
          chartType="pie"
          formData={createFormData('pie')}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('Label Format')).toBeInTheDocument();
    });

    it('should toggle data labels in pie chart', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="pie"
          formData={createFormData('pie')}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByLabelText('Show Data Labels'));

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should show label position when labels enabled in pie chart', () => {
      render(
        <ChartCustomizations
          chartType="pie"
          formData={createFormData('pie', { customizations: { showDataLabels: true } })}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('Label Position')).toBeInTheDocument();
    });

    it('should render slice limit select', () => {
      render(
        <ChartCustomizations
          chartType="pie"
          formData={createFormData('pie')}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('Slice Limit')).toBeInTheDocument();
    });

    it('should toggle tooltip in pie chart', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="pie"
          formData={createFormData('pie')}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByLabelText('Show Tooltip on Hover'));

      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  describe('Number Chart Customizations', () => {
    it('should render all number chart sections', () => {
      render(
        <ChartCustomizations
          chartType="number"
          formData={createFormData('number')}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Display Options')).toBeInTheDocument();
      expect(screen.getByText('Number Formatting')).toBeInTheDocument();
      expect(screen.getByText('Prefix & Suffix')).toBeInTheDocument();
    });

    it('should change number size to large', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="number"
          formData={createFormData('number')}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByLabelText('Large'));

      expect(mockOnChange).toHaveBeenCalledWith({
        customizations: expect.objectContaining({ numberSize: 'large' }),
      });
    });

    it('should change number size to small', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="number"
          formData={createFormData('number')}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByLabelText('Small'));

      expect(mockOnChange).toHaveBeenCalledWith({
        customizations: expect.objectContaining({ numberSize: 'small' }),
      });
    });

    it('should render number format select', () => {
      render(
        <ChartCustomizations
          chartType="number"
          formData={createFormData('number')}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('Number Format')).toBeInTheDocument();
    });

    it('should update decimal places', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="number"
          formData={createFormData('number')}
          onChange={mockOnChange}
        />
      );

      const decimalInput = screen.getByLabelText('Decimal Places');
      await user.clear(decimalInput);
      await user.type(decimalInput, '3');

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should update subtitle', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="number"
          formData={createFormData('number')}
          onChange={mockOnChange}
        />
      );

      const subtitleInput = screen.getByLabelText('Subtitle');
      await user.type(subtitleInput, 'Total');

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should update prefix', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="number"
          formData={createFormData('number')}
          onChange={mockOnChange}
        />
      );

      const prefixInput = screen.getByLabelText('Prefix');
      await user.type(prefixInput, '$');

      expect(mockOnChange).toHaveBeenCalledWith({
        customizations: expect.objectContaining({ numberPrefix: '$' }),
      });
    });

    it('should update suffix', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="number"
          formData={createFormData('number')}
          onChange={mockOnChange}
        />
      );

      const suffixInput = screen.getByLabelText('Suffix');
      await user.type(suffixInput, '%');

      expect(mockOnChange).toHaveBeenCalledWith({
        customizations: expect.objectContaining({ numberSuffix: '%' }),
      });
    });
  });

  describe('Additional Coverage - Line Chart Inputs', () => {
    it('should update X-axis title in line chart', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="line"
          formData={createFormData('line')}
          onChange={mockOnChange}
        />
      );

      const xAxisInput = screen.getByLabelText('X-Axis Title');
      await user.type(xAxisInput, 'Date');

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should update Y-axis title in line chart', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="line"
          formData={createFormData('line')}
          onChange={mockOnChange}
        />
      );

      const yAxisInput = screen.getByLabelText('Y-Axis Title');
      await user.type(yAxisInput, 'Revenue');

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should render line chart axis rotation selects', () => {
      render(
        <ChartCustomizations
          chartType="line"
          formData={createFormData('line')}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('X-Axis Label Rotation')).toBeInTheDocument();
      expect(screen.getByLabelText('Y-Axis Label Rotation')).toBeInTheDocument();
    });
  });

  describe('Comprehensive Coverage Tests', () => {
    it('should render bar chart with all possible customizations', () => {
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar', {
            customizations: { showDataLabels: true, dataLabelPosition: 'outside' },
          })}
          onChange={mockOnChange}
        />
      );

      const labelPosSelect = screen.getByLabelText('Data Label Position');
      expect(labelPosSelect).toBeInTheDocument();
    });

    it('should render bar chart with X-axis rotation customization', () => {
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar', { customizations: { xAxisRotation: 45 } })}
          onChange={mockOnChange}
        />
      );

      const xAxisRotSelect = screen.getByLabelText('X-Axis Label Rotation');
      expect(xAxisRotSelect).toBeInTheDocument();
    });

    it('should render bar chart with Y-axis rotation customization', () => {
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar', { customizations: { yAxisRotation: 90 } })}
          onChange={mockOnChange}
        />
      );

      const yAxisRotSelect = screen.getByLabelText('Y-Axis Label Rotation');
      expect(yAxisRotSelect).toBeInTheDocument();
    });

    it('should render line chart with legend position customization', () => {
      render(
        <ChartCustomizations
          chartType="line"
          formData={createFormData('line', {
            customizations: { legendDisplay: 'all', legendPosition: 'bottom' },
          })}
          onChange={mockOnChange}
        />
      );

      const legendPosSelect = screen.getByLabelText('Legend Position');
      expect(legendPosSelect).toBeInTheDocument();
    });

    it('should render line chart with data label position customization', () => {
      render(
        <ChartCustomizations
          chartType="line"
          formData={createFormData('line', {
            customizations: { showDataLabels: true, dataLabelPosition: 'top' },
          })}
          onChange={mockOnChange}
        />
      );

      const labelPosSelect = screen.getByLabelText('Data Label Position');
      expect(labelPosSelect).toBeInTheDocument();
    });

    it('should render line chart with axis rotation customizations', () => {
      render(
        <ChartCustomizations
          chartType="line"
          formData={createFormData('line', {
            customizations: { xAxisRotation: 45, yAxisRotation: 90 },
          })}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('X-Axis Label Rotation')).toBeInTheDocument();
      expect(screen.getByLabelText('Y-Axis Label Rotation')).toBeInTheDocument();
    });

    it('should render pie chart with legend position customization', () => {
      render(
        <ChartCustomizations
          chartType="pie"
          formData={createFormData('pie', {
            customizations: { legendDisplay: 'all', legendPosition: 'left' },
          })}
          onChange={mockOnChange}
        />
      );

      const legendPosSelect = screen.getByLabelText('Legend Position');
      expect(legendPosSelect).toBeInTheDocument();
    });

    it('should render pie chart with label format customization', () => {
      render(
        <ChartCustomizations
          chartType="pie"
          formData={createFormData('pie', { customizations: { labelFormat: 'value' } })}
          onChange={mockOnChange}
        />
      );

      const labelFormatSelect = screen.getByLabelText('Label Format');
      expect(labelFormatSelect).toBeInTheDocument();
    });

    it('should render pie chart with label position customization', () => {
      render(
        <ChartCustomizations
          chartType="pie"
          formData={createFormData('pie', {
            customizations: { showDataLabels: true, dataLabelPosition: 'inside' },
          })}
          onChange={mockOnChange}
        />
      );

      const labelPosSelect = screen.getByLabelText('Label Position');
      expect(labelPosSelect).toBeInTheDocument();
    });

    it('should render pie chart with slice limit customization', () => {
      render(
        <ChartCustomizations
          chartType="pie"
          formData={createFormData('pie', { customizations: { maxSlices: 5 } })}
          onChange={mockOnChange}
        />
      );

      const sliceLimitSelect = screen.getByLabelText('Slice Limit');
      expect(sliceLimitSelect).toBeInTheDocument();
    });

    it('should render number chart with currency format', () => {
      render(
        <ChartCustomizations
          chartType="number"
          formData={createFormData('number', { customizations: { numberFormat: 'currency' } })}
          onChange={mockOnChange}
        />
      );

      const formatSelect = screen.getByLabelText('Number Format');
      expect(formatSelect).toBeInTheDocument();
    });

    it('should render number chart with percentage format', () => {
      render(
        <ChartCustomizations
          chartType="number"
          formData={createFormData('number', { customizations: { numberFormat: 'percentage' } })}
          onChange={mockOnChange}
        />
      );

      const formatSelect = screen.getByLabelText('Number Format');
      expect(formatSelect).toBeInTheDocument();
    });

    it('should render number chart with comma separated format', () => {
      render(
        <ChartCustomizations
          chartType="number"
          formData={createFormData('number', { customizations: { numberFormat: 'comma' } })}
          onChange={mockOnChange}
        />
      );

      const formatSelect = screen.getByLabelText('Number Format');
      expect(formatSelect).toBeInTheDocument();
    });
  });

  describe('Additional Coverage - Edge Cases', () => {
    it('should handle bar chart with no extra dimension (stacked option hidden)', () => {
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
        />
      );

      expect(screen.queryByLabelText('Stacked Bars')).not.toBeInTheDocument();
    });

    it('should handle line chart with extra dimension for legend', () => {
      render(
        <ChartCustomizations
          chartType="line"
          formData={createFormData('line', { extra_dimension_column: 'category' })}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('Show Legend')).toBeInTheDocument();
    });

    it('should handle pie chart with legend not enabled', () => {
      render(
        <ChartCustomizations
          chartType="pie"
          formData={createFormData('pie', { customizations: { showLegend: false } })}
          onChange={mockOnChange}
        />
      );

      expect(screen.queryByLabelText('Show All Legends in Chart Area')).not.toBeInTheDocument();
    });

    it('should handle number chart with subtitle', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="number"
          formData={createFormData('number', { customizations: { subtitle: 'Old' } })}
          onChange={mockOnChange}
        />
      );

      const subtitleInput = screen.getByLabelText('Subtitle');
      await user.clear(subtitleInput);
      await user.type(subtitleInput, 'New Subtitle');

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should handle zero decimal places', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="number"
          formData={createFormData('number', { customizations: { decimalPlaces: 2 } })}
          onChange={mockOnChange}
        />
      );

      const decimalInput = screen.getByLabelText('Decimal Places');
      await user.clear(decimalInput);
      await user.type(decimalInput, '0');

      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('should disable all bar chart controls when disabled', () => {
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
          disabled
        />
      );

      const switches = screen.getAllByRole('switch');
      switches.forEach((sw) => expect(sw).toBeDisabled());

      const textboxes = screen.getAllByRole('textbox');
      textboxes.forEach((tb) => expect(tb).toBeDisabled());
    });

    it('should disable all line chart controls when disabled', () => {
      render(
        <ChartCustomizations
          chartType="line"
          formData={createFormData('line')}
          onChange={mockOnChange}
          disabled
        />
      );

      const switches = screen.getAllByRole('switch');
      switches.forEach((sw) => expect(sw).toBeDisabled());
    });

    it('should disable all pie chart controls when disabled', () => {
      render(
        <ChartCustomizations
          chartType="pie"
          formData={createFormData('pie')}
          onChange={mockOnChange}
          disabled
        />
      );

      const switches = screen.getAllByRole('switch');
      switches.forEach((sw) => expect(sw).toBeDisabled());
    });

    it('should disable all number chart controls when disabled', () => {
      render(
        <ChartCustomizations
          chartType="number"
          formData={createFormData('number')}
          onChange={mockOnChange}
          disabled
        />
      );

      const radioButtons = screen.getAllByRole('radio');
      radioButtons.forEach((rb) => expect(rb).toBeDisabled());

      const textboxes = screen.getAllByRole('textbox');
      textboxes.forEach((tb) => expect(tb).toBeDisabled());
    });
  });
});
