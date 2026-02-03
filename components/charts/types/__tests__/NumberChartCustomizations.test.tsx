/**
 * NumberChartCustomizations Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumberChartCustomizations } from '../number/NumberChartCustomizations';

describe('NumberChartCustomizations', () => {
  const mockUpdateCustomization = jest.fn();
  const defaultProps = {
    customizations: {},
    updateCustomization: mockUpdateCustomization,
    disabled: false,
  };

  beforeEach(() => jest.clearAllMocks());

  it('should render all sections and default options', () => {
    render(<NumberChartCustomizations {...defaultProps} />);

    // Sections
    expect(screen.getByText('Display Options')).toBeInTheDocument();
    expect(screen.getByText('Number Formatting')).toBeInTheDocument();
    expect(screen.getByText('Prefix & Suffix')).toBeInTheDocument();

    // Default values
    expect(screen.getByLabelText('Medium')).toBeChecked();
    expect(screen.getByLabelText('Subtitle')).toBeInTheDocument();
    expect(screen.getByLabelText('Number Format')).toBeInTheDocument();
    expect(screen.getByLabelText('Decimal Places')).toHaveValue(0);
  });

  it('should handle size selection and subtitle input', async () => {
    const user = userEvent.setup();
    render(<NumberChartCustomizations {...defaultProps} />);

    await user.click(screen.getByLabelText('Large'));
    expect(mockUpdateCustomization).toHaveBeenCalledWith('numberSize', 'large');

    mockUpdateCustomization.mockClear();
    await user.click(screen.getByLabelText('Small'));
    expect(mockUpdateCustomization).toHaveBeenCalledWith('numberSize', 'small');

    mockUpdateCustomization.mockClear();
    const subtitleInput = screen.getByLabelText('Subtitle');
    await user.type(subtitleInput, 'T');
    expect(mockUpdateCustomization).toHaveBeenCalledWith('subtitle', 'T');
  });

  it('should handle number formatting options', () => {
    render(<NumberChartCustomizations {...defaultProps} customizations={{ decimalPlaces: 2 }} />);

    expect(screen.getByLabelText('Decimal Places')).toHaveValue(2);
    expect(screen.getByText('Number of digits after decimal point (0-10)')).toBeInTheDocument();
  });

  it('should handle prefix and suffix inputs', async () => {
    const user = userEvent.setup();
    render(
      <NumberChartCustomizations
        {...defaultProps}
        customizations={{ numberPrefix: '$', numberSuffix: 'M' }}
      />
    );

    expect(screen.getByDisplayValue('$')).toBeInTheDocument();
    expect(screen.getByDisplayValue('M')).toBeInTheDocument();
    expect(screen.getByText('Text that appears before the number')).toBeInTheDocument();
    expect(screen.getByText('Text that appears after the number')).toBeInTheDocument();

    const prefixInput = screen.getByLabelText('Prefix');
    await user.type(prefixInput, '€');
    expect(mockUpdateCustomization).toHaveBeenCalledWith('numberPrefix', '$€');
  });

  it('should display existing customization values', () => {
    render(
      <NumberChartCustomizations
        {...defaultProps}
        customizations={{
          numberSize: 'large',
          subtitle: 'Total Users',
          decimalPlaces: 2,
        }}
      />
    );

    expect(screen.getByLabelText('Large')).toBeChecked();
    expect(screen.getByDisplayValue('Total Users')).toBeInTheDocument();
    expect(screen.getByLabelText('Decimal Places')).toHaveValue(2);
  });

  it('should disable all controls when disabled is true', () => {
    render(<NumberChartCustomizations {...defaultProps} disabled={true} />);

    screen.getAllByRole('radio').forEach((r) => expect(r).toBeDisabled());
    screen.getAllByRole('textbox').forEach((i) => expect(i).toBeDisabled());
    expect(screen.getByLabelText('Decimal Places')).toBeDisabled();
  });
});
