import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChartColorSwatchGrid } from '../ChartColorSwatchGrid';
import { PRESET_CHART_PALETTES } from '@/constants/chart-palettes';

describe('ChartColorSwatchGrid', () => {
  const mockOnSelect = jest.fn();
  const firstColor = PRESET_CHART_PALETTES[0].colors[0];

  beforeEach(() => jest.clearAllMocks());

  it('renders a swatch for every color across all palettes', () => {
    render(<ChartColorSwatchGrid onSelect={mockOnSelect} />);
    const total = PRESET_CHART_PALETTES.reduce((sum, p) => sum + p.colors.length, 0);
    const swatches = screen
      .getAllByRole('button')
      .filter((btn) => btn.dataset.testid?.startsWith('color-swatch-'));
    expect(swatches.length).toBe(total);
  });

  it('calls onSelect with the clicked PaletteColor', async () => {
    const user = userEvent.setup();
    render(<ChartColorSwatchGrid onSelect={mockOnSelect} />);

    await user.click(screen.getByTestId(`color-swatch-${firstColor.solid.replace('#', '')}`));
    expect(mockOnSelect).toHaveBeenCalledWith(firstColor);
  });

  it('shows reset button only when a color is selected', () => {
    const { rerender } = render(<ChartColorSwatchGrid onSelect={mockOnSelect} />);
    expect(screen.queryByTestId('color-swatch-clear')).not.toBeInTheDocument();

    rerender(<ChartColorSwatchGrid selectedSolid={firstColor.solid} onSelect={mockOnSelect} />);
    expect(screen.getByTestId('color-swatch-clear')).toBeInTheDocument();
  });

  it('does not call onSelect when disabled', async () => {
    const user = userEvent.setup();
    render(<ChartColorSwatchGrid onSelect={mockOnSelect} disabled />);

    await user.click(screen.getByTestId(`color-swatch-${firstColor.solid.replace('#', '')}`));
    expect(mockOnSelect).not.toHaveBeenCalled();
  });
});
