'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface DashboardMiniPreviewProps {
  dashboardData: any;
  className?: string;
}

export function DashboardMiniPreview({ dashboardData, className }: DashboardMiniPreviewProps) {
  // This is a simplified client-side dashboard renderer
  // Similar to how charts render using MiniChart

  // Handle different dashboard data structures and ensure we have an array
  let components: any[] = [];

  if (
    dashboardData?.layout_config?.components &&
    Array.isArray(dashboardData.layout_config.components)
  ) {
    components = dashboardData.layout_config.components;
  } else if (Array.isArray(dashboardData?.layout_config)) {
    components = dashboardData.layout_config;
  } else if (dashboardData?.components && Array.isArray(dashboardData.components)) {
    components = dashboardData.components;
  } else if (dashboardData?.components && typeof dashboardData.components === 'object') {
    // Handle case where components is an object - convert to array
    components = Object.values(dashboardData.components);
  } else {
    // No valid component array found - create fallback visualization
    console.log('❌ No valid components found, using fallback');
    components = [
      { id: 1, w: 2, h: 1 },
      { id: 2, w: 2, h: 1 },
      { id: 3, w: 4, h: 1 },
      { id: 4, w: 3, h: 1 },
    ];
  }

  // Ensure components is definitely an array
  if (!Array.isArray(components)) {
    console.log('❌ Components is not an array, creating fallback');
    components = [
      { id: 1, w: 2, h: 1 },
      { id: 2, w: 2, h: 1 },
      { id: 3, w: 4, h: 1 },
    ];
  }

  const gridColumns = dashboardData?.grid_columns || 12;

  return (
    <div className={cn('w-full h-full bg-gray-50 p-2 relative overflow-hidden border', className)}>
      <div
        className="grid gap-1 h-full"
        style={{
          gridTemplateColumns: `repeat(${Math.min(gridColumns, 6)}, 1fr)`,
          gridTemplateRows: 'repeat(auto-fit, minmax(16px, 1fr))',
        }}
      >
        {(Array.isArray(components) ? components : [])
          .slice(0, 8)
          .map((component: any, index: number) => (
            <div
              key={component.id || index}
              className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-sm shadow-sm"
              style={{
                gridColumn: `span ${Math.min(component.w || 1, 3)}`,
                gridRow: `span ${Math.min(component.h || 1, 2)}`,
              }}
            ></div>
          ))}
      </div>

      {/* Subtle preview overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-gray-50/30 pointer-events-none" />
    </div>
  );
}
