'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import GridLayout from 'react-grid-layout';
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
import { useToast } from '@/components/ui/use-toast';
import { AppliedFilters, DashboardFilterConfig } from '@/types/dashboard-filters';

interface DashboardNativeViewProps {
  dashboardId: number;
}

export function DashboardNativeView({ dashboardId }: DashboardNativeViewProps) {
  const router = useRouter();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<AppliedFilters>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [containerWidth, setContainerWidth] = useState(1200);

  // Ref for the dashboard container to measure its width
  const containerRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();

  // Get current user info for permission checks
  const getCurrentOrgUser = useAuthStore((state) => state.getCurrentOrgUser);
  const currentUser = getCurrentOrgUser();

  // Fetch dashboard data
  const { data: dashboard, isLoading, isError, mutate } = useDashboard(dashboardId);

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

  // Measure container width and update on resize (same logic as edit mode)
  useEffect(() => {
    let lastWidth = 0;

    const updateWidth = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newWidth = Math.max(rect.width - 32, 800); // Subtract padding for margins, minimum 800px

        // Only update if width has changed significantly (prevent infinite loops)
        if (Math.abs(newWidth - lastWidth) > 10) {
          lastWidth = newWidth;
          setContainerWidth(newWidth);
        }
      }
    };

    // Initial measurement with delay to ensure DOM is ready
    const timer = setTimeout(updateWidth, 100);

    // Update on window resize with debouncing
    let resizeTimeout: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateWidth, 150);
    };

    window.addEventListener('resize', debouncedResize);

    return () => {
      clearTimeout(timer);
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
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      // TODO: Show toast notification
      console.log('Dashboard link copied to clipboard');
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await mutate();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Handle filter changes
  const handleFilterChange = (filterId: string, value: any) => {
    setSelectedFilters((prev) => ({
      ...prev,
      [filterId]: value,
    }));
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
            wordBreak: 'break-words' as any,
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
                  wordBreak: 'break-words',
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

        const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
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
          console.log(
            'Comparing filter:',
            f.id,
            'with filterId:',
            filterId,
            'Match?',
            f.id === filterId
          );
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

        // Ensure filter data has required fields for the component
        const normalizedFilter = {
          ...filterData,
          name: filterData.name || filterData.column_name || 'Filter', // Use column_name as fallback
          id: String(filterData.id), // Ensure id is string as expected by types
        };

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
      <div className="h-screen flex flex-col bg-gray-50">
        <div className="bg-white border-b px-6 py-4">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex-1 p-6">
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
    <div className={cn('h-screen flex flex-col bg-gray-50', isFullscreen && 'fixed inset-0 z-50')}>
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {!isFullscreen && (
                <Button variant="ghost" size="sm" onClick={() => router.push('/dashboards')}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">{dashboard.title}</h1>
                  {dashboard.is_published && (
                    <Badge variant="success" className="text-xs">
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
                  <p className="text-sm text-gray-600 mt-1">{dashboard.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
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

              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="w-4 h-4" />
              </Button>

              <Button variant="outline" size="sm" onClick={toggleFullscreen}>
                <Maximize2 className="w-4 h-4" />
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
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div ref={containerRef} className="flex-1 overflow-auto p-4">
        <div className="w-full">
          <GridLayout
            className="dashboard-grid"
            layout={dashboard.layout_config || []}
            cols={dashboard.grid_columns || 12}
            rowHeight={30}
            width={containerWidth}
            isDraggable={false}
            isResizable={false}
            compactType={null}
            preventCollision={false}
            margin={[10, 10]}
          >
            {(dashboard.layout_config || []).map((layoutItem: any) => (
              <div key={layoutItem.i} className="dashboard-item">
                <Card className="h-full shadow-sm hover:shadow-md transition-shadow duration-200">
                  <CardContent className="p-4 h-full">{renderComponent(layoutItem.i)}</CardContent>
                </Card>
              </div>
            ))}
          </GridLayout>
        </div>
      </div>

      {/* Custom styles for view mode */}
      <style jsx global>{`
        .dashboard-grid {
          position: relative;
        }

        .dashboard-item {
          transition: transform 0.2s ease;
        }

        .dashboard-item:hover {
          z-index: 10;
        }

        .react-grid-item {
          transition: none !important;
        }

        .react-grid-item.react-grid-placeholder {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
