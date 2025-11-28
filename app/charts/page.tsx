'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  BarChart2,
  PieChart,
  LineChart,
  Trash,
  Copy,
  MapPin,
  Hash,
  CheckSquare,
  Table as TableIcon,
  Edit,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { useCharts, type Chart } from '@/hooks/api/useCharts';
import type { ChartCreate } from '@/types/charts';
import { useDeleteChart, useBulkDeleteCharts, useCreateChart } from '@/hooks/api/useChart';
import { ChartDeleteDialog } from '@/components/charts/ChartDeleteDialog';
import { ChartExportDropdownForList } from '@/components/charts/ChartExportDropdownForList';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { toastSuccess, toastError } from '@/lib/toast';
import { getChartTypeColor, type ChartType } from '@/constants/chart-types';
import { generateDuplicateTitle } from '@/lib/form-utils';
import {
  DataTable,
  ColumnHeader,
  ActionsCell,
  type ActionMenuItem,
  type FilterState,
  type TextFilterValue,
  type DateFilterValue,
  type FilterConfig,
  type SkeletonConfig,
} from '@/components/ui/data-table';

// Hooks and utilities
import { useTableState } from '@/hooks/useTableState';
import { useFavorites } from '@/hooks/useFavorites';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import {
  matchesTextFilter,
  matchesCheckboxFilter,
  matchesDateFilter,
  extractUniqueValues,
} from '@/lib/table-utils';

// Chart type icons mapping
const chartIcons = {
  bar: BarChart2,
  pie: PieChart,
  line: LineChart,
  map: MapPin,
  number: Hash,
  table: TableIcon,
};

// Filter configurations for each column
const filterConfigs: Record<string, FilterConfig> = {
  title: {
    type: 'text',
    placeholder: 'Search chart names...',
    checkboxOptions: [{ key: 'showFavorites', label: 'Show only favorites' }],
  },
  data_source: {
    type: 'checkbox',
  },
  chart_type: {
    type: 'checkbox',
  },
  updated_at: {
    type: 'date',
  },
};

// Skeleton configuration
const skeletonConfig: SkeletonConfig = {
  rowCount: 8,
  columns: [
    { width: 'w-[35%]', cellType: 'text' },
    { width: 'w-[30%]', cellType: 'text' },
    { width: 'w-[10%]', cellType: 'icon' },
    { width: 'w-[20%]', cellType: 'text' },
    { width: 'w-[5%]', cellType: 'actions' },
  ],
};

// Initial filter state
const initialFilterState: FilterState = {
  title: { text: '', showFavorites: false } as TextFilterValue,
  data_source: [] as string[],
  chart_type: [] as string[],
  updated_at: { range: 'all', customStart: null, customEnd: null } as DateFilterValue,
};

// Sort accessors for each sortable column
const sortAccessors: Record<string, (item: Chart) => string | number | Date | null> = {
  title: (item) => (item.title || '').toLowerCase(),
  updated_at: (item) => (item.updated_at ? new Date(item.updated_at) : null),
  chart_type: (item) => (item.chart_type || '').toLowerCase(),
  data_source: (item) => `${item.schema_name}.${item.table_name}`.toLowerCase(),
};

export default function ChartsPage() {
  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedCharts, setSelectedCharts] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Action loading states
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isDuplicating, setIsDuplicating] = useState<number | null>(null);

  // API hooks
  const { data: allCharts, isLoading, isError, mutate } = useCharts();
  const { trigger: deleteChart } = useDeleteChart();
  const { trigger: bulkDeleteCharts } = useBulkDeleteCharts();
  const { trigger: createChart } = useCreateChart();
  const { confirm, DialogComponent } = useConfirmationDialog();
  const { hasPermission } = useUserPermissions();

  // Favorites hook
  const { toggleFavorite, isFavorited } = useFavorites();

  // Memoize charts array
  const charts = useMemo(() => allCharts || [], [allCharts]);

  // Filter function using new utilities
  const filterFn = useCallback(
    (chart: Chart, filterState: FilterState): boolean => {
      const titleFilter = filterState.title as TextFilterValue;
      const dataSourceFilter = filterState.data_source as string[];
      const chartTypeFilter = filterState.chart_type as string[];
      const dateFilter = filterState.updated_at as DateFilterValue;

      // Name/title filter
      if (!matchesTextFilter(chart.title, titleFilter?.text || '')) {
        return false;
      }

      // Favorites filter
      if (titleFilter?.showFavorites && !isFavorited(chart.id)) {
        return false;
      }

      // Data source filter
      const dataSource = `${chart.schema_name}.${chart.table_name}`;
      if (!matchesCheckboxFilter(dataSource, dataSourceFilter)) {
        return false;
      }

      // Chart type filter
      if (!matchesCheckboxFilter(chart.chart_type, chartTypeFilter)) {
        return false;
      }

      // Date filter
      if (!matchesDateFilter(chart.updated_at, dateFilter)) {
        return false;
      }

      return true;
    },
    [isFavorited]
  );

  // Table state hook
  const {
    sortState,
    setSortState,
    filterState,
    setFilterState,
    filteredAndSortedData: filteredAndSortedCharts,
    activeFilterCount,
    clearAllFilters,
  } = useTableState({
    data: charts,
    initialSort: { column: 'updated_at', direction: 'desc' },
    initialFilters: initialFilterState,
    filterConfigs,
    sortAccessors,
    filterFn,
  });

  // Get unique data sources for filter options
  const uniqueDataSources = useMemo(
    () =>
      extractUniqueValues(charts, (chart) => {
        const dataSource = `${chart.schema_name}.${chart.table_name}`;
        return dataSource !== '.' ? dataSource : null;
      }),
    [charts]
  );

  // Get unique chart types for filter options
  const uniqueChartTypes = useMemo(
    () =>
      extractUniqueValues(
        charts,
        (chart) => chart.chart_type,
        (type) => type.charAt(0).toUpperCase() + type.slice(1)
      ),
    [charts]
  );

  // Selection mode functions
  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
    setSelectedCharts(new Set());
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedCharts(new Set());
  }, []);

  const selectAllCharts = useCallback(() => {
    const allChartIds = new Set(filteredAndSortedCharts.map((chart) => chart.id));
    setSelectedCharts(allChartIds);
  }, [filteredAndSortedCharts]);

  const deselectAllCharts = useCallback(() => {
    setSelectedCharts(new Set());
  }, []);

  // Delete handler
  const handleDeleteChart = useCallback(
    async (chartId: number, chartTitle: string) => {
      setIsDeleting(chartId);
      try {
        await deleteChart(chartId);
        await mutate();
        toastSuccess.deleted(chartTitle);
      } catch (error) {
        console.error('Error deleting chart:', error);
        toastError.delete(error, chartTitle);
      } finally {
        setIsDeleting(null);
      }
    },
    [deleteChart, mutate]
  );

  // Duplicate handler
  const handleDuplicateChart = useCallback(
    async (chartId: number, chartTitle: string) => {
      if (!charts) return;

      setIsDuplicating(chartId);

      try {
        const originalChart = charts.find((chart: Chart) => chart.id === chartId);
        if (!originalChart) {
          toastError.api('Chart not found');
          return;
        }

        const existingTitles = charts.map((chart: Chart) => chart.title);
        const duplicateTitle = generateDuplicateTitle(originalChart.title, existingTitles);

        const duplicateChartData: ChartCreate = {
          title: duplicateTitle,
          chart_type: originalChart.chart_type as
            | 'bar'
            | 'pie'
            | 'line'
            | 'number'
            | 'map'
            | 'table',
          computation_type: originalChart.computation_type as 'raw' | 'aggregated',
          schema_name: originalChart.schema_name,
          table_name: originalChart.table_name,
          extra_config: originalChart.extra_config || {},
        };

        await createChart(duplicateChartData);
        await mutate();
        toastSuccess.duplicated(originalChart.title, duplicateTitle);
      } catch (error: unknown) {
        console.error('Error duplicating chart:', error);
        toastError.duplicate(error, chartTitle);
      } finally {
        setIsDuplicating(null);
      }
    },
    [charts, createChart, mutate]
  );

  // Bulk delete handler
  const handleBulkDelete = useCallback(async () => {
    if (selectedCharts.size === 0) return;

    const chartTitles = filteredAndSortedCharts
      .filter((chart) => selectedCharts.has(chart.id))
      .map((chart) => chart.title);

    const confirmMessage =
      selectedCharts.size === 1
        ? `This will permanently delete "${chartTitles[0]}". This action cannot be undone.`
        : `This will permanently delete ${selectedCharts.size} charts. This action cannot be undone.\n\nCharts to delete:\n${chartTitles.map((title) => `• ${title}`).join('\n')}`;

    const confirmed = await confirm({
      title: `Delete ${selectedCharts.size === 1 ? 'Chart' : 'Charts'}`,
      description: confirmMessage,
      confirmText: 'Delete',
      type: 'warning',
      onConfirm: () => {},
    });

    if (!confirmed) return;

    setIsBulkDeleting(true);

    try {
      try {
        await bulkDeleteCharts(Array.from(selectedCharts));
      } catch {
        const deletePromises = Array.from(selectedCharts).map((chartId) => deleteChart(chartId));
        await Promise.all(deletePromises);
      }

      await mutate();
      toastSuccess.generic(
        `${selectedCharts.size} chart${selectedCharts.size === 1 ? '' : 's'} deleted successfully`
      );
      exitSelectionMode();
    } catch (error) {
      console.error('Error deleting charts:', error);
      toastError.delete(
        error,
        `${selectedCharts.size} chart${selectedCharts.size === 1 ? '' : 's'}`
      );
    } finally {
      setIsBulkDeleting(false);
    }
  }, [
    selectedCharts,
    filteredAndSortedCharts,
    bulkDeleteCharts,
    deleteChart,
    mutate,
    exitSelectionMode,
    confirm,
  ]);

  // Define columns
  const columns: ColumnDef<Chart>[] = useMemo(
    () => [
      {
        id: 'title',
        accessorKey: 'title',
        header: () => (
          <ColumnHeader
            columnId="title"
            title="Name"
            sortable
            sortState={sortState}
            onSortChange={setSortState}
            filterConfig={filterConfigs.title}
            filterState={filterState}
            onFilterChange={setFilterState}
          />
        ),
        cell: ({ row }) => {
          const chart = row.original;
          const chartIsFavorited = isFavorited(chart.id);

          return (
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 p-0 hover:bg-yellow-50"
                onClick={(e) => {
                  e.preventDefault();
                  toggleFavorite(chart.id);
                }}
              >
                {chartIsFavorited ? (
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                ) : (
                  <Star className="w-4 h-4 text-gray-300 hover:text-yellow-400" />
                )}
              </Button>
              <div className="flex flex-col">
                <Link
                  href={hasPermission('can_view_charts') ? `/charts/${chart.id}` : '#'}
                  className="font-medium text-lg text-gray-900 hover:text-teal-700 hover:underline"
                >
                  {chart.title}
                </Link>
              </div>
            </div>
          );
        },
        meta: {
          headerClassName: 'w-[35%]',
        },
      },
      {
        id: 'data_source',
        accessorFn: (row) => `${row.schema_name}.${row.table_name}`,
        header: () => (
          <ColumnHeader
            columnId="data_source"
            title="Data Source"
            sortable
            sortState={sortState}
            onSortChange={setSortState}
            filterConfig={filterConfigs.data_source}
            filterState={filterState}
            onFilterChange={setFilterState}
            filterOptions={uniqueDataSources}
          />
        ),
        cell: ({ row }) => {
          const dataSource = `${row.original.schema_name}.${row.original.table_name}`;
          return (
            <div className="flex items-center gap-2">
              <div className="text-base text-gray-700">{dataSource}</div>
            </div>
          );
        },
        meta: {
          headerClassName: 'w-[30%]',
        },
      },
      {
        id: 'chart_type',
        accessorKey: 'chart_type',
        header: () => (
          <ColumnHeader
            columnId="chart_type"
            title="Type"
            sortable
            sortState={sortState}
            onSortChange={setSortState}
            filterConfig={filterConfigs.chart_type}
            filterState={filterState}
            onFilterChange={setFilterState}
            filterOptions={uniqueChartTypes}
          />
        ),
        cell: ({ row }) => {
          const chart = row.original;
          const IconComponent =
            chartIcons[chart.chart_type as keyof typeof chartIcons] || BarChart2;
          const typeColors = getChartTypeColor(chart.chart_type as ChartType);

          return (
            <div className="flex justify-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 cursor-default"
                      style={{ backgroundColor: typeColors.bgColor }}
                    >
                      <IconComponent className="w-6 h-6" style={{ color: typeColors.color }} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-gray-900 text-white border-gray-700">
                    <p className="text-sm capitalize">{chart.chart_type} Chart</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          );
        },
        meta: {
          headerClassName: 'w-[10%]',
        },
      },
      {
        id: 'updated_at',
        accessorKey: 'updated_at',
        header: () => (
          <ColumnHeader
            columnId="updated_at"
            title="Last Modified"
            sortable
            sortState={sortState}
            onSortChange={setSortState}
            filterConfig={filterConfigs.updated_at}
            filterState={filterState}
            onFilterChange={setFilterState}
          />
        ),
        cell: ({ row }) => (
          <span className="text-base text-gray-600">
            {row.original.updated_at
              ? formatDistanceToNow(new Date(row.original.updated_at), { addSuffix: true })
              : 'Unknown'}
          </span>
        ),
        meta: {
          headerClassName: 'w-[20%]',
        },
      },
      {
        id: 'actions',
        header: () => <span className="font-medium text-base">Actions</span>,
        cell: ({ row }) => {
          const chart = row.original;

          const actions: ActionMenuItem<Chart>[] = [
            {
              id: 'select',
              label: 'Select',
              icon: <CheckSquare className="w-4 h-4" />,
              onClick: () => enterSelectionMode(),
            },
            {
              id: 'duplicate',
              label: isDuplicating === chart.id ? 'Duplicating...' : 'Duplicate',
              icon:
                isDuplicating === chart.id ? (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Copy className="w-4 h-4" />
                ),
              onClick: () => handleDuplicateChart(chart.id, chart.title),
              disabled: isDuplicating === chart.id,
              hidden: !hasPermission('can_create_charts'),
              separator: 'before',
            },
            {
              id: 'export',
              label: 'Export',
              hidden: !hasPermission('can_view_charts'),
              render: () => (
                <ChartExportDropdownForList
                  chartId={chart.id}
                  chartTitle={chart.title}
                  chartType={chart.chart_type}
                />
              ),
            },
            {
              id: 'delete',
              label: 'Delete',
              icon: <Trash className="w-4 h-4" />,
              variant: 'destructive',
              hidden: !hasPermission('can_delete_charts'),
              separator: 'before',
              render: (_, menuItem) => (
                <ChartDeleteDialog
                  chartId={chart.id}
                  chartTitle={chart.title}
                  onConfirm={() => handleDeleteChart(chart.id, chart.title)}
                  isDeleting={isDeleting === chart.id}
                >
                  {menuItem}
                </ChartDeleteDialog>
              ),
            },
          ];

          return (
            <ActionsCell
              row={chart}
              actions={actions}
              renderPrimaryActions={() =>
                hasPermission('can_edit_charts') ? (
                  <Link href={`/charts/${chart.id}/edit`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 p-0 hover:bg-gray-100">
                      <Edit className="w-4 h-4 text-gray-600" />
                    </Button>
                  </Link>
                ) : null
              }
            />
          );
        },
        meta: {
          headerClassName: 'w-[5%]',
        },
      },
    ],
    [
      sortState,
      filterState,
      uniqueDataSources,
      uniqueChartTypes,
      isDeleting,
      isDuplicating,
      hasPermission,
      isFavorited,
      toggleFavorite,
      handleDuplicateChart,
      handleDeleteChart,
      enterSelectionMode,
      setSortState,
      setFilterState,
    ]
  );

  // Error state
  if (isError) {
    return <ErrorState title="Failed to load charts" onRetry={() => mutate()} />;
  }

  return (
    <div id="charts-list-container" className="h-full flex flex-col">
      {/* Page Header */}
      <PageHeader
        title="Charts"
        description="Create And Manage Your Visualizations"
        idPrefix="charts"
        action={{
          label: 'CREATE CHART',
          href: '/charts/new',
          icon: <Plus className="w-4 h-4" />,
          visible: hasPermission('can_create_charts'),
        }}
      />

      {/* DataTable */}
      <DataTable
        data={filteredAndSortedCharts}
        columns={columns}
        isLoading={isLoading}
        getRowId={(row) => row.id}
        sortState={sortState}
        onSortChange={setSortState}
        filterState={filterState}
        onFilterChange={setFilterState}
        filterConfigs={filterConfigs}
        activeFilterCount={activeFilterCount}
        onClearAllFilters={clearAllFilters}
        selection={
          isSelectionMode
            ? {
                enabled: true,
                selectedIds: selectedCharts as Set<string | number>,
                onSelectionChange: (ids) => setSelectedCharts(ids as Set<number>),
                onSelectAll: selectAllCharts,
                onDeselectAll: deselectAllCharts,
                onExitSelection: exitSelectionMode,
                totalCount: filteredAndSortedCharts.length,
                getRowId: (row) => row.id,
                bulkAction: {
                  label: 'Delete',
                  icon: <Trash className="w-4 h-4" />,
                  onClick: handleBulkDelete,
                  isLoading: isBulkDeleting,
                  visible: hasPermission('can_delete_charts'),
                },
              }
            : undefined
        }
        pagination={{
          totalRows: filteredAndSortedCharts.length,
          initialPageSize: 10,
          pageSizeOptions: [10, 20, 50, 100],
        }}
        emptyState={{
          icon: <BarChart2 className="w-12 h-12" />,
          title: 'No charts yet',
          filteredTitle: 'No charts found',
          action: {
            label: 'CREATE YOUR FIRST CHART',
            href: '/charts/new',
            icon: <Plus className="w-4 h-4" />,
            visible: hasPermission('can_create_charts'),
          },
        }}
        skeleton={skeletonConfig}
      />

      <DialogComponent />
    </div>
  );
}
