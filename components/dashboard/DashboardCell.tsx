'use client';

import React, { memo } from 'react';
import { Eye, Edit, X } from 'lucide-react';
import { BUILDER_WIDGETS } from '@/components/dashboard/widgets/builder-widgets';
import { DashboardComponentType } from '@/types/dashboard';
import type { DashboardComponentConfig } from '@/types/dashboard';
import type { DashboardFilterConfig } from '@/types/dashboard-filters';
import { useChart } from '@/hooks/api/useCharts';
import { useKPI } from '@/hooks/api/useKPIs';
import { hasEditAccess } from '@/components/access/logic/resource-permissions';

interface DashboardLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
}

interface DashboardComponent {
  id: string;
  type: DashboardComponentType;
  // any: component.config.chartId / .kpiId are read as number below (TS2345 if typed unknown) — kept any, see Task 13 row 11
  config: any;
}

interface DashboardCellProps {
  item: DashboardLayout;
  component: DashboardComponent;
  isAnimating: boolean;
  isBeingPushed: boolean;
  isDraggedComponent: boolean;
  spaceMakingActive: boolean;
  animationStyles: React.CSSProperties;
  isResizing: boolean;
  appliedFilters: Record<string, unknown>;
  initialFilters: DashboardFilterConfig[];
  /** Passed through to UnifiedTextElement for analytics. A stable number, so it does not
   *  affect the React.memo comparison this component relies on for drag performance. */
  dashboardId?: number;
  // Stable callback references (must be stable for React.memo to work)
  onViewChart: (chartId: number) => void;
  onEditChart: (chartId: number) => void;
  onViewKpi: (kpiId: number) => void;
  onEditKpi: (kpiId: number) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, config: DashboardComponentConfig['config']) => void;
}

function DashboardCellInner({
  item,
  component,
  isAnimating,
  isBeingPushed,
  isDraggedComponent,
  spaceMakingActive,
  animationStyles,
  isResizing,
  appliedFilters,
  initialFilters,
  dashboardId,
  onViewChart,
  onEditChart,
  onViewKpi,
  onEditKpi,
  onRemove,
  onUpdate,
}: DashboardCellProps) {
  const isChart = component.type === DashboardComponentType.CHART;
  const isText = component.type === DashboardComponentType.TEXT;
  const isKPI = component.type === DashboardComponentType.KPI;
  const { data: chart } = useChart(isChart ? component.config.chartId : null);
  const { kpi } = useKPI(isKPI ? component.config.kpiId : null);
  const canEditCharts = hasEditAccess(chart?.access_level);
  const canEditKpis = hasEditAccess(kpi?.access_level);
  const BuilderWidget = BUILDER_WIDGETS[component.type];

  return (
    <div
      data-component-id={item.i}
      data-testid={`dashboard-cell-${item.i}`}
      className={`dashboard-item bg-transparent relative group transition-all duration-200 ${
        isAnimating ? 'animating' : ''
      } ${isBeingPushed ? 'being-pushed' : ''} ${
        isDraggedComponent && spaceMakingActive ? 'space-making-active' : ''
      } ${isText ? 'text-component' : ''}`}
      style={animationStyles}
    >
      {/* Chart Action Buttons - Single clean row */}
      {isChart && (
        <div className="absolute top-2 right-2 z-50 flex gap-1 drag-cancel opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewChart(component.config.chartId);
            }}
            className="h-7 w-7 flex items-center justify-center bg-white/90 hover:bg-white rounded shadow-sm transition-all drag-cancel hover:text-blue-600"
            title="View Chart"
            data-testid={`dashboard-cell-view-${item.i}`}
          >
            <Eye className="w-3.5 h-3.5 text-gray-600" />
          </button>
          {canEditCharts && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditChart(component.config.chartId);
              }}
              className="h-7 w-7 flex items-center justify-center bg-white/90 hover:bg-white rounded shadow-sm transition-all drag-cancel hover:text-green-600"
              title="Edit Chart"
              data-testid={`dashboard-cell-edit-${item.i}`}
            >
              <Edit className="w-3.5 h-3.5 text-gray-600" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item.i);
            }}
            className="h-7 w-7 flex items-center justify-center bg-white/90 hover:bg-white rounded shadow-sm transition-all drag-cancel hover:text-red-600"
            title="Remove Chart From Dashboard"
            data-testid={`dashboard-cell-remove-${item.i}`}
          >
            <X className="w-3.5 h-3.5 text-gray-600" />
          </button>
        </div>
      )}

      {/* Action Buttons for Text Elements */}
      {isText && (
        <div className="absolute top-2 right-2 z-[60] flex gap-1 drag-cancel opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item.i);
            }}
            className="h-7 w-7 flex items-center justify-center bg-white/90 hover:bg-white rounded shadow-sm transition-all drag-cancel hover:text-red-600"
            title="Remove Text From Dashboard"
            data-testid={`dashboard-cell-remove-${item.i}`}
          >
            <X className="w-3.5 h-3.5 text-gray-600" />
          </button>
        </div>
      )}

      {/* Action Buttons for KPI Elements */}
      {isKPI && (
        <div className="absolute top-2 right-2 z-50 flex gap-1 drag-cancel opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewKpi(component.config.kpiId);
            }}
            className="h-7 w-7 flex items-center justify-center bg-white/90 hover:bg-white rounded shadow-sm transition-all drag-cancel hover:text-blue-600"
            title="View KPI"
            data-testid={`dashboard-cell-view-${item.i}`}
          >
            <Eye className="w-3.5 h-3.5 text-gray-600" />
          </button>
          {canEditKpis && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditKpi(component.config.kpiId);
              }}
              className="h-7 w-7 flex items-center justify-center bg-white/90 hover:bg-white rounded shadow-sm transition-all drag-cancel hover:text-green-600"
              title="Edit KPI"
              data-testid={`dashboard-cell-edit-${item.i}`}
            >
              <Edit className="w-3.5 h-3.5 text-gray-600" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item.i);
            }}
            className="h-7 w-7 flex items-center justify-center bg-white/90 hover:bg-white rounded shadow-sm transition-all drag-cancel hover:text-red-600"
            title="Remove KPI From Dashboard"
            data-testid={`dashboard-cell-remove-${item.i}`}
          >
            <X className="w-3.5 h-3.5 text-gray-600" />
          </button>
        </div>
      )}

      {/* Drag Handle Area - Top section for dragging */}
      <div
        className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-blue-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-move flex items-center justify-center z-20"
        data-testid={`dashboard-cell-drag-${item.i}`}
      >
        <div className="text-xs text-gray-400 font-medium">Drag to move</div>
      </div>

      {/* Content Area - Charts fully visible and interactive */}
      <div className="flex-1 flex flex-col min-h-0 drag-cancel">
        {BuilderWidget && (
          <BuilderWidget
            item={item}
            component={component}
            isResizing={isResizing}
            appliedFilters={appliedFilters}
            initialFilters={initialFilters}
            dashboardId={dashboardId}
            onRemove={onRemove}
            onUpdate={onUpdate}
          />
        )}
      </div>
    </div>
  );
}

export const DashboardCell = memo(DashboardCellInner);
