'use client';

import type { ReactNode } from 'react';
import GridLayoutLib, {
  Responsive as ResponsiveGridLayout,
  WidthProvider as GridLayoutWidthProvider,
} from 'react-grid-layout';
import { Card, CardContent } from '@/components/ui/card';
import type { DashboardLayoutItem } from '@/types/dashboard';
import {
  GRID_BREAKPOINTS,
  GRID_COLS,
  GRID_CONTAINER_PADDING,
  GRID_MARGIN,
  GRID_ROW_HEIGHT,
  type ScreenSizeKey,
} from '@/components/dashboard/grid/grid-constants';
import { generateResponsiveLayoutsForPreview } from './view-layout';

const GridLayout = GridLayoutLib;
const ResponsiveGrid = GridLayoutWidthProvider(ResponsiveGridLayout);

interface DashboardViewGridProps {
  layout: DashboardLayoutItem[];
  effectiveScreenSize: ScreenSizeKey;
  targetScreenSize: ScreenSizeKey;
  cols: number;
  /** The dashboard's saved responsive layouts, if any. */
  responsiveLayouts: Record<string, DashboardLayoutItem[]> | undefined;
  containerWidth: number;
  onBreakpointChange: (breakpoint: string) => void;
  renderComponent: (componentId: string) => ReactNode;
}

/** "No Dashboard Components", or the widgets on the grid (responsive only when previewing another size). */
export function DashboardViewGrid({
  layout,
  effectiveScreenSize,
  targetScreenSize,
  cols,
  responsiveLayouts,
  containerWidth,
  onBreakpointChange,
  renderComponent,
}: DashboardViewGridProps) {
  return (
    <>
      {/* Show empty state if no layout config */}
      {(() => {
        const activeLayout = layout;
        return activeLayout.length === 0 ? (
          <div className="p-8 text-center text-gray-500" data-testid="dashboard-view-empty-state">
            <p className="text-lg mb-2">No Dashboard Components</p>
            <p className="text-sm">This dashboard doesn't have any components configured yet.</p>
          </div>
        ) : null;
      })()}

      {/* Use exact layout for view mode - no height reduction needed since toolbar is now floating */}
      {(() => {
        const modifiedLayout = layout;

        return effectiveScreenSize !== targetScreenSize ? (
          // Preview mode with different screen size - use responsive layout
          <ResponsiveGrid
            className="dashboard-grid"
            layouts={
              responsiveLayouts ||
              generateResponsiveLayoutsForPreview(modifiedLayout, targetScreenSize)
            }
            breakpoints={GRID_BREAKPOINTS}
            cols={GRID_COLS}
            rowHeight={GRID_ROW_HEIGHT}
            width={containerWidth}
            style={{
              width: '100% !important',
            }}
            isDraggable={false}
            isResizable={false}
            compactType={null}
            preventCollision={false}
            margin={GRID_MARGIN}
            containerPadding={GRID_CONTAINER_PADDING}
            autoSize={true}
            verticalCompact={false}
            onBreakpointChange={(newBreakpoint: string) => {
              onBreakpointChange(newBreakpoint);
            }}
          >
            {modifiedLayout.map((layoutItem) => (
              <div key={layoutItem.i} className="dashboard-item">
                <Card className="h-full shadow-sm hover:shadow-md transition-shadow duration-200 p-0 gap-0">
                  <CardContent className="p-2 h-full">{renderComponent(layoutItem.i)}</CardContent>
                </Card>
              </div>
            ))}
          </ResponsiveGrid>
        ) : (
          // Target screen size or no preview override - grid model: render each
          // widget at its own (x,y,w,h) with gravity-up, matching the editor.
          <GridLayout
            className="dashboard-grid"
            // Pass the raw layout and let RGL's compactType="vertical" handle
            // compaction — identical to the editor canvas. A prior compactVertical()
            // pass here used a "global topmost free slot" search that let items jump
            // a full-width separator into an exactly-sized gap above it, so the view
            // reflowed differently from edit. See git history / dashboard 328.
            layout={modifiedLayout}
            cols={cols}
            rowHeight={GRID_ROW_HEIGHT}
            width={containerWidth}
            style={{
              width: '100% !important',
            }}
            isDraggable={false}
            isResizable={false}
            compactType="vertical"
            preventCollision={false}
            allowOverlap={false}
            margin={GRID_MARGIN}
            containerPadding={GRID_CONTAINER_PADDING}
            autoSize={true}
          >
            {modifiedLayout.map((layoutItem) => (
              <div key={layoutItem.i} className="dashboard-item">
                <Card className="h-full shadow-sm hover:shadow-md transition-shadow duration-200 p-0 gap-0">
                  <CardContent className="p-2 h-full">{renderComponent(layoutItem.i)}</CardContent>
                </Card>
              </div>
            ))}
          </GridLayout>
        );
      })()}
    </>
  );
}
