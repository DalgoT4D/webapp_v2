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
