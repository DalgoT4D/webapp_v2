'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  BarChart2,
  PieChart,
  LineChart,
  MoreVertical,
  Trash,
  Search,
  Grid,
  List,
  Copy,
  AlertCircle,
  MapPin,
  Hash,
  CheckSquare,
  Square,
  X,
  ChevronLeft,
  ChevronRight,
  Table,
  User,
  Edit,
  ChevronUp,
  ChevronDown as ChevronDownSort,
  ArrowUpDown,
  Filter,
  Star,
  StarOff,
  Share2,
  Calendar as CalendarIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useCharts, type Chart } from '@/hooks/api/useCharts';
import type { ChartCreate } from '@/types/charts';
import { useDeleteChart, useBulkDeleteCharts, useCreateChart } from '@/hooks/api/useChart';
import { ChartDeleteDialog } from '@/components/charts/ChartDeleteDialog';
import { ChartExportDropdownForList } from '@/components/charts/ChartExportDropdownForList';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table as TableComponent,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
// AlertDialog imports removed - now using ChartDeleteDialog component
import { format, formatDistanceToNow } from 'date-fns';
import { toastSuccess, toastError, toastPromise } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { getChartTypeColor, type ChartType } from '@/constants/chart-types';

// Simple debounce implementation
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

const chartIcons = {
  bar: BarChart2,
  pie: PieChart,
  line: LineChart,
  map: MapPin,
  number: Hash,
  table: Table,
};

export default function ChartsPage() {
  // View mode is now fixed to 'table' - list and grid views are commented out
  const viewMode = 'table';
  const [sortBy, setSortBy] = useState<'title' | 'updated_at' | 'chart_type' | 'data_source'>(
    'updated_at'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  // Column filter states
  const [nameFilters, setNameFilters] = useState({
    text: '',
    showFavorites: false,
  });
  const [dataSourceFilters, setDataSourceFilters] = useState<string[]>([]);
  const [chartTypeFilters, setChartTypeFilters] = useState<string[]>([]);
  const [dateFilters, setDateFilters] = useState({
    range: 'all' as 'all' | 'today' | 'week' | 'month' | 'custom',
    customStart: null as Date | null,
    customEnd: null as Date | null,
  });

  // Filter dropdown states
  const [openFilters, setOpenFilters] = useState({
    name: false,
    dataSource: false,
    chartType: false,
    date: false,
  });

  // Search states for filters
  const [dataSourceSearch, setDataSourceSearch] = useState('');
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isDuplicating, setIsDuplicating] = useState<number | null>(null);
  // Multi-select state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedCharts, setSelectedCharts] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const {
    data: allCharts,
    total: apiTotal,
    page: apiPage,
    pageSize: apiPageSize,
    totalPages: apiTotalPages,
    isLoading,
    isError,
    mutate,
  } = useCharts({
    page: currentPage,
    pageSize,
    // Remove search and chartType - we'll handle filtering client-side
  });
  const { trigger: deleteChart } = useDeleteChart();
  const { trigger: bulkDeleteCharts } = useBulkDeleteCharts();
  const { trigger: createChart } = useCreateChart();
  const { confirm, DialogComponent } = useConfirmationDialog();

  // Get user permissions
  const { hasPermission } = useUserPermissions();

  // If API doesn't support pagination, implement client-side filtering and sorting
  const charts = allCharts || [];

  // Handle sorting
  const handleSort = (column: 'title' | 'updated_at' | 'chart_type' | 'data_source') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  // Apply filters and sort charts with memoization for performance
  const filteredAndSortedCharts = useMemo(() => {
    // Apply column filters
    const filtered = charts.filter((chart) => {
      // Name filters
      if (nameFilters.text) {
        const title = (chart.title || '').toLowerCase();
        if (!title.includes(nameFilters.text.toLowerCase())) {
          return false;
        }
      }

      if (nameFilters.showFavorites && !favorites.has(chart.id)) {
        return false;
      }

      // Data Source filters
      if (dataSourceFilters.length > 0) {
        const dataSource = `${chart.schema_name}.${chart.table_name}`;
        if (!dataSourceFilters.includes(dataSource)) {
          return false;
        }
      }

      // Chart Type filters
      if (chartTypeFilters.length > 0) {
        if (!chartTypeFilters.includes(chart.chart_type)) {
          return false;
        }
      }

      // Date filters
      if (dateFilters.range !== 'all' && chart.updated_at) {
        const updatedDate = new Date(chart.updated_at);
        const now = new Date();

        switch (dateFilters.range) {
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
            if (dateFilters.customStart && updatedDate < dateFilters.customStart) return false;
            if (dateFilters.customEnd && updatedDate > dateFilters.customEnd) return false;
            break;
          }
        }
      }

      return true;
    });

    // Sort the filtered results
    return [...filtered].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
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

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [
    charts,
    nameFilters,
    dataSourceFilters,
    chartTypeFilters,
    dateFilters,
    favorites,
    sortBy,
    sortOrder,
  ]);

  // Handle favorites toggle
  const handleToggleFavorite = (chartId: number) => {
    setFavorites((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(chartId)) {
        newFavorites.delete(chartId);
      } else {
        newFavorites.add(chartId);
      }
      return newFavorites;
    });
  };

  // Get unique data sources and chart types for filter options
  const uniqueDataSources = useMemo(() => {
    const dataSources = new Set<string>();
    charts.forEach((chart) => {
      const dataSource = `${chart.schema_name}.${chart.table_name}`;
      if (dataSource && dataSource !== '.') {
        dataSources.add(dataSource);
      }
    });
    return Array.from(dataSources).sort();
  }, [charts]);

  const uniqueChartTypes = useMemo(() => {
    const chartTypes = new Set<string>();
    charts.forEach((chart) => {
      if (chart.chart_type) {
        chartTypes.add(chart.chart_type);
      }
    });
    return Array.from(chartTypes).sort();
  }, [charts]);

  // Get active filter count
  const getActiveFilterCount = () => {
    let count = 0;
    if (nameFilters.text || nameFilters.showFavorites) count++;
    if (dataSourceFilters.length > 0) count++;
    if (chartTypeFilters.length > 0) count++;
    if (dateFilters.range !== 'all') count++;
    return count;
  };

  // Clear all filters
  const clearAllFilters = () => {
    setNameFilters({ text: '', showFavorites: false });
    setDataSourceFilters([]);
    setChartTypeFilters([]);
    setDateFilters({ range: 'all', customStart: null, customEnd: null });
  };

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

  const generateDuplicateTitle = useCallback(
    (originalTitle: string, existingTitles: string[]): string => {
      let baseName = originalTitle;
      let copyNumber = 1;

      // Check if the title already has "Copy of" prefix
      if (originalTitle.startsWith('Copy of ')) {
        baseName = originalTitle;
      } else {
        baseName = `Copy of ${originalTitle}`;
      }

      let newTitle = baseName;

      // Find next available number if duplicates exist
      while (existingTitles.includes(newTitle)) {
        copyNumber++;
        if (originalTitle.startsWith('Copy of ')) {
          // Handle existing copies - extract base and add number
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

  const handleDuplicateChart = useCallback(
    async (chartId: number, chartTitle: string) => {
      console.log('=== DUPLICATE BUTTON CLICKED ===');
      console.log('Chart ID:', chartId);
      console.log('Chart Title:', chartTitle);

      if (!charts) {
        console.log('ERROR: Charts data not loaded');
        toast.error('Charts data not loaded');
        return;
      }

      setIsDuplicating(chartId);
      console.log('Set duplicating state for chart:', chartId);

      try {
        // Find the original chart
        const originalChart = charts.find((chart: Chart) => chart.id === chartId);
        if (!originalChart) {
          console.log('ERROR: Original chart not found');
          toast.error('Chart not found');
          return;
        }

        console.log('✓ Original chart found:', {
          id: originalChart.id,
          title: originalChart.title,
          chart_type: originalChart.chart_type,
          schema_name: originalChart.schema_name,
          table_name: originalChart.table_name,
        });

        // Generate duplicate title
        const existingTitles = charts.map((chart: Chart) => chart.title);
        const duplicateTitle = generateDuplicateTitle(originalChart.title, existingTitles);

        console.log('✓ Generated duplicate title:', duplicateTitle);

        // Create duplicate chart data
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

        console.log('✓ Duplicate chart data prepared:', duplicateChartData);
        console.log('🚀 Calling createChart API...');

        const result = await createChart(duplicateChartData);

        console.log('✅ API call successful! Result:', result);

        // Refresh the charts list
        console.log('🔄 Refreshing charts list...');
        await mutate();

        console.log('✅ Charts list refreshed successfully');
        toastSuccess.duplicated(originalChart.title, duplicateTitle);
      } catch (error: any) {
        console.log('❌ ERROR in duplicate process:', error);
        console.log('Error details:', {
          message: error?.message,
          status: error?.status,
          info: error?.info,
        });

        toastError.duplicate(error, originalChart.title);
      } finally {
        console.log('🏁 Duplicate process finished, clearing loading state');
        setIsDuplicating(null);
      }
    },
    [charts, createChart, mutate, generateDuplicateTitle]
  );

  // Multi-select functions
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

  // Bulk delete function
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
      // Try bulk delete first, fall back to individual deletes if bulk API doesn't exist
      try {
        await bulkDeleteCharts(Array.from(selectedCharts));
      } catch (bulkError) {
        // Fallback to individual deletions
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
  ]);

  // Render sort icon for table headers
  const renderSortIcon = (column: 'title' | 'updated_at' | 'chart_type' | 'data_source') => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4 text-gray-600" />
    ) : (
      <ChevronDownSort className="w-4 h-4 text-gray-600" />
    );
  };

  // Check if column has active filters
  const hasActiveFilter = (column: 'name' | 'dataSource' | 'chartType' | 'date') => {
    switch (column) {
      case 'name':
        return nameFilters.text || nameFilters.showFavorites;
      case 'dataSource':
        return dataSourceFilters.length > 0;
      case 'chartType':
        return chartTypeFilters.length > 0;
      case 'date':
        return dateFilters.range !== 'all';
      default:
        return false;
    }
  };

  // Render filter icon for table headers
  const renderFilterIcon = (column: 'name' | 'dataSource' | 'chartType' | 'date') => {
    const isActive = hasActiveFilter(column);
    return (
      <div className="relative">
        <Filter
          className={cn(
            'w-4 h-4 transition-colors',
            isActive ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'
          )}
        />
        {isActive && <div className="absolute -top-1 -right-1 w-2 h-2 bg-teal-600 rounded-full" />}
      </div>
    );
  };

  // Render Name column filter
  const renderNameFilter = () => (
    <PopoverContent className="w-80" align="start">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">Filter by Name</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNameFilters({ text: '', showFavorites: false })}
            className="h-auto p-1 text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </Button>
        </div>

        <div className="space-y-2">
          <Input
            placeholder="Search chart names..."
            value={nameFilters.text}
            onChange={(e) => setNameFilters((prev) => ({ ...prev, text: e.target.value }))}
            className="h-8"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="favorites"
              checked={nameFilters.showFavorites}
              onCheckedChange={(checked) =>
                setNameFilters((prev) => ({ ...prev, showFavorites: checked as boolean }))
              }
            />
            <Label htmlFor="favorites" className="text-sm cursor-pointer">
              Show only favorites
            </Label>
          </div>
        </div>
      </div>
    </PopoverContent>
  );

  // Filter data sources based on search with memoization
  const filteredDataSources = useMemo(() => {
    return uniqueDataSources.filter((dataSource) =>
      dataSource.toLowerCase().includes(dataSourceSearch.toLowerCase())
    );
  }, [uniqueDataSources, dataSourceSearch]);

  // Render Data Source column filter
  const renderDataSourceFilter = () => {
    return (
      <PopoverContent className="w-64" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Filter by Data Source</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDataSourceFilters([])}
              className="h-auto p-1 text-xs text-gray-500 hover:text-gray-700"
            >
              Clear
            </Button>
          </div>

          <div className="space-y-2">
            <Input
              placeholder="Search data sources..."
              value={dataSourceSearch}
              onChange={(e) => setDataSourceSearch(e.target.value)}
              className="h-8"
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2">
            {filteredDataSources.length > 0 ? (
              filteredDataSources.map((dataSource) => (
                <div
                  key={dataSource}
                  className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                  onClick={() => {
                    setDataSourceFilters((prev) => {
                      if (prev.includes(dataSource)) {
                        return prev.filter((ds) => ds !== dataSource);
                      } else {
                        return [...prev, dataSource];
                      }
                    });
                  }}
                >
                  <Checkbox
                    checked={dataSourceFilters.includes(dataSource)}
                    onChange={() => {}} // Handled by parent onClick
                  />
                  <Label className="text-sm cursor-pointer flex-1 text-gray-900">
                    {dataSource}
                  </Label>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-2">No data sources found</p>
            )}
          </div>
        </div>
      </PopoverContent>
    );
  };

  // Render Chart Type column filter
  const renderChartTypeFilter = () => (
    <PopoverContent className="w-56" align="start">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">Filter by Chart Type</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setChartTypeFilters([])}
            className="h-auto p-1 text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </Button>
        </div>

        <div className="space-y-2">
          {uniqueChartTypes.map((chartType) => (
            <div
              key={chartType}
              className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
              onClick={() => {
                setChartTypeFilters((prev) => {
                  if (prev.includes(chartType)) {
                    return prev.filter((ct) => ct !== chartType);
                  } else {
                    return [...prev, chartType];
                  }
                });
              }}
            >
              <Checkbox
                checked={chartTypeFilters.includes(chartType)}
                onChange={() => {}} // Handled by parent onClick
              />
              <Label className="text-sm cursor-pointer flex-1 text-gray-900 capitalize">
                {chartType}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </PopoverContent>
  );

  // Render Date column filter
  const renderDateFilter = () => (
    <PopoverContent className="w-72" align="start">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">Filter by Date Modified</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDateFilters({ range: 'all', customStart: null, customEnd: null })}
            className="h-auto p-1 text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </Button>
        </div>

        <div className="space-y-2">
          {[
            { value: 'all', label: 'All time' },
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'Last 7 days' },
            { value: 'month', label: 'Last 30 days' },
            { value: 'custom', label: 'Custom range' },
          ].map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <input
                type="radio"
                id={option.value}
                name="dateRange"
                checked={dateFilters.range === option.value}
                onChange={() => setDateFilters((prev) => ({ ...prev, range: option.value as any }))}
                className="w-4 h-4 text-teal-600"
              />
              <Label htmlFor={option.value} className="text-sm cursor-pointer">
                {option.label}
              </Label>
            </div>
          ))}
        </div>

        {dateFilters.range === 'custom' && (
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs text-gray-600">Custom Date Range</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  value={
                    dateFilters.customStart
                      ? dateFilters.customStart.toISOString().split('T')[0]
                      : ''
                  }
                  onChange={(e) =>
                    setDateFilters((prev) => ({
                      ...prev,
                      customStart: e.target.value ? new Date(e.target.value) : null,
                    }))
                  }
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  value={
                    dateFilters.customEnd ? dateFilters.customEnd.toISOString().split('T')[0] : ''
                  }
                  onChange={(e) =>
                    setDateFilters((prev) => ({
                      ...prev,
                      customEnd: e.target.value ? new Date(e.target.value) : null,
                    }))
                  }
                  className="h-8"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </PopoverContent>
  );

  // Render chart table row
  const renderChartTableRow = (chart: Chart) => {
    const IconComponent = chartIcons[chart.chart_type as keyof typeof chartIcons] || BarChart2;
    const typeColors = getChartTypeColor(chart.chart_type as ChartType);
    const isFavorited = favorites.has(chart.id);
    const dataSource = `${chart.schema_name}.${chart.table_name}`;

    return (
      <TableRow key={chart.id} className="hover:bg-gray-50">
        {/* Name Column with Star */}
        <TableCell className="py-4">
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
        </TableCell>

        {/* Data Source Column */}
        <TableCell className="py-4">
          <div className="flex items-center gap-2">
            <div className="text-base text-gray-700">{dataSource}</div>
          </div>
        </TableCell>

        {/* Chart Type Column */}
        <TableCell className="py-4">
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
        </TableCell>

        {/* Last Modified Column */}
        <TableCell className="py-4 text-base text-gray-600">
          {chart.updated_at
            ? formatDistanceToNow(new Date(chart.updated_at), { addSuffix: true })
            : 'Unknown'}
        </TableCell>

        {/* Actions Column */}
        <TableCell className="py-4">
          <div className="flex items-center gap-2">
            {hasPermission('can_edit_charts') && (
              <Link href={`/charts/${chart.id}/edit`}>
                <Button variant="ghost" size="icon" className="h-8 w-8 p-0 hover:bg-gray-100">
                  <Edit className="w-4 h-4 text-gray-600" />
                </Button>
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 p-0 hover:bg-gray-100">
                  <MoreVertical className="w-4 h-4 text-gray-600" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={enterSelectionMode} className="cursor-pointer">
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Select
                </DropdownMenuItem>
                {hasPermission('can_create_charts') && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDuplicateChart(chart.id, chart.title)}
                      className="cursor-pointer"
                      disabled={isDuplicating === chart.id}
                    >
                      {isDuplicating === chart.id ? (
                        <div className="w-4 h-4 mr-2 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Copy className="w-4 h-4 mr-2" />
                      )}
                      Duplicate
                    </DropdownMenuItem>
                  </>
                )}
                {hasPermission('can_view_charts') && (
                  <ChartExportDropdownForList
                    chartId={chart.id}
                    chartTitle={chart.title}
                    chartType={chart.chart_type}
                  />
                )}
                {hasPermission('can_delete_charts') && (
                  <>
                    <DropdownMenuSeparator />
                    <ChartDeleteDialog
                      chartId={chart.id}
                      chartTitle={chart.title}
                      onConfirm={() => handleDeleteChart(chart.id, chart.title)}
                      isDeleting={isDeleting === chart.id}
                    >
                      <DropdownMenuItem
                        className="cursor-pointer text-destructive focus:text-destructive"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <Trash className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </ChartDeleteDialog>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  // Calculate pagination for filtered results
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedCharts = filteredAndSortedCharts.slice(startIndex, endIndex);
  const total = filteredAndSortedCharts.length;
  const totalPages = Math.ceil(filteredAndSortedCharts.length / pageSize);

  // Render chart card (grid view)
  const renderChartCard = (chart: Chart) => {
    const IconComponent = chartIcons[chart.chart_type as keyof typeof chartIcons] || BarChart2;
    const typeColors = getChartTypeColor(chart.chart_type as ChartType);

    return (
      <Card
        id={`chart-card-${chart.id}`}
        key={chart.id}
        className={cn(
          'transition-all duration-200 hover:shadow-lg hover:shadow-gray-200/50 hover:-translate-y-0.5 h-full relative group bg-white border-gray-200/60',
          isSelectionMode && selectedCharts.has(chart.id) && 'ring-2 ring-blue-500 bg-blue-50'
        )}
      >
        {/* Checkbox for selection mode */}
        {isSelectionMode && (
          <div className="absolute top-2 left-2 z-10">
            <button
              onClick={() => toggleChartSelection(chart.id)}
              className="p-1 bg-white rounded border border-gray-300 hover:bg-gray-50"
            >
              {selectedCharts.has(chart.id) ? (
                <CheckSquare className="w-4 h-4 text-blue-600" />
              ) : (
                <Square className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>
        )}

        {/* Action Menu - only render if user has any chart permissions */}
        {(hasPermission('can_create_charts') ||
          hasPermission('can_edit_charts') ||
          hasPermission('can_delete_charts') ||
          hasPermission('can_view_charts')) && (
          <div
            className={cn('absolute top-2 right-2 z-10 flex gap-1', isSelectionMode && 'hidden')}
          >
            {/* Edit Button */}
            {hasPermission('can_edit_charts') && (
              <Link href={`/charts/${chart.id}/edit`}>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 bg-white shadow-md hover:bg-gray-50 border-gray-200"
                >
                  <Edit className="w-4 h-4 text-gray-700" />
                </Button>
              </Link>
            )}

            {/* More Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 bg-white shadow-md hover:bg-gray-50 border-gray-200"
                >
                  <MoreVertical className="w-4 h-4 text-gray-700" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={enterSelectionMode} className="cursor-pointer">
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Select
                </DropdownMenuItem>
                {hasPermission('can_create_charts') && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDuplicateChart(chart.id, chart.title)}
                      className="cursor-pointer"
                      disabled={isDuplicating === chart.id}
                    >
                      {isDuplicating === chart.id ? (
                        <div className="w-4 h-4 mr-2 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Copy className="w-4 h-4 mr-2" />
                      )}
                      Duplicate
                    </DropdownMenuItem>
                  </>
                )}
                {hasPermission('can_view_charts') && (
                  <ChartExportDropdownForList
                    chartId={chart.id}
                    chartTitle={chart.title}
                    chartType={chart.chart_type}
                  />
                )}
                {hasPermission('can_delete_charts') && (
                  <>
                    <DropdownMenuSeparator />
                    <ChartDeleteDialog
                      chartId={chart.id}
                      chartTitle={chart.title}
                      onConfirm={() => handleDeleteChart(chart.id, chart.title)}
                      isDeleting={isDeleting === chart.id}
                    >
                      <DropdownMenuItem
                        className="cursor-pointer text-destructive focus:text-destructive"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <Trash className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </ChartDeleteDialog>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Clickable content area */}
        <Link
          href={isSelectionMode || !hasPermission('can_view_charts') ? '#' : `/charts/${chart.id}`}
        >
          <div
            className={cn(!isSelectionMode && 'cursor-pointer')}
            onClick={
              isSelectionMode
                ? (e) => {
                    e.preventDefault();
                    toggleChartSelection(chart.id);
                  }
                : undefined
            }
          >
            {/* Modern Chart Preview Area */}
            <div className="relative h-40 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden group-hover:from-gray-100 group-hover:to-gray-150 transition-colors duration-200">
              {/* Large Chart Icon */}
              <div className="flex items-center justify-center h-full p-6">
                <div
                  className="rounded-xl flex items-center justify-center w-28 h-28 shadow-sm border border-white/50"
                  style={{ backgroundColor: typeColors.bgColor }}
                >
                  <IconComponent className="w-18 h-18" style={{ color: typeColors.color }} />
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="p-4 space-y-2">
              {/* Title */}
              <div className="space-y-1">
                <CardTitle className="text-sm font-medium line-clamp-2 leading-tight">
                  {chart.title}
                </CardTitle>
                {/* Data Source Info */}
                <div className="text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Data Source:</span>
                    <span className="truncate">
                      {chart.schema_name}.{chart.table_name}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Modified {formatDistanceToNow(new Date(chart.updated_at), { addSuffix: true })}
                </div>
              </div>
            </div>
          </div>
        </Link>
      </Card>
    );
  };

  // Render chart list (list view)
  const renderChartList = (chart: Chart) => {
    const IconComponent = chartIcons[chart.chart_type as keyof typeof chartIcons] || BarChart2;
    const typeColors = getChartTypeColor(chart.chart_type as ChartType);

    return (
      <Card
        id={`chart-list-${chart.id}`}
        key={chart.id}
        className={cn(
          'transition-all duration-200 hover:shadow-sm hover:bg-[#0066FF]/3',
          isSelectionMode && selectedCharts.has(chart.id) && 'ring-2 ring-blue-500 bg-blue-50'
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {/* Checkbox for selection mode */}
            {isSelectionMode && (
              <div className="mr-4">
                <button
                  onClick={() => toggleChartSelection(chart.id)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  {selectedCharts.has(chart.id) ? (
                    <CheckSquare className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </div>
            )}

            {/* Clickable main content */}
            <Link
              href={
                isSelectionMode || !hasPermission('can_view_charts') ? '#' : `/charts/${chart.id}`
              }
              className={cn(
                'flex items-center gap-4 flex-1',
                !isSelectionMode && hasPermission('can_view_charts') && 'cursor-pointer'
              )}
              onClick={
                isSelectionMode
                  ? (e) => {
                      e.preventDefault();
                      toggleChartSelection(chart.id);
                    }
                  : undefined
              }
            >
              <div
                className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: typeColors.bgColor }}
              >
                <IconComponent className="w-8 h-8" style={{ color: typeColors.color }} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="space-y-1">
                  <h3 className="font-medium truncate">{chart.title}</h3>
                  {/* Data Source Info */}
                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="font-medium min-w-0">Data Source:</span>
                      <span className="truncate">
                        {chart.schema_name}.{chart.table_name}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    Modified {formatDistanceToNow(new Date(chart.updated_at), { addSuffix: true })}
                  </div>
                </div>
              </div>
            </Link>

            {/* Action Menu */}
            {!isSelectionMode && (
              <div className="flex items-center gap-2 ml-4">
                {/* Edit Button */}
                {hasPermission('can_edit_charts') && (
                  <Link href={`/charts/${chart.id}/edit`}>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                    >
                      <Edit className="w-4 h-4 text-gray-700" />
                    </Button>
                  </Link>
                )}

                {/* More Actions Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-700" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={enterSelectionMode} className="cursor-pointer">
                      <CheckSquare className="w-4 h-4 mr-2" />
                      Select
                    </DropdownMenuItem>
                    {hasPermission('can_create_charts') && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDuplicateChart(chart.id, chart.title)}
                          className="cursor-pointer"
                          disabled={isDuplicating === chart.id}
                        >
                          {isDuplicating === chart.id ? (
                            <div className="w-4 h-4 mr-2 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Copy className="w-4 h-4 mr-2" />
                          )}
                          Duplicate
                        </DropdownMenuItem>
                      </>
                    )}
                    {hasPermission('can_view_charts') && (
                      <ChartExportDropdownForList
                        chartId={chart.id}
                        chartTitle={chart.title}
                        chartType={chart.chart_type}
                      />
                    )}
                    {hasPermission('can_delete_charts') && (
                      <>
                        <DropdownMenuSeparator />
                        <ChartDeleteDialog
                          chartId={chart.id}
                          chartTitle={chart.title}
                          onConfirm={() => handleDeleteChart(chart.id, chart.title)}
                          isDeleting={isDeleting === chart.id}
                        >
                          <DropdownMenuItem
                            className="cursor-pointer text-destructive focus:text-destructive"
                            onSelect={(e) => e.preventDefault()}
                          >
                            <Trash className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </ChartDeleteDialog>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

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
              Create and manage your data visualizations
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

        {/* Selection Bar */}
        {isSelectionMode && (
          <div
            id="charts-selection-bar"
            className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between"
          >
            <div id="charts-selection-controls" className="flex items-center gap-4">
              <div id="charts-selection-info" className="flex items-center gap-2">
                <button
                  id="charts-exit-selection-button"
                  onClick={exitSelectionMode}
                  className="p-1 hover:bg-blue-100 rounded"
                  title="Exit selection mode"
                >
                  <X id="charts-exit-selection-icon" className="w-4 h-4 text-blue-600" />
                </button>
                <span className="text-sm font-medium text-blue-900">
                  {selectedCharts.size} of {filteredAndSortedCharts.length} charts selected
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllCharts}
                  disabled={selectedCharts.size === filteredAndSortedCharts.length}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={deselectAllCharts}
                  disabled={selectedCharts.size === 0}
                >
                  Deselect All
                </Button>
              </div>
            </div>

            {hasPermission('can_delete_charts') && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={selectedCharts.size === 0 || isBulkDeleting}
              >
                {isBulkDeleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <Trash className="w-4 h-4 mr-2" />
                )}
                Delete {selectedCharts.size > 0 ? `(${selectedCharts.size})` : ''}
              </Button>
            )}
          </div>
        )}

        {/* Filter Summary - Only shows when filters are active to save space */}
        {getActiveFilterCount() > 0 && (
          <div id="charts-filters-section" className="flex items-center gap-2 px-6 pb-0">
            <span className="text-sm text-gray-600">
              {getActiveFilterCount()} filter{getActiveFilterCount() > 1 ? 's' : ''} active
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-8 px-2 text-xs text-gray-500 hover:text-gray-700"
            >
              <X className="w-3 h-3 mr-1" />
              Clear all
            </Button>
          </div>
        )}
      </div>

      {/* Scrollable Content - Only the charts list scrolls */}
      <div id="charts-content-wrapper" className="flex-1 overflow-hidden px-6">
        <div id="charts-scrollable-content" className="h-full overflow-y-auto">
          {isLoading ? (
            <div className="py-6">
              <div className="border rounded-lg bg-white">
                <TableComponent>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-[35%]">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead className="w-[30%]">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead className="w-[10%]">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-12" />
                          <Skeleton className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead className="w-[20%]">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead className="w-[5%]">
                        <Skeleton className="h-4 w-16" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...Array(8)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-8 w-8 rounded" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            <Skeleton className="h-10 w-10 rounded-lg" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-8 w-8" />
                            <Skeleton className="h-8 w-8" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </TableComponent>
              </div>
            </div>
          ) : paginatedCharts.length > 0 ? (
            <div className="py-6">
              <div className="border rounded-lg bg-white">
                <TableComponent>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-[35%]">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            className="h-auto p-0 font-medium text-base hover:bg-transparent flex-1"
                            onClick={() => handleSort('title')}
                          >
                            <div className="flex items-center gap-2">
                              Name
                              {renderSortIcon('title')}
                            </div>
                          </Button>
                          <Popover
                            open={openFilters.name}
                            onOpenChange={(open) =>
                              setOpenFilters((prev) => ({ ...prev, name: open }))
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 p-0 hover:bg-gray-100"
                              >
                                {renderFilterIcon('name')}
                              </Button>
                            </PopoverTrigger>
                            {renderNameFilter()}
                          </Popover>
                        </div>
                      </TableHead>
                      <TableHead className="w-[30%]">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            className="h-auto p-0 font-medium text-base hover:bg-transparent flex-1"
                            onClick={() => handleSort('data_source')}
                          >
                            <div className="flex items-center gap-2">
                              Data Source
                              {renderSortIcon('data_source')}
                            </div>
                          </Button>
                          <Popover
                            open={openFilters.dataSource}
                            onOpenChange={(open) =>
                              setOpenFilters((prev) => ({ ...prev, dataSource: open }))
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 p-0 hover:bg-gray-100"
                              >
                                {renderFilterIcon('dataSource')}
                              </Button>
                            </PopoverTrigger>
                            {renderDataSourceFilter()}
                          </Popover>
                        </div>
                      </TableHead>
                      <TableHead className="w-[10%]">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            className="h-auto p-0 font-medium text-base hover:bg-transparent flex-1"
                            onClick={() => handleSort('chart_type')}
                          >
                            <div className="flex items-center gap-2">
                              Type
                              {renderSortIcon('chart_type')}
                            </div>
                          </Button>
                          <Popover
                            open={openFilters.chartType}
                            onOpenChange={(open) =>
                              setOpenFilters((prev) => ({ ...prev, chartType: open }))
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 p-0 hover:bg-gray-100"
                              >
                                {renderFilterIcon('chartType')}
                              </Button>
                            </PopoverTrigger>
                            {renderChartTypeFilter()}
                          </Popover>
                        </div>
                      </TableHead>
                      <TableHead className="w-[20%]">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            className="h-auto p-0 font-medium text-base hover:bg-transparent flex-1"
                            onClick={() => handleSort('updated_at')}
                          >
                            <div className="flex items-center gap-2">
                              Last Modified
                              {renderSortIcon('updated_at')}
                            </div>
                          </Button>
                          <Popover
                            open={openFilters.date}
                            onOpenChange={(open) =>
                              setOpenFilters((prev) => ({ ...prev, date: open }))
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 p-0 hover:bg-gray-100"
                              >
                                {renderFilterIcon('date')}
                              </Button>
                            </PopoverTrigger>
                            {renderDateFilter()}
                          </Popover>
                        </div>
                      </TableHead>
                      <TableHead className="w-[5%] font-medium text-base">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCharts.map((chart) => renderChartTableRow(chart))}
                  </TableBody>
                </TableComponent>
              </div>
            </div>
          ) : (
            <div
              id="charts-empty-state"
              className="flex flex-col items-center justify-center h-full gap-4"
            >
              <BarChart2 id="charts-empty-icon" className="w-12 h-12 text-muted-foreground" />
              <p id="charts-empty-text" className="text-muted-foreground">
                {getActiveFilterCount() > 0 ? 'No charts found' : 'No charts yet'}
              </p>
              {hasPermission('can_create_charts') && (
                <Link id="charts-empty-create-link" href="/charts/new">
                  <Button
                    id="charts-empty-create-button"
                    variant="ghost"
                    className="text-white hover:opacity-90 shadow-xs"
                    style={{ backgroundColor: '#06887b' }}
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

      {/* Lightweight Modern Pagination */}
      {totalPages > 1 && (
        <div
          id="charts-pagination-footer"
          className="flex-shrink-0 border-t border-gray-100 bg-gray-50/30 py-3 px-6"
        >
          <div id="charts-pagination-wrapper" className="flex items-center justify-between">
            {/* Left: Compact Item Count */}
            <div id="charts-pagination-info" className="text-sm text-gray-600">
              {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)} of{' '}
              {total}
            </div>

            {/* Right: Streamlined Controls */}
            <div id="charts-pagination-controls" className="flex items-center gap-4">
              {/* Compact Page Size Selector */}
              <div id="charts-page-size-wrapper" className="flex items-center gap-2">
                <span id="charts-page-size-label" className="text-sm text-gray-500">
                  Show
                </span>
                <Select
                  id="charts-page-size-select"
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                    setPageSize(parseInt(value));
                    setCurrentPage(1); // Reset to first page when page size changes
                  }}
                >
                  <SelectTrigger
                    id="charts-page-size-trigger"
                    className="w-16 h-7 text-sm border-gray-200 bg-white"
                  >
                    <SelectValue id="charts-page-size-value" />
                  </SelectTrigger>
                  <SelectContent id="charts-page-size-content">
                    <SelectItem id="charts-page-size-10" value="10">
                      10
                    </SelectItem>
                    <SelectItem id="charts-page-size-20" value="20">
                      20
                    </SelectItem>
                    <SelectItem id="charts-page-size-50" value="50">
                      50
                    </SelectItem>
                    <SelectItem id="charts-page-size-100" value="100">
                      100
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Simplified Navigation */}
              <div className="flex items-center gap-1">
                <Button
                  id="charts-prev-page-button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="h-7 px-2 hover:bg-gray-100 disabled:opacity-50"
                >
                  <ChevronLeft id="charts-prev-icon" className="h-4 w-4" />
                </Button>

                <span id="charts-page-info" className="text-sm text-gray-600 px-3 py-1">
                  {currentPage} of {totalPages}
                </span>

                <Button
                  id="charts-next-page-button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="h-7 px-2 hover:bg-gray-100 disabled:opacity-50"
                >
                  <ChevronRight id="charts-next-icon" className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <DialogComponent />
    </div>
  );
}
