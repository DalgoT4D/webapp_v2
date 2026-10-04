import { ChartTypes } from '@/types/charts';
import type { ChartBuilderKind } from '@/components/charts/logic/builder-kind';

/** Which builder preview requests are switched on for a chart type. */
export interface PreviewRequests {
  /** POST /api/charts/chart-data/ (ECharts config, pivot data) */
  chartData: boolean;
  /** The DATA tab's "Chart Data" table + its total-rows request */
  dataPreview: boolean;
  /** The table chart itself (server-paginated data preview) */
  tableChart: boolean;
  /** A separate total-rows request for the table chart's pagination */
  tableChartTotalRows: boolean;
}

/** The one place that decides which preview requests a builder makes. */
export function getPreviewRequests(
  chartType: string | undefined,
  builder: ChartBuilderKind
): PreviewRequests {
  const isMap = chartType === ChartTypes.MAP;
  const isTable = chartType === ChartTypes.TABLE;
  const isPivot = chartType === ChartTypes.PIVOT_TABLE;
  return {
    // BUILDER-DRIFT: the edit page also fetches /chart-data/ for table charts
    chartData: !isMap && !(builder === 'create' && isTable),
    dataPreview: !isPivot,
    tableChart: isTable,
    // BUILDER-DRIFT: the edit page paginates the table with the data-preview total instead
    tableChartTotalRows: builder === 'create' && isTable,
  };
}
