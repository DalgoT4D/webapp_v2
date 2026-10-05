'use client';

import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WidgetMapDrillLevel } from './logic/chart-widget-map';

interface MapDrillBreadcrumbProps {
  chartId: number;
  drillDownPath: WidgetMapDrillLevel[];
  onHome: () => void;
  onDrillUp: (targetLevel: number) => void;
}

/** Home / region / region … above a drilled map widget. */
export function MapDrillBreadcrumb({
  chartId,
  drillDownPath,
  onHome,
  onDrillUp,
}: MapDrillBreadcrumbProps) {
  return (
    <div className="px-2 py-1 border-b border-gray-100 flex-shrink-0">
      <div className="flex items-center gap-1 text-xs">
        <Button
          variant="ghost"
          size="sm"
          onClick={onHome}
          className="h-6 px-2 text-xs"
          title="Go to top level"
          data-testid={`dashboard-chart-map-home-${chartId}`}
        >
          <Home className="h-3 w-3 mr-1" />
          Home
        </Button>
        {drillDownPath.map((level, index) => (
          // Path entries have no id of their own; the index is their identity (kept as is).
          <div key={index} className="flex items-center gap-1">
            <span className="text-gray-400">/</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDrillUp(index - 1)}
              className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800"
              data-testid={`dashboard-chart-map-crumb-${chartId}-${index}`}
            >
              {level.name}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
