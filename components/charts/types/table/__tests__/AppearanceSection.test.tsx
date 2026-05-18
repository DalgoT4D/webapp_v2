import { render, screen, fireEvent } from '@testing-library/react';
import { AppearanceSection } from '../AppearanceSection';

describe('AppearanceSection', () => {
  const defaultProps = {
    zebraRows: false,
    freezeFirstColumn: false,
    onZebraRowsChange: jest.fn(),
    onFreezeFirstColumnChange: jest.fn(),
  };

  beforeEach(() => {
    defaultProps.onZebraRowsChange.mockClear();
    defaultProps.onFreezeFirstColumnChange.mockClear();
  });

  it('renders section heading', () => {
    render(<AppearanceSection {...defaultProps} />);
    expect(screen.getByText('Appearance')).toBeInTheDocument();
  });

  it('renders zebra rows toggle', () => {
    render(<AppearanceSection {...defaultProps} />);
    expect(screen.getByTestId('zebra-rows-switch')).toBeInTheDocument();
  });

  it('renders freeze first column toggle', () => {
    render(<AppearanceSection {...defaultProps} />);
    expect(screen.getByTestId('freeze-column-switch')).toBeInTheDocument();
  });

  it('calls onZebraRowsChange when toggled', () => {
    render(<AppearanceSection {...defaultProps} />);
    fireEvent.click(screen.getByTestId('zebra-rows-switch'));
    expect(defaultProps.onZebraRowsChange).toHaveBeenCalledWith(true);
  });

  it('calls onFreezeFirstColumnChange when toggled', () => {
    render(<AppearanceSection {...defaultProps} />);
    fireEvent.click(screen.getByTestId('freeze-column-switch'));
    expect(defaultProps.onFreezeFirstColumnChange).toHaveBeenCalledWith(true);
  });
});
