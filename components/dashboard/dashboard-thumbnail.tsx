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

    return (
      <div className={cn('flex items-center justify-center h-full', fallbackClassName)}>
        <BarChart3 className={cn(iconSizes[fallbackIconSize], 'text-muted-foreground/20')} />
      </div>
    );
  }

  return (
    <img src={thumbnailDataUrl} alt={alt} className={cn('object-cover w-full h-full', className)} />
  );
}
