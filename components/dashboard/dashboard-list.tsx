'use client';

import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Grid,
  List,
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  Activity,
  Heart,
  Target,
  Zap,
  Shield,
  Globe,
  Building,
  Calendar,
  FileText,
  Settings,
  ArrowRight,
  Plus,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import useSWR from 'swr';
import { apiGet } from '@/lib/api';
import Image from 'next/image';
import { format } from 'date-fns';

// Simple debounce implementation
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function (...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

interface Dashboard {
  id: number;
  dashboard_title: string;
  slug?: string;
  description?: string;
  published: boolean;
  json_metadata?: string;
  changed_on: string;
  changed_on_utc: string;
  changed_on_humanized?: string;
  changed_by?: {
    first_name: string;
    last_name: string;
  };
  tags?: string[];
  owners?: Array<{
    first_name: string;
    last_name: string;
    username: string;
  }>;
  thumbnail_url?: string;
  url?: string;
}

interface DashboardListResponse {
  count: number;
  ids: number[];
  result: Dashboard[];
}

interface DashboardParams {
  page: number;
  page_size: number;
  search?: string;
  status?: string;
}

// Helper function to build query string
function buildQueryString(params: DashboardParams): string {
  const queryParams = new URLSearchParams();
  queryParams.append('page', params.page.toString());
  queryParams.append('page_size', params.page_size.toString());

  if (params.search) {
    queryParams.append('search', params.search);
  }

  if (params.status && params.status !== 'all') {
    queryParams.append('status', params.status);
  }

  return queryParams.toString();
}

// Custom hook for fetching dashboards
function useSupersetDashboards(params: DashboardParams) {
  const queryString = buildQueryString(params);

  const { data, error, mutate } = useSWR<DashboardListResponse>(
    `/api/superset/dashboards/?${queryString}`,
    apiGet,
    {
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: true,
      onError: (error) => {
        console.error('Dashboard fetch error:', error);
      },
    }
  );

  return {
    data,
    error,
    mutate,
    isLoading: !data && !error,
  };
}

export function DashboardList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 12;

  // Debounce search input
  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setDebouncedSearchQuery(value);
        setCurrentPage(0); // Reset to first page on search
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

  // Build params for API call
  const params: DashboardParams = {
    page: currentPage,
    page_size: pageSize,
    search: debouncedSearchQuery,
    status: statusFilter,
  };

  // Fetch dashboards using custom hook
  const { data, error, isLoading } = useSupersetDashboards(params);

  // Calculate pagination
  const totalPages = data ? Math.ceil(data.count / pageSize) : 0;
  const dashboards = data?.result || [];

  // Handle status filter change
  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(0); // Reset to first page
  };

  // Handle page navigation
  const goToPage = (page: number) => {
    if (page >= 0 && page < totalPages) {
      setCurrentPage(page);
    }
  };

  const renderDashboardCard = (dashboard: Dashboard) => {
    return (
      <Link key={dashboard.id} href={`/dashboards/${dashboard.id}`}>
        <Card
          className={cn(
            'cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] h-full',
            !dashboard.published && 'opacity-75'
          )}
        >
          {/* Thumbnail */}
          <div className="relative h-48 bg-muted overflow-hidden">
            {dashboard.thumbnail_url ? (
              <Image
                src={dashboard.thumbnail_url}
                alt={dashboard.dashboard_title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                onError={(e) => {
                  // Fallback to placeholder on error
                  e.currentTarget.src = '/api/superset/dashboards/placeholder/thumbnail/';
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <BarChart3 className="h-16 w-16 text-muted-foreground/20" />
              </div>
            )}
          </div>

          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-base line-clamp-2">
                  {dashboard.dashboard_title}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant={dashboard.published ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {dashboard.published ? 'Published' : 'Draft'}
                  </Badge>
                  {dashboard.tags?.slice(0, 1).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            {dashboard.description && (
              <CardDescription className="text-sm mb-3 line-clamp-2">
                {dashboard.description}
              </CardDescription>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {dashboard.changed_on_humanized ||
                  (dashboard.changed_on
                    ? format(new Date(dashboard.changed_on), 'MMM d, yyyy')
                    : 'Recently')}
              </span>
              {dashboard.changed_by && (
                <span>
                  {dashboard.changed_by.first_name} {dashboard.changed_by.last_name}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  };

  const renderDashboardListItem = (dashboard: Dashboard) => {
    return (
      <Link key={dashboard.id} href={`/dashboards/${dashboard.id}`}>
        <div
          className={cn(
            'flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:bg-accent/50 hover:shadow-sm',
            !dashboard.published && 'opacity-75'
          )}
        >
          {/* Thumbnail */}
          <div className="relative w-24 h-16 bg-muted rounded overflow-hidden flex-shrink-0">
            {dashboard.thumbnail_url ? (
              <Image
                src={dashboard.thumbnail_url}
                alt={dashboard.dashboard_title}
                fill
                className="object-cover"
                sizes="96px"
                onError={(e) => {
                  e.currentTarget.src = '/api/superset/dashboards/placeholder/thumbnail/';
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <BarChart3 className="h-8 w-8 text-muted-foreground/20" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium truncate">{dashboard.dashboard_title}</h3>
              <Badge
                variant={dashboard.published ? 'default' : 'secondary'}
                className="text-xs flex-shrink-0"
              >
                {dashboard.published ? 'Published' : 'Draft'}
              </Badge>
              {dashboard.tags?.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs flex-shrink-0">
                  {tag}
                </Badge>
              ))}
            </div>
            {dashboard.description && (
              <p className="text-sm text-muted-foreground truncate mb-2">{dashboard.description}</p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {dashboard.changed_on_humanized ||
                  (dashboard.changed_on
                    ? format(new Date(dashboard.changed_on), 'MMM d, yyyy')
                    : 'Recently')}
              </span>
              {dashboard.changed_by && (
                <span className="text-xs text-muted-foreground">
                  by {dashboard.changed_by.first_name} {dashboard.changed_by.last_name}
                </span>
              )}
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>
      </Link>
    );
  };

  // Loading skeleton components
  const renderCardSkeleton = () => (
    <Card className="h-full">
      <Skeleton className="h-48 w-full" />
      <CardHeader>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2 mt-2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-3 w-full mb-2" />
        <Skeleton className="h-3 w-4/5" />
      </CardContent>
    </Card>
  );

  const renderListSkeleton = () => (
    <div className="flex items-center gap-4 p-4 border rounded-lg">
      <Skeleton className="w-24 h-16 flex-shrink-0" />
      <div className="flex-1">
        <Skeleton className="h-4 w-1/3 mb-2" />
        <Skeleton className="h-3 w-1/2 mb-2" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Static Header */}
      <div className="p-6 border-b">
        {/* Header with Create Dashboard Button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboards</h1>
            <p className="text-muted-foreground">
              Monitor and analyze your maternal health program performance
            </p>
          </div>
          <Link href="/dashboards/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Dashboard
            </Button>
          </Link>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search dashboards by title..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex border rounded-md ml-auto">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            {isLoading
              ? 'Loading dashboards...'
              : error
                ? `Error: ${error.message || 'Failed to load dashboards'}`
                : data
                  ? `Showing ${dashboards.length} of ${data.count} dashboards`
                  : 'No dashboards available'}
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div
            className={cn(
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-3'
            )}
          >
            {Array.from({ length: 6 }).map((_, i) =>
              viewMode === 'grid' ? (
                <div key={i}>{renderCardSkeleton()}</div>
              ) : (
                <div key={i}>{renderListSkeleton()}</div>
              )
            )}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <div className="text-red-500 mb-2">Failed to load dashboards</div>
            <div className="text-sm text-muted-foreground">
              {error.message || 'Please try again later'}
            </div>
          </div>
        ) : dashboards.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <div className="text-muted-foreground mb-2">No dashboards found</div>
            <div className="text-sm text-muted-foreground">
              {debouncedSearchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria'
                : 'Create your first dashboard to get started'}
            </div>
          </div>
        ) : (
          <>
            <div
              className={cn(
                viewMode === 'grid'
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                  : 'space-y-3'
              )}
            >
              {dashboards.map((dashboard) =>
                viewMode === 'grid'
                  ? renderDashboardCard(dashboard)
                  : renderDashboardListItem(dashboard)
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i;
                    } else if (currentPage < 3) {
                      pageNum = i;
                    } else if (currentPage >= totalPages - 3) {
                      pageNum = totalPages - 5 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => goToPage(pageNum)}
                        className="w-10"
                      >
                        {pageNum + 1}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages - 1}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
