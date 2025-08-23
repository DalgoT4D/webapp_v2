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
} from 'lucide-react';
import Link from 'next/link';
import { useCharts, type Chart } from '@/hooks/api/useCharts';
import type { ChartCreate } from '@/types/charts';
import { useDeleteChart, useBulkDeleteCharts, useCreateChart } from '@/hooks/api/useChart';
import { ChartDeleteDialog } from '@/components/charts/ChartDeleteDialog';
import { ChartExportDropdownForList } from '@/components/charts/ChartExportDropdownForList';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
};

export default function ChartsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [chartType, setChartType] = useState<'all' | 'bar' | 'line' | 'pie' | 'number' | 'map'>(
    'all'
  );
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isDuplicating, setIsDuplicating] = useState<number | null>(null);
  // Multi-select state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedCharts, setSelectedCharts] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const { data: charts, isLoading, isError, mutate } = useCharts();
  const { trigger: deleteChart } = useDeleteChart();
  const { trigger: bulkDeleteCharts } = useBulkDeleteCharts();
  const { trigger: createChart } = useCreateChart();
  const { confirm, DialogComponent } = useConfirmationDialog();

  // Debounce search input
  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setDebouncedSearchQuery(value);
      }, 500),
    []
  );

  // Update search with debounce
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchQuery(value);
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  // Filter charts based on search and type
  const filteredCharts = useMemo(() => {
    if (!charts) return [];

    return charts.filter((chart: Chart) => {
      const matchesSearch =
        debouncedSearchQuery === '' ||
        chart.title.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        chart.description?.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

      const matchesType = chartType === 'all' || chart.chart_type === chartType;

      return matchesSearch && matchesType;
    });
  }, [charts, debouncedSearchQuery, chartType]);

  const handleDeleteChart = useCallback(
    async (chartId: number, chartTitle: string) => {
      setIsDeleting(chartId);

      try {
        await deleteChart(chartId);
        await mutate();
        toast.success(`"${chartTitle}" has been deleted successfully`);
      } catch (error) {
        console.error('Error deleting chart:', error);
        toast.error('Failed to delete chart. Please try again.');
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
          description: originalChart.description
            ? `Copy of ${originalChart.description}`
            : undefined,
          chart_type: originalChart.chart_type as 'bar' | 'pie' | 'line' | 'number' | 'map',
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
        toast.success(`Chart "${duplicateTitle}" created successfully!`);
      } catch (error: any) {
        console.log('❌ ERROR in duplicate process:', error);
        console.log('Error details:', {
          message: error?.message,
          status: error?.status,
          info: error?.info,
        });

        const errorMessage = error?.message || 'Unknown error occurred';
        toast.error(`Failed to duplicate chart: ${errorMessage}`);
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
    const allChartIds = new Set(filteredCharts.map((chart) => chart.id));
    setSelectedCharts(allChartIds);
  }, [filteredCharts]);

  const deselectAllCharts = useCallback(() => {
    setSelectedCharts(new Set());
  }, []);

  // Bulk delete function
  const handleBulkDelete = useCallback(async () => {
    if (selectedCharts.size === 0) return;

    const chartTitles = filteredCharts
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
      toast.success(
        `${selectedCharts.size} chart${selectedCharts.size === 1 ? '' : 's'} deleted successfully`
      );
      exitSelectionMode();
    } catch (error) {
      console.error('Error deleting charts:', error);
      toast.error('Failed to delete some charts. Please try again.');
    } finally {
      setIsBulkDeleting(false);
    }
  }, [selectedCharts, filteredCharts, bulkDeleteCharts, deleteChart, mutate, exitSelectionMode]);

  // Render chart card (grid view)
  const renderChartCard = (chart: Chart) => {
    const IconComponent = chartIcons[chart.chart_type as keyof typeof chartIcons] || BarChart2;

    return (
      <Card
        key={chart.id}
        className={cn(
          'transition-all duration-200 hover:shadow-md h-full relative group',
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

        {/* Action Menu */}
        <div className={cn('absolute top-2 right-2 z-10', isSelectionMode && 'hidden')}>
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
              <ChartExportDropdownForList
                chartId={chart.id}
                chartTitle={chart.title}
                chartType={chart.chart_type}
              />
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Clickable content area */}
        <Link href={isSelectionMode ? '#' : `/charts/${chart.id}`}>
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
            {/* Thumbnail */}
            <div className="relative h-48 bg-muted overflow-hidden">
              <div className="flex items-center justify-center h-full">
                <IconComponent className="w-16 h-16 text-muted-foreground" />
              </div>

              {/* Type badge */}
              <Badge variant="default" className="absolute top-2 left-2 capitalize">
                {chart.chart_type}
              </Badge>
            </div>

            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-base line-clamp-1">{chart.title}</CardTitle>
                  <CardDescription className="text-xs line-clamp-2">
                    {chart.description || 'No description'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Source:</span>
                  <span className="font-mono">
                    {chart.schema_name}.{chart.table_name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Updated:</span>
                  <span>{format(new Date(chart.updated_at), 'MMM d, yyyy')}</span>
                </div>
              </div>
            </CardContent>
          </div>
        </Link>
      </Card>
    );
  };

  // Render chart list (list view)
  const renderChartList = (chart: Chart) => {
    const IconComponent = chartIcons[chart.chart_type as keyof typeof chartIcons] || BarChart2;

    return (
      <Card
        key={chart.id}
        className={cn(
          'transition-all duration-200 hover:shadow-sm',
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
              href={isSelectionMode ? '#' : `/charts/${chart.id}`}
              className={cn('flex items-center gap-4 flex-1', !isSelectionMode && 'cursor-pointer')}
              onClick={
                isSelectionMode
                  ? (e) => {
                      e.preventDefault();
                      toggleChartSelection(chart.id);
                    }
                  : undefined
              }
            >
              <div className="w-16 h-16 bg-muted rounded flex items-center justify-center flex-shrink-0">
                <IconComponent className="w-8 h-8 text-muted-foreground" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium truncate">{chart.title}</h3>
                  <Badge variant="default" className="text-xs capitalize">
                    {chart.chart_type}
                  </Badge>
                </div>

                <p className="text-sm text-muted-foreground truncate">
                  {chart.description || 'No description'}
                </p>

                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="font-mono">
                    {chart.schema_name}.{chart.table_name}
                  </span>
                  <span>{format(new Date(chart.updated_at), 'MMM d, yyyy')}</span>
                </div>
              </div>
            </Link>

            {/* Action Menu */}
            {!isSelectionMode && (
              <div className="flex items-center gap-2 ml-4">
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
                    <ChartExportDropdownForList
                      chartId={chart.id}
                      chartTitle={chart.title}
                      chartType={chart.chart_type}
                    />
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
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Charts</h1>
            <p className="text-muted-foreground mt-1">Create and manage your data visualizations</p>
          </div>

          <Link href="/charts/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Chart
            </Button>
          </Link>
        </div>

        {/* Selection Bar */}
        {isSelectionMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={exitSelectionMode}
                  className="p-1 hover:bg-blue-100 rounded"
                  title="Exit selection mode"
                >
                  <X className="w-4 h-4 text-blue-600" />
                </button>
                <span className="text-sm font-medium text-blue-900">
                  {selectedCharts.size} of {filteredCharts.length} charts selected
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllCharts}
                  disabled={selectedCharts.size === filteredCharts.length}
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
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search charts..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-10"
            />
          </div>

          <Select value={chartType} onValueChange={(value: any) => setChartType(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="bar">Bar Charts</SelectItem>
              <SelectItem value="line">Line Charts</SelectItem>
              <SelectItem value="pie">Pie Charts</SelectItem>
              <SelectItem value="number">Number Cards</SelectItem>
              <SelectItem value="map">Maps</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div
            className={cn(
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                : 'space-y-2'
            )}
          >
            {[...Array(8)].map((_, i) => (
              <Card key={i}>
                <div className="h-48 bg-muted animate-pulse" />
                <CardHeader>
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3 w-full mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-3 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredCharts.length > 0 ? (
          <div
            className={cn(
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                : 'space-y-2'
            )}
          >
            {filteredCharts.map((chart: any) =>
              viewMode === 'grid' ? renderChartCard(chart) : renderChartList(chart)
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <BarChart2 className="w-12 h-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              {searchQuery || chartType !== 'all' ? 'No charts found' : 'No charts yet'}
            </p>
            <Link href="/charts/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create your first chart
              </Button>
            </Link>
          </div>
        )}
      </div>
      <DialogComponent />
    </div>
  );
}
