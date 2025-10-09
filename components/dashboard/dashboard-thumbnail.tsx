'use client';

import React from 'react';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDashboardThumbnail } from '@/hooks/api/useDashboardThumbnail';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardThumbnailProps {
  dashboardId: number;
  thumbnailUrl?: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  fallbackIconSize?: 'sm' | 'md' | 'lg';
  onError?: () => void;
}

export function DashboardThumbnail({
  dashboardId,
  thumbnailUrl,
  alt,
  className,
  fallbackClassName,
  fallbackIconSize = 'lg',
  onError,
}: DashboardThumbnailProps) {
  const { thumbnailDataUrl, isLoading, error } = useDashboardThumbnail({
    dashboardId,
    thumbnailUrl,
    enabled: !!thumbnailUrl,
  });

  React.useEffect(() => {
    if (error && onError) {
      onError();
    }
  }, [error, onError]);

  if (isLoading) {
    return <Skeleton className={cn('w-full h-full', className)} />;
  }

  if (!thumbnailUrl || error || !thumbnailDataUrl) {
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

  return (
    <img src={thumbnailDataUrl} alt={alt} className={cn('object-cover w-full h-full', className)} />
  );
}
