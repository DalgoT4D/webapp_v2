'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Plus, BarChart2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useCharts, type Chart } from '@/hooks/api/useCharts';
import { useDeleteChart } from '@/hooks/api/useChart';
import { ShareModal } from '@/components/share/ShareModal';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { PERMISSIONS, useRbac } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { DocsLink } from '@/components/ui/docs-link';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Table as TableComponent, TableBody } from '@/components/ui/table';
import { toastSuccess, toastError } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { DEFAULT_LIST_PAGE_SIZE, sortRows } from '@/components/list-page/list-logic';
import { useListSort } from '@/components/list-page/useListSort';
import { ListPagination } from '@/components/list-page/ListPagination';
import { ActiveFiltersSummary } from '@/components/list-page/ActiveFiltersSummary';
import {
  filterCharts,
  getChartSortValue,
  getUniqueChartTypes,
  getUniqueDataSources,
  type ChartSortColumn,
} from '@/components/charts/list/chart-list-logic';
import { useChartListFilters } from '@/components/charts/list/useChartListFilters';
import { useChartSelection } from '@/components/charts/list/useChartSelection';
import { useChartFavoriteToggle } from '@/components/charts/list/useChartFavoriteToggle';
import { useDuplicateChart } from '@/components/charts/list/useDuplicateChart';
import { ChartListSkeleton } from '@/components/charts/list/ChartListSkeleton';
import { ChartListTableHeader } from '@/components/charts/list/ChartListTableHeader';
import { ChartListRow } from '@/components/charts/list/ChartListRow';
import { ChartSelectionBar } from '@/components/charts/list/ChartSelectionBar';

export default function ChartsPage() {
  const { sortBy, sortOrder, handleSort } = useListSort<ChartSortColumn>('updated_at');
  const filters = useChartListFilters();
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE);
  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareChart, setShareChart] = useState<Chart | null>(null);

  const {
    data: allCharts,
    total: apiTotal,
    totalPages: apiTotalPages,
    isLoading,
    isError,
    mutate,
  } = useCharts({ page: currentPage, pageSize });
  const { trigger: deleteChart } = useDeleteChart();
  const { confirm, DialogComponent } = useConfirmationDialog();
  const { hasPermission } = useRbac();

  const charts = allCharts || [];

  // PINNED-BUGS: "List filters/sort apply to current page only; counter shows server total" —
  // the server pages; this filters and sorts the one page it returned.
  const filteredAndSortedCharts = useMemo(
    () =>
      sortRows(
        filterCharts(charts, filters.values),
        (chart) => getChartSortValue(chart, sortBy),
        sortOrder
      ),
    [charts, filters.values, sortBy, sortOrder]
  );
  const uniqueDataSources = useMemo(() => getUniqueDataSources(charts), [charts]);
  const uniqueChartTypes = useMemo(() => getUniqueChartTypes(charts), [charts]);

  const selection = useChartSelection({
    visibleCharts: filteredAndSortedCharts,
    confirm,
    deleteChart,
    mutate,
  });
  const { favoritingIds, handleToggleFavorite } = useChartFavoriteToggle(mutate);
  const { duplicatingChartId, handleDuplicateChart } = useDuplicateChart(charts, mutate);

  const handleDeleteChart = useCallback(
    // chartType is passed in (not looked up in `charts`) so this callback keeps the
    // same dependencies as before — the analytics property costs no extra re-renders.
    async (chartId: number, chartTitle: string, chartType?: string) => {
      setIsDeleting(chartId);

      try {
        await deleteChart(chartId);
        trackEvent(ANALYTICS_EVENTS.CHART_DELETED, {
          chart_id: chartId,
          chart_type: chartType ?? null,
        });
        await mutate();
        toastSuccess.deleted(chartTitle);
      } catch (error) {
        toastError.delete(error, chartTitle);
      } finally {
        setIsDeleting(null);
      }
    },
    [deleteChart, mutate]
  );

  const handleShareChart = useCallback((chart: Chart) => {
    setShareChart(chart);
    setShareModalOpen(true);
  }, []);

  const handleShareModalClose = useCallback(() => {
    setShareModalOpen(false);
    setShareChart(null);
  }, []);

  // Reset to page 1 whenever filters or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    filters.nameFilters.text,
    filters.nameFilters.showFavorites,
    filters.dataSourceFilters,
    filters.chartTypeFilters,
    filters.dateFilters.range,
    filters.dateFilters.customStart,
    filters.dateFilters.customEnd,
    sortBy,
    sortOrder,
  ]);

  // Clamp currentPage if total pages shrinks (e.g. after deletes)
  // PINNED-BUGS: "First "Next" on chart list pagination bounces back to page 1" — while page 2
  // loads, useCharts reports totalPages=1, so this clamps straight back to page 1.
  useEffect(() => {
    if (apiTotalPages > 0 && currentPage > apiTotalPages) {
      setCurrentPage(apiTotalPages);
    }
  }, [apiTotalPages, currentPage]);

  // Server handles pagination; use its values for display
  const paginatedCharts = filteredAndSortedCharts;
  const total = apiTotal;
  const totalPages = apiTotalPages;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load charts</p>
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
          data-testid="chart-list-retry-btn"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div id="charts-list-container" className="h-full flex flex-col">
      {/* Fixed Header */}
      <div id="charts-header" className="flex-shrink-0 border-b bg-background">
        {/* Title Section */}
        <div id="charts-title-section" className="flex items-center justify-between mb-6 p-6 pb-0">
          <div id="charts-title-wrapper">
            <DocsLink path="/charts">
              <h1 id="charts-page-title" className="text-3xl font-bold">
                Charts
              </h1>
            </DocsLink>
            <p id="charts-page-description" className="text-muted-foreground mt-1">
              Create and manage your visualizations
            </p>
          </div>

          {hasPermission(PERMISSIONS.CAN_CREATE_CHARTS) && (
            <Link id="charts-create-link" href="/charts/new">
              <Button id="charts-create-button" variant="primary" data-testid="charts-create-btn">
                <Plus id="charts-create-icon" className="w-4 h-4 mr-2" />
                CREATE CHART
              </Button>
            </Link>
          )}
        </div>

        {selection.isSelectionMode && (
          <ChartSelectionBar
            selectedCount={selection.selectedCharts.size}
            visibleCount={filteredAndSortedCharts.length}
            canDelete={hasPermission(PERMISSIONS.CAN_DELETE_CHARTS)}
            isBulkDeleting={selection.isBulkDeleting}
            onExit={selection.exitSelectionMode}
            onSelectAll={selection.selectAllCharts}
            onDeselectAll={selection.deselectAllCharts}
            onBulkDelete={selection.handleBulkDelete}
          />
        )}

        {/* Filter Summary - Only shows when filters are active to save space */}
        <ActiveFiltersSummary
          id="charts-filters-section"
          count={filters.activeFilterCount}
          onClearAll={filters.clearAllFilters}
          clearTestId="chart-list-clear-all-filters-btn"
        />
      </div>

      {/* Scrollable Content - Only the charts list scrolls */}
      <div id="charts-content-wrapper" className="flex-1 overflow-hidden px-6">
        <div id="charts-scrollable-content" className="h-full overflow-y-auto">
          {isLoading ? (
            <ChartListSkeleton />
          ) : paginatedCharts.length > 0 ? (
            // PINNED-BUGS: "Empty filtered list unmounts the table header" — header lives in this branch only.
            <div className="py-6">
              <div className="border rounded-lg bg-white">
                <TooltipProvider delayDuration={300}>
                  <TableComponent className="table-fixed">
                    <ChartListTableHeader
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      filters={filters}
                      uniqueDataSources={uniqueDataSources}
                      uniqueChartTypes={uniqueChartTypes}
                    />
                    <TableBody>
                      {paginatedCharts.map((chart) => (
                        <ChartListRow
                          key={chart.id}
                          chart={chart}
                          isSelectionMode={selection.isSelectionMode}
                          isSelected={selection.selectedCharts.has(chart.id)}
                          isFavoriting={favoritingIds.has(chart.id)}
                          isDuplicating={duplicatingChartId === chart.id}
                          isDeleting={isDeleting === chart.id}
                          hasPermission={hasPermission}
                          onToggleFavorite={handleToggleFavorite}
                          onToggleSelection={selection.toggleChartSelection}
                          onEnterSelectionMode={selection.enterSelectionMode}
                          onShare={handleShareChart}
                          onDuplicate={handleDuplicateChart}
                          onDelete={handleDeleteChart}
                        />
                      ))}
                    </TableBody>
                  </TableComponent>
                </TooltipProvider>
              </div>
            </div>
          ) : (
            <div
              id="charts-empty-state"
              className="flex flex-col items-center justify-center h-full gap-4"
            >
              <BarChart2 id="charts-empty-icon" className="w-12 h-12 text-muted-foreground" />
              <p id="charts-empty-text" className="text-muted-foreground">
                {filters.activeFilterCount > 0 ? 'No charts found' : 'No charts yet'}
              </p>
              {hasPermission(PERMISSIONS.CAN_CREATE_CHARTS) && (
                <Link id="charts-empty-create-link" href="/charts/new">
                  <Button
                    id="charts-empty-create-button"
                    variant="primary"
                    data-testid="charts-empty-create-btn"
                  >
                    <Plus id="charts-empty-create-icon" className="w-4 h-4 mr-2" />
                    CREATE YOUR FIRST CHART
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <ListPagination
        idPrefix="charts"
        currentPage={currentPage}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        testIds={{
          pageSizeTrigger: 'chart-list-page-size-trigger',
          pageSizeOptionPrefix: 'chart-list-page-size-option',
          prev: 'chart-list-prev-page-btn',
          next: 'chart-list-next-page-btn',
        }}
      />
      <DialogComponent />

      {/* Share Modal */}
      {shareChart && (
        <ShareModal
          rtype="chart"
          entityId={shareChart.id}
          entityLabel={shareChart.title || 'Chart'}
          isOpen={shareModalOpen}
          onClose={handleShareModalClose}
        />
      )}
    </div>
  );
}
