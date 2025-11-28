'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  BarChart2,
  PieChart,
  LineChart,
  Trash,
  Copy,
  AlertCircle,
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
import {
  DataTable,
  ColumnHeader,
  ActionsCell,
  type ActionMenuItem,
  type SortState,
  type FilterState,
  type TextFilterValue,
  type DateFilterValue,
  type FilterConfig,
  type SkeletonConfig,
} from '@/components/ui/data-table';

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

export default function ChartsPage() {
  // Sorting state
  const [sortState, setSortState] = useState<SortState>({
    column: 'updated_at',
    direction: 'desc',
  });

  // Filter state
  const [filterState, setFilterState] = useState<FilterState>(initialFilterState);

  // Favorites (local state)
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedCharts, setSelectedCharts] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Action loading states
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isDuplicating, setIsDuplicating] = useState<number | null>(null);

  // API hooks - fetch all charts, pagination handled by TanStack Table
  const { data: allCharts, isLoading, isError, mutate } = useCharts();

  const { trigger: deleteChart } = useDeleteChart();
  const { trigger: bulkDeleteCharts } = useBulkDeleteCharts();
  const { trigger: createChart } = useCreateChart();
  const { confirm, DialogComponent } = useConfirmationDialog();
  const { hasPermission } = useUserPermissions();

  // Memoize charts to prevent unnecessary re-renders
  const charts = useMemo(() => allCharts || [], [allCharts]);

  // Get unique data sources for filter options
  const uniqueDataSources = useMemo(() => {
    const dataSources = new Set<string>();
    charts.forEach((chart) => {
      const dataSource = `${chart.schema_name}.${chart.table_name}`;
      if (dataSource && dataSource !== '.') {
        dataSources.add(dataSource);
      }
    });
    return Array.from(dataSources)
      .sort()
      .map((ds) => ({ value: ds, label: ds }));
  }, [charts]);

  // Get unique chart types for filter options
  const uniqueChartTypes = useMemo(() => {
    const chartTypes = new Set<string>();
    charts.forEach((chart) => {
      if (chart.chart_type) {
        chartTypes.add(chart.chart_type);
      }
    });
    return Array.from(chartTypes)
      .sort()
      .map((ct) => ({ value: ct, label: ct.charAt(0).toUpperCase() + ct.slice(1) }));
  }, [charts]);

  // Apply filters and sort charts
  const filteredAndSortedCharts = useMemo(() => {
    const titleFilter = filterState.title as TextFilterValue;
    const dataSourceFilter = filterState.data_source as string[];
    const chartTypeFilter = filterState.chart_type as string[];
    const dateFilter = filterState.updated_at as DateFilterValue;

    // Apply filters
    const filtered = charts.filter((chart) => {
      // Name/title filter
      if (titleFilter?.text) {
        const title = (chart.title || '').toLowerCase();
        if (!title.includes(titleFilter.text.toLowerCase())) {
          return false;
        }
      }

      // Favorites filter
      if (titleFilter?.showFavorites && !favorites.has(chart.id)) {
        return false;
      }

      // Data source filter
      if (dataSourceFilter.length > 0) {
        const dataSource = `${chart.schema_name}.${chart.table_name}`;
        if (!dataSourceFilter.includes(dataSource)) {
          return false;
        }
      }

      // Chart type filter
      if (chartTypeFilter.length > 0) {
        if (!chartTypeFilter.includes(chart.chart_type)) {
          return false;
        }
      }

      // Date filter
      if (dateFilter.range !== 'all' && chart.updated_at) {
        const updatedDate = new Date(chart.updated_at);
        const now = new Date();

        switch (dateFilter.range) {
          case 'today': {
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (updatedDate < today) return false;
            break;
          }
          case 'week': {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (updatedDate < weekAgo) return false;
            break;
          }
          case 'month': {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            if (updatedDate < monthAgo) return false;
            break;
          }
          case 'custom': {
            if (dateFilter.customStart && updatedDate < dateFilter.customStart) return false;
            if (dateFilter.customEnd && updatedDate > dateFilter.customEnd) return false;
            break;
          }
        }
      }

      return true;
    });

    // Sort
    return [...filtered].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortState.column) {
        case 'title':
          aValue = (a.title || '').toLowerCase();
          bValue = (b.title || '').toLowerCase();
          break;
        case 'updated_at':
          aValue = new Date(a.updated_at || 0).getTime();
          bValue = new Date(b.updated_at || 0).getTime();
          break;
        case 'chart_type':
          aValue = (a.chart_type || '').toLowerCase();
          bValue = (b.chart_type || '').toLowerCase();
          break;
        case 'data_source':
          aValue = `${a.schema_name}.${a.table_name}`.toLowerCase();
          bValue = `${b.schema_name}.${b.table_name}`.toLowerCase();
          break;
        default:
          return 0;
      }

      if (sortState.direction === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [charts, filterState, favorites, sortState]);

  // Get active filter count
  const getActiveFilterCount = useCallback(() => {
    let count = 0;
    const titleFilter = filterState.title as TextFilterValue;
    if (titleFilter?.text || titleFilter?.showFavorites) count++;
    if ((filterState.data_source as string[]).length > 0) count++;
    if ((filterState.chart_type as string[]).length > 0) count++;
    const dateFilter = filterState.updated_at as DateFilterValue;
    if (dateFilter?.range !== 'all') count++;
    return count;
  }, [filterState]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFilterState(initialFilterState);
  }, []);

  // Favorites toggle
  const handleToggleFavorite = useCallback((chartId: number) => {
    setFavorites((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(chartId)) {
        newFavorites.delete(chartId);
      } else {
        newFavorites.add(chartId);
      }
      return newFavorites;
    });
  }, []);

  // Selection mode functions
  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
    setSelectedCharts(new Set());
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedCharts(new Set());
  }, []);

  const toggleChartSelection = useCallback((chartId: number) => {
    setSelectedCharts((prev) => {
      const newSelection = new Set(prev);
      if (newSelection.has(chartId)) {
        newSelection.delete(chartId);
      } else {
        newSelection.add(chartId);
      }
      return newSelection;
    });
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

  // Duplicate title generator
  const generateDuplicateTitle = useCallback(
    (originalTitle: string, existingTitles: string[]): string => {
      let baseName = originalTitle;
      let copyNumber = 1;

      if (originalTitle.startsWith('Copy of ')) {
        baseName = originalTitle;
      } else {
        baseName = `Copy of ${originalTitle}`;
      }

      let newTitle = baseName;

      while (existingTitles.includes(newTitle)) {
        copyNumber++;
        if (originalTitle.startsWith('Copy of ')) {
          const match = originalTitle.match(/^Copy of (.+?)( \((\d+)\))?$/);
          if (match) {
            const baseTitle = match[1];
            newTitle = `Copy of ${baseTitle} (${copyNumber})`;
          } else {
            newTitle = `${originalTitle} (${copyNumber})`;
          }
        } else {
          newTitle = `Copy of ${originalTitle} (${copyNumber})`;
        }
      }

      return newTitle;
    },
    []
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
    [charts, createChart, mutate, generateDuplicateTitle]
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
          const isFavorited = favorites.has(chart.id);

          return (
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 p-0 hover:bg-yellow-50"
                onClick={(e) => {
                  e.preventDefault();
                  handleToggleFavorite(chart.id);
                }}
              >
                {isFavorited ? (
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
      favorites,
      uniqueDataSources,
      uniqueChartTypes,
      isDeleting,
      isDuplicating,
      hasPermission,
      handleToggleFavorite,
      handleDuplicateChart,
      handleDeleteChart,
      enterSelectionMode,
    ]
  );

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load charts</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
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
            <h1 id="charts-page-title" className="text-3xl font-bold">
              Charts
            </h1>
            <p id="charts-page-description" className="text-muted-foreground mt-1">
              Create And Manage Your Visualizations
            </p>
          </div>

          {hasPermission('can_create_charts') && (
            <Link id="charts-create-link" href="/charts/new">
              <Button
                id="charts-create-button"
                variant="ghost"
                className="text-white hover:opacity-90 shadow-xs"
                style={{ backgroundColor: '#06887b' }}
              >
                <Plus id="charts-create-icon" className="w-4 h-4 mr-2" />
                CREATE CHART
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* DataTable - pass all filtered data, TanStack handles pagination */}
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
        activeFilterCount={getActiveFilterCount()}
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
