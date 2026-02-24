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
    expect(screen.getByText('X-Axis')).toBeInTheDocument();
    expect(screen.getByText('Y-Axis')).toBeInTheDocument();

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
    expect(mockUpdateCustomization).toHaveBeenCalledWith('legendPosition', 'right');
    expect(mockUpdateCustomization).toHaveBeenCalledWith('legendDisplay', 'all');
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
    // Label Rotation fields are now just called "Label Rotation" within each section
    expect(screen.getAllByLabelText('Label Rotation').length).toBe(2);

    // X-axis title input (first Title field)
    const titleInputs = screen.getAllByLabelText('Title');
    await user.type(titleInputs[0], 'M');
    expect(mockUpdateCustomization).toHaveBeenCalledWith('xAxisTitle', 'TimeM');

    // Y-axis title input (second Title field)
    await user.type(titleInputs[1], 's');
    expect(mockUpdateCustomization).toHaveBeenCalledWith('yAxisTitle', 'Values');

    // Label rotation selects
    const rotationSelects = screen.getAllByLabelText('Label Rotation');
    await user.click(rotationSelects[0]);
    await user.click(screen.getByRole('option', { name: '45 degrees' }));
    expect(mockUpdateCustomization).toHaveBeenCalledWith('xAxisLabelRotation', '45');

    await user.click(rotationSelects[1]);
    await user.click(screen.getByRole('option', { name: 'Vertical (90°)' }));
    expect(mockUpdateCustomization).toHaveBeenCalledWith('yAxisLabelRotation', 'vertical');
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

  describe('Number Formatting', () => {
    it('should render Y-axis number formatting within Y-Axis section', () => {
      render(<BarChartCustomizations {...defaultProps} />);

      expect(screen.getByText('Y-Axis')).toBeInTheDocument();
      expect(
        screen.getByText('Applied to Y-axis labels, data labels, and tooltips')
      ).toBeInTheDocument();
    });

    it('should render X-axis number formatting only when hasNumericXAxis is true', () => {
      const { rerender } = render(<BarChartCustomizations {...defaultProps} />);

      // X-axis Number Format field should NOT be visible by default (only 1 Number Format for Y-Axis)
      expect(screen.getAllByLabelText('Number Format').length).toBe(1);

      // X-axis Number Format should be visible when hasNumericXAxis is true
      rerender(<BarChartCustomizations {...defaultProps} hasNumericXAxis={true} />);
      expect(screen.getAllByLabelText('Number Format').length).toBe(2);
    });

    it('should display existing Y-axis number format customizations', () => {
      render(
        <BarChartCustomizations
          {...defaultProps}
          customizations={{ yAxisNumberFormat: 'indian', yAxisDecimalPlaces: 2 }}
        />
      );

      expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    });

    it('should handle Y-axis decimal places input changes', async () => {
      const user = userEvent.setup();
      render(
        <BarChartCustomizations {...defaultProps} customizations={{ yAxisDecimalPlaces: 0 }} />
      );

      // Only one Decimal Places field (Y-Axis) when hasNumericXAxis is false
      const decimalInput = screen.getByLabelText('Decimal Places');
      await user.clear(decimalInput);
      await user.type(decimalInput, '3');

      expect(mockUpdateCustomization).toHaveBeenCalledWith('yAxisDecimalPlaces', 3);
    });

    it('should handle X-axis decimal places input changes', async () => {
      const user = userEvent.setup();
      render(
        <BarChartCustomizations
          {...defaultProps}
          customizations={{ xAxisDecimalPlaces: 0 }}
          hasNumericXAxis={true}
        />
      );

      // Two Decimal Places fields when hasNumericXAxis is true
      const decimalInputs = screen.getAllByLabelText('Decimal Places');
      await user.clear(decimalInputs[0]); // X-Axis decimal places (first)
      await user.type(decimalInputs[0], '2');

      expect(mockUpdateCustomization).toHaveBeenCalledWith('xAxisDecimalPlaces', 2);
    });

    it('should clamp Y-axis decimal places between 0 and 10', async () => {
      const user = userEvent.setup();
      render(
        <BarChartCustomizations {...defaultProps} customizations={{ yAxisDecimalPlaces: 5 }} />
      );

      const decimalInput = screen.getByLabelText('Decimal Places');

      await user.clear(decimalInput);
      await user.type(decimalInput, '1');
      await user.type(decimalInput, '5');

      const calls = mockUpdateCustomization.mock.calls;
      const decimalCalls = calls.filter((call) => call[0] === 'yAxisDecimalPlaces');
      const lastDecimalCall = decimalCalls[decimalCalls.length - 1];
      expect(lastDecimalCall[1]).toBeLessThanOrEqual(10);
    });
  });
});
