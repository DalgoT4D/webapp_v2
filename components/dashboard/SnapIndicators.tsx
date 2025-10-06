/**
 * Snap Indicators Component
 * Shows visual feedback for magnetic snapping zones during drag operations
 */

import React from 'react';
import { SnapZone } from '@/lib/dashboard-animation-utils';

interface SnapIndicatorsProps {
  snapZones: SnapZone[];
  containerWidth: number;
  containerHeight: number;
  rowHeight: number;
  visible: boolean;
}

export const SnapIndicators: React.FC<SnapIndicatorsProps> = ({
  snapZones,
  containerWidth,
  containerHeight,
  rowHeight,
  visible,
}) => {
  if (!visible || snapZones.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      {snapZones.map((zone, index) => {
        const style: React.CSSProperties = {};

        if (zone.direction === 'vertical') {
          style.left = zone.position.x;
          style.top = 0;
          style.width = '2px';
          style.height = containerHeight;
        } else {
          style.left = 0;
          style.top = zone.position.y * rowHeight;
          style.width = containerWidth;
          style.height = '2px';
        }

        return (
          <div
            key={`${zone.type}-${zone.direction}-${index}`}
            className={`snap-indicator ${zone.direction}`}
            style={{
              ...style,
              opacity: zone.strength * 0.8, // Adjust opacity based on strength
            }}
          />
        );
      })}
    </div>
  );
};

export default SnapIndicators;
