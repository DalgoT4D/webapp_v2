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

  // Note: Detailed number formatting behavior (clamping, callbacks, etc.)
  // is tested in NumberFormatSection.test.tsx. These tests verify integration only.

  it('should render NumberFormatSection in Number Formatting section', () => {
    render(<PieChartCustomizations {...defaultProps} />);

    expect(screen.getByText('Number Formatting')).toBeInTheDocument();
    expect(screen.getByLabelText('Number Format')).toBeInTheDocument();
    expect(screen.getByLabelText('Decimal Places')).toBeInTheDocument();
    expect(screen.getByLabelText('Decimal Places')).toHaveValue(0);
  });

  it('should pass customization values to NumberFormatSection correctly', () => {
    render(
      <PieChartCustomizations
        {...defaultProps}
        customizations={{ numberFormat: 'indian', decimalPlaces: 2 }}
      />
    );

    expect(screen.getByLabelText('Decimal Places')).toHaveValue(2);
  });

  it('should disable all controls when disabled is true', () => {
    render(<PieChartCustomizations {...defaultProps} disabled={true} />);

    screen.getAllByRole('switch').forEach((s) => {
      expect(s).toBeDisabled();
    });
    screen.getAllByRole('radio').forEach((r) => {
      expect(r).toBeDisabled();
    });
    expect(screen.getByLabelText('Decimal Places')).toBeDisabled();
  });

  // Date Formatting Tests
  describe('Date Formatting', () => {
    it('should not show Date Formatting section when dimension is not a date', () => {
      render(<PieChartCustomizations {...defaultProps} hasDimensionDate={false} />);

      expect(screen.queryByText('Date Formatting')).not.toBeInTheDocument();
    });

    it('should show Date Formatting section when dimension is a date type', () => {
      render(
        <PieChartCustomizations
          {...defaultProps}
          hasDimensionDate={true}
          dimensionColumn="created_at"
        />
      );

      expect(screen.getByText('Date Formatting')).toBeInTheDocument();
      expect(screen.getByLabelText('Date Format')).toBeInTheDocument();
      expect(screen.getByText('Format dates in slice labels (created_at)')).toBeInTheDocument();
    });

    it('should call updateCustomization when date format changes', async () => {
      const user = userEvent.setup();
      render(
        <PieChartCustomizations
          {...defaultProps}
          hasDimensionDate={true}
          dimensionColumn="order_date"
        />
      );

      const formatSelect = screen.getByLabelText('Date Format');
      await user.click(formatSelect);
      await user.click(screen.getByRole('option', { name: '%d/%m/%Y (14/01/2019)' }));

      expect(mockUpdateCustomization).toHaveBeenCalledWith('dateFormat', 'dd_mm_yyyy');
    });

    it('should display existing date format customization', () => {
      render(
        <PieChartCustomizations
          {...defaultProps}
          customizations={{ dateFormat: 'yyyy_mm_dd' }}
          hasDimensionDate={true}
          dimensionColumn="event_date"
        />
      );

      expect(screen.getByText('Date Formatting')).toBeInTheDocument();
    });

    it('should add border to Number Formatting section when Date Formatting is shown', () => {
      const { container, rerender } = render(
        <PieChartCustomizations {...defaultProps} hasDimensionDate={false} />
      );

      // Without date formatting, Number Formatting section should not have border-b class
      const numberSectionWithoutDate = container.querySelector('.space-y-4:last-child');
      expect(numberSectionWithoutDate?.className).not.toContain('border-b');

      // With date formatting, Number Formatting section should have border-b class
      rerender(
        <PieChartCustomizations {...defaultProps} hasDimensionDate={true} dimensionColumn="date" />
      );
      const numberSectionWithDate = screen.getByText('Number Formatting').closest('.space-y-4');
      expect(numberSectionWithDate?.className).toContain('border-b');
    });
  });
});
