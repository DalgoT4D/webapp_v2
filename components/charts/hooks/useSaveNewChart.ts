'use client';

import { useRouter } from 'next/navigation';
import { useCreateChart } from '@/hooks/api/useChart';
import { toastSuccess, toastError } from '@/lib/toast';
import type { ChartBuilderFormData, ChartCreate } from '@/types/charts';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS, CHART_CREATE_SOURCES, METRIC_USE_SOURCES } from '@/constants/analytics';
import {
  getMetricAnalyticsProps,
  getUsedSavedMetricIds,
  isDrillDownEnabled,
} from '@/components/charts/utils';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import {
  isStageBefore,
  markChartCreated,
} from '@/components/onboarding/insight-walkthrough-constants';
import { canSaveChart } from '@/components/charts/logic/validation';
import { buildCreateChartPayload } from '@/components/charts/logic/payload';

/** Create page Save: POST the chart, report it, advance the walkthrough, open the new chart. */
export function useSaveNewChart({
  config,
  isFromDashboard,
  markSaved,
}: {
  config: ChartBuilderFormData;
  isFromDashboard: boolean;
  markSaved: () => void;
}) {
  const router = useRouter();
  const { trigger: createChart, isMutating } = useCreateChart();

  const handleSave = async () => {
    if (!canSaveChart(config)) {
      return;
    }

    const chartData: ChartCreate = buildCreateChartPayload(config);

    try {
      const result = await createChart(chartData);
      trackEvent(ANALYTICS_EVENTS.CHART_CREATED, {
        chart_type: chartData.chart_type,
        chart_id: result.id,
        // Entered from the dashboard builder vs the charts list — same page, very
        // different intent, so they get distinct sources rather than one 'new'.
        source: isFromDashboard
          ? CHART_CREATE_SOURCES.NEW_FROM_DASHBOARD
          : CHART_CREATE_SOURCES.NEW,
        ...getMetricAnalyticsProps(config.metrics),
        drill_down_enabled: isDrillDownEnabled(config),
      });
      // Charts are the main consumer of the metrics library — one METRIC_USED per
      // distinct saved metric, same as the KPI form does on its create path.
      getUsedSavedMetricIds(config.metrics).forEach((metricId) => {
        // chart_id too — answers "which chart consumed this metric", not just how often.
        trackEvent(ANALYTICS_EVENTS.METRIC_USED, {
          metric_id: metricId,
          chart_id: result.id,
          source: METRIC_USE_SOURCES.CHART,
        });
      });
      // Reset unsaved changes state after successful save
      markSaved();
      toastSuccess.created('Chart');

      // Resume-nudge milestone — set regardless of an active coachmark session.
      markChartCreated();

      const walkthrough = useInsightWalkthroughStore.getState();
      // Saving the chart is the checkpoint, whatever hints were clicked past on the way here
      // (the two tab stages are read-this hints a user can skip straight over).
      if (
        walkthrough.active &&
        walkthrough.stage &&
        !isFromDashboard &&
        isStageBefore(walkthrough.path, walkthrough.stage, 'chart_dashboard_nudge')
      ) {
        // Hand the celebration to the chart's own page rather than showing it here: the user
        // should see the chart they just built behind the dialog, not the builder they're
        // leaving. The normal redirect below carries them there.
        walkthrough.setPendingCelebration('chart');
        // The next stage's coachmark points at the Dashboards nav item, which would otherwise
        // appear on the chart page underneath the dialog. Released when it closes, so the
        // nudge is what the user sees next.
        walkthrough.setSuppressCoachmark(true);
        walkthrough.advanceIfBefore('chart_dashboard_nudge');
      }

      if (isFromDashboard) {
        // Use replace so back button from chart detail goes to dashboard
        router.replace(`/charts/${result.id}?from=dashboard`);
      } else {
        router.push(`/charts/${result.id}`);
      }
    } catch (error) {
      // Show more detailed error message
      toastError.api(error, 'save chart');
    }
  };

  return { handleSave, isMutating };
}
