// Palette names as an enum so they can be referenced without magic strings
export enum ChartPaletteName {
  DEFAULT = 'Default',
  DALGO = 'Dalgo',
  VIBRANT = 'Vibrant',
  BLUE_GRADIENT = 'Blue Gradient',
  GREEN_GRADIENT = 'Green Gradient',
  WARM_GRADIENT = 'Warm Gradient',
  PURPLE_GRADIENT = 'Purple Gradient',
  NEUTRAL_GRADIENT = 'Neutral Gradient',
}

export interface PaletteColor {
  solid: string;
  /**
   * Lighter tint of the solid color.
   * Used exclusively by map chart choropleth — defines the low end of the
   * visualMap gradient range [light → solid]. Never shown in the palette picker UI.
   */
  light: string;
}

export interface ChartPalette {
  name: ChartPaletteName;
  colors: PaletteColor[];
}

// Returns only the solid hex values — used for bar/line/pie ECharts color array
export function getSolidColors(colors: PaletteColor[]): string[] {
  return colors.map((c) => c.solid);
}

// Returns the [light, solid] tuple for ECharts visualMap inRange.color on map charts
export function getMapColorRange(color: PaletteColor): [string, string] {
  return [color.light, color.solid];
}

/**
 * Blend a hex color with white to produce a light tint.
 * opacity=0 → pure white, opacity=1 → original color.
 * Default 0.2 gives an 80%-white, 20%-color tint suitable for map choropleth.
 */
export function blendWithWhite(hex: string, opacity: number = 0.2): string {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return '#f5f5f5';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(255 - (255 - r) * opacity);
  const lg = Math.round(255 - (255 - g) * opacity);
  const lb = Math.round(255 - (255 - b) * opacity);
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}

function createPalette(name: ChartPaletteName, solidColors: string[]): ChartPalette {
  return {
    name,
    colors: solidColors.map((solid) => ({
      solid,
      light: blendWithWhite(solid, 0.22),
    })),
  };
}

export const PRESET_CHART_PALETTES: ChartPalette[] = [
  createPalette(ChartPaletteName.DEFAULT, [
    '#4285F4',
    '#DB4437',
    '#F4B400',
    '#0F9D58',
    '#AB47BC',
    '#00ACC1',
    '#FF7043',
    '#9AA0A6',
  ]),
  createPalette(ChartPaletteName.DALGO, [
    '#00897B',
    '#0F2440',
    '#1F6AA5',
    '#39A0C8',
    '#6EC9C2',
    '#F4A261',
    '#E76F51',
    '#8A94A6',
  ]),
  createPalette(ChartPaletteName.VIBRANT, [
    '#118DFF',
    '#12239E',
    '#E66C37',
    '#6B007B',
    '#E044A7',
    '#744EC2',
    '#D9B300',
    '#D64550',
  ]),
  createPalette(ChartPaletteName.BLUE_GRADIENT, [
    '#DCEBFA',
    '#B6D3F5',
    '#8EBBED',
    '#649FE2',
    '#447FD4',
    '#2F62B8',
    '#224A8E',
    '#173467',
  ]),
  createPalette(ChartPaletteName.GREEN_GRADIENT, [
    '#DDF4E4',
    '#B7E4C7',
    '#8FD3A6',
    '#65C083',
    '#3FA968',
    '#238A4A',
    '#186B38',
    '#114A29',
  ]),
  createPalette(ChartPaletteName.WARM_GRADIENT, [
    '#FCE7D6',
    '#F8C99F',
    '#F3A96E',
    '#EC8844',
    '#E16A2D',
    '#C9501F',
    '#A63B19',
    '#7A2814',
  ]),
  createPalette(ChartPaletteName.PURPLE_GRADIENT, [
    '#F0E5FA',
    '#DCC5F1',
    '#C6A1E6',
    '#AE7AD8',
    '#9456C7',
    '#7938B0',
    '#5E2887',
    '#411B5E',
  ]),
  createPalette(ChartPaletteName.NEUTRAL_GRADIENT, [
    '#F4F5F7',
    '#DBDEE3',
    '#C0C6CF',
    '#A3ABB7',
    '#808A98',
    '#646D7A',
    '#4A515C',
    '#2F343C',
  ]),
];

// Default palette solid colors — used as the ultimate fallback across all chart renderers
export const DEFAULT_CHART_PALETTE_COLORS: string[] = getSolidColors(
  PRESET_CHART_PALETTES[0].colors
);
