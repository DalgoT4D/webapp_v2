import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChartPaletteSelector } from '../ChartPaletteSelector';
import { PRESET_CHART_PALETTES, getSolidColors } from '@/constants/chart-palettes';
import { TestWrapper } from '@/test-utils/render';

const mockUseDashboardBranding = jest.fn();
jest.mock('@/hooks/api/useDashboardBranding', () => ({
  useDashboardBranding: () => mockUseDashboardBranding(),
}));

describe('ChartPaletteSelector', () => {
  const mockOnSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDashboardBranding.mockReturnValue({ branding: null });
  });

  const renderComponent = (props = {}) =>
    render(
      <TestWrapper>
        <ChartPaletteSelector onSelect={mockOnSelect} {...props} />
      </TestWrapper>
    );

  it('highlights Default preset when no selection and no custom org palette', () => {
    renderComponent({ selectedColors: null });
    // Org Default row should NOT appear — no custom branding
    expect(screen.queryByTestId('palette-org-default')).not.toBeInTheDocument();
    // Default preset row should be highlighted
    expect(screen.getByTestId('palette-default').className).toContain('border-blue-500');
  });

  it('shows and highlights Org Default row when org has custom palette and no selection', () => {
    mockUseDashboardBranding.mockReturnValue({
      branding: { chart_palette_colors: ['#aabbcc', '#112233'], chart_palette_name: 'Custom' },
    });
    renderComponent({ selectedColors: null });
    expect(screen.getByTestId('palette-org-default').className).toContain('border-blue-500');
  });

  it('marks the matching preset as active when selectedColors matches it', () => {
    const palette = PRESET_CHART_PALETTES[1];
    renderComponent({ selectedColors: getSolidColors(palette.colors) });

    const testId = `palette-${palette.name.toLowerCase().replace(/\s/g, '-')}`;
    expect(screen.getByTestId(testId).className).toContain('border-blue-500');
    // Default preset should not be highlighted
    expect(screen.getByTestId('palette-default').className).not.toContain('border-blue-500');
  });

  it('calls onSelect with solid colors when a preset palette is clicked', async () => {
    const user = userEvent.setup();
    renderComponent();

    const palette = PRESET_CHART_PALETTES[2];
    const testId = `palette-${palette.name.toLowerCase().replace(/\s/g, '-')}`;
    await user.click(screen.getByTestId(testId));
    expect(mockOnSelect).toHaveBeenCalledWith(getSolidColors(palette.colors));
  });

  it('calls onSelect(null) when Org Default row is clicked', async () => {
    mockUseDashboardBranding.mockReturnValue({
      branding: { chart_palette_colors: ['#aabbcc'], chart_palette_name: 'Custom' },
    });
    const user = userEvent.setup();
    renderComponent({ selectedColors: getSolidColors(PRESET_CHART_PALETTES[0].colors) });

    await user.click(screen.getByTestId('palette-org-default'));
    expect(mockOnSelect).toHaveBeenCalledWith(null);
  });
});
