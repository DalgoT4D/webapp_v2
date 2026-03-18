/**
 * Utility for handling stacked bar chart data labels
 */

/**
 * Extract numeric value from various ECharts data formats
 */
function extractValue(value: any): number {
  if (Array.isArray(value)) value = value[1];
  if (value !== null && typeof value === 'object' && 'value' in value) value = value.value;
  if (typeof value !== 'number' || isNaN(value)) return 0;
  return value;
}

/**
 * Formatter for stacked bar data labels - handles various value types
 */
export function stackedBarLabelFormatter(params: any): string {
  if (!params) return '';
  const value = extractValue(params.value);
  if (value === 0) return '';
  return value.toLocaleString();
}

/**
 * Create a formatter that shows total of all series at the given data index
 */
export function createStackedTotalFormatter(seriesArray: any[]) {
  return function (params: any): string {
    const dataIndex = params.dataIndex;

    // Sum values across all series for this category
    let total = 0;
    for (const series of seriesArray) {
      const dataPoint = series.data?.[dataIndex];
      total += extractValue(dataPoint);
    }

    if (total === 0) return '';
    return total.toLocaleString();
  };
}

/**
 * Apply stacked bar data labels to chart config
 * Shows total at top of each stacked bar (not individual segment values)
 */
export function applyStackedBarLabels(
  config: Record<string, any>,
  customizations: Record<string, any>
): Record<string, any> {
  const seriesArray = Array.isArray(config.series)
    ? config.series
    : config.series
      ? [config.series]
      : [];
  const isStackedFromSeries = seriesArray.some((s: any) => s.stack);
  const isStacked = customizations.stacked || isStackedFromSeries;
  const showDataLabels =
    customizations.showDataLabels || seriesArray.some((s: any) => s.label?.show === true);

  if (!isStacked || !showDataLabels) return config;

  const lastIndex = seriesArray.length - 1;

  return {
    ...config,
    series: seriesArray.map((series: any, index: number) => {
      const isLastSeries = index === lastIndex;

      if (isLastSeries) {
        // Only the last (topmost) series shows the total label
        return {
          ...series,
          label: {
            ...series.label,
            show: true,
            position: 'top',
            formatter: createStackedTotalFormatter(seriesArray),
          },
        };
      } else {
        // Other series don't show labels
        return {
          ...series,
          label: {
            ...series.label,
            show: false,
          },
        };
      }
    }),
  };
}
