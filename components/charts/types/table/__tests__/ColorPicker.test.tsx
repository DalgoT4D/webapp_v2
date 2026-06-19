import { render, screen, fireEvent } from '@testing-library/react';
import { ColorPicker } from '../ColorPicker';

describe('ColorPicker', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders 7 preset color swatches', () => {
    render(<ColorPicker value="#C8E6C9" onChange={mockOnChange} />);
    const swatches = screen.getAllByTestId(/^color-swatch-/);
    expect(swatches).toHaveLength(7);
  });

  it('calls onChange when a preset swatch is clicked', () => {
    render(<ColorPicker value="" onChange={mockOnChange} />);
    const firstSwatch = screen.getByTestId('color-swatch-0');
    fireEvent.click(firstSwatch);
    expect(mockOnChange).toHaveBeenCalledWith('#C8E6C9');
  });

  it('shows selected state on the active color', () => {
    render(<ColorPicker value="#C8E6C9" onChange={mockOnChange} />);
    const firstSwatch = screen.getByTestId('color-swatch-0');
    expect(firstSwatch.className).toContain('ring-2');
  });

  it('does not call onChange when disabled', () => {
    render(<ColorPicker value="" onChange={mockOnChange} disabled />);
    const firstSwatch = screen.getByTestId('color-swatch-0');
    fireEvent.click(firstSwatch);
    expect(mockOnChange).not.toHaveBeenCalled();
  });
});
