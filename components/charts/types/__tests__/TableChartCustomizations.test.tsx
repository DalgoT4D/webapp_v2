/**
 * TableChartCustomizations Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TableChartCustomizations } from '../table/TableChartCustomizations';

describe('TableChartCustomizations', () => {
  const mockUpdateCustomization = jest.fn();
  const defaultProps = {
    customizations: {},
    updateCustomization: mockUpdateCustomization,
    disabled: false,
    availableColumns: ['budget', 'revenue', 'profit'],
  };

  beforeEach(() => jest.clearAllMocks());

  it('should render section header, columns, and empty state', () => {
    const { rerender } = render(<TableChartCustomizations {...defaultProps} />);

    expect(screen.getByText('Number Formatting')).toBeInTheDocument();
    expect(screen.getByText('budget')).toBeInTheDocument();
    expect(screen.getByText('revenue')).toBeInTheDocument();
    expect(screen.getAllByText('No Formatting').length).toBe(3);

    rerender(<TableChartCustomizations {...defaultProps} availableColumns={[]} />);
    expect(screen.getByText('No numeric columns to format.')).toBeInTheDocument();
  });

  it('should expand/collapse column and show NumberFormatSection', async () => {
    const user = userEvent.setup();
    render(<TableChartCustomizations {...defaultProps} />);

    await user.click(screen.getByText('budget'));
    // Now uses NumberFormatSection which has "Number Format" label
    expect(screen.getByLabelText('Number Format')).toBeInTheDocument();
    expect(screen.getByLabelText('Decimal Places')).toBeInTheDocument();

    await user.click(screen.getByText('budget'));
    expect(screen.queryByLabelText('Number Format')).not.toBeInTheDocument();
  });

  it('should auto-save format configuration on dropdown change', async () => {
    const user = userEvent.setup();
    render(<TableChartCustomizations {...defaultProps} />);

    await user.click(screen.getByText('budget'));

    const formatSelect = screen.getByRole('combobox');
    await user.click(formatSelect);
    await user.click(screen.getByText('Indian (1234567 => 12,34,567)'));

    expect(mockUpdateCustomization).toHaveBeenCalledWith('columnFormatting', {
      budget: { numberFormat: 'indian', decimalPlaces: 0 },
    });
  });

  it('should auto-save decimal places on input change', async () => {
    const user = userEvent.setup();
    render(<TableChartCustomizations {...defaultProps} />);

    await user.click(screen.getByText('budget'));

    const decimalInput = screen.getByLabelText('Decimal Places');
    await user.clear(decimalInput);
    await user.type(decimalInput, '2');

    expect(mockUpdateCustomization).toHaveBeenCalledWith('columnFormatting', {
      budget: { numberFormat: 'default', decimalPlaces: 2 },
    });
  });

  it('should display existing customizations and load on expand', async () => {
    const user = userEvent.setup();
    render(
      <TableChartCustomizations
        {...defaultProps}
        customizations={{
          columnFormatting: { budget: { numberFormat: 'indian', decimalPlaces: 2 } },
        }}
      />
    );

    expect(screen.getByText('Indian • 2 dec')).toBeInTheDocument();
    expect(screen.getAllByText('No Formatting').length).toBe(2);

    await user.click(screen.getByText('budget'));
    expect(screen.getByLabelText('Decimal Places')).toHaveValue(2);
  });

  it('should display decimal places independently when no format is selected', () => {
    render(
      <TableChartCustomizations
        {...defaultProps}
        customizations={{
          columnFormatting: { budget: { numberFormat: 'default', decimalPlaces: 3 } },
        }}
      />
    );

    // Should show "3 decimal places" instead of "No Formatting • 3 dec"
    expect(screen.getByText('3 decimal places')).toBeInTheDocument();
  });

  it('should handle remove format button', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TableChartCustomizations
        {...defaultProps}
        customizations={{
          columnFormatting: {
            budget: { numberFormat: 'indian', decimalPlaces: 2 },
            revenue: { numberFormat: 'international', decimalPlaces: 1 },
          },
        }}
      />
    );

    const removeButton = container.querySelector('.lucide-refresh-cw')?.closest('button');
    await user.click(removeButton!);
    expect(mockUpdateCustomization).toHaveBeenCalledWith('columnFormatting', {
      revenue: { numberFormat: 'international', decimalPlaces: 1 },
    });
  });

  it('should disable all controls when disabled is true', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TableChartCustomizations
        {...defaultProps}
        disabled={true}
        customizations={{
          columnFormatting: { budget: { numberFormat: 'indian', decimalPlaces: 2 } },
        }}
      />
    );

    await user.click(screen.getByText('budget'));
    expect(screen.getByRole('combobox')).toHaveAttribute('data-disabled');
    expect(screen.getByLabelText('Decimal Places')).toBeDisabled();

    const removeButton = container.querySelector('.lucide-refresh-cw')?.closest('button');
    expect(removeButton).toBeDisabled();
  });

  // Note: Detailed number formatting behavior (clamping, excludeFormats, etc.)
  // is tested in NumberFormatSection.test.tsx. These tests verify integration only.

  it('should exclude percentage and currency formats', async () => {
    const user = userEvent.setup();
    render(<TableChartCustomizations {...defaultProps} />);

    await user.click(screen.getByText('budget'));
    await user.click(screen.getByRole('combobox'));

    // These should be present
    expect(screen.getByRole('option', { name: 'No Formatting' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Indian (1234567 => 12,34,567)' })
    ).toBeInTheDocument();

    // These should NOT be present (excluded for table charts)
    expect(screen.queryByRole('option', { name: 'Percentage (%)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Currency ($)' })).not.toBeInTheDocument();
  });
});
