/** Display names used in auto-generated titles. Table and pivot have none today and fall back to "Chart". */
const TYPE_NAMES: Record<string, string> = {
  bar: 'Bar chart',
  line: 'Line chart',
  pie: 'Pie chart',
  number: 'Number card',
  map: 'Map chart',
};

/** Title a new chart starts with, e.g. "Bar chart - students Oct 4, 3:05 PM". */
export function generateDefaultChartName(chartType: string, table: string): string {
  const timestamp = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${TYPE_NAMES[chartType] || 'Chart'} - ${table} ${timestamp}`;
}
