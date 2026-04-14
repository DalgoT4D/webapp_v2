/**
 * DateFormatSection Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateFormatSection, DATE_FORMAT_OPTIONS } from '../shared/DateFormatSection';

describe('DateFormatSection', () => {
  const mockOnDateFormatChange = jest.fn();

  const defaultProps = {
    idPrefix: 'table-date-column1',
    dateFormat: undefined,
    onDateFormatChange: mockOnDateFormatChange,
    disabled: false,
  };

  beforeEach(() => jest.clearAllMocks());

  it('should render date format dropdown', () => {
    render(<DateFormatSection {...defaultProps} />);

    expect(screen.getByLabelText('Date Format')).toBeInTheDocument();
  });

  it('should use correct ID based on idPrefix', () => {
    render(<DateFormatSection {...defaultProps} idPrefix="table-date-created_at" />);

    expect(screen.getByLabelText('Date Format')).toHaveAttribute(
      'id',
      'table-date-created_atDateFormat'
    );
  });

  it('should display default value when no value provided', () => {
    render(<DateFormatSection {...defaultProps} />);

    // The combobox should show "No Formatting" as default
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should call onDateFormatChange when format is selected', async () => {
    const user = userEvent.setup();
    render(<DateFormatSection {...defaultProps} />);

    await user.click(screen.getByLabelText('Date Format'));
    await user.click(screen.getByRole('option', { name: '%d/%m/%Y (14/01/2019)' }));

    expect(mockOnDateFormatChange).toHaveBeenCalledWith('dd_mm_yyyy');
  });

  it('should disable controls when disabled is true', () => {
    render(<DateFormatSection {...defaultProps} disabled={true} />);

    // The select trigger should be disabled
    expect(screen.getByRole('combobox')).toHaveAttribute('data-disabled');
  });

  it('should not show description by default', () => {
    render(<DateFormatSection {...defaultProps} />);

    expect(screen.queryByText('Applied to date/timestamp columns')).not.toBeInTheDocument();
  });

  it('should show description when showDescription is true', () => {
    render(<DateFormatSection {...defaultProps} showDescription={true} />);

    expect(screen.getByText('Applied to date/timestamp columns')).toBeInTheDocument();
  });

  it('should show custom description when provided', () => {
    render(
      <DateFormatSection
        {...defaultProps}
        showDescription={true}
        description="Custom date description"
      />
    );

    expect(screen.getByText('Custom date description')).toBeInTheDocument();
  });

  it('should have all expected format options', async () => {
    const user = userEvent.setup();
    render(<DateFormatSection {...defaultProps} />);

    await user.click(screen.getByLabelText('Date Format'));

    // Check all options are present
    for (const option of DATE_FORMAT_OPTIONS) {
      expect(screen.getByRole('option', { name: option.label })).toBeInTheDocument();
    }
  });

  it('should exclude specified formats when excludeFormats is provided', async () => {
    const user = userEvent.setup();
    render(<DateFormatSection {...defaultProps} excludeFormats={['time_only']} />);

    await user.click(screen.getByLabelText('Date Format'));

    // These should be present
    expect(screen.getByRole('option', { name: 'No Formatting' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '%d/%m/%Y (14/01/2019)' })).toBeInTheDocument();

    // This should NOT be present
    expect(screen.queryByRole('option', { name: '%H:%M:%S (01:32:10)' })).not.toBeInTheDocument();
  });

  it('should select iso_datetime format correctly', async () => {
    const user = userEvent.setup();
    render(<DateFormatSection {...defaultProps} />);

    await user.click(screen.getByLabelText('Date Format'));
    await user.click(
      screen.getByRole('option', { name: '%Y-%m-%d %H:%M:%S (2019-01-14 01:32:10)' })
    );

    expect(mockOnDateFormatChange).toHaveBeenCalledWith('iso_datetime');
  });

  it('should select yyyy_mm_dd format correctly', async () => {
    const user = userEvent.setup();
    render(<DateFormatSection {...defaultProps} />);

    await user.click(screen.getByLabelText('Date Format'));
    await user.click(screen.getByRole('option', { name: '%Y-%m-%d (2019-01-14)' }));

    expect(mockOnDateFormatChange).toHaveBeenCalledWith('yyyy_mm_dd');
  });
});
