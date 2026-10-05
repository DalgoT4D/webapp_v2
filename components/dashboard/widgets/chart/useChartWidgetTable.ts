'use client';

import { useCallback, useState } from 'react';
import { useTableDrillDown } from '@/components/charts/hooks/useTableDrillDown';
import { ChartTypes, type Chart } from '@/types/charts';

/** Rows per page a dashboard table widget starts with. */
export const WIDGET_TABLE_PAGE_SIZE = 20;

/**
 * Table paging + drill-down for a dashboard chart widget. The drill rule is the chart
 * builders' (R2d useTableDrillDown with drill-enabled columns on drill-up); every level change
 * returns to page 1, as both widgets did.
 */
export function useChartWidgetTable(
  chart: { chart_type?: string; extra_config?: Chart['extra_config'] } | null | undefined
) {
  // Table pagination state
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(WIDGET_TABLE_PAGE_SIZE);
  const resetToFirstPage = useCallback(() => setTablePage(1), []);

  const drillDown = useTableDrillDown({
    dimensions: chart?.extra_config?.dimensions,
    isTable: chart?.chart_type === ChartTypes.TABLE,
    drillUpColumns: 'drillEnabled',
    onLevelChange: resetToFirstPage,
  });

  // Handle table pagination page size change
  const handleTablePageSizeChange = (newPageSize: number) => {
    setTablePageSize(newPageSize);
    setTablePage(1); // Reset to first page when page size changes
  };

  return { tablePage, setTablePage, tablePageSize, handleTablePageSizeChange, ...drillDown };
}
