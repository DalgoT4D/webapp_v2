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
    expect(screen.getAllByText('Default').length).toBe(3);

    rerender(<TableChartCustomizations {...defaultProps} availableColumns={[]} />);
    expect(
      screen.getByText('No columns available. Configure table data first.')
    ).toBeInTheDocument();
  });

  it('should expand/collapse column and show configuration options', async () => {
    const user = userEvent.setup();
    render(<TableChartCustomizations {...defaultProps} />);

    await user.click(screen.getByText('budget'));
    expect(screen.getByText('Format Type')).toBeInTheDocument();
    expect(screen.getByText('Decimal Places')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();

    await user.click(screen.getByText('budget'));
    expect(screen.queryByText('Format Type')).not.toBeInTheDocument();
  });

  it('should save format configuration and handle cancel', async () => {
    const user = userEvent.setup();
    render(<TableChartCustomizations {...defaultProps} />);

    await user.click(screen.getByText('budget'));
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(mockUpdateCustomization).toHaveBeenCalledWith('columnFormatting', {
      budget: { numberFormat: 'default', precision: 0 },
    });

    mockUpdateCustomization.mockClear();
    await user.click(screen.getByText('revenue'));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText('Format Type')).not.toBeInTheDocument();
    expect(mockUpdateCustomization).not.toHaveBeenCalled();
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

    expect(screen.getByText('Indian \u2022 2 dec')).toBeInTheDocument();
    expect(screen.getAllByText('Default').length).toBe(2);

    await user.click(screen.getByText('budget'));
    expect(screen.getByRole('spinbutton')).toHaveValue(2);
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
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    expect(screen.getByRole('spinbutton')).toBeDisabled();

    const removeButton = container.querySelector('.lucide-x')?.closest('button');
    expect(removeButton).toBeDisabled();
  });
});
