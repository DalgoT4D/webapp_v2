'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ChartElementView } from '@/components/dashboard/chart-element-view';
import { UnifiedTextElement } from '@/components/dashboard/text-element-unified';
import type { Dashboard } from '@/hooks/api/useDashboards';
import type { FrozenChartConfig } from '@/types/reports';

const ROW_HEIGHT_PX = 20;
const MIN_CHART_HEIGHT_PX = 300;

interface PrintLayoutProps {
  dashboardData: Dashboard;
  frozenChartConfigs: Record<string, FrozenChartConfig>;
  publicToken: string;
  isPublicMode?: boolean;
}

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface RowGroup {
  y: number;
  items: LayoutItem[];
}

function groupLayoutByRows(
  layoutConfig: LayoutItem[],
  components: Record<string, any>
): RowGroup[] {
  const filtered = layoutConfig.filter((item) => {
    const component = components[item.i];
    return component && component.type !== 'filter';
  });

  const byY = new Map<number, LayoutItem[]>();
  for (const item of filtered) {
    const row = byY.get(item.y) || [];
    row.push(item);
    byY.set(item.y, row);
  }

  const rows: RowGroup[] = [];
  for (const [y, items] of byY) {
    items.sort((a, b) => a.x - b.x);
    rows.push({ y, items });
  }
  rows.sort((a, b) => a.y - b.y);

  return rows;
}

export function PrintLayout({
  dashboardData,
  frozenChartConfigs,
  publicToken,
  isPublicMode = true,
}: PrintLayoutProps) {
  const tabs = dashboardData.tabs || [];

  const renderItem = (layoutItem: LayoutItem, components: Record<string, any>) => {
    const component = components[layoutItem.i];
    if (!component) return null;

    switch (component.type) {
      case 'chart': {
        const height = Math.max(layoutItem.h * ROW_HEIGHT_PX, MIN_CHART_HEIGHT_PX);
        return (
          <div key={layoutItem.i} style={{ flex: layoutItem.w, minWidth: 0 }}>
            <Card className="h-full shadow-sm p-0 gap-0">
              <CardContent className="p-2" style={{ height }}>
                <ChartElementView
                  chartId={component.config?.chartId}
                  dashboardFilters={{}}
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

      case 'text':
        return (
          <div key={layoutItem.i} style={{ flex: layoutItem.w, minWidth: 0 }}>
            <UnifiedTextElement config={component.config} onUpdate={() => {}} isEditMode={false} />
          </div>
        );

      case 'heading': {
        const level = component.config?.level || 2;
        const headingStyles = cn(
          'text-gray-900 font-semibold',
          level === 1 && 'text-2xl',
          level === 2 && 'text-xl',
          level === 3 && 'text-lg'
        );
        const HeadingTag = `h${level}` as keyof React.JSX.IntrinsicElements;
        return (
          <div key={layoutItem.i} style={{ flex: layoutItem.w, minWidth: 0 }}>
            <div className="p-4 flex items-center">
              <HeadingTag
                className={headingStyles}
                style={{ color: component.config?.color || '#1f2937' }}
              >
                {component.config?.text || 'Heading'}
              </HeadingTag>
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
        const tabLayout: LayoutItem[] = (tab.layout_config as LayoutItem[]) || [];
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
