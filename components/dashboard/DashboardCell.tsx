'use client';

import React, { memo } from 'react';
import { Eye, Edit, X } from 'lucide-react';
import { ChartElementV2 } from './chart-element-v2';
import { UnifiedTextElement } from './text-element-unified';
import type { UnifiedTextConfig } from './text-element-unified';
import { DashboardComponentType } from './dashboard-builder-v2';
import type { DashboardFilterConfig } from '@/types/dashboard-filters';

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
  appliedFilters: Record<string, any>;
  initialFilters: DashboardFilterConfig[];
  // Stable callback references (must be stable for React.memo to work)
  onViewChart: (chartId: number) => void;
  onEditChart: (chartId: number) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, config: any) => void;
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
  onViewChart,
  onEditChart,
  onRemove,
  onUpdate,
}: DashboardCellProps) {
  const isChart = component.type === DashboardComponentType.CHART;
  const isText = component.type === DashboardComponentType.TEXT;

  return (
    <div
      data-component-id={item.i}
      className={`dashboard-item bg-transparent relative group transition-all duration-200 ${
        isAnimating ? 'animating' : ''
      } ${isBeingPushed ? 'being-pushed' : ''} ${
        isDraggedComponent && spaceMakingActive ? 'space-making-active' : ''
      } ${isText ? 'text-component' : ''}`}
      style={animationStyles}
    >
      {/* Chart Action Buttons - Single clean row */}
      {isChart && (
        <div className="absolute top-2 right-2 z-50 flex gap-1 drag-cancel opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewChart(component.config.chartId);
            }}
            className="h-7 w-7 flex items-center justify-center bg-white/90 hover:bg-white rounded shadow-sm transition-all drag-cancel hover:text-blue-600"
            title="View Chart"
          >
            <Eye className="w-3.5 h-3.5 text-gray-600" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditChart(component.config.chartId);
            }}
            className="h-7 w-7 flex items-center justify-center bg-white/90 hover:bg-white rounded shadow-sm transition-all drag-cancel hover:text-green-600"
            title="Edit Chart"
          >
            <Edit className="w-3.5 h-3.5 text-gray-600" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item.i);
            }}
            className="h-7 w-7 flex items-center justify-center bg-white/90 hover:bg-white rounded shadow-sm transition-all drag-cancel hover:text-red-600"
            title="Remove Chart From Dashboard"
          >
            <X className="w-3.5 h-3.5 text-gray-600" />
          </button>
        </div>
      )}

      {/* Action Buttons for Text Elements */}
      {isText && (
        <div className="absolute top-2 right-2 z-50 flex gap-1 drag-cancel opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item.i);
            }}
            className="p-1 bg-white/80 hover:bg-white rounded transition-all drag-cancel hover:text-red-600"
            title="Remove text"
          >
            <X className="w-3 h-3 text-gray-500" />
          </button>
        </div>
      )}

      {/* Drag Handle Area - Top section for dragging */}
      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-blue-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-move flex items-center justify-center z-20">
        <div className="text-xs text-gray-400 font-medium">Drag to move</div>
      </div>

      {/* Content Area - Charts fully visible and interactive */}
      <div className="flex-1 flex flex-col min-h-0 drag-cancel">
        {isChart && (
          <ChartElementV2
            onRemove={() => onRemove(item.i)}
            onUpdate={(config: any) => onUpdate(item.i, config)}
            chartId={component.config.chartId}
            config={component.config}
            isResizing={isResizing}
            appliedFilters={appliedFilters}
            dashboardFilterConfigs={initialFilters}
          />
        )}
        {isText && (
          <UnifiedTextElement
            onUpdate={(config: UnifiedTextConfig) => onUpdate(item.i, config)}
            config={component.config as UnifiedTextConfig}
            isEditMode={true}
          />
        )}
      </div>
    </div>
  );
}

export const DashboardCell = memo(DashboardCellInner);
