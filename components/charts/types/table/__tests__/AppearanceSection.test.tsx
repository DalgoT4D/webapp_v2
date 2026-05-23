import { render, screen, fireEvent } from '@testing-library/react';
import { AppearanceSection } from '../AppearanceSection';

describe('AppearanceSection', () => {
  const defaultProps = {
    zebraRows: false,
    onZebraRowsChange: jest.fn(),
  };

  beforeEach(() => {
    defaultProps.onZebraRowsChange.mockClear();
  });

  it('renders zebra rows toggle', () => {
    render(<AppearanceSection {...defaultProps} />);
    expect(screen.getByTestId('zebra-rows-switch')).toBeInTheDocument();
  });

  it('calls onZebraRowsChange when toggled', () => {
    render(<AppearanceSection {...defaultProps} />);
    fireEvent.click(screen.getByTestId('zebra-rows-switch'));
    expect(defaultProps.onZebraRowsChange).toHaveBeenCalledWith(true);
  });
});
