/**
 * BarChartCustomizations Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BarChartCustomizations } from '../bar/BarChartCustomizations';

describe('BarChartCustomizations', () => {
  const mockUpdateCustomization = jest.fn();
  const defaultProps = {
    customizations: {},
    updateCustomization: mockUpdateCustomization,
    disabled: false,
    hasExtraDimension: false,
  };

  beforeEach(() => jest.clearAllMocks());

  it('should render all sections and default options', () => {
    render(<BarChartCustomizations {...defaultProps} />);

    // Sections
    expect(screen.getByText('Display Options')).toBeInTheDocument();
    expect(screen.getByText('Data Labels')).toBeInTheDocument();
    expect(screen.getByText('Axis Configuration')).toBeInTheDocument();

    // Default values
    expect(screen.getByLabelText('Vertical')).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Show Tooltip on Hover' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Show Legend' })).toBeChecked();

    // Stacked should not show without extra dimension
    expect(screen.queryByLabelText('Stacked Bars')).not.toBeInTheDocument();
  });

  it('should handle orientation and stacked options', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<BarChartCustomizations {...defaultProps} />);

    await user.click(screen.getByLabelText('Horizontal'));
    expect(mockUpdateCustomization).toHaveBeenCalledWith('orientation', 'horizontal');

    // Show stacked with extra dimension
    rerender(<BarChartCustomizations {...defaultProps} hasExtraDimension={true} />);
    expect(screen.getByLabelText('Stacked Bars')).toBeInTheDocument();

    mockUpdateCustomization.mockClear();
    await user.click(screen.getByLabelText('Stacked Bars'));
    expect(mockUpdateCustomization).toHaveBeenCalledWith('stacked', true);
  });

  it('should handle legend options and show conditional fields', async () => {
    const user = userEvent.setup();
    render(<BarChartCustomizations {...defaultProps} customizations={{ showLegend: true }} />);

    expect(screen.getByText('Legend Display')).toBeInTheDocument();
    expect(screen.getByText('Legend Position')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Show All Legends in Chart Area'));
    expect(mockUpdateCustomization).toHaveBeenCalledWith({
      legendPosition: 'right',
      legendDisplay: 'all',
    });
  });

  it('should handle data labels options', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<BarChartCustomizations {...defaultProps} />);

    await user.click(screen.getByLabelText('Show Data Labels'));
    expect(mockUpdateCustomization).toHaveBeenCalledWith('showDataLabels', true);

    rerender(
      <BarChartCustomizations {...defaultProps} customizations={{ showDataLabels: true }} />
    );
    expect(screen.getByText('Data Label Position')).toBeInTheDocument();
  });

  it('should handle axis configuration inputs', async () => {
    const user = userEvent.setup();
    render(
      <BarChartCustomizations
        {...defaultProps}
        customizations={{ xAxisTitle: 'Time', yAxisTitle: 'Value' }}
      />
    );

    expect(screen.getByDisplayValue('Time')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Value')).toBeInTheDocument();
    expect(screen.getByLabelText('X-Axis Label Rotation')).toBeInTheDocument();
    expect(screen.getByLabelText('Y-Axis Label Rotation')).toBeInTheDocument();

    // X-axis title input
    const xInput = screen.getByLabelText('X-Axis Title');
    await user.type(xInput, 'M');
    expect(mockUpdateCustomization).toHaveBeenCalledWith('xAxisTitle', 'TimeM');

    // Y-axis title input
    const yInput = screen.getByLabelText('Y-Axis Title');
    await user.type(yInput, 's');
    expect(mockUpdateCustomization).toHaveBeenCalledWith('yAxisTitle', 'Values');

    // X-axis rotation
    const xRotationSelect = screen.getByLabelText('X-Axis Label Rotation');
    await user.click(xRotationSelect);
    await user.click(screen.getByRole('option', { name: '45 degrees' }));
    expect(mockUpdateCustomization).toHaveBeenCalledWith('xAxisLabelRotation', '45');

    // Y-axis rotation
    const yRotationSelect = screen.getByLabelText('Y-Axis Label Rotation');
    await user.click(yRotationSelect);
    await user.click(screen.getByRole('option', { name: 'Vertical (90°)' }));
    expect(mockUpdateCustomization).toHaveBeenCalledWith('yAxisLabelRotation', 'vertical');
  });

  it('shows a default color picker and per-category rows for single-series categorical bars', () => {
    render(
      <BarChartCustomizations
        {...defaultProps}
        chartConfig={{
          xAxis: { type: 'category', data: ['R', 'A', 'G'] },
          yAxis: { type: 'value' },
          series: [{ type: 'bar', data: [12, 6, 20] }],
        }}
      />
    );

    expect(screen.getByText('Default Color')).toBeInTheDocument();
    expect(screen.queryByText('Color Palette')).not.toBeInTheDocument();
    expect(screen.getByText('Category Colors')).toBeInTheDocument();
    expect(screen.getByTestId('dimension-color-row-0')).toBeInTheDocument();
    expect(screen.getByText('R')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('G')).toBeInTheDocument();
  });

  it('shows additional-dimension color rows by default when extra dimension is set', () => {
    render(
      <BarChartCustomizations
        {...defaultProps}
        hasExtraDimension={true}
        primaryDimensionLabel="region"
        extraDimensionLabel="status"
        chartConfig={{
          xAxis: { type: 'category', data: ['North', 'South'] },
          yAxis: { type: 'value' },
          series: [
            { type: 'bar', name: 'R', data: [12, 6] },
            { type: 'bar', name: 'G', data: [7, 10] },
          ],
        }}
      />
    );

    expect(screen.getByLabelText('Color Dimension')).toBeInTheDocument();
    expect(screen.queryByText('Default Color')).not.toBeInTheDocument();
    expect(screen.getByText('Color Palette')).toBeInTheDocument();
    expect(screen.getByText('status Colors')).toBeInTheDocument();
    expect(screen.getByText('R')).toBeInTheDocument();
    expect(screen.getByText('G')).toBeInTheDocument();
  });

  it('offers a palette selector for the added dimension alongside individual overrides', async () => {
    const user = userEvent.setup();

    render(
      <BarChartCustomizations
        {...defaultProps}
        hasExtraDimension={true}
        extraDimensionLabel="status"
        chartConfig={{
          xAxis: { type: 'category', data: ['North', 'South'] },
          yAxis: { type: 'value' },
          series: [
            { type: 'bar', name: 'R', data: [12, 6] },
            { type: 'bar', name: 'G', data: [7, 10] },
          ],
        }}
      />
    );

    expect(screen.getByText('Color Palette')).toBeInTheDocument();
    expect(screen.getByTestId('dimension-color-row-0')).toBeInTheDocument();

    await user.click(screen.getByTestId('palette-dalgo'));

    expect(mockUpdateCustomization).toHaveBeenCalledWith('color_palette_colors', [
      '#00897B',
      '#0F2440',
      '#1F6AA5',
      '#39A0C8',
      '#6EC9C2',
      '#F4A261',
      '#E76F51',
      '#8A94A6',
    ]);
  });

  it('shows tooltip guidance for extra-dimension color editing', async () => {
    const user = userEvent.setup();

    render(
      <BarChartCustomizations
        {...defaultProps}
        hasExtraDimension={true}
        primaryDimensionLabel="state"
        extraDimensionLabel="status"
        chartConfig={{
          xAxis: { type: 'category', data: ['North', 'South'] },
          yAxis: { type: 'value' },
          series: [
            { type: 'bar', name: 'R', data: [12, 6] },
            { type: 'bar', name: 'G', data: [7, 10] },
          ],
        }}
      />
    );

    await user.hover(screen.getByTestId('color-guidance-trigger'));

    expect(
      (
        await screen.findAllByText(
          'With an extra dimension, you can color up to two dimensions here. Use Color Dimension to switch between state and status.'
        )
      )[0]
    ).toBeInTheDocument();
  });

  it('shows primary-dimension color controls when that dimension is selected', () => {
    render(
      <BarChartCustomizations
        {...defaultProps}
        hasExtraDimension={true}
        primaryDimensionLabel="region"
        extraDimensionLabel="status"
        customizations={{ bar_color_target: 'primary' }}
        chartConfig={{
          xAxis: { type: 'category', data: ['North', 'South'] },
          yAxis: { type: 'value' },
          series: [
            { type: 'bar', name: 'R', data: [12, 6] },
            { type: 'bar', name: 'G', data: [7, 10] },
          ],
        }}
      />
    );

    expect(screen.getByText('Default Color')).toBeInTheDocument();
    expect(screen.queryByText('Color Palette')).not.toBeInTheDocument();
    expect(screen.getByText('region Colors')).toBeInTheDocument();
    expect(screen.getByText('North')).toBeInTheDocument();
    expect(screen.getByText('South')).toBeInTheDocument();
  });

  it('shows tooltip guidance for multi-metric color editing', async () => {
    const user = userEvent.setup();

    render(
      <BarChartCustomizations
        {...defaultProps}
        metrics={[
          { column: 'value_a', aggregation: 'SUM' },
          { column: 'value_b', aggregation: 'SUM' },
        ]}
        primaryDimensionLabel="state"
      />
    );

    await user.hover(screen.getByTestId('color-guidance-trigger'));

    expect(
      (
        await screen.findAllByText(
          'With multiple metrics, colors can only be changed per metric. Categories in state keep the same color inside each metric.'
        )
      )[0]
    ).toBeInTheDocument();
  });

  it('stores additional-dimension overrides separately when extra dimension colors are edited', async () => {
    const user = userEvent.setup();

    render(
      <BarChartCustomizations
        {...defaultProps}
        hasExtraDimension={true}
        extraDimensionLabel="status"
        chartConfig={{
          xAxis: { type: 'category', data: ['North', 'South'] },
          yAxis: { type: 'value' },
          series: [
            { type: 'bar', name: 'R', data: [12, 6] },
            { type: 'bar', name: 'G', data: [7, 10] },
          ],
        }}
      />
    );

    await user.click(screen.getByTestId('dimension-color-row-1'));
    await user.click(screen.getByTestId('color-swatch-00897B'));

    expect(mockUpdateCustomization).toHaveBeenCalledWith('extra_dimension_colors', {
      G: '#00897B',
    });
  });

  it('clears category overrides when a new default color is selected', async () => {
    const user = userEvent.setup();

    render(
      <BarChartCustomizations
        {...defaultProps}
        customizations={{
          dimension_colors: {
            R: '#dc2626',
          },
        }}
        chartConfig={{
          xAxis: { type: 'category', data: ['R', 'A', 'G'] },
          yAxis: { type: 'value' },
          series: [{ type: 'bar', data: [12, 6, 20] }],
        }}
      />
    );

    await user.click(screen.getByTestId('color-swatch-00897B'));

    expect(mockUpdateCustomization).toHaveBeenCalledWith({
      chart_color: '#00897B',
      color_palette_colors: undefined,
      dimension_colors: undefined,
    });
  });

  it('should disable all controls when disabled is true', () => {
    render(<BarChartCustomizations {...defaultProps} disabled={true} hasExtraDimension={true} />);

    screen.getAllByRole('switch').forEach((s) => {
      expect(s).toBeDisabled();
    });
    screen.getAllByRole('radio').forEach((r) => {
      expect(r).toBeDisabled();
    });
    screen.getAllByRole('textbox').forEach((i) => {
      expect(i).toBeDisabled();
    });
  });
});
