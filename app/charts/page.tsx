'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  BarChart2,
  PieChart,
  LineChart,
  MoreVertical,
  Edit,
  Trash,
  Search,
  Grid,
  List,
  Copy,
  Download,
  AlertCircle,
  MapPin,
  Hash,
} from 'lucide-react';
import Link from 'next/link';
import { useCharts, useDeleteChart } from '@/hooks/api/useChart';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Chart } from '@/types/charts';

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

  const { data: charts, isLoading, error, mutate } = useCharts();
  const { trigger: deleteChart } = useDeleteChart();

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

  const handleDuplicateChart = useCallback((chartId: number, chartTitle: string) => {
    toast.success('Chart duplication will be available soon');
  }, []);

  const handleDownloadChart = useCallback((chartId: number, chartTitle: string) => {
    toast.success('Chart download will be available soon');
  }, []);

  // Render chart card (grid view)
  const renderChartCard = (chart: Chart) => {
    const IconComponent = chartIcons[chart.chart_type as keyof typeof chartIcons] || BarChart2;

    return (
      <Card
        key={chart.id}
        className="transition-all duration-200 hover:shadow-md h-full relative group"
      >
        {/* Action Menu */}
        <div className="absolute top-2 right-2 z-10">
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
              <DropdownMenuItem
                onClick={() => handleDuplicateChart(chart.id, chart.title)}
                className="cursor-pointer"
              >
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDownloadChart(chart.id, chart.title)}
                className="cursor-pointer"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:text-destructive"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Trash className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Chart</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{chart.title}"? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDeleteChart(chart.id, chart.title)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting === chart.id ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Clickable content area */}
        <Link href={`/charts/${chart.id}`}>
          <div className="cursor-pointer">
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
      <Card key={chart.id} className="transition-all duration-200 hover:shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {/* Clickable main content */}
            <Link
              href={`/charts/${chart.id}`}
              className="flex items-center gap-4 flex-1 cursor-pointer"
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
                  <DropdownMenuItem
                    onClick={() => handleDuplicateChart(chart.id, chart.title)}
                    className="cursor-pointer"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDownloadChart(chart.id, chart.title)}
                    className="cursor-pointer"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        className="cursor-pointer text-destructive focus:text-destructive"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <Trash className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Chart</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{chart.title}"? This action cannot be
                          undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteChart(chart.id, chart.title)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {isDeleting === chart.id ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (error) {
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
            {filteredCharts.map((chart) =>
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
    </div>
  );
}
