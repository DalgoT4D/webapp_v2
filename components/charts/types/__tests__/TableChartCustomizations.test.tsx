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

  it('should expand/collapse column and show configuration options', async () => {
    const user = userEvent.setup();
    render(<TableChartCustomizations {...defaultProps} />);

    await user.click(screen.getByText('budget'));
    expect(screen.getByText('Format Type')).toBeInTheDocument();
    expect(screen.getByText('Decimal Places')).toBeInTheDocument();

    await user.click(screen.getByText('budget'));
    expect(screen.queryByText('Format Type')).not.toBeInTheDocument();
  });

  it('should auto-save format configuration on dropdown change', async () => {
    const user = userEvent.setup();
    render(<TableChartCustomizations {...defaultProps} />);

    await user.click(screen.getByText('budget'));

    const formatSelect = screen.getByRole('combobox');
    await user.click(formatSelect);
    await user.click(screen.getByText('Indian (12,34,567)'));

    expect(mockUpdateCustomization).toHaveBeenCalledWith('columnFormatting', {
      budget: { numberFormat: 'indian', precision: 0 },
    });
  });

  it('should auto-save decimal places on input change', async () => {
    const user = userEvent.setup();
    render(<TableChartCustomizations {...defaultProps} />);

    await user.click(screen.getByText('budget'));

    const decimalInput = screen.getByRole('spinbutton');
    await user.clear(decimalInput);
    await user.type(decimalInput, '2');

    expect(mockUpdateCustomization).toHaveBeenCalledWith('columnFormatting', {
      budget: { numberFormat: 'default', precision: 2 },
    });
  });

  it('should display existing customizations and load on expand', async () => {
    const user = userEvent.setup();
    render(
      <TableChartCustomizations
        {...defaultProps}
        customizations={{
          columnFormatting: { budget: { numberFormat: 'indian', precision: 2 } },
        }}
      />
    );

    expect(screen.getByText('Indian • 2 dec')).toBeInTheDocument();
    expect(screen.getAllByText('No Formatting').length).toBe(2);

    await user.click(screen.getByText('budget'));
    expect(screen.getByRole('spinbutton')).toHaveValue(2);
  });

  it('should display decimal places independently when no format is selected', () => {
    render(
      <TableChartCustomizations
        {...defaultProps}
        customizations={{
          columnFormatting: { budget: { numberFormat: 'default', precision: 3 } },
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
            budget: { numberFormat: 'indian', precision: 2 },
            revenue: { numberFormat: 'percentage', precision: 1 },
          },
        }}
      />
    );

    const removeButton = container.querySelector('.lucide-x')?.closest('button');
    await user.click(removeButton!);
    expect(mockUpdateCustomization).toHaveBeenCalledWith('columnFormatting', {
      revenue: { numberFormat: 'percentage', precision: 1 },
    });
  });

  it('should disable all controls when disabled is true', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TableChartCustomizations
        {...defaultProps}
        disabled={true}
        customizations={{
          columnFormatting: { budget: { numberFormat: 'indian', precision: 2 } },
        }}
      />
    );

    await user.click(screen.getByText('budget'));
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByRole('spinbutton')).toBeDisabled();

    const removeButton = container.querySelector('.lucide-x')?.closest('button');
    expect(removeButton).toBeDisabled();
  });
});
