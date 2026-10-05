'use client';

import { Card, CardContent } from '@/components/ui/card';
import { ChartElementView } from '@/components/dashboard/chart-element-view';
import { UnifiedTextElement } from '@/components/dashboard/text-element-unified';
import { LegacyHeading } from '@/components/dashboard/widgets/view-widgets';
import type { Dashboard } from '@/hooks/api/useDashboards';
import type { FrozenChartConfig } from '@/types/reports';
import {
  getPrintChartHeight,
  getPrintTextHeight,
  groupLayoutByRows,
  type PrintLayoutItem,
} from '@/components/reports/logic/print-rows';

interface PrintLayoutProps {
  dashboardData: Dashboard;
  frozenChartConfigs: Record<string, FrozenChartConfig>;
  publicToken: string;
  isPublicMode?: boolean;
  dashboardFilters?: Record<string, any>; // Currently-applied filter values to bake into the PDF/print capture
}

export function PrintLayout({
  dashboardData,
  frozenChartConfigs,
  publicToken,
  isPublicMode = true,
  dashboardFilters = {},
}: PrintLayoutProps) {
  const tabs = dashboardData.tabs || [];

  const renderItem = (layoutItem: PrintLayoutItem, components: Record<string, any>) => {
    const component = components[layoutItem.i];
    if (!component) return null;

    switch (component.type) {
      case 'chart': {
        const height = getPrintChartHeight(layoutItem.h);
        return (
          <div key={layoutItem.i} style={{ flex: layoutItem.w, minWidth: 0 }}>
            <Card className="h-full shadow-sm p-0 gap-0">
              <CardContent className="p-2" style={{ height }}>
                <ChartElementView
                  chartId={component.config?.chartId}
                  dashboardFilters={dashboardFilters}
                  dashboardFilterConfigs={[]}
                  viewMode={true}
                  className="h-full"
                  isPublicMode={isPublicMode}
                  publicToken={publicToken}
                  config={component.config}
                  frozenChartConfig={
                    frozenChartConfigs
                      ? frozenChartConfigs[String(component.config?.chartId)]
                      : undefined
                  }
                />
              </CardContent>
            </Card>
          </div>
        );
      }

      case 'text': {
        const height = getPrintTextHeight(layoutItem.h);
        return (
          <div key={layoutItem.i} style={{ flex: layoutItem.w, minWidth: 0, height }}>
            <UnifiedTextElement config={component.config} onUpdate={() => {}} isEditMode={false} />
          </div>
        );
      }

      case 'heading': {
        return (
          <div key={layoutItem.i} style={{ flex: layoutItem.w, minWidth: 0 }}>
            <div className="p-4 flex items-center">
              <LegacyHeading config={component.config} />
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="px-2 py-2">
      {tabs.map((tab) => {
        const tabComponents = tab.components || {};
        const tabLayout: PrintLayoutItem[] = (tab.layout_config as PrintLayoutItem[]) || [];
        const tabRows = groupLayoutByRows(tabLayout, tabComponents);
        return tabRows.map((row) => (
          <div
            key={`${tab.id}-row-${row.y}`}
            className="flex gap-2 mb-2"
            style={{ breakInside: 'avoid' }}
          >
            {row.items.map((item) => renderItem(item, tabComponents))}
          </div>
        ));
      })}
    </div>
  );
}
