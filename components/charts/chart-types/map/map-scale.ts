/** HTML-escape text placed in map tooltip HTML. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');
}

/** A lighter shade of a #rrggbb color (percent 0–1 towards white), for hover emphasis. */
export function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * percent));
  const g = Math.min(
    255,
    Math.floor(((num >> 8) & 0x00ff) + (255 - ((num >> 8) & 0x00ff)) * percent)
  );
  const b = Math.min(255, Math.floor((num & 0x0000ff) + (255 - (num & 0x0000ff)) * percent));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Min/max for the color scale; a single value is stretched to 0 so it still gets a color. */
export function getMapValueRange(values: number[]): { minValue: number; maxValue: number } {
  let minValue = values.length > 0 ? Math.min(...values) : 0;
  let maxValue = values.length > 0 ? Math.max(...values) : 100;
  const hasSingleValue = minValue === maxValue && values.length > 0;
  if (hasSingleValue) {
    if (maxValue > 0) {
      minValue = 0;
    } else if (maxValue < 0) {
      maxValue = 0;
    } else {
      minValue = -1;
      maxValue = 1;
    }
  }
  return { minValue, maxValue };
}
