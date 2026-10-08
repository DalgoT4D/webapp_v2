import { generateDefaultChartName } from '@/components/charts/logic/default-name';

describe('generateDefaultChartName', () => {
  it('names known types', () => {
    expect(generateDefaultChartName('bar', 'students')).toMatch(
      /^Bar chart - students \w{3} \d{1,2}, \d{1,2}:\d{2}[\s ](AM|PM)$/
    );
    expect(generateDefaultChartName('line', 't')).toMatch(/^Line chart - t /);
    expect(generateDefaultChartName('pie', 't')).toMatch(/^Pie chart - t /);
    expect(generateDefaultChartName('number', 't')).toMatch(/^Number card - t /);
    expect(generateDefaultChartName('map', 't')).toMatch(/^Map chart - t /);
  });

  it('falls back to "Chart" for table and pivot (no type name today)', () => {
    expect(generateDefaultChartName('table', 't')).toMatch(/^Chart - t /);
    expect(generateDefaultChartName('pivot_table', 't')).toMatch(/^Chart - t /);
  });
});
