'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

interface Filter {
  column: string;
  operator: string;
  value: string;
}

interface UseMapFilterToastsProps {
  chartType: string | undefined;
  filters: Filter[] | undefined;
  geojsonData: unknown;
  geojsonLoading: boolean;
  geojsonError: Error | null;
  chartId: number;
  hasEditPermission: boolean;
}

/**
 * useMapFilterToasts - Shows toast notifications for filtered map regions
 *
 * Displays informational toasts when map filters are applied and the map
 * shows an empty state, helping users understand why regions may be missing.
 */
export function useMapFilterToasts({
  chartType,
  filters,
  geojsonData,
  geojsonLoading,
  geojsonError,
  chartId,
  hasEditPermission,
}: UseMapFilterToastsProps): void {
  useEffect(() => {
    const shouldShowToasts =
      chartType === 'map' &&
      filters &&
      filters.length > 0 &&
      !geojsonData &&
      !geojsonLoading &&
      !geojsonError;

    if (!shouldShowToasts) return;

    // Show toast for each applied filter
    filters.forEach((filter, index) => {
      const operatorText =
        filter.operator === 'not equals' || filter.operator === '!=' ? 'excluded' : 'filtered';

      setTimeout(() => {
        toast.info(`${filter.value} ${operatorText} from map`, {
          description: `Filter: ${filter.column} ${filter.operator} ${filter.value}`,
          duration: 5000,
          position: 'top-right',
        });
      }, index * 500);
    });

    // Show helpful drill-down configuration toast
    setTimeout(
      () => {
        toast('Configure drill-down layers to see filtered regions', {
          description: hasEditPermission
            ? "Click 'Edit Chart' to set up geographic layers"
            : 'Chart needs geographic layers to show filtered regions',
          duration: 7000,
          position: 'top-right',
          ...(hasEditPermission && {
            action: {
              label: 'Edit Chart',
              onClick: () => (window.location.href = `/charts/${chartId}/edit`),
            },
          }),
        });
      },
      filters.length * 500 + 1000
    );
  }, [chartType, filters, geojsonData, geojsonLoading, geojsonError, chartId, hasEditPermission]);
}
