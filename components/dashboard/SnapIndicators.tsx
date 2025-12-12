/**
 * Snap Indicators Component
 * Shows visual feedback for magnetic snapping zones during drag operations
 * Always renders 12 columns that scale with container width (Superset-style)
 */

import React from 'react';
import { SnapZone } from '@/lib/dashboard-animation-utils';

interface SnapIndicatorsProps {
  snapZones: SnapZone[]; // Keep for compatibility but we'll calculate our own grid
  containerWidth: number;
  containerHeight: number;
  rowHeight: number;
  visible: boolean;
}

export const SnapIndicators: React.FC<SnapIndicatorsProps> = ({
  containerWidth,
  containerHeight,
  visible,
}) => {
  if (!visible || containerWidth <= 0) {
    return null;
  }

  // Always use 12 columns (Superset-style) - calculate positions directly
  const FIXED_COLS = 12;
  const colWidth = containerWidth / FIXED_COLS;

  // Generate grid line positions (excluding first and last edges)
  const gridLines: number[] = [];
  for (let i = 1; i < FIXED_COLS; i++) {
    gridLines.push(i * colWidth);
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {gridLines.map((x, index) => (
        <div
          key={`snap-grid-${index}`}
          className="snap-indicator vertical"
          style={{
            left: x,
            top: 0,
            height: containerHeight,
          }}
        />
      ))}
    </div>
  );
};

export default SnapIndicators;
