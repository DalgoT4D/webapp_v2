'use client';

import type { ComponentProps, CSSProperties, RefObject } from 'react';
import GridLayout from 'react-grid-layout';
import type { DashboardComponentConfig, DashboardLayoutItem } from '@/types/dashboard';
import type { DashboardFilterConfig } from '@/types/dashboard-filters';
import {
  GRID_CONTAINER_PADDING,
  GRID_MARGIN,
  GRID_ROW_HEIGHT,
} from '@/components/dashboard/grid/grid-constants';
import { DashboardCell } from '@/components/dashboard/DashboardCell';

/** The canvas is never shorter than this. */
const MIN_CANVAS_HEIGHT_PX = 400;
/** Empty space kept below the lowest widget. */
const CANVAS_BOTTOM_SPACE_PX = 100;

type GridProps = ComponentProps<typeof GridLayout>;

interface BuilderCanvasProps {
  canvasRef: RefObject<HTMLDivElement | null>;
  dashboardContainerRef: RefObject<HTMLDivElement | null>;
  screenHeight: number;
  cols: number;
  containerWidth: number;
  activeLayout: DashboardLayoutItem[];
  activeComponents: Record<string, DashboardComponentConfig>;
  renderedActiveTabId: string;
  isHandoff: boolean;
  handoffPlaceholderStyle: CSSProperties | null;
  onLayoutChange: GridProps['onLayoutChange'];
  onDragStart: GridProps['onDragStart'];
  onDrag: GridProps['onDrag'];
  onDragStop: GridProps['onDragStop'];
  onResizeStart: GridProps['onResizeStart'];
  onResizeStop: GridProps['onResizeStop'];
  animatingComponents: Set<string>;
  getAnimationStyles: (componentId: string) => CSSProperties;
  draggedItemId: string | undefined;
  resizingItems: Set<string>;
  appliedFilters: Record<string, unknown>;
  initialFilters: DashboardFilterConfig[];
  dashboardId: number | undefined;
  onViewChart: (chartId: number) => void;
  onEditChart: (chartId: number) => void;
  onViewKpi: (kpiId: number) => void;
  onEditKpi: (kpiId: number) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, config: Record<string, unknown>) => void;
}

/** The builder's grid canvas: drop placeholder, RGL grid and one DashboardCell per widget. */
export function BuilderCanvas(props: BuilderCanvasProps) {
  const {
    canvasRef,
    dashboardContainerRef,
    screenHeight,
    cols,
    containerWidth,
    activeLayout,
    activeComponents,
    renderedActiveTabId,
    isHandoff,
    handoffPlaceholderStyle,
    onLayoutChange,
    onDragStart,
    onDrag,
    onDragStop,
    onResizeStart,
    onResizeStop,
    animatingComponents,
    getAnimationStyles,
    draggedItemId,
    resizingItems,
    appliedFilters,
    initialFilters,
    dashboardId,
    onViewChart,
    onEditChart,
    onViewKpi,
    onEditKpi,
    onRemove,
    onUpdate,
  } = props;
  return (
    <div ref={canvasRef} className="flex-1 overflow-auto bg-gray-50 p-4 pb-[150px] min-w-0">
      {/* Canvas container with full width */}
      <div
        ref={dashboardContainerRef}
        className="bg-white dashboard-canvas-responsive"
        style={{
          width: '100%',
          // Calculate minimum height based on actual content:
          // Find the lowest item (y + h) and multiply by GRID_ROW_HEIGHT + padding
          minHeight: Math.max(
            screenHeight,
            MIN_CANVAS_HEIGHT_PX,
            // Calculate content height from layout items
            activeLayout.length > 0
              ? Math.max(...activeLayout.map((item) => (item.y + item.h) * GRID_ROW_HEIGHT)) +
                  CANVAS_BOTTOM_SPACE_PX
              : 0
          ),
          position: 'relative',
        }}
      >
        {handoffPlaceholderStyle && (
          <div
            className="pointer-events-none absolute z-30 rounded-md border-2 border-dashed border-blue-500 bg-blue-100/50 shadow-inner"
            style={handoffPlaceholderStyle}
            data-testid="cross-tab-drop-placeholder"
          />
        )}
        <GridLayout
          // The handoff grid can receive the tail of RGL's original mouse gesture.
          // Remount it once more when the handoff settles so RGL cannot retain an
          // activeDrag placeholder over the newly inserted destination widget.
          key={`dashboard-grid-${renderedActiveTabId}-${isHandoff ? 'handoff' : 'settled'}`}
          className="layout relative z-10"
          data-grid-instance={`${renderedActiveTabId}-${isHandoff ? 'handoff' : 'settled'}`}
          data-grid-model="true"
          layout={activeLayout}
          cols={cols} // Always exactly 12 columns (Superset-style)
          rowHeight={GRID_ROW_HEIGHT}
          width={containerWidth} // Use available container width - columns adjust to fit
          onLayoutChange={onLayoutChange}
          onDragStart={onDragStart}
          onDrag={onDrag}
          onDragStop={onDragStop}
          onResizeStart={onResizeStart}
          onResizeStop={onResizeStop}
          draggableCancel=".drag-cancel"
          // Grid model: each widget owns its (x, y, w, h). Gravity-up is the only
          // automatic behaviour; neighbours are pushed down (never sideways) on collision.
          compactType="vertical"
          preventCollision={false}
          allowOverlap={false}
          margin={GRID_MARGIN} // Match preview mode spacing
          containerPadding={GRID_CONTAINER_PADDING} // Match preview mode padding
          autoSize={true}
          useCSSTransforms={true}
          transformScale={1}
          isDraggable={true}
          isResizable={true}
          resizeHandles={['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne']}
        >
          {activeLayout.map((item) => {
            const component = activeComponents[item.i];
            if (!component) return null;
            return (
              // RGL requires the immediate child to carry key={item.i}; the wrapping div
              // preserves that contract while DashboardCell handles all visual content.
              <div key={item.i}>
                <DashboardCell
                  item={item}
                  component={component}
                  isAnimating={animatingComponents.has(item.i)}
                  isBeingPushed={false}
                  isDraggedComponent={draggedItemId === item.i}
                  spaceMakingActive={false}
                  animationStyles={getAnimationStyles(item.i)}
                  isResizing={resizingItems.has(item.i)}
                  appliedFilters={appliedFilters}
                  initialFilters={initialFilters}
                  dashboardId={dashboardId}
                  onViewChart={onViewChart}
                  onEditChart={onEditChart}
                  onViewKpi={onViewKpi}
                  onEditKpi={onEditKpi}
                  onRemove={onRemove}
                  onUpdate={onUpdate}
                />
              </div>
            );
          })}
        </GridLayout>
      </div>
    </div>
  );
}
