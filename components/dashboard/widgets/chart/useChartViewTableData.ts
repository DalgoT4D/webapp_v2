import useSWR from 'swr';
import { apiPublicPost } from '@/lib/api';
import { useChartDataPreview, useChartDataPreviewTotalRows } from '@/hooks/api/useChart';
import type { ChartDataPayload } from '@/types/charts';
import type { FrozenChartConfig } from '@/types/reports';

export interface ChartViewTableDataOptions {
  chartId: number;
  isPublicMode: boolean;
  publicToken?: string;
  frozenChartConfig?: FrozenChartConfig;
  snapshotId?: number;
  dashboardFilters: Record<string, unknown>;
  isTableChart: boolean;
  tablePage: number;
  tablePageSize: number;
  chartDataPayload: ChartDataPayload | null;
  isPublicReport: boolean;
}

/** Table widget rows and total, public (dashboard GET-by-POST / report GET) or private (preview endpoints). */
export function useChartViewTableData({
  chartId,
  isPublicMode,
  publicToken,
  frozenChartConfig,
  snapshotId,
  dashboardFilters,
  isTableChart,
  tablePage,
  tablePageSize,
  chartDataPayload,
  isPublicReport,
}: ChartViewTableDataOptions) {
  // For table charts - public vs private mode
  const publicTableDataUrl =
    isPublicMode && publicToken && isTableChart
      ? isPublicReport
        ? `/api/v1/public/reports/${publicToken}/charts/${chartId}/data-preview/`
        : `/api/v1/public/dashboards/${publicToken}/charts/${chartId}/data-preview/`
      : null;

  const {
    data: publicTableData,
    error: publicTableError,
    isLoading: publicTableLoading,
  } = useSWR(
    publicTableDataUrl
      ? isPublicReport
        ? [publicTableDataUrl, tablePage, tablePageSize, dashboardFilters]
        : [publicTableDataUrl, chartDataPayload, tablePage, tablePageSize, dashboardFilters]
      : null,
    isPublicMode && isTableChart
      ? isPublicReport
        ? async ([url, page, size, filters]: [string, number, number, Record<string, unknown>]) => {
            // Public report: GET — server builds payload from frozen config
            const qp = new URLSearchParams({
              page: (page - 1).toString(),
              limit: size.toString(),
            });
            if (Object.keys(filters).length > 0) {
              qp.append('dashboard_filters', JSON.stringify(filters));
            }
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002'}${url}?${qp}`
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            return response.json();
          }
        : async ([url, payload, page, size, filters]: [
            string,
            ChartDataPayload,
            number,
            number,
            Record<string, unknown>,
          ]) => {
            // Public dashboard: POST with payload (unchanged)
            const qp = new URLSearchParams({
              page: (page - 1).toString(),
              limit: size.toString(),
            });
            if (Object.keys(filters).length > 0) {
              qp.append('dashboard_filters', JSON.stringify(filters));
            }
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002'}${url}?${qp}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              }
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            return response.json();
          }
      : null,
    { revalidateOnFocus: false, revalidateOnReconnect: false, refreshInterval: 0 }
  );

  // Private mode table data. In report mode, only fetch once snapshotId is
  // available — don't fall back to the live-chart endpoint while it's still
  // missing.
  const isTableReadyToFetch = frozenChartConfig ? !!snapshotId : true;
  const {
    data: privateTableData,
    error: privateTableError,
    isLoading: privateTableLoading,
  } = useChartDataPreview(
    !isPublicMode && isTableChart && isTableReadyToFetch ? chartDataPayload : null,
    tablePage,
    tablePageSize,
    dashboardFilters,
    frozenChartConfig ? snapshotId : null,
    chartId
  );

  // Get total rows for table pagination (private mode, only for table charts)
  const { data: privateTableTotalRows } = useChartDataPreviewTotalRows(
    !isPublicMode && isTableChart && isTableReadyToFetch ? chartDataPayload : null,
    dashboardFilters,
    frozenChartConfig ? snapshotId : null,
    chartId
  );

  // Get total rows for table pagination (public mode)
  const publicTableTotalRowsUrl =
    isPublicMode && publicToken && isTableChart
      ? isPublicReport
        ? `/api/v1/public/reports/${publicToken}/charts/${chartId}/total-rows/`
        : `/api/v1/public/dashboards/${publicToken}/charts/${chartId}/data-preview/total-rows/`
      : null;

  const { data: publicTableTotalRowsData } = useSWR(
    publicTableTotalRowsUrl
      ? isPublicReport
        ? [publicTableTotalRowsUrl, dashboardFilters]
        : [publicTableTotalRowsUrl, chartDataPayload, dashboardFilters]
      : null,
    isPublicMode && isTableChart
      ? isPublicReport
        ? async ([url, filters]: [string, Record<string, unknown>]) => {
            // Public report: GET — server builds payload from frozen config
            const qp = new URLSearchParams();
            if (Object.keys(filters).length > 0) {
              qp.append('dashboard_filters', JSON.stringify(filters));
            }
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002'}${url}${qp.toString() ? `?${qp}` : ''}`
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            return response.json();
          }
        : async ([url, payload, filters]: [string, ChartDataPayload, Record<string, unknown>]) => {
            // Public dashboard: POST with payload (unchanged)
            const qp = new URLSearchParams();
            if (Object.keys(filters).length > 0) {
              qp.append('dashboard_filters', JSON.stringify(filters));
            }
            return apiPublicPost(url, payload, qp);
          }
      : null,
    { revalidateOnFocus: false, revalidateOnReconnect: false, refreshInterval: 0 }
  );

  const publicTableTotalRows = publicTableTotalRowsData?.total_rows;

  // Use appropriate table data based on mode
  const tableData = isPublicMode ? publicTableData : privateTableData;
  const tableError = isPublicMode ? publicTableError : privateTableError;
  const tableLoading = isPublicMode ? publicTableLoading : privateTableLoading;

  return { tableData, tableError, tableLoading, privateTableTotalRows, publicTableTotalRows };
}
