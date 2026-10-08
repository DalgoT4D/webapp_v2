'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChartPagination } from '@/types/charts';
import type { ChartBuilderKind } from '@/components/charts/logic/builder-kind';

/** DATA tab "Chart Data" rows per page. PINNED-BUGS C-E7: create 20, edit 25 (25 is not a dropdown option). */
const DATA_PREVIEW_PAGE_SIZE: Record<ChartBuilderKind, number> = { create: 20, edit: 25 };
/** Rows per page of the raw-data table and of the table chart, both builders. */
const DEFAULT_PAGE_SIZE = 20;

export interface PageState {
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  /** New page size; always goes back to page 1. */
  changePageSize: (pageSize: number) => void;
}

function usePageState(
  initialPageSize: number
): PageState & { setPageSize: (size: number) => void } {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const changePageSize = useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);
  return { page, pageSize, setPage, setPageSize, changePageSize };
}

export function usePreviewPagination(
  builder: ChartBuilderKind,
  chartPagination: ChartPagination | undefined
) {
  const dataPreview = usePageState(DATA_PREVIEW_PAGE_SIZE[builder]);
  const rawData = usePageState(DEFAULT_PAGE_SIZE);
  const tableChart = usePageState(DEFAULT_PAGE_SIZE);

  const { setPage: setTableChartPage } = tableChart;
  const resetTableChartPage = useCallback(() => setTableChartPage(1), [setTableChartPage]);

  // PINNED-BUGS: "Edit data preview resets to 25 rows on row-limit change" — edit page only.
  const { setPage: setDataPreviewPage, setPageSize: setDataPreviewPageSize } = dataPreview;
  useEffect(() => {
    if (builder !== 'edit') return;
    setDataPreviewPageSize(DATA_PREVIEW_PAGE_SIZE.edit);
    setDataPreviewPage(1);
  }, [
    builder,
    chartPagination?.page_size,
    chartPagination?.enabled,
    setDataPreviewPage,
    setDataPreviewPageSize,
  ]);

  return { dataPreview, rawData, tableChart, resetTableChartPage };
}
