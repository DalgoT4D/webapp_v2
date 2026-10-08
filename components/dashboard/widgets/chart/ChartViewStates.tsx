'use client';

import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChartViewLoadingProps {
  className?: string;
  isTableChart: boolean;
  tableLoading: boolean;
  isMapChart: boolean;
  mapLoading: boolean;
  geojsonLoading: boolean;
}

/** Spinner + "Loading table data…" / "Loading map boundaries…" / "Loading map data…" / "Loading chart…". */
export function ChartViewLoading({
  className,
  isTableChart,
  tableLoading,
  isMapChart,
  mapLoading,
  geojsonLoading,
}: ChartViewLoadingProps) {
  return (
    <div className={cn('relative w-full h-full min-h-[300px]', className)}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm text-muted-foreground">
            {isTableChart && tableLoading
              ? 'Loading table data...'
              : isMapChart && (mapLoading || geojsonLoading)
                ? geojsonLoading
                  ? 'Loading map boundaries...'
                  : 'Loading map data...'
                : 'Loading chart...'}
          </p>
        </div>
      </div>
    </div>
  );
}

interface ChartViewErrorProps {
  className?: string;
  chartId: number;
  errorMessage: string;
  onRetry: () => void;
}

/** "Chart Error" card with Retry. */
export function ChartViewError({ className, chartId, errorMessage, onRetry }: ChartViewErrorProps) {
  return (
    <div className={cn('h-full flex flex-col items-center justify-start pt-20 p-4', className)}>
      <div className="w-full max-w-md">
        <div className="flex items-center p-4 border border-red-200 rounded-lg bg-red-50 shadow-lg">
          <AlertCircle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Chart Error</p>
            <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-3 h-8 text-xs border-red-300 text-red-700 hover:bg-red-100"
              data-testid={`dashboard-chart-retry-btn-${chartId}`}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
