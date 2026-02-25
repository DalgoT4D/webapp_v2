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
    expect(screen.getByText('X-Axis')).toBeInTheDocument();
    expect(screen.getByText('Y-Axis')).toBeInTheDocument();
    // X-Axis Number Format is only shown when hasNumericXAxis is true
    expect(screen.getAllByLabelText('Number Format').length).toBe(1);

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
    // Label Rotation fields are now just called "Label Rotation" within each section
    expect(screen.getAllByLabelText('Label Rotation').length).toBe(2);

    // X-axis title input (first Title field)
    const titleInputs = screen.getAllByLabelText('Title');
    await user.type(titleInputs[0], 'D');
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
    // Note: Detailed number formatting behavior (clamping, callbacks, etc.)
    // is tested in NumberFormatSection.test.tsx. These tests verify integration only.

    it('should render NumberFormatSection in Y-Axis section with description', () => {
      render(<LineChartCustomizations {...defaultProps} />);

      expect(screen.getByText('Y-Axis')).toBeInTheDocument();
      expect(screen.getByLabelText('Number Format')).toBeInTheDocument();
      expect(screen.getByLabelText('Decimal Places')).toBeInTheDocument();
      expect(
        screen.getByText('Applied to Y-axis labels, data labels, and tooltips')
      ).toBeInTheDocument();
    });

    it('should render X-axis NumberFormatSection only when hasNumericXAxis is true', () => {
      const { rerender } = render(<LineChartCustomizations {...defaultProps} />);

      // Only Y-Axis number format by default
      expect(screen.getAllByLabelText('Number Format').length).toBe(1);

      // Both X-Axis and Y-Axis when hasNumericXAxis is true
      rerender(<LineChartCustomizations {...defaultProps} hasNumericXAxis={true} />);
      expect(screen.getAllByLabelText('Number Format').length).toBe(2);
    });

    it('should pass customization values to NumberFormatSection correctly', () => {
      render(
        <LineChartCustomizations
          {...defaultProps}
          customizations={{ yAxisNumberFormat: 'indian', yAxisDecimalPlaces: 2 }}
        />
      );

      expect(screen.getByLabelText('Decimal Places')).toHaveValue(2);
    });
  });
});
