'use client';

import { ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DrillDownConfig, DrillDownPathStep } from '@/types/charts';

interface DrillDownBreadcrumbProps {
  path: DrillDownPathStep[];
  config: DrillDownConfig;
  onLevelClick: (level: number) => void;
  className?: string;
}

export function DrillDownBreadcrumb({
  path,
  config,
  onLevelClick,
  className,
}: DrillDownBreadcrumbProps) {
  // Get the base level display name
  const baseLevel = config.hierarchy[0];

  return (
    <nav
      className={cn(
        'flex items-center space-x-1 text-sm mb-4 p-3 bg-gray-50 rounded-lg',
        className
      )}
      aria-label="Drill-down navigation breadcrumb"
    >
      {/* Home/Base Level */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onLevelClick(0)}
        className="h-7 px-2 hover:bg-gray-100 text-blue-600 hover:text-blue-700"
      >
        <Home className="h-3.5 w-3.5 mr-1" />
        {baseLevel?.display_name || 'All'}
      </Button>

      {/* Breadcrumb Trail */}
      {path.map((step, index) => (
        <div key={index} className="flex items-center">
          <ChevronRight className="h-4 w-4 text-gray-400 mx-0.5" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onLevelClick(step.level + 1)}
            className={cn(
              'h-7 px-2 hover:bg-gray-100',
              index === path.length - 1
                ? 'text-gray-900 font-medium bg-white'
                : 'text-blue-600 hover:text-blue-700'
            )}
            disabled={index === path.length - 1}
          >
            {step.value}
          </Button>
        </div>
      ))}

      {/* Level indicator */}
      {path.length > 0 && (
        <div className="ml-auto flex items-center text-xs text-gray-500">
          <span className="px-2 py-1 bg-gray-100 rounded">
            Level {path.length} of {config.hierarchy.length}
          </span>
        </div>
      )}
    </nav>
  );
}
