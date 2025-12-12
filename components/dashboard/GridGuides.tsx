/**
 * Grid Guides Component
 * Renders visible grid column guides like Apache Superset
 * Always shows 12 columns that scale with container width
 */

import React from 'react';

interface GridGuidesProps {
  containerWidth: number;
  containerHeight: number;
  cols?: number;
  visible?: boolean;
}

export const GridGuides: React.FC<GridGuidesProps> = ({
  containerWidth,
  containerHeight,
  cols = 12,
  visible = true,
}) => {
  if (!visible || containerWidth <= 0) {
    return null;
  }

  const colWidth = containerWidth / cols;
  const guides: number[] = [];

  // Generate guide positions for each column boundary (excluding first and last)
  for (let i = 1; i < cols; i++) {
    guides.push(i * colWidth);
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      {guides.map((x, index) => (
        <div
          key={`grid-guide-${index}`}
          className="absolute top-0 bottom-0 w-px"
          style={{
            left: x,
            height: containerHeight,
            background:
              'repeating-linear-gradient(to bottom, transparent, transparent 4px, rgba(209, 213, 219, 0.5) 4px, rgba(209, 213, 219, 0.5) 8px)',
          }}
        />
      ))}
    </div>
  );
};

export default GridGuides;
