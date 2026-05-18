import { render, screen, fireEvent } from '@testing-library/react';
import { ColorPicker } from '../ColorPicker';

describe('ColorPicker', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders 8 preset color swatches', () => {
    render(<ColorPicker value="#C8E6C9" onChange={mockOnChange} />);
    const swatches = screen.getAllByTestId(/^color-swatch-/);
    expect(swatches).toHaveLength(8);
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

  it('renders hex input field', () => {
    render(<ColorPicker value="#C8E6C9" onChange={mockOnChange} />);
    const input = screen.getByTestId('color-hex-input');
    expect(input).toBeInTheDocument();
  });

  it('calls onChange with valid hex from input', () => {
    render(<ColorPicker value="#C8E6C9" onChange={mockOnChange} />);
    const input = screen.getByTestId('color-hex-input');
    fireEvent.change(input, { target: { value: '#AABBCC' } });
    fireEvent.blur(input);
    expect(mockOnChange).toHaveBeenCalledWith('#AABBCC');
  });

  it('does not call onChange with invalid hex', () => {
    render(<ColorPicker value="#C8E6C9" onChange={mockOnChange} />);
    const input = screen.getByTestId('color-hex-input');
    fireEvent.change(input, { target: { value: 'invalid' } });
    fireEvent.blur(input);
    expect(mockOnChange).not.toHaveBeenCalled();
  });
});
