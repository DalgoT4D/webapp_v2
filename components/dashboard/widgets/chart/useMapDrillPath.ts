'use client';

import { useState } from 'react';
import type { WidgetMapDrillLevel } from './logic/chart-widget-map';

/** A map widget's drill path. Handlers are rebuilt every render, as before (MapPreview and the chart effect see new identities each render). */
export function useMapDrillPath() {
  // Use chartId as unique identifier to isolate drill-down state per chart
  const [drillDownPath, setDrillDownPath] = useState<WidgetMapDrillLevel[]>([]);

  // Handle drill up to a specific level
  const handleDrillUp = (targetLevel: number) => {
    if (targetLevel < 0) {
      setDrillDownPath([]);
    } else {
      setDrillDownPath(drillDownPath.slice(0, targetLevel + 1));
    }
  };

  // Handle drill to home (first level)
  const handleDrillHome = () => {
    setDrillDownPath([]);
  };

  return { drillDownPath, setDrillDownPath, handleDrillUp, handleDrillHome };
}
