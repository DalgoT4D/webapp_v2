import { useCallback, useState } from 'react';
import type { KeyedMutator } from 'swr';
import type { Chart, ChartListResponse } from '@/hooks/api/useCharts';
import { useCreateChart } from '@/hooks/api/useChart';
import { toastSuccess, toastError } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS, CHART_CREATE_SOURCES } from '@/constants/analytics';
import { getMetricAnalyticsProps, isDrillDownEnabled } from '@/components/charts/utils';
import { buildDuplicateChartPayload } from './chart-list-logic';

/** Row menu → Duplicate on the chart list. */
export function useDuplicateChart(charts: Chart[], mutate: KeyedMutator<ChartListResponse>) {
  const { trigger: createChart } = useCreateChart();
  const [duplicatingChartId, setDuplicatingChartId] = useState<number | null>(null);

  const handleDuplicateChart = useCallback(
    async (chartId: number, chartTitle: string) => {
      if (!charts) {
        toastError.load(null, 'charts data');
        return;
      }

      setDuplicatingChartId(chartId);

      try {
        const originalChart = charts.find((chart: Chart) => chart.id === chartId);
        if (!originalChart) {
          toastError.load(null, 'chart');
          return;
        }

        const existingTitles = charts.map((chart: Chart) => chart.title);
        const duplicateChartData = buildDuplicateChartPayload(originalChart, existingTitles);
        const duplicateTitle = duplicateChartData.title;

        const result = await createChart(duplicateChartData);
        // A duplicate is a created chart — same event, `source: 'duplicate'`.
        // Kept out of a separate CHART_DUPLICATED event so the "charts created"
        // total isn't short by every duplicate.
        trackEvent(ANALYTICS_EVENTS.CHART_CREATED, {
          chart_type: originalChart.chart_type,
          chart_id: result.id,
          source: CHART_CREATE_SOURCES.DUPLICATE,
          // Carried over from the original so the metric breakdown on
          // CHART_CREATED isn't skewed by duplicates reporting zero metrics.
          ...getMetricAnalyticsProps(originalChart.extra_config?.metrics),
          // Saved charts keep drill config inside extra_config; the builder keeps it at
          // the top level, so flatten it into the shape isDrillDownEnabled expects.
          drill_down_enabled: isDrillDownEnabled({
            chart_type: originalChart.chart_type,
            ...originalChart.extra_config,
          }),
        });
        // No METRIC_USED here on purpose: duplicating copies a metric reference
        // mechanically, it isn't a user choosing to consume that metric.
        await mutate();

        toastSuccess.duplicated(originalChart.title, duplicateTitle);
      } catch (error) {
        toastError.duplicate(error, chartTitle);
      } finally {
        setDuplicatingChartId(null);
      }
    },
    [charts, createChart, mutate]
  );

  return { duplicatingChartId, handleDuplicateChart };
}
