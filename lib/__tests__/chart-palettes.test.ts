import {
  PRESET_CHART_PALETTES,
  DEFAULT_CHART_PALETTE_COLORS,
  getSolidColors,
  blendWithWhite,
} from '@/constants/chart-palettes';

describe('chart-palettes', () => {
  it('should have 7 palettes each with 8 colors', () => {
    expect(PRESET_CHART_PALETTES).toHaveLength(7);
    PRESET_CHART_PALETTES.forEach((p) => expect(p.colors).toHaveLength(8));
  });

  it('every color should have valid solid and light hex values', () => {
    const hexRegex = /^#[0-9a-fA-F]{6}$/;
    PRESET_CHART_PALETTES.forEach((palette) => {
      palette.colors.forEach((color) => {
        expect(color.solid).toMatch(hexRegex);
        expect(color.light).toMatch(hexRegex);
      });
    });
  });

  it('DEFAULT_CHART_PALETTE_COLORS matches solid colors of first palette', () => {
    expect(DEFAULT_CHART_PALETTE_COLORS).toEqual(getSolidColors(PRESET_CHART_PALETTES[0].colors));
  });

  describe('blendWithWhite', () => {
    it('returns white for opacity 0', () => {
      expect(blendWithWhite('#ff0000', 0)).toBe('#ffffff');
    });

    it('returns the original color for opacity 1', () => {
      expect(blendWithWhite('#3b82f6', 1)).toBe('#3b82f6');
    });

    it('returns a valid 6-char hex for normal input', () => {
      expect(blendWithWhite('#1f77b4', 0.2)).toMatch(/^#[0-9a-f]{6}$/);
    });

    it('returns fallback for invalid hex', () => {
      expect(blendWithWhite('')).toBe('#f5f5f5');
      expect(blendWithWhite('notahex')).toBe('#f5f5f5');
    });
  });
});
