/**
 * ChartCustomizations Component Tests
 *
 * Tests customization options for different chart types:
 * - Bar: orientation, stacking, labels, axes
 * - Line: style, data points, smooth curves
 * - Pie: donut style, legends, slices
 * - Number: size, formatting, prefix/suffix
 *
 * Architecture: Focused, behavior-driven tests with proper default handling
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

  /**
   * Safety and Initialization
   */
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
          chartType="unknown"
          as
          any
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

  /**
   * Chart Type Specific Rendering
   */
  describe('Chart Type Specific Sections', () => {
    it.each([
      ['bar', ['Display Options', 'Data Labels', 'Axis Configuration']],
      ['line', ['Display Options', 'Data Labels', 'Axis Configuration']],
      ['pie', ['Display Options', 'Legend', 'Data Labels', 'Slice Configuration']],
      ['number', ['Display Options', 'Number Formatting', 'Prefix & Suffix']],
    ])('should render %s chart sections', (chartType, expectedSections) => {
      render(
        <ChartCustomizations
          chartType={chartType as any}
          formData={createFormData(chartType as any)}
          onChange={mockOnChange}
        />
      );

      expectedSections.forEach((section) => {
        expect(screen.getByText(section)).toBeInTheDocument();
      });
    });
  });

  /**
   * Orientation Selection (Bar Charts)
   */
  describe('Orientation Selection', () => {
    it('should change bar orientation to horizontal', async () => {
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

    it('should change bar orientation to vertical', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar', { customizations: { orientation: 'horizontal' } })}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByLabelText('Vertical'));

      expect(mockOnChange).toHaveBeenCalledWith({
        customizations: expect.objectContaining({ orientation: 'vertical' }),
      });
    });
  });

  /**
   * Chart Style Selection (Pie Charts)
   */
  describe('Chart Style Selection', () => {
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
  });

  /**
   * Line Style Selection
   */
  describe('Line Style Selection', () => {
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
  });

  /**
   * Number Size Selection
   */
  describe('Number Size Selection', () => {
    it.each([
      ['Small', 'small', {}],
      ['Large', 'large', {}],
      ['Medium', 'medium', { customizations: { numberSize: 'small' } }], // Change from small to medium
    ])('should change number size to %s', async (label, value, initialState) => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="number"
          formData={createFormData('number', initialState)}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByLabelText(label));

      expect(mockOnChange).toHaveBeenCalledWith({
        customizations: expect.objectContaining({ numberSize: value }),
      });
    });
  });

  /**
   * Switch Toggles - Testing both ON and OFF states
   */
  describe('Switch Interactions', () => {
    it('should toggle stacked bars when extra dimension present', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar', { extra_dimension_column: 'region' })}
          onChange={mockOnChange}
        />
      );

      const toggle = screen.getByLabelText('Stacked Bars');
      await user.click(toggle);

      expect(mockOnChange).toHaveBeenCalledWith({
        customizations: expect.objectContaining({ stacked: true }),
      });
    });

    // Test switches that default to TRUE (turning OFF)
    it.each([
      ['bar', 'Show Tooltip on Hover', 'showTooltip'],
      ['bar', 'Show Legend', 'showLegend'],
      ['pie', 'Show Tooltip on Hover', 'showTooltip'],
      ['pie', 'Show Legend', 'showLegend'],
      ['line', 'Show Tooltip on Hover', 'showTooltip'],
      ['line', 'Show Data Points', 'showDataPoints'],
      ['line', 'Show Legend', 'showLegend'],
    ])('should toggle %s off in %s chart', async (chartType, switchLabel, key) => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType={chartType as any}
          formData={createFormData(chartType as any)}
          onChange={mockOnChange}
        />
      );

      const toggle = screen.getByLabelText(switchLabel);
      await user.click(toggle);

      // These switches default to true, so clicking turns them OFF (false)
      expect(mockOnChange).toHaveBeenCalledWith({
        customizations: expect.objectContaining({ [key]: false }),
      });
    });

    // Test switches that default to FALSE (turning ON) - only bar and line
    it.each([
      ['bar', 'Show Data Labels', 'showDataLabels'],
      ['line', 'Show Data Labels', 'showDataLabels'],
    ])('should toggle %s on in %s chart', async (chartType, switchLabel, key) => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType={chartType as any}
          formData={createFormData(chartType as any)}
          onChange={mockOnChange}
        />
      );

      const toggle = screen.getByLabelText(switchLabel);
      await user.click(toggle);

      // These switches default to false, so clicking turns them ON (true)
      expect(mockOnChange).toHaveBeenCalledWith({
        customizations: expect.objectContaining({ [key]: true }),
      });
    });
  });

  /**
   * Text Input Fields
   */
  describe('Text Input Fields', () => {
    it('should update text inputs', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
        />
      );

      const xAxisInput = screen.getByLabelText('X-Axis Title');
      await user.type(xAxisInput, 'Test');

      // Text inputs fire onChange on each keystroke
      expect(mockOnChange).toHaveBeenCalled();
      expect(mockOnChange.mock.calls.length).toBeGreaterThan(0);
    });
  });

  /**
   * Number Input Fields
   */
  describe('Number Input Fields', () => {
    it('should update decimal places', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="number"
          formData={createFormData('number')}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByLabelText('Decimal Places');
      await user.clear(input);
      await user.type(input, '2');

      expect(mockOnChange).toHaveBeenCalled();
      // Check that decimalPlaces was set
      const calls = mockOnChange.mock.calls;
      expect(calls[calls.length - 1][0].customizations).toHaveProperty('decimalPlaces');
    });

    it('should handle decimal places with 0', async () => {
      const user = userEvent.setup();
      render(
        <ChartCustomizations
          chartType="number"
          formData={createFormData('number')}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByLabelText('Decimal Places');
      await user.clear(input);
      await user.type(input, '0');

      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1];
      expect(lastCall[0]).toEqual({
        customizations: expect.objectContaining({ decimalPlaces: 0 }),
      });
    });
  });

  /**
   * Conditional Rendering
   */
  describe('Conditional Features', () => {
    it('should show stacked bars option only when extra dimension exists', () => {
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
          formData={createFormData('bar', { extra_dimension_column: 'region' })}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('Stacked Bars')).toBeInTheDocument();
    });

    it('should show data label position when labels are enabled in bar chart', () => {
      const { rerender } = render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
        />
      );

      expect(screen.queryByLabelText('Data Label Position')).not.toBeInTheDocument();

      rerender(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar', { customizations: { showDataLabels: true } })}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('Data Label Position')).toBeInTheDocument();
    });

    it('should show label format in pie chart by default (showDataLabels defaults to true)', () => {
      render(
        <ChartCustomizations
          chartType="pie"
          formData={createFormData('pie')}
          onChange={mockOnChange}
        />
      );

      // Pie chart showDataLabels defaults to true (!== false), so Label Format should be visible
      expect(screen.getByLabelText('Label Format')).toBeInTheDocument();
    });
  });

  /**
   * Legend Configuration
   */
  describe('Legend Configuration', () => {
    it.each([['bar'], ['line'], ['pie']])(
      'should show legend position when display is "all" in %s chart',
      (chartType) => {
        const { rerender } = render(
          <ChartCustomizations
            chartType={chartType as any}
            formData={createFormData(chartType as any, {
              customizations: { legendDisplay: 'paginated' },
            })}
            onChange={mockOnChange}
          />
        );

        expect(screen.queryByText('Legend Position')).not.toBeInTheDocument();

        rerender(
          <ChartCustomizations
            chartType={chartType as any}
            formData={createFormData(chartType as any, {
              customizations: { legendDisplay: 'all' },
            })}
            onChange={mockOnChange}
          />
        );

        expect(screen.getByText('Legend Position')).toBeInTheDocument();
      }
    );
  });

  /**
   * Disabled State
   */
  describe('Disabled State', () => {
    it('should disable all controls when disabled prop is true', () => {
      render(
        <ChartCustomizations
          chartType="bar"
          formData={createFormData('bar')}
          onChange={mockOnChange}
          disabled
        />
      );

      const switches = screen.getAllByRole('switch');
      switches.forEach((switchEl) => {
        expect(switchEl).toBeDisabled();
      });

      const textboxes = screen.getAllByRole('textbox');
      textboxes.forEach((textbox) => {
        expect(textbox).toBeDisabled();
      });

      const radioButtons = screen.getAllByRole('radio');
      radioButtons.forEach((radio) => {
        expect(radio).toBeDisabled();
      });
    });
  });
});
