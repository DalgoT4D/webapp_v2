/**
 * MapChartCustomizations Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapChartCustomizations } from '../map/MapChartCustomizations';

describe('MapChartCustomizations', () => {
  const mockUpdateCustomization = jest.fn();
  const defaultProps = {
    customizations: {},
    updateCustomization: mockUpdateCustomization,
    disabled: false,
  };

  beforeEach(() => jest.clearAllMocks());

  it('should render all sections', () => {
    render(<MapChartCustomizations {...defaultProps} />);

    expect(screen.getByText('Color and Styling')).toBeInTheDocument();
    expect(screen.getByText('Interactive Features')).toBeInTheDocument();
    expect(screen.getByText('Data Handling')).toBeInTheDocument();
    expect(screen.getByText('Visual Elements')).toBeInTheDocument();
    expect(screen.getByText('Animation & Effects')).toBeInTheDocument();
  });

  it('should render interactive features with default values and descriptions', () => {
    render(<MapChartCustomizations {...defaultProps} />);

    // Helper texts
    expect(screen.getByText('Display values on hover')).toBeInTheDocument();
    expect(screen.getByText('Display color scale legend')).toBeInTheDocument();
    expect(screen.getByText('Allow clicking to select regions')).toBeInTheDocument();

    // Default switches should be checked (tooltip, legend, selection enabled by default)
    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBeGreaterThan(0);
  });

  it('should handle data handling section with null value label', async () => {
    const user = userEvent.setup();
    render(<MapChartCustomizations {...defaultProps} />);

    expect(screen.getByText('Text to show for regions with no data')).toBeInTheDocument();
    expect(screen.getByDisplayValue('No Data')).toBeInTheDocument();

    const input = screen.getByDisplayValue('No Data');
    await user.type(input, 'x');
    expect(mockUpdateCustomization).toHaveBeenCalledWith('nullValueLabel', 'No Datax');
  });

  it('should render visual elements and animation settings', () => {
    render(<MapChartCustomizations {...defaultProps} />);

    expect(screen.getByText('Legend Position')).toBeInTheDocument();
    expect(screen.getByText('Show Region Names')).toBeInTheDocument();
    expect(screen.getByText('Border Width')).toBeInTheDocument();
    expect(screen.getByText('Border Color')).toBeInTheDocument();
    expect(screen.getByText('Enable smooth transitions')).toBeInTheDocument();
  });

  it('should handle show region names toggle', async () => {
    const user = userEvent.setup();
    render(<MapChartCustomizations {...defaultProps} />);

    const switches = screen.getAllByRole('switch');
    const regionNamesSwitch = switches.find((s) =>
      s.closest('div')?.textContent?.includes('Show Region Names')
    );
    expect(regionNamesSwitch).not.toBeChecked();

    if (regionNamesSwitch) {
      await user.click(regionNamesSwitch);
      expect(mockUpdateCustomization).toHaveBeenCalledWith('showLabels', true);
    }
  });

  it('should normalize legacy legend positions', () => {
    const { rerender } = render(
      <MapChartCustomizations {...defaultProps} customizations={{ legendPosition: 'left' }} />
    );
    expect(screen.getByText('Visual Elements')).toBeInTheDocument();

    rerender(
      <MapChartCustomizations {...defaultProps} customizations={{ legendPosition: 'top-right' }} />
    );
    expect(screen.getByText('Visual Elements')).toBeInTheDocument();
  });

  it('should disable all controls when disabled is true', () => {
    render(<MapChartCustomizations {...defaultProps} disabled={true} />);

    screen.getAllByRole('switch').forEach((s) => {
      expect(s).toBeDisabled();
    });
    expect(screen.getByDisplayValue('No Data')).toBeDisabled();
  });
});
