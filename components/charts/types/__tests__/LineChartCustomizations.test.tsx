/**
 * LineChartCustomizations Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LineChartCustomizations } from '../line/LineChartCustomizations';

describe('LineChartCustomizations', () => {
  const mockUpdateCustomization = jest.fn();
  const defaultProps = {
    customizations: {},
    updateCustomization: mockUpdateCustomization,
    disabled: false,
  };

  beforeEach(() => jest.clearAllMocks());

  it('should render all sections and default options', () => {
    render(<LineChartCustomizations {...defaultProps} />);

    // Sections
    expect(screen.getByText('Display Options')).toBeInTheDocument();
    expect(screen.getByText('Data Labels')).toBeInTheDocument();
    expect(screen.getByText('Axis Configuration')).toBeInTheDocument();
    expect(screen.getByText('Y-Axis Number Formatting')).toBeInTheDocument();
    // X-Axis Number Formatting is only shown when hasNumericXAxis is true
    expect(screen.queryByText('X-Axis Number Formatting')).not.toBeInTheDocument();

    // Default values
    expect(screen.getByLabelText('Smooth Curves')).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Show Tooltip on Hover' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Show Data Points' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Show Legend' })).toBeChecked();
  });

  it('should handle line style and display options', async () => {
    const user = userEvent.setup();
    render(<LineChartCustomizations {...defaultProps} />);

    await user.click(screen.getByLabelText('Straight Lines'));
    expect(mockUpdateCustomization).toHaveBeenCalledWith('lineStyle', 'straight');

    mockUpdateCustomization.mockClear();
    await user.click(screen.getByLabelText('Show Data Points'));
    expect(mockUpdateCustomization).toHaveBeenCalledWith('showDataPoints', false);
  });

  it('should handle legend options and show conditional fields', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <LineChartCustomizations {...defaultProps} customizations={{ showLegend: true }} />
    );

    expect(screen.getByText('Legend Display')).toBeInTheDocument();
    expect(screen.getByText('Legend Position')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Show All Legends in Chart Area'));
    expect(mockUpdateCustomization).toHaveBeenCalledWith('legendDisplay', 'all');

    // Hide legend options when disabled
    rerender(<LineChartCustomizations {...defaultProps} customizations={{ showLegend: false }} />);
    expect(screen.queryByText('Legend Display')).not.toBeInTheDocument();
  });

  it('should handle data labels options', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<LineChartCustomizations {...defaultProps} />);

    await user.click(screen.getByLabelText('Show Data Labels'));
    expect(mockUpdateCustomization).toHaveBeenCalledWith('showDataLabels', true);

    rerender(
      <LineChartCustomizations {...defaultProps} customizations={{ showDataLabels: true }} />
    );
    expect(screen.getByText('Data Label Position')).toBeInTheDocument();
  });

  it('should handle axis configuration inputs', async () => {
    const user = userEvent.setup();
    render(
      <LineChartCustomizations
        {...defaultProps}
        customizations={{ xAxisTitle: 'Months', yAxisTitle: 'Sales' }}
      />
    );

    expect(screen.getByDisplayValue('Months')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Sales')).toBeInTheDocument();
    expect(screen.getByLabelText('X-Axis Label Rotation')).toBeInTheDocument();
    expect(screen.getByLabelText('Y-Axis Label Rotation')).toBeInTheDocument();

    const xInput = screen.getByLabelText('X-Axis Title');
    await user.type(xInput, 'D');
    expect(mockUpdateCustomization).toHaveBeenCalledWith('xAxisTitle', 'MonthsD');
  });

  it('should disable all controls when disabled is true', () => {
    render(<LineChartCustomizations {...defaultProps} disabled={true} />);

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
    it('should render Y-axis number formatting section', () => {
      render(<LineChartCustomizations {...defaultProps} />);

      expect(screen.getByText('Y-Axis Number Formatting')).toBeInTheDocument();
      expect(
        screen.getByText('Applied to Y-axis labels, data labels, and tooltips')
      ).toBeInTheDocument();
    });

    it('should render X-axis number formatting section only when hasNumericXAxis is true', () => {
      const { rerender } = render(<LineChartCustomizations {...defaultProps} />);

      // X-axis formatting should NOT be visible by default
      expect(screen.queryByText('X-Axis Number Formatting')).not.toBeInTheDocument();

      // X-axis formatting should be visible when hasNumericXAxis is true
      rerender(<LineChartCustomizations {...defaultProps} hasNumericXAxis={true} />);
      expect(screen.getByText('X-Axis Number Formatting')).toBeInTheDocument();
      expect(screen.getByText('Applied to X-axis labels')).toBeInTheDocument();
    });

    it('should display existing Y-axis number format customizations', () => {
      render(
        <LineChartCustomizations
          {...defaultProps}
          customizations={{ yAxisNumberFormat: 'indian', yAxisDecimalPlaces: 2 }}
        />
      );

      expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    });

    it('should handle Y-axis decimal places input changes', async () => {
      const user = userEvent.setup();
      render(
        <LineChartCustomizations {...defaultProps} customizations={{ yAxisDecimalPlaces: 0 }} />
      );

      const decimalInput = screen.getByLabelText(/Y-Axis.*Decimal Places/i);
      await user.clear(decimalInput);
      await user.type(decimalInput, '3');

      expect(mockUpdateCustomization).toHaveBeenCalledWith('yAxisDecimalPlaces', 3);
    });

    it('should handle X-axis decimal places input changes', async () => {
      const user = userEvent.setup();
      render(
        <LineChartCustomizations
          {...defaultProps}
          customizations={{ xAxisDecimalPlaces: 0 }}
          hasNumericXAxis={true}
        />
      );

      const decimalInput = screen.getByLabelText(/X-Axis.*Decimal Places/i);
      await user.clear(decimalInput);
      await user.type(decimalInput, '2');

      expect(mockUpdateCustomization).toHaveBeenCalledWith('xAxisDecimalPlaces', 2);
    });

    it('should clamp Y-axis decimal places between 0 and 10', async () => {
      const user = userEvent.setup();
      render(
        <LineChartCustomizations {...defaultProps} customizations={{ yAxisDecimalPlaces: 5 }} />
      );

      const decimalInput = screen.getByLabelText(/Y-Axis.*Decimal Places/i);

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
