import { getPreviewRequests } from '@/components/charts/logic/preview-requests';

describe('getPreviewRequests', () => {
  it.each([
    [
      'bar',
      'create',
      { chartData: true, dataPreview: true, tableChart: false, tableChartTotalRows: false },
    ],
    [
      'bar',
      'edit',
      { chartData: true, dataPreview: true, tableChart: false, tableChartTotalRows: false },
    ],
    [
      'map',
      'create',
      { chartData: false, dataPreview: true, tableChart: false, tableChartTotalRows: false },
    ],
    [
      'map',
      'edit',
      { chartData: false, dataPreview: true, tableChart: false, tableChartTotalRows: false },
    ],
    [
      'pivot_table',
      'create',
      { chartData: true, dataPreview: false, tableChart: false, tableChartTotalRows: false },
    ],
    [
      'pivot_table',
      'edit',
      { chartData: true, dataPreview: false, tableChart: false, tableChartTotalRows: false },
    ],
    [
      'table',
      'create',
      { chartData: false, dataPreview: true, tableChart: true, tableChartTotalRows: true },
    ],
    [
      'table',
      'edit',
      { chartData: true, dataPreview: true, tableChart: true, tableChartTotalRows: false },
    ],
  ] as const)('%s in %s', (chartType, builder, expected) => {
    expect(getPreviewRequests(chartType, builder)).toEqual(expected);
  });
});
