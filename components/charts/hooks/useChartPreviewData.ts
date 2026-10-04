'use client';

import { useEffect, useState } from 'react';
import type { ChartBuilderFormData, ChartDataPayload } from '@/types/charts';
import type { ChartBuilderKind } from '@/components/charts/logic/builder-kind';
import { getPreviewRequests } from '@/components/charts/logic/preview-requests';
import {
  useChartData,
  useChartDataPreview,
  useChartDataPreviewTotalRows,
  useRawTableData,
  useTableCount,
} from '@/hooks/api/useChart';
import type { PageState } from '@/components/charts/hooks/usePreviewPagination';

interface PreviewPages {
  dataPreview: PageState;
  rawData: PageState;
  tableChart: PageState;
}

/** Every SWR request behind the builder's CHART and DATA tabs (maps: see useBuilderMapPreview). */
export function useChartPreviewData({
  config,
  payload,
  builder,
  pages,
}: {
  config: ChartBuilderFormData;
  payload: ChartDataPayload | null;
  builder: ChartBuilderKind;
  pages: PreviewPages;
}) {
  const requests = getPreviewRequests(config.chart_type, builder);
  const schema = config.schema_name || null;
  const table = config.table_name || null;

  const chartData = useChartData(requests.chartData ? payload : null);
  const dataPreview = useChartDataPreview(
    requests.dataPreview ? payload : null,
    pages.dataPreview.page,
    pages.dataPreview.pageSize
  );
  const { data: chartDataTotalRows } = useChartDataPreviewTotalRows(
    requests.dataPreview ? payload : null
  );
  const tableChart = useChartDataPreview(
    requests.tableChart ? payload : null,
    pages.tableChart.page,
    pages.tableChart.pageSize
  );
  const { data: tableChartTotalRows } = useChartDataPreviewTotalRows(
    requests.tableChartTotalRows ? payload : null
  );
  const rawData = useRawTableData(schema, table, pages.rawData.page, pages.rawData.pageSize);
  const { data: tableCount } = useTableCount(schema, table);

  // Edit page shows the last good ECharts config while a new one loads (create ignores it).
  const [lastValidChartConfig, setLastValidChartConfig] = useState<Record<string, unknown> | null>(
    null
  );
  useEffect(() => {
    if (chartData.data?.echarts_config) setLastValidChartConfig(chartData.data.echarts_config);
  }, [chartData.data?.echarts_config]);

  return {
    chartData: chartData.data,
    chartDataError: chartData.error,
    chartDataLoading: chartData.isLoading,
    lastValidChartConfig,
    dataPreview: dataPreview.data,
    previewError: dataPreview.error,
    previewLoading: dataPreview.isLoading,
    chartDataTotalRows,
    tableChartData: tableChart.data,
    tableChartError: tableChart.error,
    tableChartLoading: tableChart.isLoading,
    tableChartTotalRows,
    rawTableData: rawData.data,
    rawDataError: rawData.error,
    rawDataLoading: rawData.isLoading,
    tableCount,
  };
}
