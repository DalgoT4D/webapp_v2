'use client';

import { Loader2, AlertCircle, type LucideIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ChartLoadingStateProps {
  message?: string;
  minHeight?: string;
}

/**
 * Shared loading state for chart components (ChartPreview, TableChart, MapPreview)
 */
export function ChartLoadingState({
  message = 'Loading...',
  minHeight = '300px',
}: ChartLoadingStateProps) {
  return (
    <div className="relative w-full h-full" style={{ minHeight }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
}

interface ChartErrorStateProps {
  message?: string;
  details?: string;
  minHeight?: string;
}

/**
 * Shared error state for chart components
 * Shows a warning alert with optional details
 */
export function ChartErrorState({
  message = 'Configuration needs a small adjustment. Please review your settings and try again.',
  details,
  minHeight = '300px',
}: ChartErrorStateProps) {
  return (
    <div className="relative h-full" style={{ minHeight }}>
      <div className="absolute top-0 left-0 right-0 z-10 p-4">
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {message}
            {details && (
              <>
                <br />
                <span className="text-xs mt-1 block">{details}</span>
              </>
            )}
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

/**
 * Silent error state - used when error is handled at page level
 */
export function ChartSilentErrorState() {
  return <div className="w-full h-full" />;
}

interface ChartEmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  minHeight?: string;
}

/**
 * Shared empty state for chart components
 * Shows an icon with title and subtitle for unconfigured charts
 */
export function ChartEmptyState({
  icon: Icon,
  title,
  subtitle,
  minHeight = '300px',
}: ChartEmptyStateProps) {
  return (
    <div className="flex items-center justify-center h-full" style={{ minHeight }}>
      <div className="text-center text-muted-foreground">
        <Icon className="h-12 w-12 mx-auto mb-4 opacity-20" />
        <p>{title}</p>
        <p className="text-sm mt-2">{subtitle}</p>
      </div>
    </div>
  );
}

interface DataLoadingOverlayProps {
  message?: string;
}

/**
 * Overlay for when map boundaries are loaded but data is still loading
 * Used by MapPreview for separated data fetching
 */
export function DataLoadingOverlay({ message = 'Loading data...' }: DataLoadingOverlayProps) {
  return (
    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

interface DataErrorOverlayProps {
  message: string;
}

/**
 * Overlay for data-specific errors (map data, not boundaries)
 */
export function DataErrorOverlay({ message }: DataErrorOverlayProps) {
  return (
    <div className="absolute top-4 left-4 right-4">
      <Alert variant="warning" className="max-w-lg">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Data needs attention: {message}</AlertDescription>
      </Alert>
    </div>
  );
}
