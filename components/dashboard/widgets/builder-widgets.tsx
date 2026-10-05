'use client';

import type { ComponentType } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChartElementV2 } from '@/components/dashboard/chart-element-v2';
import { KPIChartElement } from '@/components/dashboard/kpi-chart-element';
import {
  UnifiedTextElement,
  type UnifiedTextConfig,
} from '@/components/dashboard/text-element-unified';
import {
  DashboardComponentType,
  type DashboardComponentConfig,
  type DashboardLayoutItem,
} from '@/types/dashboard';
import type { DashboardFilterConfig } from '@/types/dashboard-filters';

export interface BuilderWidgetProps {
  item: DashboardLayoutItem;
  component: DashboardComponentConfig;
  isResizing: boolean;
  appliedFilters: Record<string, unknown>;
  initialFilters: DashboardFilterConfig[];
  /** Analytics only (rich-text events). */
  dashboardId?: number;
  onRemove: (id: string) => void;
  onUpdate: (id: string, config: Record<string, unknown>) => void;
}

function ChartBuilderWidget({
  item,
  component,
  isResizing,
  appliedFilters,
  initialFilters,
  onRemove,
  onUpdate,
}: BuilderWidgetProps) {
  const config = component.config as { chartId: number } & Record<string, unknown>;
  return (
    <ChartElementV2
      onRemove={() => onRemove(item.i)}
      onUpdate={(nextConfig: Record<string, unknown>) => onUpdate(item.i, nextConfig)}
      chartId={config.chartId}
      config={component.config}
      isResizing={isResizing}
      appliedFilters={appliedFilters}
      dashboardFilterConfigs={initialFilters}
    />
  );
}

function TextBuilderWidget({ item, component, dashboardId, onUpdate }: BuilderWidgetProps) {
  return (
    <UnifiedTextElement
      onUpdate={(config: UnifiedTextConfig) =>
        onUpdate(item.i, config as unknown as Record<string, unknown>)
      }
      config={component.config as unknown as UnifiedTextConfig}
      componentId={item.i}
      isEditMode={true}
      dashboardId={dashboardId}
    />
  );
}

// PINNED-BUGS: "Builder KPIs ignore dashboard filters" — no dashboardFilters passed here.
function KpiBuilderWidget({ component, isResizing }: BuilderWidgetProps) {
  const config = component.config as { kpiId: number };
  return (
    <Card className="h-full w-full flex flex-col">
      <CardContent className="p-2 flex-1 flex flex-col min-h-0">
        <KPIChartElement kpiId={config.kpiId} config={component.config} isResizing={isResizing} />
      </CardContent>
    </Card>
  );
}

/** What a builder cell renders below its toolbar, per widget type. Legacy heading/filter render nothing. */
export const BUILDER_WIDGETS: Record<string, ComponentType<BuilderWidgetProps>> = {
  [DashboardComponentType.CHART]: ChartBuilderWidget,
  [DashboardComponentType.TEXT]: TextBuilderWidget,
  [DashboardComponentType.KPI]: KpiBuilderWidget,
};
