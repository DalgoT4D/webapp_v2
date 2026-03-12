/**
 * PieChartCustomizations Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PieChartCustomizations } from '../pie/PieChartCustomizations';

describe('PieChartCustomizations', () => {
  const mockUpdateCustomization = jest.fn();
  const defaultProps = {
    customizations: {},
    updateCustomization: mockUpdateCustomization,
    disabled: false,
  };

  beforeEach(() => jest.clearAllMocks());

  it('should render all sections and default options', () => {
    render(<PieChartCustomizations {...defaultProps} />);

    // Sections
    expect(screen.getByText('Legend')).toBeInTheDocument();
    expect(screen.getByText('Display Options')).toBeInTheDocument();
    expect(screen.getByText('Slice Configuration')).toBeInTheDocument();
    expect(screen.getByText('Data Labels')).toBeInTheDocument();

    // Default values
    expect(screen.getByRole('switch', { name: 'Show Legend' })).toBeChecked();
    expect(screen.getByLabelText('Donut Chart')).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Show Tooltip on Hover' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Show Data Labels' })).toBeChecked();
  });

  it('should handle legend options and conditional fields', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <PieChartCustomizations {...defaultProps} customizations={{ showLegend: true }} />
    );

    expect(screen.getByText('Legend Display')).toBeInTheDocument();
    expect(screen.getByText('Legend Position')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Show All Legends in Chart Area'));
    expect(mockUpdateCustomization).toHaveBeenCalledWith('legendPosition', 'right');
    expect(mockUpdateCustomization).toHaveBeenCalledWith('legendDisplay', 'all');

    // Hide when disabled
    rerender(<PieChartCustomizations {...defaultProps} customizations={{ showLegend: false }} />);
    expect(screen.queryByText('Legend Display')).not.toBeInTheDocument();
  });

  it('should handle chart style and display options', async () => {
    const user = userEvent.setup();
    render(<PieChartCustomizations {...defaultProps} />);

    await user.click(screen.getByLabelText('Full Pie'));
    expect(mockUpdateCustomization).toHaveBeenCalledWith('chartStyle', 'pie');

    mockUpdateCustomization.mockClear();
    await user.click(screen.getByLabelText('Show Tooltip on Hover'));
    expect(mockUpdateCustomization).toHaveBeenCalledWith('showTooltip', false);
  });

  it('should render slice configuration with helper text', () => {
    render(<PieChartCustomizations {...defaultProps} />);

    expect(screen.getByLabelText('Slice Limit')).toBeInTheDocument();
    expect(
      screen.getByText('When limited, remaining slices will be grouped under "Other" category.')
    ).toBeInTheDocument();
  });

  it('should handle data labels options and conditional fields', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <PieChartCustomizations {...defaultProps} customizations={{ showDataLabels: true }} />
    );

    expect(screen.getByLabelText('Label Format')).toBeInTheDocument();
    expect(screen.getByLabelText('Label Position')).toBeInTheDocument();

    // Hide when disabled
    rerender(
      <PieChartCustomizations {...defaultProps} customizations={{ showDataLabels: false }} />
    );
    expect(screen.queryByLabelText('Label Format')).not.toBeInTheDocument();

    mockUpdateCustomization.mockClear();
    rerender(<PieChartCustomizations {...defaultProps} />);
    await user.click(screen.getByLabelText('Show Data Labels'));
    expect(mockUpdateCustomization).toHaveBeenCalledWith('showDataLabels', false);
  });

  it('should disable all controls when disabled is true', () => {
    render(<PieChartCustomizations {...defaultProps} disabled={true} />);

    screen.getAllByRole('switch').forEach((s) => {
      expect(s).toBeDisabled();
    });
    screen.getAllByRole('radio').forEach((r) => {
      expect(r).toBeDisabled();
    });
  });
});
