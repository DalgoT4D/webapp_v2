import { useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';
import {
  ANALYTICS_EVENTS,
  type ChartDrillSource,
  type ChartExportSource,
} from '@/constants/analytics';

interface UseDrillDownAnalyticsArgs {
  chartId?: number;
  chartType?: string;
  // Which viewing surface the drill happened on (chart page vs dashboard embed).
  source: ChartDrillSource | ChartExportSource;
  // Map drill depth — drillDownPath.length (0 = top level).
  mapLevel: number;
  // Table drill depth — tableDrillDownState?.currentLevel, null at top level.
  tableLevel: number | null;
  // Pass false on anonymous surfaces (public share links, report snapshots) so
  // logged-in engagement events don't leak into them. Depth is still tracked while
  // disabled, so re-enabling mid-session can't fire a burst of backdated events.
  enabled?: boolean;
}

// Fires CHART_DRILLED_DOWN when the viewer goes one level DEEPER into a map or
// table chart.
//
// Watching the depth (rather than calling trackEvent inside each click handler)
// is deliberate: map drill-down has three separate branches — dynamic hierarchy,
// simplified hierarchy, and the legacy layers system — each with its own
// `setDrillDownPath` call, and several of them bail out early with a "no further
// levels" toast. Watching the resulting depth catches exactly the successful
// drills, all branches at once, and any branch added later.
//
// Only increases fire: drill-up and drill-home are backtracking, not new intent.
export function useDrillDownAnalytics({
  chartId,
  chartType,
  source,
  mapLevel,
  tableLevel,
  enabled = true,
}: UseDrillDownAnalyticsArgs): void {
  const prevMapLevel = useRef(mapLevel);
  // null (top level) normalises to 0 so the first drill reads as an increase.
  const normalisedTableLevel = tableLevel ?? 0;
  const prevTableLevel = useRef(normalisedTableLevel);

  useEffect(() => {
    if (enabled && mapLevel > prevMapLevel.current) {
      trackEvent(ANALYTICS_EVENTS.CHART_DRILLED_DOWN, {
        chart_id: chartId,
        chart_type: chartType,
        drill_type: 'map',
        level: mapLevel,
        source,
      });
    }
    prevMapLevel.current = mapLevel;
    // chartId/chartType/source are stable for the life of the chart; depth is the
    // only real trigger, and including the rest would not change when this runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLevel]);

  useEffect(() => {
    if (enabled && normalisedTableLevel > prevTableLevel.current) {
      trackEvent(ANALYTICS_EVENTS.CHART_DRILLED_DOWN, {
        chart_id: chartId,
        chart_type: chartType,
        drill_type: 'table',
        level: normalisedTableLevel,
        source,
      });
    }
    prevTableLevel.current = normalisedTableLevel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalisedTableLevel]);
}
