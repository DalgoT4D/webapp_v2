import {
  escapeHtml,
  getMapValueRange,
  lightenColor,
} from '@/components/charts/chart-types/map/map-scale';

describe('map scale helpers', () => {
  it('escapeHtml escapes the six characters', () => {
    expect(escapeHtml(`<a href="x">'&'/</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&#x2F;&lt;&#x2F;a&gt;'
    );
  });

  it('lightenColor moves each channel towards white', () => {
    expect(lightenColor('#1f77b4', 0.4)).toBe('#78add2');
    expect(lightenColor('#000000', 0)).toBe('#000000');
    expect(lightenColor('#ffffff', 0.5)).toBe('#ffffff');
  });

  it('value range: min/max, defaults 0–100 without data', () => {
    expect(getMapValueRange([3, 9, 5])).toEqual({ minValue: 3, maxValue: 9 });
    expect(getMapValueRange([])).toEqual({ minValue: 0, maxValue: 100 });
  });

  it('a single value is stretched to zero', () => {
    expect(getMapValueRange([7, 7])).toEqual({ minValue: 0, maxValue: 7 });
    expect(getMapValueRange([-4])).toEqual({ minValue: -4, maxValue: 0 });
    expect(getMapValueRange([0])).toEqual({ minValue: -1, maxValue: 1 });
  });
});
