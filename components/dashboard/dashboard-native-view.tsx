'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Maximize2, Lock, Clock, User, Star, StarOff, Settings } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  useDashboard,
  getDashboardSharingStatus,
  updateDashboardSharing,
} from '@/hooks/api/useDashboards';
import { useAuthStore } from '@/stores/authStore';
import { ChartElementView } from './chart-element-view';
import { FilterElement } from './filter-element';
import { UnifiedFiltersPanel } from './unified-filters-panel';
import { getDefaultFilterValues } from '@/lib/dashboard-filter-utils';
import { UnifiedTextElement } from './text-element-unified';
import { ImageElement } from './image-element';
import { DashboardLogo } from './dashboard-logo';
import {
  DashboardFilterType,
  type AppliedFilters,
  type DashboardFilterConfig,
  type ValueFilterSettings,
  type NumericalFilterSettings,
  type DateTimeFilterSettings,
} from '@/types/dashboard-filters';
import { ShareModal } from '@/components/ui/share-modal';
import { ResponsiveDashboardActions } from './responsive-dashboard-actions';
import { ResponsiveFiltersSection } from './responsive-filters-section';
import type { FrozenChartConfig } from '@/types/reports';
import { useLandingPage } from '@/hooks/api/useLandingPage';
import type { OrgBranding } from '@/hooks/api/useDashboardBranding';
import useSWR, { mutate as swrMutate } from 'swr';
import { apiGet } from '@/lib/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import {
  buildDashboardBackgroundImageStyle,
  buildDashboardOverlayStyle,
  buildDashboardSurfaceStyle,
} from '@/lib/dashboard-theme';

// Define responsive breakpoints and column configurations (same as builder)
// Superset-style: Always 12 columns, they just scale with container width
const BREAKPOINTS = {
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
  xxs: 0,
};

// Screen size configurations (same as builder)
// All use 12 columns - the column width scales based on container size
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
    cols: 12,
    breakpoint: 'sm',
  },
  mobile: {
    name: 'Mobile',
    width: 375,
    height: 667,
    cols: 12,
    breakpoint: 'xxs',
  },
};

// Fixed 12 columns at all breakpoints - columns scale with container width
const COLS = {
  lg: 12,
  md: 12,
  sm: 12,
  xs: 12,
  xxs: 12,
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
// With fixed 12 columns (Superset-style), all breakpoints use the same layout
function generateResponsiveLayoutsForPreview(
  layout: any[],
  _previewScreenSize: ScreenSizeKey
): any {
  const layouts: any = {};

  // Since all breakpoints use 12 columns (Superset-style),
  // the same layout works for all screen sizes - columns just scale in width
  Object.keys(COLS).forEach((breakpoint) => {
    // Use the same layout for all breakpoints - the grid columns scale with container width
    layouts[breakpoint] = layout.map((item) => ({
      ...item,
      // Ensure valid constraints
      w: Math.max(1, Math.min(item.w, 12)),
      x: Math.max(0, Math.min(item.x, 12 - Math.max(1, item.w))),
      y: Math.max(0, item.y),
      minW: Math.max(1, Math.min(item.minW || 1, 12)),
      minH: item.minH || 1,
      maxW: 12,
    }));
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
  hideHeader?: boolean; // Hide header when used as landing page
  showMinimalHeader?: boolean; // Show only title when used as landing page
  isEmbedMode?: boolean; // Hide all non-essential UI for iframe embedding
  embedTheme?: 'light' | 'dark'; // Theme for embed mode
  isReportMode?: boolean; // Report snapshot mode — frozen config, no editing
  frozenChartConfigs?: Record<string, FrozenChartConfig>; // Chart configs keyed by chart ID
  beforeContent?: React.ReactNode; // Content rendered above the chart grid inside the canvas
  onContainerRef?: (el: HTMLDivElement | null) => void; // Callback to expose the canvas container ref
  isPrintMode?: boolean; // Print mode — removes height constraints for full-page PDF capture
}

export function DashboardNativeView({
  dashboardId,
  isPublicMode = false,
  publicToken,
  dashboardData,
  hideHeader = false,
  showMinimalHeader = false,
  isEmbedMode = false,
  embedTheme = 'light',
  isReportMode = false,
  frozenChartConfigs,
  beforeContent,
  onContainerRef,
  isPrintMode = false,
}: DashboardNativeViewProps) {
  const router = useRouter();
  const [selectedFilters, setSelectedFilters] = useState<AppliedFilters>({});
  const [actualContainerWidth, setActualContainerWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );
  const [shareModalOpen, setShareModalOpen] = useState(false);
  // Filters panel collapse state
  const [, setIsFiltersCollapsed] = useState(showMinimalHeader || isPublicMode);

  // Ref for the dashboard container
  const dashboardContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use unified fullscreen hook
  const { isFullscreen, toggleFullscreen } = useFullscreen('dashboard');

  // Get current user info for permission checks (skip in public mode)
  const getCurrentOrgUser = useAuthStore((state) => state.getCurrentOrgUser);
  const authCurrentUser = isPublicMode ? null : getCurrentOrgUser();

  // Fetch fresh user data to get updated landing page settings
  const { data: orgUsersData } = useSWR(!isPublicMode ? '/api/currentuserv2' : null, apiGet, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });

  // Use fresh user data if available, fall back to auth store data
  const selectedOrgSlug = useAuthStore((state) => state.selectedOrgSlug);
  const currentUser = isPublicMode
    ? null
    : orgUsersData?.find((ou: any) => ou.org.slug === selectedOrgSlug) || authCurrentUser;

  // Landing page functionality
  const {
    setPersonalLanding,
    removePersonalLanding,
    setOrgDefault,
    isLoading: landingPageLoading,
  } = useLandingPage();

  // Fetch dashboard data (skip API call if we have pre-fetched data for public mode)
  const {
    data: dashboardFromApi,
    isLoading: apiIsLoading,
    isError: apiIsError,
    mutate,
  } = useDashboard((isPublicMode || isReportMode) && dashboardData ? null : dashboardId);

  // Use pre-fetched data for public/report mode, otherwise use API data
  const dashboard =
    (isPublicMode || isReportMode) && dashboardData ? dashboardData : dashboardFromApi;

  // Override loading and error states when we have pre-fetched data
  const isLoading = (isPublicMode || isReportMode) && dashboardData ? false : apiIsLoading;
  const isError = (isPublicMode || isReportMode) && dashboardData ? false : apiIsError;

  // Use responsive layout hook
  const responsive = useResponsiveLayout();

  // Get user permissions
  const { hasPermission } = useUserPermissions();

  // Check if user can edit - requires can_edit_dashboards permission
  const canEdit = useMemo(() => {
    if (isPublicMode || !dashboard || !currentUser) return false;
    return hasPermission('can_edit_dashboards');
  }, [isPublicMode, dashboard, currentUser, hasPermission]);

  // Check if dashboard is locked
  const isLocked = dashboard?.is_locked || false;
  const lockedBy = dashboard?.locked_by;

  // Check if dashboard is locked by another user
  const isLockedByOther = isLocked && lockedBy && lockedBy !== currentUser?.email;

  // Check landing page status
  const isPersonalLanding = currentUser?.landing_dashboard_id === dashboardId;
  const isOrgDefault = currentUser?.org_default_dashboard_id === dashboardId;
  const canManageOrgDefault =
    currentUser?.new_role_slug === 'admin' || currentUser?.new_role_slug === 'super-admin';

  // Convert dashboard filters to DashboardFilterConfig format for UnifiedFiltersPanel
  const dashboardFilters: DashboardFilterConfig[] = useMemo(() => {
    if (!dashboard?.filters || !Array.isArray(dashboard.filters)) return [];

    return dashboard.filters.map((filter: any) =>
      convertFilterToConfig(filter, { x: 0, y: 0, w: 4, h: 3 })
    );
  }, [dashboard?.filters]);

  const publicBranding = useMemo<OrgBranding | null>(() => {
    if (!isPublicMode || !dashboard) return null;

    return {
      dashboard_logo_url: dashboard.dashboard_logo_url ?? null,
      dashboard_logo_width: dashboard.dashboard_logo_width ?? 80,
      chart_palette_name: dashboard.chart_palette_name ?? null,
      chart_palette_colors: dashboard.chart_palette_colors ?? null,
    };
  }, [dashboard, isPublicMode]);

  // Generate theme styles for the dashboard canvas
  const themeSurfaceStyle = useMemo(() => buildDashboardSurfaceStyle(dashboard), [dashboard]);
  const themeBackgroundImageStyle = useMemo(
    () => buildDashboardBackgroundImageStyle(dashboard),
    [dashboard]
  );
  const themeOverlayStyle = useMemo(() => buildDashboardOverlayStyle(dashboard), [dashboard]);

  // Auto-apply default filter values in report mode so charts render pre-filtered.
  // The backend injects period dates into the datetime filter's settings,
  // so getDefaultFilterValues() extracts them automatically.
  useEffect(() => {
    if (isReportMode && dashboardFilters.length > 0) {
      const defaultValues = getDefaultFilterValues(dashboardFilters);
      if (Object.keys(defaultValues).length > 0) {
        setSelectedFilters(defaultValues);
      }
    }
  }, [isReportMode, dashboardFilters]);

  // Observe dashboard container for responsive width
  useEffect(() => {
    if (!dashboardContainerRef.current) return undefined;

    // Set initial width
    const initialWidth = dashboardContainerRef.current.offsetWidth || window.innerWidth;
    setActualContainerWidth(initialWidth);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        // Use full available container width
        setActualContainerWidth(width);
      }
    });

    resizeObserver.observe(dashboardContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Handle fullscreen toggle - use unified fullscreen system
  const handleToggleFullscreen = () => {
    if (containerRef.current) {
      toggleFullscreen(containerRef.current);
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

  // Count applied filters for responsive component
  const appliedFiltersCount = Object.keys(selectedFilters).length;

  // Landing page handlers
  const handleSetPersonalLanding = async () => {
    await setPersonalLanding(dashboardId);
    // Refresh user data to update landing page status
    await swrMutate('/api/currentuserv2');
  };

  const handleRemovePersonalLanding = async () => {
    await removePersonalLanding();
    // Refresh user data to update landing page status
    await swrMutate('/api/currentuserv2');
  };

  const handleSetOrgDefault = async () => {
    await setOrgDefault(dashboardId);
    // Refresh user data to update landing page status
    await swrMutate('/api/currentuserv2');
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
              dashboardFilterConfigs={dashboardFilters}
              viewMode={true}
              className="h-full"
              isPublicMode={isPublicMode}
              publicToken={publicToken}
              config={component.config}
              brandingOverride={isPublicMode ? publicBranding : undefined}
              frozenChartConfig={
                isReportMode && frozenChartConfigs
                  ? frozenChartConfigs[String(component.config?.chartId)]
                  : undefined
              }
            />
          </div>
        );

      case 'text':
        // Use the same UnifiedTextElement component as edit mode for perfect consistency
        return (
          <div key={componentId} className="w-full h-full">
            <UnifiedTextElement
              config={component.config}
              onUpdate={() => {}} // No-op in view mode
              isEditMode={false}
            />
          </div>
        );

      case 'image':
        return (
          <div key={componentId} className="w-full h-full">
            <ImageElement
              config={component.config}
              onUpdate={() => {}} // No-op in view mode
              isEditMode={false}
            />
          </div>
        );

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
              isPublicMode={isPublicMode}
              publicToken={publicToken}
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
      ref={containerRef}
      className={cn(
        'h-full flex flex-col bg-white overflow-hidden',
        isFullscreen && 'fixed inset-0 z-50',
        isPublicMode &&
          !isPrintMode &&
          'h-screen sm:h-screen sm:overflow-hidden min-h-screen overflow-auto',
        isPrintMode && 'h-auto overflow-visible print-mode'
      )}
    >
      {/* Fixed Header - Conditional rendering for landing page */}
      {!hideHeader && !showMinimalHeader && !isEmbedMode && (
        <div className="bg-white border-b shadow-sm flex-shrink-0">
          {/* Mobile Header */}
          <div className="lg:hidden">
            {/* Mobile Top Row */}
            <div className="px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {!isFullscreen && !isPublicMode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/dashboards')}
                    className="p-1 flex-shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                )}
                <DashboardLogo branding={isPublicMode ? publicBranding : undefined} />
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
                </div>
              </div>

              {/* Mobile Quick Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {!isPublicMode && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          'px-3 py-1 text-xs border-green-600 text-green-600 bg-white hover:bg-green-50',
                          (isPersonalLanding || isOrgDefault) &&
                            'bg-blue-50 border-blue-200 text-blue-700'
                        )}
                        disabled={landingPageLoading}
                      >
                        {isPersonalLanding
                          ? 'My Landing'
                          : isOrgDefault
                            ? 'Org Default'
                            : 'Set Landing'}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                        Landing Page
                      </div>
                      <DropdownMenuSeparator />

                      {isPersonalLanding ? (
                        <DropdownMenuItem
                          onClick={handleRemovePersonalLanding}
                          disabled={landingPageLoading}
                        >
                          <StarOff className="w-4 h-4 mr-2" />
                          Remove as my landing page
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={handleSetPersonalLanding}
                          disabled={landingPageLoading}
                        >
                          <Star className="w-4 h-4 mr-2" />
                          Set as my landing page
                        </DropdownMenuItem>
                      )}

                      {canManageOrgDefault && (
                        <>
                          <DropdownMenuSeparator />
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            Organization Default
                          </div>
                          <DropdownMenuItem
                            onClick={handleSetOrgDefault}
                            disabled={landingPageLoading || isOrgDefault}
                          >
                            <Settings className="w-4 h-4 mr-2" />
                            {isOrgDefault ? 'Current org default' : 'Set as org default'}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleFullscreen}
                  className="p-1.5"
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Responsive Action Row */}
            {!isPublicMode && (
              <div className="px-4 pb-2">
                <ResponsiveDashboardActions
                  onShare={handleShare}
                  onEdit={handleEdit}
                  canEdit={canEdit && !isLockedByOther}
                  className="justify-end"
                />
              </div>
            )}

            {/* Mobile Metadata Row */}
            <div className="px-4 pb-2 flex items-center gap-4 text-xs text-gray-500 border-t pt-2">
              {dashboard.last_modified_by && (
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span className="truncate">Updated by {dashboard.last_modified_by}</span>
                </div>
              )}
              {dashboard.updated_at && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>
                    Modified{' '}
                    {formatDistanceToNow(new Date(dashboard.updated_at), { addSuffix: true })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:block px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                {!isFullscreen && !isPublicMode && (
                  <Button variant="ghost" size="sm" onClick={() => router.push('/dashboards')}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                )}
                <DashboardLogo branding={isPublicMode ? publicBranding : undefined} />
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

                  {/* Metadata below title */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    {dashboard.last_modified_by && (
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>Updated by {dashboard.last_modified_by}</span>
                      </div>
                    )}
                    {dashboard.updated_at && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          Modified{' '}
                          {formatDistanceToNow(new Date(dashboard.updated_at), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Landing page controls */}
                {!isPublicMode && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          'text-xs border-green-600 text-green-600 bg-white hover:bg-green-50',
                          (isPersonalLanding || isOrgDefault) &&
                            'bg-blue-50 border-blue-200 text-blue-700'
                        )}
                        disabled={landingPageLoading}
                      >
                        {isPersonalLanding
                          ? 'My Landing'
                          : isOrgDefault
                            ? 'Org Default'
                            : 'Set Landing'}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                        Landing Page
                      </div>
                      <DropdownMenuSeparator />

                      {isPersonalLanding ? (
                        <DropdownMenuItem
                          onClick={handleRemovePersonalLanding}
                          disabled={landingPageLoading}
                        >
                          <StarOff className="w-4 h-4 mr-2" />
                          Remove as my landing page
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={handleSetPersonalLanding}
                          disabled={landingPageLoading}
                        >
                          <Star className="w-4 h-4 mr-2" />
                          Set as my landing page
                        </DropdownMenuItem>
                      )}

                      {canManageOrgDefault && (
                        <>
                          <DropdownMenuSeparator />
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            Organization Default
                          </div>
                          <DropdownMenuItem
                            onClick={handleSetOrgDefault}
                            disabled={landingPageLoading || isOrgDefault}
                          >
                            <Settings className="w-4 h-4 mr-2" />
                            {isOrgDefault ? 'Current org default' : 'Set as org default'}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Action buttons */}
                <Button variant="outline" size="sm" onClick={handleToggleFullscreen}>
                  <Maximize2 className="w-4 h-4" />
                </Button>

                {!isPublicMode && (
                  <ResponsiveDashboardActions
                    onShare={handleShare}
                    onEdit={handleEdit}
                    canEdit={canEdit && !isLockedByOther}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Minimal Header - Show only title for landing page */}
      {showMinimalHeader && !isEmbedMode && (
        <div className="bg-white border-b flex-shrink-0 px-6 py-6">
          <div className="flex items-center gap-4 min-w-0">
            <DashboardLogo branding={isPublicMode ? publicBranding : undefined} />
            <h1 className="text-3xl font-bold truncate">{dashboard.title}</h1>
          </div>
        </div>
      )}
      {/* Mobile/Tablet Filters Section - Only show on non-desktop */}
      {!isEmbedMode && (
        <ResponsiveFiltersSection
          dashboardFilters={dashboardFilters}
          dashboardId={dashboardId}
          isEditMode={false}
          onFiltersApplied={handleFiltersApplied}
          onFiltersCleared={handleFiltersCleared}
          isPublicMode={isPublicMode}
          publicToken={publicToken}
          appliedFiltersCount={appliedFiltersCount}
          className="px-4 pb-2"
          isReportMode={isReportMode}
        />
      )}
      {/* Main Content Area */}
      <div className={cn('flex-1 flex overflow-hidden', isPrintMode && 'overflow-visible')}>
        {/* Desktop Vertical Filters Sidebar - Only show on desktop */}
        {responsive.isDesktop && dashboardFilters.length > 0 && !isEmbedMode && (
          <UnifiedFiltersPanel
            initialFilters={dashboardFilters}
            dashboardId={dashboardId}
            isEditMode={false}
            layout="vertical"
            onFiltersApplied={handleFiltersApplied}
            onFiltersCleared={handleFiltersCleared}
            onCollapseChange={setIsFiltersCollapsed}
            isPublicMode={isPublicMode}
            publicToken={publicToken}
            initiallyCollapsed={showMinimalHeader || isPublicMode}
            isReportMode={isReportMode}
          />
        )}

        {/* Dashboard Content - Scrollable Canvas Area */}
        <div
          className={cn(
            'flex-1 overflow-auto min-w-0 bg-gray-50 p-4 pb-[150px]',
            isPublicMode && 'pb-24 sm:pb-16',
            isPrintMode && 'overflow-visible pb-4'
          )}
        >
          <div
            ref={(el) => {
              dashboardContainerRef.current = el;
              onContainerRef?.(el);
            }}
            className={`dashboard-canvas relative z-10 ${
              isEmbedMode ? (embedTheme === 'dark' ? 'bg-gray-800' : 'bg-white') : 'bg-white'
            }`}
            style={{
              width: '100%',
              minHeight: '100%',
              ...themeSurfaceStyle,
            }}
          >
            {themeBackgroundImageStyle && (
              <div aria-hidden="true" style={themeBackgroundImageStyle} />
            )}
            {/* Theme overlay */}
            {themeOverlayStyle && <div aria-hidden="true" style={themeOverlayStyle} />}

            <div className="relative z-10">
              {/* Optional content above the chart grid (e.g. Executive Summary) */}
              {beforeContent}

              {/* Show empty state if no layout config */}
              {!dashboard?.layout_config || dashboard.layout_config.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p className="text-lg mb-2">No Dashboard Components</p>
                  <p className="text-sm">
                    This dashboard doesn't have any components configured yet.
                  </p>
                </div>
              ) : null}

              <GridLayout
                className="dashboard-grid"
                layout={dashboard.layout_config || []}
                cols={12}
                rowHeight={20}
                width={actualContainerWidth}
                style={{
                  width: '100% !important',
                }}
                isDraggable={false}
                isResizable={false}
                compactType={null}
                preventCollision={true}
                allowOverlap={false}
                margin={[8, 8]}
                containerPadding={[8, 8]}
                autoSize={true}
                verticalCompact={false}
              >
                {(dashboard.layout_config || []).map((layoutItem: any) => (
                  <div
                    key={layoutItem.i}
                    className="dashboard-item"
                    style={{
                      backgroundColor:
                        dashboard?.components?.[layoutItem.i]?.config?.panelBackgroundColor,
                      borderRadius: dashboard?.components?.[layoutItem.i]?.config
                        ?.panelBackgroundColor
                        ? '4px'
                        : undefined,
                    }}
                  >
                    <Card className="h-full shadow-sm hover:shadow-md transition-shadow duration-200 p-0 gap-0 bg-transparent">
                      <CardContent className="p-2 h-full">
                        {renderComponent(layoutItem.i)}
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </GridLayout>
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

        .print-mode .dashboard-canvas {
          overflow: visible !important;
        }

        .dashboard-canvas .dashboard-grid {
          position: relative;
          width: 100% !important;
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

        /* Mobile-specific fixes for scrolling - ONLY for public dashboards */
        ${isPublicMode
          ? `
          @media (max-width: 640px) {
            html, body {
              height: auto !important;
              min-height: 100vh;
              overflow-x: hidden;
              -webkit-overflow-scrolling: touch;
            }
            
            .dashboard-canvas {
              max-width: calc(100vw - 2rem) !important;
              margin-left: auto !important;
              margin-right: auto !important;
            }
          }

          /* iOS Safari specific fixes - ONLY for public dashboards */
          @supports (-webkit-touch-callout: none) {
            @media (max-width: 640px) {
              .dashboard-canvas {
                will-change: scroll-position;
              }
            }
          }
        `
          : ''}
      `}</style>
      {/* Share Modal */}
      {dashboard && !isPublicMode && (
        <ShareModal
          entityId={dashboardId}
          entityLabel="Dashboard"
          isOpen={shareModalOpen}
          onClose={handleShareModalClose}
          onUpdate={handleDashboardUpdate}
          initialShareStatus={{
            is_public: dashboard.is_public,
            public_access_count: dashboard.public_access_count,
          }}
          getShareStatus={getDashboardSharingStatus}
          updateSharing={updateDashboardSharing}
        />
      )}
    </div>
  );
}
