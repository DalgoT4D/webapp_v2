'use client';

import { useUpdateChart, useCreateChart } from '@/hooks/api/useChart';
import { toastSuccess, toastError } from '@/lib/toast';
import type { ChartBuilderFormData, ChartCreate, ChartUpdate } from '@/types/charts';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS, CHART_CREATE_SOURCES, METRIC_USE_SOURCES } from '@/constants/analytics';
import {
  getMetricAnalyticsProps,
  getNewlyUsedSavedMetricIds,
  getUsedSavedMetricIds,
  isDrillDownEnabled,
} from '@/components/charts/utils';
import { canSaveChart } from '@/components/charts/logic/validation';
import { buildEditChartPayload } from '@/components/charts/logic/payload';
import type { EditChartNavigation } from '@/components/charts/hooks/useEditChartNavigation';

/** Edit page's two save paths: update this chart (PUT) or save a copy as a new chart (POST). */
export function useSaveExistingChart({
  chartId,
  config,
  savedConfig,
  markSaved,
  nav,
  isExitingAfterSave,
  setIsExitingAfterSave,
}: {
  chartId: number;
  config: ChartBuilderFormData;
  savedConfig: ChartBuilderFormData | null;
  markSaved: () => void;
  nav: Pick<EditChartNavigation, 'navigateToOrigin' | 'navigateToChartDetail'>;
  isExitingAfterSave: boolean;
  setIsExitingAfterSave: (isExiting: boolean) => void;
}) {
  const { trigger: updateChart, isMutating } = useUpdateChart();
  const { trigger: createChart, isMutating: isCreating } = useCreateChart();
  const { navigateToOrigin, navigateToChartDetail } = nav;

  // Helper to build chart data from form
  const buildChartData = (): ChartCreate => buildEditChartPayload(config);

  // Handle updating existing chart
  const handleUpdateExisting = async () => {
    if (!canSaveChart(config)) {
      return;
    }

    try {
      const chartData = buildChartData();
      const updateData: ChartUpdate = {
        title: chartData.title,
        chart_type: chartData.chart_type,
        computation_type: chartData.computation_type,
        schema_name: chartData.schema_name,
        table_name: chartData.table_name,
        extra_config: chartData.extra_config,
      };

      await updateChart({
        id: chartId,
        data: updateData,
      });
      trackEvent(ANALYTICS_EVENTS.CHART_UPDATED, {
        chart_type: chartData.chart_type,
        chart_id: chartId,
        ...getMetricAnalyticsProps(config.metrics),
        drill_down_enabled: isDrillDownEnabled(config),
      });
      // Only metrics this edit newly attached — otherwise every re-save of an
      // unchanged chart would re-report the same metrics as freshly used.
      getNewlyUsedSavedMetricIds(config.metrics, savedConfig?.metrics).forEach((metricId) => {
        trackEvent(ANALYTICS_EVENTS.METRIC_USED, {
          metric_id: metricId,
          chart_id: chartId,
          source: METRIC_USE_SOURCES.CHART,
        });
      });

      // Update original data to reflect saved state
      markSaved();

      toastSuccess.updated('Chart');

      if (isExitingAfterSave) {
        setIsExitingAfterSave(false);
        navigateToOrigin();
      } else {
        navigateToChartDetail(chartId);
      }
    } catch (err) {
      toastError.update(err, 'chart');
    }
  };

  // Handle saving as new chart
  const handleSaveAsNew = async (newTitle: string) => {
    if (!canSaveChart(config)) {
      return;
    }

    try {
      const chartData = buildChartData();
      const newChartData: ChartCreate = {
        ...chartData,
        title: newTitle,
      };

      const result = await createChart(newChartData);
      // Save-as-new creates a chart, so it fires CHART_CREATED like every other
      // create path — `source` is what distinguishes it.
      trackEvent(ANALYTICS_EVENTS.CHART_CREATED, {
        chart_type: newChartData.chart_type,
        chart_id: result.id,
        source: CHART_CREATE_SOURCES.SAVE_AS_NEW,
        ...getMetricAnalyticsProps(config.metrics),
        drill_down_enabled: isDrillDownEnabled(config),
      });
      getUsedSavedMetricIds(config.metrics).forEach((metricId) => {
        trackEvent(ANALYTICS_EVENTS.METRIC_USED, {
          metric_id: metricId,
          chart_id: result.id,
          source: METRIC_USE_SOURCES.CHART,
        });
      });

      toastSuccess.created(`Chart "${newTitle}"`);

      if (isExitingAfterSave) {
        setIsExitingAfterSave(false);
        navigateToOrigin();
      } else {
        navigateToChartDetail(result.id);
      }
    } catch (err) {
      toastError.create(err, 'chart');
    }
  };

  return { handleUpdateExisting, handleSaveAsNew, isMutating, isCreating };
}
