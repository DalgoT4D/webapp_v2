import { DEFAULT_CHART_PALETTE_COLORS } from '@/constants/chart-palettes';

export interface NamedChartColorEntry {
  key: string;
  label: string;
}

export type BarColorMode = 'single-category' | 'extra-dimension' | 'multi-metric';
export type BarColorTarget = 'primary' | 'extra';

interface GetChartNamedColorEntriesArgs {
  chartType?: string;
  chartConfig?: Record<string, any>;
  customizations?: Record<string, any>;
}

interface ApplyChartColorCustomizationsArgs {
  chartType?: string;
  chartConfig?: Record<string, any>;
  customizations?: Record<string, any>;
  fallbackPaletteColors?: string[];
  barColorMode?: BarColorMode;
}

interface ResolveBarColorModeArgs {
  chartType?: string;
  hasExtraDimension?: boolean;
  metrics?: Array<Record<string, any>>;
}

function normalizeSeries(seriesConfig: any): any[] {
  if (Array.isArray(seriesConfig)) return seriesConfig.filter(Boolean);
  return seriesConfig ? [seriesConfig] : [];
}

function denormalizeSeries(originalSeriesConfig: any, series: any[]) {
  return Array.isArray(originalSeriesConfig) ? series : series[0];
}

function toLabel(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function getUniqueLabels(values: any[]): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();

  values.forEach((value) => {
    const label = toLabel(value);
    if (!label || seen.has(label)) return;

    seen.add(label);
    labels.push(label);
  });

  return labels;
}

function getCategoryAxisValues(chartConfig?: Record<string, any>): string[] {
  const axes = [chartConfig?.xAxis, chartConfig?.yAxis].flatMap((axisConfig) => {
    if (Array.isArray(axisConfig)) return axisConfig;
    return axisConfig ? [axisConfig] : [];
  });

  const categoryAxis = axes.find((axis) => axis?.type === 'category' && Array.isArray(axis?.data));

  if (!categoryAxis) return [];
  return categoryAxis.data.map(toLabel).filter(Boolean);
}

function getBarLegendLabels(
  chartConfig: Record<string, any> | undefined,
  barColorTarget: BarColorTarget
): string[] {
  const series = normalizeSeries(chartConfig?.series);
  if (series.length === 0) return [];

  if (barColorTarget === 'extra') {
    return getUniqueLabels(series.map((seriesConfig) => seriesConfig?.name));
  }

  const categoryAxisValues = getCategoryAxisValues(chartConfig);
  if (categoryAxisValues.length > 0) {
    return getUniqueLabels(categoryAxisValues);
  }

  if (!Array.isArray(series[0]?.data)) return [];
  return getUniqueLabels(series[0].data.map((item: any) => item?.name));
}

export function getDimensionColorMap(
  customizations?: Record<string, any>,
  customizationKey = 'dimension_colors'
): Record<string, string> {
  return getNamedColorMap(customizations, customizationKey);
}

function getNamedColorMap(
  customizations?: Record<string, any>,
  customizationKey = 'dimension_colors'
): Record<string, string> {
  const rawDimensionColors = customizations?.[customizationKey];
  if (
    !rawDimensionColors ||
    typeof rawDimensionColors !== 'object' ||
    Array.isArray(rawDimensionColors)
  ) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(rawDimensionColors).filter(
      ([key, value]) => Boolean(toLabel(key)) && typeof value === 'string' && Boolean(value.trim())
    )
  );
}

function getExtraDimensionColorMap(customizations?: Record<string, any>): Record<string, string> {
  const extraDimensionColors = getNamedColorMap(customizations, 'extra_dimension_colors');
  if (Object.keys(extraDimensionColors).length > 0) {
    return extraDimensionColors;
  }

  if (typeof customizations?.bar_color_target === 'string') {
    return {};
  }

  // Backward compatibility for extra-dimension bars saved before a separate
  // override map existed for the additional dimension.
  return getDimensionColorMap(customizations);
}

export function getBarColorTarget(
  customizations?: Record<string, any>,
  hasExtraDimension = false
): BarColorTarget {
  if (!hasExtraDimension) return 'primary';
  return customizations?.bar_color_target === 'primary' ? 'primary' : 'extra';
}

export function resolveBarColorMode({
  chartType,
  hasExtraDimension,
  metrics,
}: ResolveBarColorModeArgs): BarColorMode | undefined {
  if (chartType !== 'bar') return undefined;
  if (typeof hasExtraDimension !== 'boolean' && !Array.isArray(metrics)) return undefined;

  const hasMultipleMetrics = Array.isArray(metrics) && metrics.length > 1;
  if (hasExtraDimension) return 'extra-dimension';
  if (hasMultipleMetrics) return 'multi-metric';
  return 'single-category';
}

function applyColorToSeries(seriesConfig: any, color?: string) {
  if (!color) return seriesConfig;

  if (seriesConfig?.type === 'line') {
    return {
      ...seriesConfig,
      lineStyle: {
        ...seriesConfig.lineStyle,
        color,
      },
      itemStyle: {
        ...seriesConfig.itemStyle,
        color,
      },
    };
  }

  return {
    ...seriesConfig,
    itemStyle: {
      ...seriesConfig.itemStyle,
      color,
    },
  };
}

function applyColorToNamedDataPoints(
  data: any,
  getName: (item: any, index: number) => string,
  dimensionColors: Record<string, string>
) {
  if (!Array.isArray(data) || Object.keys(dimensionColors).length === 0) return data;

  return data.map((item, index) => {
    const name = getName(item, index);
    const color = name ? dimensionColors[name] : undefined;

    if (!color) return item;

    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return {
        ...item,
        itemStyle: {
          ...item.itemStyle,
          color,
        },
      };
    }

    return {
      value: item,
      itemStyle: {
        color,
      },
    };
  });
}

export function getChartNamedColorEntries({
  chartType,
  chartConfig,
  customizations,
}: GetChartNamedColorEntriesArgs): NamedChartColorEntry[] {
  const entries: NamedChartColorEntry[] = [];
  const seen = new Set<string>();
  const series = normalizeSeries(chartConfig?.series);
  const isPieChart =
    chartType === 'pie' || series.some((seriesConfig) => seriesConfig?.type === 'pie');
  const barColorTarget =
    chartType === 'bar' && series.length > 1 ? getBarColorTarget(customizations, true) : 'primary';

  const addEntry = (value: any) => {
    const label = toLabel(value);
    if (!label || seen.has(label)) return;
    seen.add(label);
    entries.push({ key: label, label });
  };

  if (isPieChart) {
    series.forEach((seriesConfig) => {
      if (!Array.isArray(seriesConfig?.data)) return;
      seriesConfig.data.forEach((item: any) => addEntry(item?.name));
    });
  } else if (chartType === 'bar') {
    getBarLegendLabels(chartConfig, barColorTarget).forEach(addEntry);
  } else if (chartType === 'line') {
    if (series.length > 1) {
      series.forEach((seriesConfig) => addEntry(seriesConfig?.name));
    }
  } else if (series.length > 1) {
    series.forEach((seriesConfig) => addEntry(seriesConfig?.name));
  }

  const activeDimensionColors =
    chartType === 'bar' && series.length > 1 && barColorTarget === 'extra'
      ? getExtraDimensionColorMap(customizations)
      : getDimensionColorMap(customizations);

  Object.keys(activeDimensionColors).forEach(addEntry);

  return entries;
}

export function applyChartColorCustomizations({
  chartType,
  chartConfig,
  customizations,
  fallbackPaletteColors = DEFAULT_CHART_PALETTE_COLORS,
  barColorMode,
}: ApplyChartColorCustomizationsArgs) {
  if (!chartConfig) return chartConfig;

  const series = normalizeSeries(chartConfig.series);
  const isPieChart =
    chartType === 'pie' || series.some((seriesConfig) => seriesConfig?.type === 'pie');
  const isMultiSeries = series.length > 1;
  const primaryDimensionColors = getDimensionColorMap(customizations);
  const categoryAxisValues = chartType === 'bar' ? getCategoryAxisValues(chartConfig) : [];
  const paletteOverrideColors: string[] = Array.isArray(customizations?.color_palette_colors)
    ? customizations.color_palette_colors.filter(
        (color): color is string => typeof color === 'string' && Boolean(color.trim())
      )
    : [];
  const effectiveBarColorMode =
    chartType === 'bar'
      ? (barColorMode ?? (series.length <= 1 ? 'single-category' : undefined))
      : undefined;
  const barColorTarget =
    chartType === 'bar' && effectiveBarColorMode === 'extra-dimension'
      ? getBarColorTarget(customizations, true)
      : 'primary';
  const extraDimensionColors =
    chartType === 'bar' && effectiveBarColorMode === 'extra-dimension'
      ? getExtraDimensionColorMap(customizations)
      : {};
  const seriesColors: string[] = Array.isArray(customizations?.series_colors)
    ? customizations.series_colors
    : [];

  function resolvedFirstColor() {
    const baseBarColor =
      typeof customizations?.chart_color === 'string' && customizations.chart_color.trim()
        ? customizations.chart_color
        : (paletteOverrideColors[0] ?? fallbackPaletteColors[0]);

    return baseBarColor || fallbackPaletteColors[0];
  }

  const resolvedColors: string[] = (() => {
    if (chartType === 'bar' && effectiveBarColorMode === 'single-category') {
      const baseBarColor = resolvedFirstColor();

      return baseBarColor ? [baseBarColor] : fallbackPaletteColors;
    }

    if (chartType === 'bar' && effectiveBarColorMode === 'extra-dimension') {
      if (barColorTarget === 'primary') {
        const baseBarColor = resolvedFirstColor();

        return baseBarColor ? [baseBarColor] : fallbackPaletteColors;
      }

      if (paletteOverrideColors.length > 0) {
        return paletteOverrideColors;
      }

      return fallbackPaletteColors;
    }

    const isSingleColorEligible = !isMultiSeries && chartType !== 'pie';

    if (customizations?.chart_color && isSingleColorEligible) {
      return [customizations.chart_color];
    }

    if (paletteOverrideColors.length > 0) {
      return paletteOverrideColors;
    }

    return fallbackPaletteColors;
  })();
  const defaultPrimaryBarSeriesColor =
    chartType === 'bar' &&
    (effectiveBarColorMode === 'single-category' ||
      (effectiveBarColorMode === 'extra-dimension' && barColorTarget === 'primary'))
      ? resolvedFirstColor()
      : undefined;

  if (series.length === 0) {
    return {
      ...chartConfig,
      color: resolvedColors,
    };
  }

  const updatedSeries = series.map((seriesConfig, index) => {
    const shouldUseIndexedSeriesColors =
      chartType === 'bar' &&
      (effectiveBarColorMode === 'multi-metric' || (!effectiveBarColorMode && isMultiSeries));
    const explicitSeriesColor =
      shouldUseIndexedSeriesColors && typeof seriesColors[index] === 'string' && seriesColors[index]
        ? seriesColors[index]
        : undefined;
    const seriesName = toLabel(seriesConfig?.name);
    const namedSeriesColor =
      chartType === 'bar'
        ? barColorTarget === 'extra' && seriesName
          ? extraDimensionColors[seriesName]
          : undefined
        : seriesName
          ? primaryDimensionColors[seriesName]
          : undefined;
    const automaticExtraDimensionColor =
      chartType === 'bar' &&
      effectiveBarColorMode === 'extra-dimension' &&
      barColorTarget === 'extra'
        ? resolvedColors[index % resolvedColors.length]
        : undefined;

    let nextSeries = applyColorToSeries(
      seriesConfig,
      explicitSeriesColor ??
        namedSeriesColor ??
        defaultPrimaryBarSeriesColor ??
        automaticExtraDimensionColor
    );

    if (isPieChart) {
      nextSeries = {
        ...nextSeries,
        data: applyColorToNamedDataPoints(
          nextSeries.data,
          (item) => toLabel(item?.name),
          primaryDimensionColors
        ),
      };
    } else if (
      chartType === 'bar' &&
      (effectiveBarColorMode === 'single-category' ||
        (effectiveBarColorMode === 'extra-dimension' && barColorTarget === 'primary'))
    ) {
      nextSeries = {
        ...nextSeries,
        data: applyColorToNamedDataPoints(
          nextSeries.data,
          (item, itemIndex) => {
            const axisValue = categoryAxisValues[itemIndex];
            if (axisValue) return axisValue;
            return toLabel(item?.name);
          },
          primaryDimensionColors
        ),
      };
    }

    return nextSeries;
  });

  const shouldSyncBarLegend =
    chartType === 'bar' &&
    effectiveBarColorMode === 'extra-dimension' &&
    Boolean(chartConfig.legend);
  const barLegendLabels = shouldSyncBarLegend
    ? getBarLegendLabels(chartConfig, barColorTarget)
    : [];
  const barLegendColors =
    shouldSyncBarLegend && barLegendLabels.length > 0
      ? barColorTarget === 'primary'
        ? barLegendLabels.map(
            (label) =>
              primaryDimensionColors[label] ??
              defaultPrimaryBarSeriesColor ??
              resolvedColors[0] ??
              fallbackPaletteColors[0]
          )
        : (() => {
            const legendColorBySeriesName = new Map<string, string>();

            series.forEach((seriesConfig, index) => {
              const seriesName = toLabel(seriesConfig?.name);
              if (!seriesName) return;

              const seriesColor = seriesColors[index];
              const explicitSeriesColor =
                typeof seriesColor === 'string' && Boolean(seriesColor.trim())
                  ? seriesColor
                  : undefined;

              const resolvedSeriesColor =
                explicitSeriesColor ??
                extraDimensionColors[seriesName] ??
                resolvedColors[index % resolvedColors.length];

              if (!resolvedSeriesColor) return;
              legendColorBySeriesName.set(seriesName, resolvedSeriesColor);
            });

            return barLegendLabels.map(
              (label, index) =>
                legendColorBySeriesName.get(label) ??
                resolvedColors[index % resolvedColors.length] ??
                fallbackPaletteColors[index % fallbackPaletteColors.length]
            );
          })()
      : [];
  const legendConfig =
    shouldSyncBarLegend && barLegendLabels.length > 0
      ? {
          ...chartConfig.legend,
          data: barLegendLabels,
          ...(barColorTarget === 'primary'
            ? {
                selectedMode: false,
                selected: undefined,
              }
            : {}),
        }
      : undefined;

  return {
    ...chartConfig,
    color:
      shouldSyncBarLegend && barColorTarget === 'primary' && barLegendColors.length > 0
        ? barLegendColors
        : resolvedColors,
    series: denormalizeSeries(chartConfig.series, updatedSeries),
    ...(legendConfig ? { legend: legendConfig } : {}),
  };
}
