'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { DashboardTabsData } from '@/types/dashboard';
import { initializeTabsData } from './tabs/tab-utils';
import { TabBar } from './tabs/TabBar';
import { cn } from '@/lib/utils';
import { useDashboard, deleteDashboard } from '@/hooks/api/useDashboards';
import { useAuthStore } from '@/stores/authStore';
import { UnifiedFiltersPanel } from './unified-filters-panel';
import { getDefaultFilterValues } from '@/lib/dashboard-filter-utils';
import { type AppliedFilters, type DashboardFilterConfig } from '@/types/dashboard-filters';
import { toFilterConfig } from '@/components/dashboard/filters/filter-config';
import { useToast } from '@/components/ui/use-toast';
import { ShareModal } from '@/components/share/ShareModal';
import { ResponsiveFiltersSection } from './responsive-filters-section';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import type { FrozenChartConfig } from '@/types/reports';
import type { CommentStates } from '@/types/comments';
import { useCurrentOrgUser } from '@/components/dashboard/hooks/useCurrentOrgUser';
import { useLandingPageActions } from '@/components/dashboard/hooks/useLandingPageActions';
import { useFullscreen } from '@/hooks/useFullscreen';
import { PERMISSIONS, useRbac } from '@/lib/rbac';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { WIDGET_NAVIGATION_SOURCES } from '@/lib/widget-navigation';
import { CelebrationModal } from '@/components/onboarding/celebration-modal';
import { SCREEN_SIZES, type ScreenSizeKey } from '@/components/dashboard/grid/grid-constants';
import { VIEW_WIDGETS, type ViewWidgetContext } from '@/components/dashboard/widgets/view-widgets';
import { DashboardViewHeader } from '@/components/dashboard/view/DashboardViewHeader';
import { useDashboardShareFlow } from '@/components/dashboard/view/useDashboardShareFlow';
import { useViewContainerWidth } from '@/components/dashboard/view/useViewContainerWidth';
import { DashboardViewGrid } from '@/components/dashboard/view/DashboardViewGrid';
import {
  DashboardViewLoading,
  DashboardViewNotFound,
} from '@/components/dashboard/view/DashboardViewStates';
import { DashboardCanvasStyles } from '@/components/dashboard/view/DashboardCanvasStyles';

// After filter panel collapse, ECharts still sees the pre-animation container width.
// Wait for the slide transition (duration-300) to finish before firing resize so all
// chart instances remeasure against the final layout — 300ms transition + 50ms buffer.
const FILTER_PANEL_TRANSITION_MS = 350;
/** The refresh spinner stays this long after the refetch resolves. */
const REFRESH_SPINNER_MS = 500;

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
  topRightContent?: React.ReactNode; // Content rendered above the tab bar in the right column (e.g. report summary)
  onContainerRef?: (el: HTMLDivElement | null) => void; // Callback to expose the canvas container ref
  isPrintMode?: boolean; // Print mode — removes height constraints for full-page PDF capture
  snapshotId?: number; // Report snapshot ID for comments
  commentStates?: CommentStates; // Comment states array with target_type and chart_id
  onCommentStateChange?: () => void; // Callback to revalidate comment states
  autoOpenCommentChartId?: string; // Chart ID whose comment popover should auto-open (from email deep-link)
  onFiltersChange?: (filters: AppliedFilters) => void; // Notifies the parent whenever selectedFilters changes (e.g. so it can be included in a PDF export request)
  canModerateComments?: boolean; // Caller has Edit access on the parent report — enables moderator Delete on other users' comments
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
  topRightContent,
  onContainerRef,
  isPrintMode = false,
  snapshotId,
  commentStates,
  onCommentStateChange,
  autoOpenCommentChartId,
  onFiltersChange,
  canModerateComments = false,
}: DashboardNativeViewProps) {
  const router = useRouter();
  const widgetNavigationSource = isReportMode
    ? WIDGET_NAVIGATION_SOURCES.REPORT
    : WIDGET_NAVIGATION_SOURCES.DASHBOARD;
  const showWidgetNavigation = !isPublicMode && !isEmbedMode && !isPrintMode;
  const [selectedFilters, setSelectedFilters] = useState<AppliedFilters>(() => {
    // In report mode, dashboardData is pre-fetched so filters are available immediately.
    // Compute defaults synchronously to avoid a double-render cycle with empty filters.
    if (isReportMode && dashboardData?.filters && Array.isArray(dashboardData.filters)) {
      const filterConfigs = dashboardData.filters.map((filter: any) => toFilterConfig(filter));
      return getDefaultFilterValues(filterConfigs);
    }
    return {};
  });

  useEffect(() => {
    onFiltersChange?.(selectedFilters);
  }, [selectedFilters, onFiltersChange]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [, setCurrentBreakpoint] = useState('lg');
  const [previewScreenSize] = useState<ScreenSizeKey | null>(null);
  // Filters panel collapse state (set, never read — kept: its setter re-renders as before)
  const [, setIsFiltersCollapsed] = useState(showMinimalHeader || isPublicMode);
  // Tabs state for view mode - only need to track active tab for switching
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Ref for the dashboard container
  const dashboardContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use unified fullscreen hook
  const { isFullscreen, toggleFullscreen } = useFullscreen('dashboard');

  const { toast } = useToast();

  // Current user (fresh landing-page ids; null in public mode)
  const currentUser = useCurrentOrgUser(isPublicMode);

  // Landing page functionality (shared with the dashboard list)
  const {
    setMyLanding,
    removeMyLanding,
    makeOrgDefault,
    isLandingPageLoading: landingPageLoading,
  } = useLandingPageActions();

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

  const share = useDashboardShareFlow({ dashboard, refreshDashboard: mutate });

  // Org logo for fullscreen overlays:
  // - Private mode: user is logged in, auth store has the org logo
  // - Public mode: no auth store, logo comes from backend dashboard API response
  const currentOrg = useAuthStore((state) => state.currentOrg);
  const orgLogoUrl = isPublicMode
    ? (dashboard?.org_logo_url ?? null)
    : (currentOrg?.logo_url ?? null);

  // Override loading and error states when we have pre-fetched data
  const isLoading = (isPublicMode || isReportMode) && dashboardData ? false : apiIsLoading;
  const isError = (isPublicMode || isReportMode) && dashboardData ? false : apiIsError;

  // Use responsive layout hook
  const responsive = useResponsiveLayout();

  // Get user permissions
  const { hasPermission } = useRbac();

  // Can this user edit THIS dashboard? Per-resource access (grants + org floor
  // + ownership), surfaced by the API as `access_level`. Not the role permission —
  // a member granted edit has access_level === "edit" but no role edit slug.
  const canEdit = useMemo(() => {
    if (isPublicMode || !dashboard || !currentUser) return false;
    return dashboard.access_level === 'edit';
  }, [isPublicMode, dashboard, currentUser]);

  // Check if dashboard is locked
  const isLocked = dashboard?.is_locked || false;
  const lockedBy = dashboard?.locked_by;

  // Check if dashboard is locked by another user
  const isLockedByOther = isLocked && lockedBy && lockedBy !== currentUser?.email;

  // Check landing page status
  const isPersonalLanding = currentUser?.landing_dashboard_id === dashboardId;
  const isOrgDefault = currentUser?.org_default_dashboard_id === dashboardId;
  // Same permission gate as the dashboard list — keep role assignments authoritative
  const canManageOrgDefault = hasPermission(PERMISSIONS.CAN_MANAGE_ORG_DEFAULT_DASHBOARD);

  // Get target screen size (the size dashboard was designed for)
  const targetScreenSize = (dashboard?.target_screen_size as ScreenSizeKey) || 'desktop';

  const { actualContainerWidth } = useViewContainerWidth(dashboardContainerRef);

  // Use preview size if set, otherwise fall back to target size
  const effectiveScreenSize = previewScreenSize || targetScreenSize;
  const effectiveScreenConfig = SCREEN_SIZES[effectiveScreenSize];

  // Convert dashboard filters to DashboardFilterConfig format for UnifiedFiltersPanel
  const dashboardFilters: DashboardFilterConfig[] = useMemo(() => {
    if (!dashboard?.filters || !Array.isArray(dashboard.filters)) return [];

    return dashboard.filters.map((filter: any) => toFilterConfig(filter));
  }, [dashboard?.filters]);

  // Default filter values for report mode are computed synchronously in useState above.
  // No useEffect needed — this avoids a double-render cycle with empty filters.

  // Derive tabs data from dashboard
  const tabsData: DashboardTabsData | null = useMemo(() => {
    if (!dashboard) return null;
    return initializeTabsData(dashboard.tabs);
  }, [dashboard]);

  // Get effective active tab ID
  const effectiveActiveTabId =
    activeTabId || tabsData?.activeTabId || tabsData?.tabs?.[0]?.id || null;

  // Derive the current tab's layout/components to render
  const currentTab = useMemo(() => {
    if (tabsData && effectiveActiveTabId) {
      return tabsData.tabs.find((t) => t.id === effectiveActiveTabId) || null;
    }
    return null;
  }, [tabsData, effectiveActiveTabId]);

  // Handle tab change in view mode
  const handleTabChange = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const handleFiltersCollapseChange = useCallback((collapsed: boolean) => {
    setIsFiltersCollapsed(collapsed);
    setTimeout(() => window.dispatchEvent(new Event('resize')), FILTER_PANEL_TRANSITION_MS);
  }, []);

  // Check if we should show tabs (2 or more tabs)
  const shouldShowTabs = tabsData && (tabsData.tabs?.length ?? 0) >= 2;

  // Allow editing in preview mode without any conditions

  // DASHBOARD_VIEWED is intentionally NOT fired here. This component is shared by the
  // live dashboard route, the impact/landing page, report snapshots, and public share
  // views, so firing here leaked DASHBOARD_VIEWED into report and impact opens. The event
  // now lives on the live dashboard route only (app/dashboards/[id]/page.tsx) so each page
  // fires exactly its own view event.

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

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await mutate();
    setTimeout(() => setIsRefreshing(false), REFRESH_SPINNER_MS);
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
  // PINNED-BUGS: "Mobile filter accordion "N applied" counts unset filters"
  const appliedFiltersCount = Object.keys(selectedFilters).length;

  // Handle dashboard deletion
  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      await deleteDashboard(dashboardId);
      trackEvent(ANALYTICS_EVENTS.DASHBOARD_DELETED, { dashboard_id: dashboardId });

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

  // Landing page handlers
  const handleSetPersonalLanding = () => setMyLanding(dashboardId);
  const handleRemovePersonalLanding = () => removeMyLanding();
  const handleSetOrgDefault = () => makeOrgDefault(dashboardId);

  // What every widget reads from this view (one object per render)
  const widgetContext: ViewWidgetContext = {
    dashboardFilterRows: dashboard?.filters,
    selectedFilters,
    dashboardFilterConfigs: dashboardFilters,
    isPublicMode,
    publicToken,
    isReportMode,
    frozenChartConfigs,
    snapshotId,
    commentStates,
    onCommentStateChange,
    autoOpenCommentChartId,
    canModerateComments,
    orgLogoUrl,
    showWidgetNavigation,
    widgetNavigationSource,
    navigate: (url: string) => router.push(url),
    onFilterChange: handleFilterChange,
  };

  // Render dashboard components (from active tab)
  const renderComponent = (componentId: string) => {
    const components = currentTab?.components;
    if (!components) return null;

    const component = components[componentId];
    if (!component) return null;

    const ViewWidget = VIEW_WIDGETS[component.type];
    return ViewWidget ? (
      <ViewWidget componentId={componentId} component={component} ctx={widgetContext} />
    ) : null;
  };

  if (isLoading) {
    return <DashboardViewLoading />;
  }

  if (isError || !dashboard) {
    return <DashboardViewNotFound onBack={() => router.push('/dashboards')} />;
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
      {!hideHeader && !showMinimalHeader && !isPublicMode && (
        <DashboardViewHeader
          dashboard={dashboard}
          isFullscreen={isFullscreen}
          isPublicMode={isPublicMode}
          isReportMode={isReportMode}
          isLocked={isLocked}
          isLockedByOther={Boolean(isLockedByOther)}
          lockedBy={lockedBy}
          landing={{
            isPersonalLanding,
            isOrgDefault,
            canManageOrgDefault,
            isLoading: landingPageLoading,
            onSetPersonal: handleSetPersonalLanding,
            onRemovePersonal: handleRemovePersonalLanding,
            onSetOrgDefault: handleSetOrgDefault,
          }}
          canEdit={canEdit}
          isDeleting={isDeleting}
          isRefreshing={isRefreshing}
          onBack={() => router.push('/dashboards')}
          onToggleFullscreen={handleToggleFullscreen}
          onShare={share.handleShare}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onRefresh={handleRefresh}
        />
      )}
      {/* Minimal Header - Show only title for landing page */}
      {showMinimalHeader && !isEmbedMode && (
        <div className="bg-white border-b flex-shrink-0 px-6 py-6">
          <div>
            <h1 className="text-3xl font-bold truncate">{dashboard.title}</h1>
            {dashboard.description && (
              <p className="text-base text-gray-600 mt-2 line-clamp-2 max-w-3xl">
                {dashboard.description}
              </p>
            )}
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
        {/* Desktop Vertical Filters Sidebar — spans full height including tabs row */}
        {responsive.isDesktop && dashboardFilters.length > 0 && !isEmbedMode && (
          <UnifiedFiltersPanel
            initialFilters={dashboardFilters}
            dashboardId={dashboardId}
            isEditMode={false}
            layout="vertical"
            onFiltersApplied={handleFiltersApplied}
            onFiltersCleared={handleFiltersCleared}
            onCollapseChange={handleFiltersCollapseChange}
            isPublicMode={isPublicMode}
            publicToken={publicToken}
            initiallyCollapsed={showMinimalHeader || isPublicMode || isReportMode}
            isReportMode={isReportMode}
          />
        )}

        {/* Right side: Tab Bar + Canvas stacked vertically */}
        <div
          className={cn('flex-1 flex flex-col overflow-hidden', isPrintMode && 'overflow-visible')}
        >
          {/* Tab Bar sticky at top — only in non-report dashboard mode */}
          {!isReportMode && shouldShowTabs && tabsData && effectiveActiveTabId && !isEmbedMode && (
            <TabBar
              tabs={tabsData.tabs}
              activeTabId={effectiveActiveTabId}
              isEditMode={false}
              onTabChange={handleTabChange}
              onTabAdd={() => {}} // No-op in view mode
              onTabRemove={() => {}} // No-op in view mode
              onTabRename={() => {}} // No-op in view mode
            />
          )}

          {/* Scrollable area:
              - Report mode: summary + tabs + canvas all scroll together
              - Dashboard mode: only canvas scrolls (tabs stay sticky above) */}
          <div className={cn('flex-1 overflow-auto min-h-0', isPrintMode && 'overflow-visible')}>
            {/* Summary scrolls with content (only set in report mode) */}
            {topRightContent}

            {/* Tab Bar inside scroll area — report mode only */}
            {isReportMode && shouldShowTabs && tabsData && effectiveActiveTabId && !isEmbedMode && (
              <TabBar
                tabs={tabsData.tabs}
                activeTabId={effectiveActiveTabId}
                isEditMode={false}
                onTabChange={handleTabChange}
                onTabAdd={() => {}} // No-op in view mode
                onTabRemove={() => {}} // No-op in view mode
                onTabRename={() => {}} // No-op in view mode
              />
            )}

            {/* Dashboard Content - Canvas Area */}
            <div
              className={cn(
                'min-w-0 bg-gray-50 p-4 pb-[150px]',
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
                }}
              >
                {/* Optional content above the chart grid (e.g. Executive Summary) */}
                {beforeContent}

                <DashboardViewGrid
                  layout={currentTab?.layout_config || []}
                  effectiveScreenSize={effectiveScreenSize}
                  targetScreenSize={targetScreenSize}
                  cols={effectiveScreenConfig.cols}
                  responsiveLayouts={dashboard.responsive_layouts}
                  containerWidth={actualContainerWidth}
                  onBreakpointChange={setCurrentBreakpoint}
                  renderComponent={renderComponent}
                />
              </div>
            </div>
          </div>
        </div>
      </div>{' '}
      {/* Close Main Content Area */}
      {/* Custom styles for preview mode canvas */}
      <DashboardCanvasStyles isPublicMode={isPublicMode} />
      <CelebrationModal
        open={share.dashboardLiveModalOpen}
        onOpenChange={share.setDashboardLiveModalOpen}
        title="Congratulations, you're officially live!"
        description="Your insights are built and your new dashboard is ready to go."
        ctaLabel="View Dashboard"
        dismissEvent={ANALYTICS_EVENTS.DASHBOARD_LIVE_MODAL_DISMISSED}
        testId="dashboard-live-modal"
      />
      {/* Share Modal */}
      {dashboard && !isPublicMode && (
        <ShareModal
          rtype="dashboard"
          entityId={dashboard.id}
          entityLabel={dashboard.title || 'Dashboard'}
          isOpen={share.shareModalOpen}
          onClose={share.handleShareModalClose}
          onUpdate={share.handleDashboardUpdate}
          onCopyLink={share.handleCopyLink}
          onMadePublic={share.handleMadePublic}
        />
      )}
    </div>
  );
}
