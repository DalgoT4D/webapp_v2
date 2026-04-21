'use client';

import { useState, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import { usePipelineOverview } from '@/hooks/api/usePipelines';
import { PipelineSection } from './pipeline-section';

/**
 * PipelineOverview - Main component for the /pipeline page
 *
 * Features:
 * - Visual run history with bar charts
 * - Color-coded status icons (success/failure)
 * - Click bar to view logs inline below the pipeline card
 * - Scale to runtime toggle per pipeline
 * - Auto-refresh when pipeline is running
 * - Mobile responsive with scroll
 */
export function PipelineOverview() {
  const { pipelines, isLoading, isError } = usePipelineOverview();
  const [scaleByRuntime, setScaleByRuntime] = useState<Record<string, boolean>>({});

  const handleScaleChange = useCallback((deploymentName: string, checked: boolean) => {
    setScaleByRuntime((prev) => ({
      ...prev,
      [deploymentName]: checked,
    }));
  }, []);

  if (isLoading) {
    return <PipelineOverviewSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-1">Failed to load pipelines</h3>
        <p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Pipeline list */}
      <div className="space-y-6 pb-8">
        {pipelines.length === 0 ? (
          <EmptyState />
        ) : (
          pipelines.map((pipeline) => (
            <PipelineSection
              key={pipeline.deploymentName}
              pipeline={pipeline}
              scaleToRuntime={scaleByRuntime[pipeline.deploymentName] ?? true}
              onScaleChange={(checked) => handleScaleChange(pipeline.deploymentName, checked)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Empty state when no pipelines exist
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center bg-card rounded-xl border border-border">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <AlertCircle className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">No pipelines available</h3>
      <p className="text-sm text-muted-foreground max-w-md">
        Create a pipeline in the Orchestrate section to see run history here.
      </p>
    </div>
  );
}

/**
 * Skeleton loader for the overview page
 */
function PipelineOverviewSkeleton() {
  return (
    <div className="w-full animate-pulse">
      {/* Pipeline sections skeleton */}
      <div className="space-y-6">
        {['skeleton-1', 'skeleton-2', 'skeleton-3'].map((id) => (
          <div key={id}>
            <div className="h-5 w-32 bg-gray-200 rounded mb-2" />
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-gray-200 rounded-full" />
                  <div className="h-4 w-40 bg-gray-200 rounded" />
                </div>
                <div className="h-4 w-24 bg-gray-200 rounded" />
              </div>
              <div className="h-14 bg-muted rounded mb-4" />
              <div className="flex items-center justify-between">
                <div className="h-4 w-20 bg-gray-200 rounded" />
                <div className="h-4 w-32 bg-gray-200 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
