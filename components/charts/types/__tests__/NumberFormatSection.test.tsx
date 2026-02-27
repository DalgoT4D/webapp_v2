/**
 * NumberFormatSection Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumberFormatSection, NUMBER_FORMAT_OPTIONS } from '../shared/NumberFormatSection';

describe('NumberFormatSection', () => {
  const mockOnNumberFormatChange = jest.fn();
  const mockOnDecimalPlacesChange = jest.fn();

  const defaultProps = {
    idPrefix: 'yAxis',
    numberFormat: undefined,
    decimalPlaces: undefined,
    onNumberFormatChange: mockOnNumberFormatChange,
    onDecimalPlacesChange: mockOnDecimalPlacesChange,
    disabled: false,
  };

  beforeEach(() => jest.clearAllMocks());

  it('should render number format dropdown and decimal places input', () => {
    render(<NumberFormatSection {...defaultProps} />);

    expect(screen.getByLabelText('Number Format')).toBeInTheDocument();
    expect(screen.getByLabelText('Decimal Places')).toBeInTheDocument();
  });

  it('should use correct IDs based on idPrefix', () => {
    render(<NumberFormatSection {...defaultProps} idPrefix="xAxis" />);

    expect(screen.getByLabelText('Number Format')).toHaveAttribute('id', 'xAxisNumberFormat');
    expect(screen.getByLabelText('Decimal Places')).toHaveAttribute('id', 'xAxisDecimalPlaces');
  });

  it('should display default values when no values provided', () => {
    render(<NumberFormatSection {...defaultProps} />);

    // Decimal places defaults to 0
    expect(screen.getByLabelText('Decimal Places')).toHaveValue(0);
  });

  it('should display provided values', () => {
    render(<NumberFormatSection {...defaultProps} numberFormat="indian" decimalPlaces={2} />);

    expect(screen.getByLabelText('Decimal Places')).toHaveValue(2);
  });

  it('should call onNumberFormatChange when format is selected', async () => {
    const user = userEvent.setup();
    render(<NumberFormatSection {...defaultProps} />);

    await user.click(screen.getByLabelText('Number Format'));
    await user.click(screen.getByRole('option', { name: 'Indian (1234567 => 12,34,567)' }));

    expect(mockOnNumberFormatChange).toHaveBeenCalledWith('indian');
  });

  it('should call onDecimalPlacesChange when decimal places changes', async () => {
    const user = userEvent.setup();
    render(<NumberFormatSection {...defaultProps} decimalPlaces={0} />);

    const decimalInput = screen.getByLabelText('Decimal Places');
    await user.clear(decimalInput);
    await user.type(decimalInput, '3');

    expect(mockOnDecimalPlacesChange).toHaveBeenCalledWith(3);
  });

  it('should clamp decimal places between 0 and 10', async () => {
    const user = userEvent.setup();
    render(<NumberFormatSection {...defaultProps} decimalPlaces={5} />);

    const decimalInput = screen.getByLabelText('Decimal Places');

    // Try to enter 15
    await user.clear(decimalInput);
    await user.type(decimalInput, '1');
    await user.type(decimalInput, '5');

    // Last call should be clamped to 10
    const calls = mockOnDecimalPlacesChange.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[0]).toBeLessThanOrEqual(10);
  });

  it('should disable controls when disabled is true', () => {
    render(<NumberFormatSection {...defaultProps} disabled={true} />);

    expect(screen.getByLabelText('Decimal Places')).toBeDisabled();
    // The select trigger should be disabled
    expect(screen.getByRole('combobox')).toHaveAttribute('data-disabled');
  });

  it('should not show description by default', () => {
    render(<NumberFormatSection {...defaultProps} />);

    expect(
      screen.queryByText('Applied to axis labels, data labels, and tooltips')
    ).not.toBeInTheDocument();
  });

  it('should show description when showDescription is true', () => {
    render(<NumberFormatSection {...defaultProps} showDescription={true} />);

    expect(
      screen.getByText('Applied to axis labels, data labels, and tooltips')
    ).toBeInTheDocument();
  });

  it('should show custom description when provided', () => {
    render(
      <NumberFormatSection
        {...defaultProps}
        showDescription={true}
        description="Custom description text"
      />
    );

    expect(screen.getByText('Custom description text')).toBeInTheDocument();
  });

  it('should always show decimal places helper text', () => {
    render(<NumberFormatSection {...defaultProps} />);

    expect(screen.getByText('Number of digits after decimal point (0-10)')).toBeInTheDocument();
  });

  it('should have all expected format options', async () => {
    const user = userEvent.setup();
    render(<NumberFormatSection {...defaultProps} />);

    await user.click(screen.getByLabelText('Number Format'));

    // Check all options are present
    for (const option of NUMBER_FORMAT_OPTIONS) {
      expect(screen.getByRole('option', { name: option.label })).toBeInTheDocument();
    }
  });

  it('should handle empty decimal input gracefully', async () => {
    const user = userEvent.setup();
    render(<NumberFormatSection {...defaultProps} decimalPlaces={5} />);

    const decimalInput = screen.getByLabelText('Decimal Places');
    await user.clear(decimalInput);

    // Should default to 0 when empty
    expect(mockOnDecimalPlacesChange).toHaveBeenCalledWith(0);
  });

  it('should exclude specified formats when excludeFormats is provided', async () => {
    const user = userEvent.setup();
    render(<NumberFormatSection {...defaultProps} excludeFormats={['percentage', 'currency']} />);

    await user.click(screen.getByLabelText('Number Format'));

    // These should be present
    expect(screen.getByRole('option', { name: 'No Formatting' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Indian (1234567 => 12,34,567)' })
    ).toBeInTheDocument();

    // These should NOT be present
    expect(screen.queryByRole('option', { name: 'Percentage (%)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Currency ($)' })).not.toBeInTheDocument();
  });
});
