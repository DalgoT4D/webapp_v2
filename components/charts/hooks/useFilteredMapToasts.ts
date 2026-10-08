'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import type { Chart } from '@/types/charts';

interface UseFilteredMapToastsOptions {
  chart: Chart | undefined;
  geojsonData: { geojson_data?: unknown } | undefined;
  geojsonLoading: boolean;
  geojsonError: unknown;
  chartId: number;
  canEditCharts: boolean;
}

/** Detail page: when a filtered map has no boundary to show, explain each filter in a toast. */
export function useFilteredMapToasts({
  chart,
  geojsonData,
  geojsonLoading,
  geojsonError,
  chartId,
  canEditCharts,
}: UseFilteredMapToastsOptions) {
  // Show toast notifications for filtered states when map shows empty state
  useEffect(() => {
    if (
      chart?.chart_type === 'map' &&
      chart.extra_config?.filters &&
      chart.extra_config.filters.length > 0 &&
      !geojsonData?.geojson_data &&
      !geojsonLoading &&
      !geojsonError
    ) {
      // Show toast for each applied filter
      // any: ChartFilter.operator has no "not equals"/"!=" members (TS2367) — kept any, see Task 13 row 6
      chart.extra_config.filters.forEach((filter: any, index: number) => {
        // PINNED-BUGS: 'Detail filtered-map toast says "filtered" for excluded regions' (builder writes not_equals)
        const operatorText =
          filter.operator === 'not equals' || filter.operator === '!=' ? 'excluded' : 'filtered';

        setTimeout(() => {
          toast.info(`🗺️ ${filter.value} ${operatorText} from map`, {
            description: `Filter: ${filter.column} ${filter.operator} ${filter.value}`,
            duration: 5000,
            position: 'top-right',
          });
        }, index * 500); // Stagger toasts by 500ms
      });

      // Show additional helpful toast
      setTimeout(
        () => {
          toast('💡 Configure drill-down layers to see filtered regions', {
            description: canEditCharts
              ? "Click 'Edit Chart' to set up geographic layers"
              : 'Chart needs geographic layers to show filtered regions',
            duration: 7000,
            position: 'top-right',
            ...(canEditCharts && {
              action: {
                label: 'Edit Chart',
                onClick: () => (window.location.href = `/charts/${chartId}/edit`),
              },
            }),
          });
        },
        chart.extra_config.filters.length * 500 + 1000
      ); // Show after all filter toasts
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same deps as the effect it replaces
  }, [chart, geojsonData, geojsonLoading, geojsonError, chartId]);
}
