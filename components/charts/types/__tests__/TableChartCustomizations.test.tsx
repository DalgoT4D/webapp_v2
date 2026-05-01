/**
 * TableChartCustomizations Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TableChartCustomizations } from '../table/TableChartCustomizations';

// Mock @dnd-kit to avoid drag-and-drop complexity in tests
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  closestCenter: jest.fn(),
  KeyboardSensor: jest.fn(),
  PointerSensor: jest.fn(),
  useSensor: jest.fn(),
  useSensors: jest.fn(() => []),
}));

jest.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => <div>{children}</div>,
  verticalListSortingStrategy: jest.fn(),
  useSortable: jest.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
  arrayMove: jest.fn((arr: any[], from: number, to: number) => {
    const newArr = [...arr];
    const [removed] = newArr.splice(from, 1);
    newArr.splice(to, 0, removed);
    return newArr;
  }),
}));

jest.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

describe('TableChartCustomizations', () => {
  const mockUpdateCustomization = jest.fn();
  const defaultProps = {
    customizations: {},
    updateCustomization: mockUpdateCustomization,
    disabled: false,
    availableColumns: ['budget', 'revenue', 'profit'],
    allColumns: ['budget', 'revenue', 'profit'],
    onTableColumnsChange: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('should render section header, columns, and empty state', () => {
    const { rerender } = render(<TableChartCustomizations {...defaultProps} />);

    expect(screen.getByText('Number Formatting')).toBeInTheDocument();
    expect(screen.getByTestId('column-row-budget')).toBeInTheDocument();
    expect(screen.getByTestId('column-row-revenue')).toBeInTheDocument();
    expect(screen.getAllByText('No Formatting').length).toBe(3);

    rerender(
      <TableChartCustomizations {...defaultProps} availableColumns={[]} availableDateColumns={[]} />
    );
    expect(screen.getByText('No numeric columns to format.')).toBeInTheDocument();
    expect(screen.getByText('No date columns to format.')).toBeInTheDocument();
  });

  it('should expand/collapse column and show NumberFormatSection', async () => {
    const user = userEvent.setup();
    render(<TableChartCustomizations {...defaultProps} />);

    await user.click(screen.getByTestId('column-row-budget'));
    // Now uses NumberFormatSection which has "Number Format" label
    expect(screen.getByLabelText('Number Format')).toBeInTheDocument();
    expect(screen.getByLabelText('Decimal Places')).toBeInTheDocument();

    await user.click(screen.getByTestId('column-row-budget'));
    expect(screen.queryByLabelText('Number Format')).not.toBeInTheDocument();
  });

  it('should auto-save format configuration on dropdown change', async () => {
    const user = userEvent.setup();
    render(<TableChartCustomizations {...defaultProps} />);

    await user.click(screen.getByTestId('column-row-budget'));

    // The Number Format combobox is the one with aria-label "Number Format"
    const formatSelect = screen.getByLabelText('Number Format');
    await user.click(formatSelect);
    await user.click(screen.getByText('Indian (1234567 => 12,34,567)'));

    // decimalPlaces should be undefined until user explicitly sets it (prevents unintended integer rounding)
    expect(mockUpdateCustomization).toHaveBeenCalledWith('columnFormatting', {
      budget: { numberFormat: 'indian', decimalPlaces: undefined },
    });
  });

  it('should auto-save decimal places on input change', async () => {
    const user = userEvent.setup();
    render(<TableChartCustomizations {...defaultProps} />);

    await user.click(screen.getByTestId('column-row-budget'));

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

    await user.click(screen.getByTestId('column-row-budget'));
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

    await user.click(screen.getByTestId('column-row-budget'));
    expect(screen.getByLabelText('Number Format')).toHaveAttribute('data-disabled');
    expect(screen.getByLabelText('Decimal Places')).toBeDisabled();

    const removeButton = container.querySelector('.lucide-refresh-cw')?.closest('button');
    expect(removeButton).toBeDisabled();
  });

  // Note: Detailed number formatting behavior (clamping, excludeFormats, etc.)
  // is tested in NumberFormatSection.test.tsx. These tests verify integration only.

  it('should exclude percentage and currency formats', async () => {
    const user = userEvent.setup();
    render(<TableChartCustomizations {...defaultProps} />);

    await user.click(screen.getByTestId('column-row-budget'));
    await user.click(screen.getByLabelText('Number Format'));

    // These should be present
    expect(screen.getByRole('option', { name: 'No Formatting' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Indian (1234567 => 12,34,567)' })
    ).toBeInTheDocument();

    // These should NOT be present (excluded for table charts)
    expect(screen.queryByRole('option', { name: 'Percentage (%)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Currency ($)' })).not.toBeInTheDocument();
  });

  it('should render new enhancement sections', () => {
    render(<TableChartCustomizations {...defaultProps} />);

    expect(screen.getByText('Conditional Formatting')).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
  });

  // Date Formatting Tests
  describe('Date Formatting', () => {
    const propsWithDateColumns = {
      ...defaultProps,
      availableDateColumns: ['created_at', 'updated_at'],
    };

    it('should render Date Formatting section when date columns are provided', () => {
      render(<TableChartCustomizations {...propsWithDateColumns} />);

      expect(screen.getByText('Date Formatting')).toBeInTheDocument();
      expect(screen.getByText('created_at')).toBeInTheDocument();
      expect(screen.getByText('updated_at')).toBeInTheDocument();
    });

    it('should expand/collapse date column and show DateFormatSection', async () => {
      const user = userEvent.setup();
      render(<TableChartCustomizations {...propsWithDateColumns} />);

      await user.click(screen.getByText('created_at'));
      expect(screen.getByLabelText('Date Format')).toBeInTheDocument();

      await user.click(screen.getByText('created_at'));
      expect(screen.queryByLabelText('Date Format')).not.toBeInTheDocument();
    });

    it('should auto-save date format configuration on dropdown change', async () => {
      const user = userEvent.setup();
      render(<TableChartCustomizations {...propsWithDateColumns} />);

      await user.click(screen.getByText('created_at'));

      const formatSelect = screen.getByLabelText('Date Format');
      await user.click(formatSelect);
      await user.click(screen.getByRole('option', { name: '%d/%m/%Y (14/01/2019)' }));

      expect(mockUpdateCustomization).toHaveBeenCalledWith('dateColumnFormatting', {
        created_at: { dateFormat: 'dd_mm_yyyy' },
      });
    });

    it('should display existing date customizations', () => {
      render(
        <TableChartCustomizations
          {...propsWithDateColumns}
          customizations={{
            dateColumnFormatting: { created_at: { dateFormat: 'dd_mm_yyyy' } },
          }}
        />
      );

      expect(screen.getByText('%d/%m/%Y')).toBeInTheDocument();
    });

    it('should handle remove date format button', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <TableChartCustomizations
          {...propsWithDateColumns}
          customizations={{
            dateColumnFormatting: {
              created_at: { dateFormat: 'dd_mm_yyyy' },
              updated_at: { dateFormat: 'iso_datetime' },
            },
          }}
        />
      );

      // Find the remove button in the Date Formatting section (second section)
      const dateSection = screen.getByText('Date Formatting').parentElement;
      const removeButton = dateSection?.querySelector('.lucide-refresh-cw')?.closest('button');
      await user.click(removeButton!);

      expect(mockUpdateCustomization).toHaveBeenCalledWith('dateColumnFormatting', {
        updated_at: { dateFormat: 'iso_datetime' },
      });
    });

    it('should show both Number and Date formatting sections when both column types exist', () => {
      render(<TableChartCustomizations {...propsWithDateColumns} />);

      expect(screen.getByText('Number Formatting')).toBeInTheDocument();
      expect(screen.getByText('Date Formatting')).toBeInTheDocument();
    });

    it('should show empty state for Number Formatting when no numeric columns exist', () => {
      render(
        <TableChartCustomizations
          {...defaultProps}
          availableColumns={[]}
          availableDateColumns={['created_at']}
        />
      );

      expect(screen.getByText('Number Formatting')).toBeInTheDocument();
      expect(screen.getByText('No numeric columns to format.')).toBeInTheDocument();
      expect(screen.getByText('Date Formatting')).toBeInTheDocument();
      expect(screen.getByText('created_at')).toBeInTheDocument();
    });
  });
});
