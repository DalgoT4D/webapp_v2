'use client';

import React from 'react';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDashboardThumbnail } from '@/hooks/api/useDashboardThumbnail';
import { useDashboard } from '@/hooks/api/useDashboards';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardMiniPreview } from './DashboardMiniPreview';

interface DashboardThumbnailProps {
  dashboardId: number;
  thumbnailUrl?: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  fallbackIconSize?: 'sm' | 'md' | 'lg';
  onError?: () => void;
  dashboardType?: 'native' | 'superset';
  isPublished?: boolean;
  useClientSideRendering?: boolean;
}

export function DashboardThumbnail({
  dashboardId,
  thumbnailUrl,
  alt,
  className,
  fallbackClassName,
  fallbackIconSize = 'lg',
  onError,
  dashboardType,
  isPublished = false,
  useClientSideRendering = true,
}: DashboardThumbnailProps) {
  const [showFallback, setShowFallback] = React.useState(false);
  const [loadingTimeout, setLoadingTimeout] = React.useState(false);

  // Try client-side rendering first
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    isError: dashboardError,
  } = useDashboard(useClientSideRendering ? dashboardId : 0);

  // Only try server-side thumbnail if not using client-side rendering
  const shouldGenerateServerThumbnail =
    !useClientSideRendering && (!!thumbnailUrl || (isPublished && dashboardType === 'native'));

  const {
    thumbnailDataUrl,
    isLoading: thumbnailLoading,
    error,
  } = useDashboardThumbnail({
    dashboardId,
    thumbnailUrl,
    enabled: shouldGenerateServerThumbnail,
  });

  const isLoading = useClientSideRendering ? dashboardLoading : thumbnailLoading;

  // Check if dashboard data is valid for client-side rendering

  const hasValidDashboardData =
    dashboardData &&
    ((dashboardData.layout_config?.components &&
      Array.isArray(dashboardData.layout_config.components)) ||
      Array.isArray(dashboardData?.layout_config) ||
      (dashboardData.components && Array.isArray(dashboardData.components)) ||
      (dashboardData.components &&
        typeof dashboardData.components === 'object' &&
        dashboardData.components !== null));

  // Fallback logic for invalid data or errors
  React.useEffect(() => {
    if (useClientSideRendering && dashboardData && !hasValidDashboardData) {
      setShowFallback(true);
    }
    if (dashboardError) {
      setShowFallback(true);
    }
  }, [dashboardData, hasValidDashboardData, dashboardError, useClientSideRendering]);

  // Timeout mechanism - if loading takes too long, show fallback
  React.useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (isLoading && useClientSideRendering) {
      timeoutId = setTimeout(() => {
        setLoadingTimeout(true);
        setShowFallback(true);
      }, 3000); // 3 second timeout
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isLoading, useClientSideRendering]);

  React.useEffect(() => {
    if (error && onError) {
      onError();
    }
  }, [error, onError]);

  // Show loading skeleton
  if (isLoading && !loadingTimeout) {
    return <Skeleton className={cn('w-full h-full', className)} />;
  }

  // Show client-side rendered dashboard preview if data is valid
  if (useClientSideRendering && !showFallback && hasValidDashboardData) {
    return (
      <div className={cn('relative w-full h-full', className)}>
        <DashboardMiniPreview dashboardData={dashboardData} className="w-full h-full" />
      </div>
    );
  }

  // Show server-side thumbnail if available
  if (thumbnailDataUrl && !error) {
    return (
      <img
        src={thumbnailDataUrl}
        alt={alt}
        className={cn('object-cover w-full h-full', className)}
      />
    );
  }

  // Final fallback to icon (for all failure cases)
  const iconSizes = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  };

  // Responsive sizing based on fallbackIconSize
  const dashboardSizes = {
    sm: { container: 'w-12 h-8', padding: 'p-1', gap: 'gap-0.5', radius: 'rounded' },
    md: { container: 'w-20 h-12', padding: 'p-2', gap: 'gap-1', radius: 'rounded-md' },
    lg: { container: 'w-64 h-40', padding: 'p-4', gap: 'gap-3', radius: 'rounded-lg' },
  };

  const size = dashboardSizes[fallbackIconSize];

  return (
    <div
      className={cn(
        'flex items-center justify-center h-full bg-gradient-to-br from-gray-100 to-gray-200',
        fallbackClassName
      )}
    >
      {/* Responsive Dashboard Layout */}
      <div
        className={cn(
          'relative bg-gray-50 border border-gray-300 shadow-sm',
          size.container,
          size.padding,
          size.radius
        )}
      >
        <div className={cn('flex h-full', size.gap)}>
          {/* Left large block */}
          <div
            className={cn('flex-1 bg-white border border-gray-200 shadow-sm', size.radius)}
          ></div>

          {/* Right column with stacked blocks */}
          <div className={cn('flex-1 flex flex-col', size.gap)}>
            {/* Top row with two small blocks */}
            <div className={cn('flex h-1/2', size.gap)}>
              <div
                className={cn('flex-1 bg-white border border-gray-200 shadow-sm', size.radius)}
              ></div>
              <div
                className={cn('flex-1 bg-white border border-gray-200 shadow-sm', size.radius)}
              ></div>
            </div>
            {/* Bottom large block */}
            <div
              className={cn('flex-1 bg-white border border-gray-200 shadow-sm', size.radius)}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
