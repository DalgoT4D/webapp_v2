'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import { ChartTypes, type ChartBuilderFormData } from '@/types/charts';
import { isChartReady } from '@/components/charts/logic/validation';

/** Edit page's red "configuration incomplete" overlay over the chart preview. */
export function useConfigIncompleteOverlay({
  config,
  chartDataLoading,
  chartData,
}: {
  config: ChartBuilderFormData;
  chartDataLoading: boolean;
  chartData: unknown;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // A config change re-arms a dismissed overlay.
  useEffect(() => {
    setIsDismissed(false);
  }, [
    config.chart_type,
    config.aggregate_function,
    config.aggregate_column,
    config.dimension_column,
    config.metrics,
    config.schema_name,
    config.table_name,
  ]);

  // No dependency array on purpose: the original listed a function recreated every render,
  // so it ran after every render. chartData is read only to mirror that dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void chartData;
    const hasBasicConfig = config.schema_name && config.table_name && config.chart_type;
    const isConfigIncomplete =
      hasBasicConfig &&
      !isChartReady(config, 'edit') &&
      config.chart_type !== ChartTypes.MAP &&
      config.chart_type !== ChartTypes.TABLE;
    const shouldShow = isConfigIncomplete && !chartDataLoading && !isDismissed;
    if (shouldShow && !isVisible) setIsVisible(true);
    else if (!isConfigIncomplete && isVisible) setIsVisible(false);
  });

  const dismiss = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsVisible(false);
    setIsDismissed(true);
  };

  return { isVisible, dismiss };
}
