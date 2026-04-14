// Palette names as an enum so they can be referenced without magic strings
export enum ChartPaletteName {
  DEFAULT = 'Default',
  EARTH_TONES = 'Earth Tones',
  OCEAN = 'Ocean',
  SUNSET = 'Sunset',
  PASTEL = 'Pastel',
  VIBRANT = 'Vibrant',
  MONOCHROME = 'Monochrome',
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

export const PRESET_CHART_PALETTES: ChartPalette[] = [
  {
    name: ChartPaletteName.DEFAULT,
    colors: [
      { solid: '#3b82f6', light: '#dbeafe' },
      { solid: '#10b981', light: '#d1fae5' },
      { solid: '#f59e0b', light: '#fef3c7' },
      { solid: '#ef4444', light: '#fee2e2' },
      { solid: '#8b5cf6', light: '#ede9fe' },
      { solid: '#ec4899', light: '#fce7f3' },
      { solid: '#14b8a6', light: '#ccfbf1' },
      { solid: '#f97316', light: '#ffedd5' },
    ],
  },
  {
    name: ChartPaletteName.EARTH_TONES,
    colors: [
      { solid: '#8B6914', light: '#e8d5a3' },
      { solid: '#2E7D32', light: '#c8e6c9' },
      { solid: '#C75B12', light: '#f8cba8' },
      { solid: '#5D4037', light: '#d7ccc8' },
      { solid: '#00695C', light: '#b2dfdb' },
      { solid: '#BF360C', light: '#ffccbc' },
      { solid: '#827717', light: '#f9f0b6' },
      { solid: '#4E342E', light: '#d7bca8' },
    ],
  },
  {
    name: ChartPaletteName.OCEAN,
    colors: [
      { solid: '#0D47A1', light: '#bbdefb' },
      { solid: '#00838F', light: '#b2ebf2' },
      { solid: '#1565C0', light: '#c5cae9' },
      { solid: '#00ACC1', light: '#e0f7fa' },
      { solid: '#0277BD', light: '#b3e5fc' },
      { solid: '#4DD0E1', light: '#e0f7fa' },
      { solid: '#01579B', light: '#b3d4f7' },
      { solid: '#26C6DA', light: '#e0f7fa' },
    ],
  },
  {
    name: ChartPaletteName.SUNSET,
    colors: [
      { solid: '#E65100', light: '#ffe0b2' },
      { solid: '#F57C00', light: '#fff3e0' },
      { solid: '#FF8F00', light: '#fff8e1' },
      { solid: '#FFB300', light: '#fffde7' },
      { solid: '#D84315', light: '#fbe9e7' },
      { solid: '#FF7043', light: '#fbe9e7' },
      { solid: '#E64A19', light: '#fbe9e7' },
      { solid: '#FFAB40', light: '#fff3e0' },
    ],
  },
  {
    name: ChartPaletteName.PASTEL,
    colors: [
      { solid: '#90CAF9', light: '#e3f2fd' },
      { solid: '#A5D6A7', light: '#e8f5e9' },
      { solid: '#FFCC02', light: '#fffde7' },
      { solid: '#EF9A9A', light: '#fce4ec' },
      { solid: '#CE93D8', light: '#f3e5f5' },
      { solid: '#F48FB1', light: '#fce4ec' },
      { solid: '#80CBC4', light: '#e0f2f1' },
      { solid: '#FFAB91', light: '#fbe9e7' },
    ],
  },
  {
    name: ChartPaletteName.VIBRANT,
    colors: [
      { solid: '#D50000', light: '#ffcdd2' },
      { solid: '#304FFE', light: '#c5cae9' },
      { solid: '#00C853', light: '#ccff90' },
      { solid: '#FFAB00', light: '#fff8e1' },
      { solid: '#AA00FF', light: '#e1bee7' },
      { solid: '#00BFA5', light: '#ccfbf1' },
      { solid: '#FF6D00', light: '#ffe0b2' },
      { solid: '#6200EA', light: '#ede7f6' },
    ],
  },
  {
    name: ChartPaletteName.MONOCHROME,
    colors: [
      { solid: '#212121', light: '#f5f5f5' },
      { solid: '#424242', light: '#eeeeee' },
      { solid: '#616161', light: '#e0e0e0' },
      { solid: '#757575', light: '#f5f5f5' },
      { solid: '#9E9E9E', light: '#fafafa' },
      { solid: '#BDBDBD', light: '#fafafa' },
      { solid: '#E0E0E0', light: '#f5f5f5' },
      { solid: '#F5F5F5', light: '#ffffff' },
    ],
  },
];

// Default palette solid colors — used as the ultimate fallback across all chart renderers
export const DEFAULT_CHART_PALETTE_COLORS: string[] = getSolidColors(
  PRESET_CHART_PALETTES[0].colors
);
