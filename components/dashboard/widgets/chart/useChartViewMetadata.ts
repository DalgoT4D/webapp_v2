'use client';

import useSWR from 'swr';
import { apiGet } from '@/lib/api';
import { useChart, useRegions } from '@/hooks/api/useChart';
import { ChartTypes } from '@/types/charts';
import type { FrozenChartConfig } from '@/types/reports';
import type { WidgetChartLike } from './logic/chart-widget-map';

interface ChartViewMetadataOptions {
  chartId: number;
  isPublicMode: boolean;
  publicToken?: string;
  frozenChartConfig?: FrozenChartConfig;
}

/** The chart a view widget renders: frozen (report), public metadata, or the private chart. */
export function useChartViewMetadata({
  chartId,
  isPublicMode,
  publicToken,
  frozenChartConfig,
}: ChartViewMetadataOptions) {
  // Check if this chart is a map early so we can skip regions fetch for non-map charts.
  // In report mode frozenChartConfig is available immediately; otherwise we wait for useChart.
  const mightBeMap = frozenChartConfig ? frozenChartConfig.chart_type === ChartTypes.MAP : true; // default to true for dashboard mode until chart metadata loads

  // Fetch regions data only for map charts
  const { data: privateRegions } = useRegions(!isPublicMode && mightBeMap ? 'IND' : null, 'state');

  // Use public regions API for public mode (only for map charts)
  const publicRegionsUrl =
    isPublicMode && publicToken && mightBeMap
      ? `/api/v1/public/regions/?country_code=IND&region_type=state`
      : null;

  const { data: publicRegions } = useSWR(publicRegionsUrl, async (url: string) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`);
    if (!response.ok) {
      throw new Error('Failed to fetch public regions');
    }
    return response.json();
  });

  const regions = isPublicMode ? publicRegions : privateRegions;

  // Fetch chart metadata to determine chart type (skip in public mode and report/frozen mode)
  const {
    data: chart,
    isLoading: chartLoading,
    error: chartError,
  } = useChart(isPublicMode || frozenChartConfig ? null : chartId);

  // Fetch chart metadata - public vs private mode
  const publicChartMetadataUrl =
    isPublicMode && publicToken && !frozenChartConfig
      ? `/api/v1/public/dashboards/${publicToken}/charts/${chartId}/`
      : null;

  const { data: publicChartMetadata, isLoading: publicChartLoading } = useSWR(
    publicChartMetadataUrl,
    isPublicMode
      ? async (url: string) => {
          const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.json();
        }
      : null,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 0,
    }
  );

  // Private mode metadata (skip in report/frozen mode)
  const { data: chartMetadata, error: metadataError } = useSWR(
    !isPublicMode && !frozenChartConfig ? `/api/charts/${chartId}` : null,
    apiGet,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 0,
      // Don't retry on 404 errors
      onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
        // Never retry on 404
        if (error?.message?.includes('404') || error?.message?.includes('not found')) {
          return;
        }
        // Only retry up to 3 times for other errors
        if (retryCount >= 3) return;

        // Retry after 1 second
        setTimeout(() => revalidate({ retryCount }), 1000);
      },
    }
  );

  // Use frozen config in report mode, public metadata in public mode, or chart in private mode
  const effectiveChart:
    | (WidgetChartLike & { title?: string; computation_type?: string })
    | undefined = frozenChartConfig || (isPublicMode ? publicChartMetadata : chart);

  return {
    regions,
    chart,
    chartLoading,
    chartError,
    publicChartMetadata,
    publicChartLoading,
    chartMetadata,
    metadataError,
    effectiveChart,
  };
}
