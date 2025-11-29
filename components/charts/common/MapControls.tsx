'use client';

import { ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface DrillDownLevel {
  level: number;
  name: string;
  geographic_column: string;
  parent_selections: Array<{
    column: string;
    value: string;
  }>;
}

interface MapBreadcrumbsProps {
  /** Array of drill-down levels representing the navigation path */
  drillDownPath: DrillDownLevel[];
  /** Callback when navigating to a specific level */
  onDrillUp?: (level: number) => void;
  /** Callback when navigating to home/root level */
  onDrillHome?: () => void;
}

/**
 * Breadcrumb navigation for map drill-down functionality
 *
 * Shows the current drill-down path and allows navigation back to
 * previous levels or home.
 *
 * @example
 * ```tsx
 * <MapBreadcrumbs
 *   drillDownPath={[{ level: 1, name: 'California', ... }]}
 *   onDrillUp={(level) => handleDrillUp(level)}
 *   onDrillHome={() => handleDrillHome()}
 * />
 * ```
 */
export function MapBreadcrumbs({ drillDownPath, onDrillUp, onDrillHome }: MapBreadcrumbsProps) {
  if (drillDownPath.length === 0) return null;

  return (
    <div className="flex items-center justify-between p-4 bg-muted/50 border-b">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onDrillHome} className="flex items-center gap-1">
          <Home className="h-4 w-4" />
          Home
        </Button>

        {drillDownPath.map((level, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="text-muted-foreground">/</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDrillUp?.(index)}
              className="flex items-center gap-1"
            >
              {level.name}
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {drillDownPath.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDrillUp?.(drillDownPath.length - 2)}
            className="flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        )}

        <Badge variant="outline">Level {drillDownPath.length || 1}</Badge>
      </div>
    </div>
  );
}

interface MapZoomControlsProps {
  /** Callback when zoom in is clicked */
  onZoomIn: () => void;
  /** Callback when zoom out is clicked */
  onZoomOut: () => void;
  /** Whether breadcrumbs are shown (affects positioning) */
  showBreadcrumbs?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Zoom controls for map charts
 *
 * Provides + and - buttons for zooming in and out of the map.
 * Position adjusts based on whether breadcrumbs are shown.
 *
 * @example
 * ```tsx
 * <MapZoomControls
 *   onZoomIn={handleZoomIn}
 *   onZoomOut={handleZoomOut}
 *   showBreadcrumbs={true}
 * />
 * ```
 */
export function MapZoomControls({
  onZoomIn,
  onZoomOut,
  showBreadcrumbs = false,
  className = '',
}: MapZoomControlsProps) {
  return (
    <div
      className={`absolute flex flex-col gap-1 z-10 ${className}`}
      style={{
        top: showBreadcrumbs ? '80px' : '12px',
        right: '12px',
        marginRight: '4px',
      }}
    >
      <button
        onClick={onZoomIn}
        className="w-9 h-9 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-md shadow-md hover:bg-white hover:shadow-lg transition-all duration-200 flex items-center justify-center text-base font-semibold text-gray-700 hover:text-gray-900"
        title="Zoom In"
      >
        +
      </button>
      <button
        onClick={onZoomOut}
        className="w-9 h-9 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-md shadow-md hover:bg-white hover:shadow-lg transition-all duration-200 flex items-center justify-center text-base font-semibold text-gray-700 hover:text-gray-900"
        title="Zoom Out"
      >
        −
      </button>
    </div>
  );
}
