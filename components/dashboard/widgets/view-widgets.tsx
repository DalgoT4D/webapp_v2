'use client';

import type { ComponentType } from 'react';
import { cn } from '@/lib/utils';
import { ChartElementView } from '@/components/dashboard/widgets/chart/chart-element-view';
import { KPIChartElement } from '@/components/dashboard/widgets/kpi/kpi-chart-element';
import {
  UnifiedTextElement,
  type UnifiedTextConfig,
} from '@/components/dashboard/widgets/text/text-element-unified';
import { FilterElement } from '@/components/dashboard/filter-element';
import { toFilterConfig } from '@/components/dashboard/filters/filter-config';
import type { DashboardFilter } from '@/hooks/api/useDashboards';
import { DashboardComponentType, type DashboardComponentConfig } from '@/types/dashboard';
import type { AppliedFilters, DashboardFilterConfig } from '@/types/dashboard-filters';
import type { FrozenChartConfig } from '@/types/reports';
import type { CommentStates } from '@/types/comments';
import type { ChartTitleConfig } from '@/lib/chart-title-utils';
import {
  getChartViewUrl,
  getKpiViewUrl,
  type WidgetNavigationSource,
} from '@/lib/widget-navigation';

/** Everything a view widget reads from the dashboard view. Built once per render by the view. */
export interface ViewWidgetContext {
  /** dashboard.filters — the legacy `filter` widget looks its filter up here. */
  dashboardFilterRows: DashboardFilter[] | undefined;
  selectedFilters: AppliedFilters;
  dashboardFilterConfigs: DashboardFilterConfig[];
  isPublicMode: boolean;
  publicToken?: string;
  isReportMode: boolean;
  frozenChartConfigs?: Record<string, FrozenChartConfig>;
  snapshotId?: number;
  commentStates?: CommentStates;
  onCommentStateChange?: () => void;
  autoOpenCommentChartId?: string;
  canModerateComments: boolean;
  orgLogoUrl: string | null;
  showWidgetNavigation: boolean;
  widgetNavigationSource: WidgetNavigationSource;
  navigate: (url: string) => void;
  onFilterChange: (filterId: string, value: unknown) => void;
}

export interface ViewWidgetProps {
  componentId: string;
  component: DashboardComponentConfig;
  ctx: ViewWidgetContext;
}

interface LegacyHeadingConfig {
  level?: number;
  color?: string;
  text?: string;
}

interface LegacyFilterWidgetConfig {
  filterId?: number | string;
  id?: number | string;
  column_name?: string;
}

function ChartViewWidget({ componentId, component, ctx }: ViewWidgetProps) {
  const config = component.config as ChartTitleConfig & { chartId?: number | string };
  return (
    <div key={componentId} className="h-full">
      <ChartElementView
        chartId={Number(config?.chartId)}
        dashboardFilters={ctx.selectedFilters}
        dashboardFilterConfigs={ctx.dashboardFilterConfigs}
        viewMode={true}
        className="h-full"
        isPublicMode={ctx.isPublicMode}
        publicToken={ctx.publicToken}
        config={config}
        frozenChartConfig={
          ctx.isReportMode && ctx.frozenChartConfigs
            ? ctx.frozenChartConfigs[String(config?.chartId)]
            : undefined
        }
        snapshotId={ctx.isReportMode ? ctx.snapshotId : undefined}
        commentStates={ctx.isReportMode ? ctx.commentStates : undefined}
        onCommentStateChange={ctx.isReportMode ? ctx.onCommentStateChange : undefined}
        autoOpenCommentChartId={ctx.isReportMode ? ctx.autoOpenCommentChartId : undefined}
        canModerateComments={ctx.isReportMode ? ctx.canModerateComments : undefined}
        orgLogoUrl={ctx.orgLogoUrl}
        onView={
          ctx.showWidgetNavigation
            ? () =>
                ctx.navigate(getChartViewUrl(Number(config?.chartId), ctx.widgetNavigationSource))
            : undefined
        }
      />
    </div>
  );
}

function TextViewWidget({ componentId, component }: ViewWidgetProps) {
  // Use the same UnifiedTextElement component as edit mode for perfect consistency
  return (
    <div key={componentId} className="w-full h-full">
      <UnifiedTextElement
        config={component.config as unknown as UnifiedTextConfig}
        onUpdate={() => {}} // No-op in view mode
        isEditMode={false}
      />
    </div>
  );
}

/** Legacy heading widget (no way to add one today) — the view and the print layout render it alike. */
export function LegacyHeading({ config }: { config: LegacyHeadingConfig | undefined }) {
  const level = config?.level || 2;
  const headingStyles = cn(
    'text-gray-900 font-semibold',
    level === 1 && 'text-2xl',
    level === 2 && 'text-xl',
    level === 3 && 'text-lg'
  );

  const HeadingTag = `h${level}` as keyof React.JSX.IntrinsicElements;
  return (
    <HeadingTag className={headingStyles} style={{ color: config?.color || '#1f2937' }}>
      {config?.text || 'Heading'}
    </HeadingTag>
  );
}

function LegacyHeadingViewWidget({ componentId, component }: ViewWidgetProps) {
  // Legacy heading component - keep for backward compatibility
  return (
    <div key={componentId} className="h-full p-4 flex items-center">
      <LegacyHeading config={component.config as LegacyHeadingConfig} />
    </div>
  );
}

function KpiViewWidget({ componentId, component, ctx }: ViewWidgetProps) {
  const config = component.config as { kpiId?: number | string };
  return (
    <div key={componentId} className="h-full">
      <KPIChartElement
        kpiId={Number(config?.kpiId)}
        config={component.config}
        dashboardFilters={ctx.selectedFilters}
        snapshotId={ctx.isReportMode ? ctx.snapshotId : undefined}
        publicToken={ctx.publicToken}
        isPublicMode={ctx.isPublicMode}
        isReportMode={ctx.isReportMode}
        commentStates={ctx.isReportMode ? ctx.commentStates : undefined}
        onCommentStateChange={ctx.isReportMode ? ctx.onCommentStateChange : undefined}
        autoOpenCommentChartId={ctx.isReportMode ? ctx.autoOpenCommentChartId : undefined}
        canModerateComments={ctx.isReportMode ? ctx.canModerateComments : undefined}
        onView={
          ctx.showWidgetNavigation
            ? () => ctx.navigate(getKpiViewUrl(Number(config?.kpiId), ctx.widgetNavigationSource))
            : undefined
        }
      />
    </div>
  );
}

function LegacyFilterViewWidget({ componentId, component, ctx }: ViewWidgetProps) {
  const config = component.config as LegacyFilterWidgetConfig;
  // Get the actual filter data from dashboard.filters using the filterId reference
  const filterId = config?.filterId || config?.id;

  // First try to find in dashboard.filters array
  let filterData = ctx.dashboardFilterRows?.find((f) => {
    // Convert both to numbers for comparison since one might be string
    return Number(f.id) === Number(filterId);
  });

  // If not found in filters array (for backward compatibility), use config directly
  if (!filterData && config?.column_name) {
    filterData = component.config as unknown as DashboardFilter;
  }

  if (!filterData) {
    return (
      <div key={componentId} className="h-full p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-red-600">Filter not found: ID {filterId}</p>
        <p className="text-xs">Available: {ctx.dashboardFilterRows?.map((f) => f.id).join(', ')}</p>
      </div>
    );
  }

  // Convert to proper format using conversion function
  const normalizedFilter = toFilterConfig(filterData);

  return (
    <div key={componentId} className="h-full">
      <FilterElement
        filter={normalizedFilter}
        onRemove={() => {}} // No remove in view mode
        isEditMode={false}
        value={ctx.selectedFilters[normalizedFilter.id]}
        onChange={ctx.onFilterChange}
        isPublicMode={ctx.isPublicMode}
        publicToken={ctx.publicToken}
      />
    </div>
  );
}

/** What the view renders inside each grid card, per widget type. `heading` and `filter` are legacy (view-only). */
export const VIEW_WIDGETS: Record<string, ComponentType<ViewWidgetProps>> = {
  [DashboardComponentType.CHART]: ChartViewWidget,
  [DashboardComponentType.TEXT]: TextViewWidget,
  heading: LegacyHeadingViewWidget,
  [DashboardComponentType.KPI]: KpiViewWidget,
  [DashboardComponentType.FILTER]: LegacyFilterViewWidget,
};
