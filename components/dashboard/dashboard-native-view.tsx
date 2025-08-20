'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import GridLayoutLib, {
  Responsive as ResponsiveGridLayout,
  WidthProvider as GridLayoutWidthProvider,
} from 'react-grid-layout';
const GridLayout = GridLayoutLib;
const ResponsiveGrid = GridLayoutWidthProvider(ResponsiveGridLayout);
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Edit,
  Share2,
  Download,
  Maximize2,
  Filter,
  RefreshCw,
  Lock,
  Clock,
  User,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useDashboard, deleteDashboard } from '@/hooks/api/useDashboards';
import { useAuthStore } from '@/stores/authStore';
import { ChartElementView } from './chart-element-view';
import { FilterElement } from './filter-element';
import { UnifiedFiltersPanel } from './unified-filters-panel';
import {
  DashboardFilterType,
  type ValueFilterSettings,
  type NumericalFilterSettings,
  type DateTimeFilterSettings,
} from '@/types/dashboard-filters';
import { useToast } from '@/components/ui/use-toast';
import { ShareModal } from './ShareModal';
import type { AppliedFilters, DashboardFilterConfig } from '@/types/dashboard-filters';

// Define responsive breakpoints and column configurations (same as builder)
const BREAKPOINTS = {
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
  xxs: 0,
};

// Screen size configurations (same as builder)
const SCREEN_SIZES = {
  desktop: {
    name: 'Desktop',
    width: 1200,
    height: 800,
    cols: 12,
    breakpoint: 'lg',
  },
  tablet: {
    name: 'Tablet',
    width: 768,
    height: 1024,
    cols: 6,
    breakpoint: 'sm',
  },
  mobile: {
    name: 'Mobile',
    width: 375,
    height: 667,
    cols: 2,
    breakpoint: 'xxs',
  },
  a4: {
    name: 'A4 Print',
    width: 794,
    height: 1123,
    cols: 8,
    breakpoint: 'md',
  },
};

const COLS = {
  lg: 12,
  md: 10,
  sm: 6,
  xs: 4,
  xxs: 2,
};

type ScreenSizeKey = keyof typeof SCREEN_SIZES;

// Get current viewport screen size category
function getCurrentScreenSize(): ScreenSizeKey {
  if (typeof window === 'undefined') return 'desktop';

  const width = window.innerWidth;
  if (width >= 1200) return 'desktop';
  if (width >= 768) return 'tablet';
  if (width >= 480) return 'tablet'; // Large mobile treated as tablet
  return 'mobile';
}

// Helper function to generate responsive layouts with preview screen size focus
function generateResponsiveLayoutsForPreview(layout: any[], previewScreenSize: ScreenSizeKey): any {
  const layouts: any = {};

  // For each breakpoint, adjust the layout
  Object.keys(COLS).forEach((breakpoint) => {
    const cols = COLS[breakpoint as keyof typeof COLS];

    // Sort items by their original position (top to bottom, left to right)
    const sortedItems = [...layout].sort((a, b) => {
      if (a.y === b.y) return a.x - b.x;
      return a.y - b.y;
    });

    let currentY = 0;

    layouts[breakpoint] = sortedItems.map((item, index) => {
      let newW, newX, newY;

      // For very small screens (mobile), stack everything vertically
      if (breakpoint === 'xxs' || breakpoint === 'xs') {
        newW = cols; // Use all available columns (full width)
        newX = 0; // Always start at left edge
        newY = currentY; // Stack vertically
        currentY += Math.max(item.h, 4); // Move down for next item (min height 4)
      } else if (breakpoint === 'sm') {
        // For tablets, try 2 columns or stack
        const canFitTwo = cols >= 6;
        if (canFitTwo && item.w <= cols / 2) {
          newW = Math.floor(cols / 2); // Half width
          newX = (index % 2) * newW; // Alternate left/right
          newY = Math.floor(index / 2) * Math.max(item.h, 4); // Row positioning
        } else {
          newW = cols; // Full width
          newX = 0;
          newY = index * Math.max(item.h, 4); // Stack vertically
        }
      } else if (breakpoint === 'md') {
        // Scale proportionally for medium screens
        const scaleFactor = cols / 12;
        newW = Math.max(2, Math.min(Math.floor(item.w * scaleFactor), cols));
        newX = Math.max(0, Math.min(Math.floor(item.x * scaleFactor), cols - newW));
        newY = Math.max(0, Math.floor(item.y * scaleFactor));
      } else {
        // Large screens - keep original layout but ensure bounds
        newW = Math.min(item.w, cols);
        newX = Math.max(0, Math.min(item.x, cols - newW));
        newY = Math.max(0, item.y);
      }

      const result = {
        ...item,
        w: Math.max(1, Math.min(newW, cols)), // Ensure valid width (at least 1, max cols)
        x: Math.max(0, Math.min(newX, cols - 1)), // Ensure valid X position
        y: Math.max(0, newY), // Ensure non-negative Y
        minW: Math.max(1, Math.min(item.minW || 2, cols)), // Ensure valid minW
        maxW: cols, // Max width is all columns
      };

      return result;
    });
  });

  return layouts;
}

// Convert DashboardFilter (API response) to DashboardFilterConfig (frontend format)
function convertFilterToConfig(
  filter: any,
  position: { x: number; y: number; w: number; h: number }
): DashboardFilterConfig {
  const baseConfig = {
    id: filter.id.toString(),
    name: filter.name,
    schema_name: filter.schema_name,
    table_name: filter.table_name,
    column_name: filter.column_name,
    filter_type: filter.filter_type as DashboardFilterType,
    position,
  };

  if (filter.filter_type === 'value') {
    return {
      ...baseConfig,
      filter_type: DashboardFilterType.VALUE,
      settings: filter.settings as ValueFilterSettings,
    };
  } else if (filter.filter_type === 'numerical') {
    return {
      ...baseConfig,
      filter_type: DashboardFilterType.NUMERICAL,
      settings: filter.settings as NumericalFilterSettings,
    };
  } else if (filter.filter_type === 'datetime') {
    return {
      ...baseConfig,
      filter_type: DashboardFilterType.DATETIME,
      settings: filter.settings as DateTimeFilterSettings,
    };
  } else {
    // Fallback to VALUE type for unknown types
    return {
      ...baseConfig,
      filter_type: DashboardFilterType.VALUE,
      settings: filter.settings as ValueFilterSettings,
    };
  }
}

interface DashboardNativeViewProps {
  dashboardId: number;
  isPublicMode?: boolean;
  publicToken?: string;
  dashboardData?: any; // Pre-fetched dashboard data for public mode
}

export function DashboardNativeView({
  dashboardId,
  isPublicMode = false,
  publicToken,
  dashboardData,
}: DashboardNativeViewProps) {
  const router = useRouter();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<AppliedFilters>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [currentBreakpoint, setCurrentBreakpoint] = useState('lg');
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Ref for the dashboard container
  const containerRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();

  // Get current user info for permission checks
  const getCurrentOrgUser = useAuthStore((state) => state.getCurrentOrgUser);
  const currentUser = getCurrentOrgUser();

  // Fetch dashboard data (skip API call if we have pre-fetched data for public mode)
  const {
    data: dashboardFromApi,
    isLoading: apiIsLoading,
    isError: apiIsError,
    mutate,
  } = useDashboard(isPublicMode && dashboardData ? null : dashboardId);

  // Use pre-fetched data for public mode, otherwise use API data
  const dashboard = isPublicMode && dashboardData ? dashboardData : dashboardFromApi;

  // Override loading and error states for public mode when we have pre-fetched data
  const isLoading = isPublicMode && dashboardData ? false : apiIsLoading;
  const isError = isPublicMode && dashboardData ? false : apiIsError;

  // Check if user can edit (creator or admin)
  const canEdit = useMemo(() => {
    if (!dashboard || !currentUser) return false;
    return (
      dashboard.created_by === currentUser.email ||
      currentUser.new_role_slug === 'admin' ||
      currentUser.new_role_slug === 'super-admin'
    );
  }, [dashboard, currentUser]);

  // Check if dashboard is locked
  const isLocked = dashboard?.is_locked || false;
  const lockedBy = dashboard?.locked_by;

  // Check if dashboard is locked by another user
  const isLockedByOther = isLocked && lockedBy && lockedBy !== currentUser?.email;

  // Get target screen size (the size dashboard was designed for)
  const targetScreenSize = (dashboard?.target_screen_size as ScreenSizeKey) || 'desktop';
  const [currentScreenSize, setCurrentScreenSize] = useState<ScreenSizeKey>('desktop');

  // Get filter layout from dashboard data (same as edit mode)
  const filterLayout = (dashboard?.filter_layout as 'vertical' | 'horizontal') || 'vertical';

  // Convert dashboard filters to DashboardFilterConfig format for UnifiedFiltersPanel
  const dashboardFilters: DashboardFilterConfig[] = useMemo(() => {
    if (!dashboard?.filters || !Array.isArray(dashboard.filters)) return [];

    return dashboard.filters.map((filter: any) =>
      convertFilterToConfig(filter, { x: 0, y: 0, w: 4, h: 3 })
    );
  }, [dashboard?.filters]);

  // Allow editing in preview mode without any conditions

  // Set container width to match the target screen size exactly
  useEffect(() => {
    const targetConfig = SCREEN_SIZES[targetScreenSize];
    setContainerWidth(targetConfig.width);
  }, [targetScreenSize]);

  // Update current screen size on resize
  useEffect(() => {
    const updateScreenSize = () => {
      const newScreenSize = getCurrentScreenSize();
      setCurrentScreenSize(newScreenSize);
    };

    // Initial measurement
    updateScreenSize();

    // Update on window resize with debouncing
    let resizeTimeout: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateScreenSize, 150);
    };

    window.addEventListener('resize', debouncedResize);

    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', debouncedResize);
    };
  }, []);

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Handle edit navigation
  const handleEdit = () => {
    router.push(`/dashboards/${dashboardId}/edit`);
  };

  // Handle share
  const handleShare = () => {
    setShareModalOpen(true);
  };

  // Handle share modal close
  const handleShareModalClose = () => {
    setShareModalOpen(false);
  };

  // Handle dashboard update after sharing changes
  const handleDashboardUpdate = () => {
    mutate(); // Refresh the dashboard data
  };

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await mutate();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Handle filter changes (for legacy filter components in canvas)
  const handleFilterChange = (filterId: string, value: any) => {
    setSelectedFilters((prev) => ({
      ...prev,
      [filterId]: value,
    }));
  };

  // Handle filters applied from UnifiedFiltersPanel
  const handleFiltersApplied = (appliedFilters: AppliedFilters) => {
    setSelectedFilters(appliedFilters);
  };

  // Handle filters cleared from UnifiedFiltersPanel
  const handleFiltersCleared = () => {
    setSelectedFilters({});
  };

  const handleClearAllFilters = () => {
    setSelectedFilters({});
  };

  // Handle dashboard deletion
  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      await deleteDashboard(dashboardId);

      toast({
        title: 'Dashboard deleted',
        description: `"${dashboard?.title}" has been successfully deleted.`,
        variant: 'default',
      });

      // Navigate back to dashboard list
      router.push('/dashboards');
    } catch (error) {
      console.error('Error deleting dashboard:', error);
      toast({
        title: 'Delete failed',
        description: 'Failed to delete the dashboard. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Render dashboard components
  const renderComponent = (componentId: string) => {
    if (!dashboard?.components) return null;

    const component = dashboard.components[componentId];
    if (!component) return null;

    switch (component.type) {
      case 'chart':
        return (
          <div key={componentId} className="h-full">
            <ChartElementView
              chartId={component.config?.chartId}
              dashboardFilters={selectedFilters}
              viewMode={true}
              className="h-full"
              isPublicMode={isPublicMode}
              publicToken={publicToken}
              config={component.config}
            />
          </div>
        );

      case 'text':
        const config = component.config;

        // Handle both old and new text component formats
        const isUnifiedTextComponent = config?.type !== undefined;

        if (isUnifiedTextComponent) {
          // New unified text component format
          const content = config?.content || 'Text content';
          const commonStyle = {
            fontSize: `${config?.fontSize || 14}px`,
            fontWeight: config?.fontWeight || 'normal',
            fontStyle: config?.fontStyle || 'normal',
            textDecoration: config?.textDecoration || 'none',
            textAlign: (config?.textAlign || 'left') as any,
            color: config?.color || '#1f2937',
            backgroundColor: config?.backgroundColor || 'transparent',
            lineHeight: config?.type === 'heading' ? '1.2' : '1.6',
            padding: '8px',
            margin: 0,
            whiteSpace: 'pre-wrap' as any,
            wordBreak: 'break-word' as any,
          };

          if (config?.type === 'heading') {
            const headingLevel = config?.headingLevel || 2;
            const HeadingTag = `h${headingLevel}` as keyof React.JSX.IntrinsicElements;
            const headingClass = cn(
              headingLevel === 1 && 'text-3xl font-bold',
              headingLevel === 2 && 'text-2xl font-semibold',
              headingLevel === 3 && 'text-xl font-medium'
            );

            return (
              <div key={componentId} className="h-full flex items-start">
                <HeadingTag className={headingClass} style={commonStyle}>
                  {content}
                </HeadingTag>
              </div>
            );
          }

          return (
            <div key={componentId} className="h-full flex items-start">
              <div style={commonStyle}>{content}</div>
            </div>
          );
        } else {
          // Legacy text component format
          return (
            <div key={componentId} className="h-full p-4">
              <div
                className="text-gray-900"
                style={{
                  fontSize: config?.fontSize || 14,
                  fontWeight: config?.fontWeight || 'normal',
                  color: config?.color || '#1f2937',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {config?.content || 'Text content'}
              </div>
            </div>
          );
        }

      case 'heading':
        // Legacy heading component - keep for backward compatibility
        const level = component.config?.level || 2;
        const headingStyles = cn(
          'text-gray-900 font-semibold',
          level === 1 && 'text-2xl',
          level === 2 && 'text-xl',
          level === 3 && 'text-lg'
        );

        const HeadingTag = `h${level}` as keyof React.JSX.IntrinsicElements;
        return (
          <div key={componentId} className="h-full p-4 flex items-center">
            <HeadingTag
              className={headingStyles}
              style={{ color: component.config?.color || '#1f2937' }}
            >
              {component.config?.text || 'Heading'}
            </HeadingTag>
          </div>
        );

      case 'filter':
        // Get the actual filter data from dashboard.filters using the filterId reference
        const filterId = component.config?.filterId || component.config?.id;

        // First try to find in dashboard.filters array
        let filterData = dashboard?.filters?.find((f: any) => {
          // Convert both to numbers for comparison since one might be string
          return Number(f.id) === Number(filterId);
        });

        // If not found in filters array (for backward compatibility), use config directly
        if (!filterData && component.config?.column_name) {
          filterData = component.config;
        }

        if (!filterData) {
          return (
            <div key={componentId} className="h-full p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-red-600">Filter not found: ID {filterId}</p>
              <p className="text-xs">
                Available: {dashboard?.filters?.map((f: any) => f.id).join(', ')}
              </p>
            </div>
          );
        }

        // Convert to proper format using conversion function
        const normalizedFilter = convertFilterToConfig(filterData, { x: 0, y: 0, w: 4, h: 3 });

        return (
          <div key={componentId} className="h-full">
            <FilterElement
              filter={normalizedFilter}
              onRemove={() => {}} // No remove in view mode
              isEditMode={false}
              value={selectedFilters[normalizedFilter.id]}
              onChange={handleFilterChange}
            />
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
        <div className="bg-white border-b px-6 py-4 flex-shrink-0">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-12 gap-4">
            <Skeleton className="col-span-6 h-64" />
            <Skeleton className="col-span-6 h-64" />
            <Skeleton className="col-span-4 h-48" />
            <Skeleton className="col-span-8 h-48" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !dashboard) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold mb-2">Dashboard Not Found</h2>
              <p className="text-sm text-muted-foreground mb-4">
                The dashboard you're looking for doesn't exist or you don't have access to it.
              </p>
              <Button onClick={() => router.push('/dashboards')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboards
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'h-screen flex flex-col bg-white overflow-hidden',
        isFullscreen && 'fixed inset-0 z-50'
      )}
    >
      {/* Fixed Header */}
      <div className="bg-white border-b shadow-sm flex-shrink-0">
        {/* Mobile Header */}
        <div className="lg:hidden">
          {/* Mobile Top Row */}
          <div className="px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {!isFullscreen && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/dashboards')}
                  className="p-1 flex-shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold text-gray-900 truncate dashboard-header-title">
                    {dashboard.title}
                  </h1>
                  {dashboard.is_published && (
                    <Badge
                      variant="default"
                      className="text-xs bg-green-100 text-green-800 flex-shrink-0"
                    >
                      Published
                    </Badge>
                  )}
                  {isLocked && (
                    <Badge
                      variant={isLockedByOther ? 'destructive' : 'secondary'}
                      className="text-xs flex-shrink-0"
                    >
                      <Lock className="w-3 h-3 mr-1" />
                      Locked
                    </Badge>
                  )}
                </div>
                {dashboard.description && (
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2 dashboard-header-description">
                    {dashboard.description}
                  </p>
                )}
              </div>
            </div>

            {/* Mobile Quick Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-1.5"
              >
                <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
              </Button>
              <Button variant="outline" size="sm" onClick={toggleFullscreen} className="p-1.5">
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Mobile Action Row */}
          {!isPublicMode && (
            <div className="px-4 pb-2 flex items-center gap-2 overflow-x-auto mobile-action-row">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="flex-shrink-0 h-8 text-xs"
              >
                <Share2 className="w-3 h-3 mr-1" />
                Share
              </Button>
              {canEdit && !isLockedByOther && (
                <>
                  <Button onClick={handleEdit} size="sm" className="flex-shrink-0 h-8 text-xs">
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isDeleting}
                        className="flex-shrink-0 h-8 text-xs"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Dashboard</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{dashboard?.title}"? This action cannot
                          be undone and will permanently remove all dashboard content and
                          configuration.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          disabled={isDeleting}
                        >
                          {isDeleting ? 'Deleting...' : 'Delete Dashboard'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          )}

          {/* Mobile Metadata Row */}
          <div className="px-4 pb-2 flex items-center gap-4 text-xs text-gray-500 border-t pt-2">
            {dashboard.last_modified_by && (
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span className="truncate">{dashboard.last_modified_by}</span>
              </div>
            )}
            {dashboard.updated_at && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{format(new Date(dashboard.updated_at), 'MMM d, yyyy')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden lg:block px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              {!isFullscreen && (
                <Button variant="ghost" size="sm" onClick={() => router.push('/dashboards')}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900 dashboard-header-title">
                    {dashboard.title}
                  </h1>
                  {dashboard.is_published && (
                    <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                      Published
                    </Badge>
                  )}
                  {isLocked && (
                    <Badge
                      variant={isLockedByOther ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      <Lock className="w-3 h-3 mr-1" />
                      {isLockedByOther ? `Locked by ${lockedBy}` : `Locked by you`}
                    </Badge>
                  )}
                </div>
                {dashboard.description && (
                  <p className="text-sm text-gray-600 mt-1 dashboard-header-description">
                    {dashboard.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Metadata */}
              <div className="flex items-center gap-4 mr-4 text-xs text-gray-500">
                {dashboard.last_modified_by && (
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>{dashboard.last_modified_by}</span>
                  </div>
                )}
                {dashboard.updated_at && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{format(new Date(dashboard.updated_at), 'MMM d, yyyy')}</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
              </Button>

              <Button variant="outline" size="sm" onClick={toggleFullscreen}>
                <Maximize2 className="w-4 h-4" />
              </Button>

              {!isPublicMode && (
                <>
                  <Button variant="outline" size="sm" onClick={handleShare}>
                    <Share2 className="w-4 h-4" />
                  </Button>

                  {canEdit && !isLockedByOther && (
                    <>
                      <Button onClick={handleEdit} size="sm">
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Dashboard
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" disabled={isDeleting}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Dashboard</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{dashboard?.title}"? This action
                              cannot be undone and will permanently remove all dashboard content and
                              configuration.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleDelete}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              disabled={isDeleting}
                            >
                              {isDeleting ? 'Deleting...' : 'Delete Dashboard'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Horizontal Filters Bar */}
      {filterLayout === 'horizontal' && dashboardFilters.length > 0 && (
        <UnifiedFiltersPanel
          initialFilters={dashboardFilters}
          dashboardId={dashboardId}
          isEditMode={false}
          layout="horizontal"
          onFiltersApplied={handleFiltersApplied}
          onFiltersCleared={handleFiltersCleared}
          isPublicMode={isPublicMode}
          publicToken={publicToken}
        />
      )}
      {/* Main Content Area */}
      <div
        className={cn(
          'flex-1 flex overflow-hidden',
          filterLayout === 'vertical' ? 'flex-col md:flex-row' : ''
        )}
      >
        {/* Vertical Filters Sidebar */}
        {filterLayout === 'vertical' && dashboardFilters.length > 0 && (
          <UnifiedFiltersPanel
            initialFilters={dashboardFilters}
            dashboardId={dashboardId}
            isEditMode={false}
            layout="vertical"
            onFiltersApplied={handleFiltersApplied}
            onFiltersCleared={handleFiltersCleared}
            isPublicMode={isPublicMode}
            publicToken={publicToken}
          />
        )}

        {/* Dashboard Content - Scrollable Canvas Area */}
        <div className="flex-1 overflow-auto p-4 md:p-6 min-w-0 bg-gray-50">
          <div className="flex justify-center">
            <div
              className="dashboard-canvas bg-white border border-gray-300 shadow-lg relative z-10"
              style={{
                width: SCREEN_SIZES[targetScreenSize].width,
                minHeight: SCREEN_SIZES[targetScreenSize].height,
                maxWidth: '100%',
              }}
            >
              {/* Canvas Header */}
              <div className="absolute -top-8 left-0 text-xs text-gray-500 font-medium">
                {SCREEN_SIZES[targetScreenSize].name} Canvas ({SCREEN_SIZES[targetScreenSize].width}{' '}
                × {SCREEN_SIZES[targetScreenSize].height}px)
              </div>

              {/* Show empty state if no layout config */}
              {!dashboard?.layout_config || dashboard.layout_config.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p className="text-lg mb-2">No Dashboard Components</p>
                  <p className="text-sm">
                    This dashboard doesn't have any components configured yet.
                  </p>
                </div>
              ) : null}

              {/* Conditional Grid Layout: Use simple GridLayout for target screen size, ResponsiveGridLayout for others */}
              {currentScreenSize === targetScreenSize ? (
                // Target screen size - use exact same layout as edit mode
                <GridLayout
                  className="dashboard-grid"
                  layout={dashboard.layout_config || []}
                  cols={SCREEN_SIZES[targetScreenSize].cols}
                  rowHeight={30}
                  width={SCREEN_SIZES[targetScreenSize].width}
                  isDraggable={false}
                  isResizable={false}
                  compactType={null}
                  preventCollision={true}
                  allowOverlap={false}
                  margin={[4, 4]}
                  containerPadding={[4, 4]}
                  autoSize={true}
                  verticalCompact={false}
                >
                  {(dashboard.layout_config || []).map((layoutItem: any) => (
                    <div key={layoutItem.i} className="dashboard-item">
                      <Card className="h-full shadow-sm hover:shadow-md transition-shadow duration-200">
                        <CardContent className="p-4 h-full">
                          {renderComponent(layoutItem.i)}
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </GridLayout>
              ) : (
                // Different screen size - use responsive layout
                <ResponsiveGrid
                  className="dashboard-grid"
                  layouts={
                    dashboard.responsive_layouts ||
                    generateResponsiveLayoutsForPreview(
                      dashboard.layout_config || [],
                      targetScreenSize
                    )
                  }
                  breakpoints={BREAKPOINTS}
                  cols={COLS}
                  rowHeight={30}
                  width={SCREEN_SIZES[targetScreenSize].width}
                  isDraggable={false}
                  isResizable={false}
                  compactType={null}
                  preventCollision={false}
                  margin={[4, 4]}
                  containerPadding={[4, 4]}
                  autoSize={true}
                  verticalCompact={false}
                  onBreakpointChange={(newBreakpoint: string) => {
                    setCurrentBreakpoint(newBreakpoint);
                  }}
                >
                  {(dashboard.layout_config || []).map((layoutItem: any) => (
                    <div key={layoutItem.i} className="dashboard-item">
                      <Card className="h-full shadow-sm hover:shadow-md transition-shadow duration-200">
                        <CardContent className="p-4 h-full">
                          {renderComponent(layoutItem.i)}
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </ResponsiveGrid>
              )}
            </div>
          </div>
        </div>
      </div>{' '}
      {/* Close Main Content Area */}
      {/* Custom styles for preview mode canvas */}
      <style jsx global>{`
        .dashboard-canvas {
          position: relative;
          border-radius: 8px;
          overflow: hidden;
        }

        .dashboard-canvas .dashboard-grid {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .dashboard-canvas .dashboard-item {
          transition: transform 0.2s ease;
          cursor: default;
        }

        .dashboard-canvas .dashboard-item:hover {
          z-index: 10;
        }

        .dashboard-canvas .react-grid-item {
          transition: none !important;
        }

        .dashboard-canvas .react-grid-item.react-grid-placeholder {
          display: none !important;
        }

        /* Canvas border animations */
        .dashboard-canvas {
          animation: canvasAppear 0.3s ease-out;
        }

        @keyframes canvasAppear {
          from {
            opacity: 0;
            transform: scale(0.98);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
      {/* Share Modal */}
      {dashboard && !isPublicMode && (
        <ShareModal
          dashboard={dashboard}
          isOpen={shareModalOpen}
          onClose={handleShareModalClose}
          onUpdate={handleDashboardUpdate}
        />
      )}
    </div>
  );
}
