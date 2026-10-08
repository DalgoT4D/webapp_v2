import {
  applyLegendPosition,
  extractLegendPosition,
  isLegendPaginated,
  type LegendPosition,
} from '@/components/charts/chart-types/echarts/legend';
import {
  applyResponsiveLegend,
  getResponsiveGridMargins,
  shouldShowLegend,
} from '@/lib/responsive-legend';
import {
  createTooltipFormatter,
  applyNumberChartFormatting,
  applyPieChartFormatting,
  applyLineBarChartFormatting,
} from '@/components/charts/chart-types/echarts/formatting';
import {
  applyPieDateFormatting,
  applyLineBarDateFormatting,
} from '@/components/charts/chart-types/echarts/date-formatting';
import { applyStackedBarLabels } from '@/components/charts/chart-types/echarts/stacked-bar';
import { ChartTypes } from '@/types/charts';

/** The loose echarts option type the lib helpers use (tightened in R6b). */
export type EChartsOptionConfig = ReturnType<typeof applyLegendPosition>;
type WidgetCustomizations = Parameters<typeof createTooltipFormatter>[0];

export type ChartWidgetVariant = 'builder' | 'view';

/** Container size assumed until the ResizeObserver reports one. */
const FALLBACK_WIDTH_PX = 400;
const FALLBACK_HEIGHT_PX = 300;
const WIDGET_FONT_FAMILY = 'Inter, system-ui, sans-serif';
/** Data labels: half a point above the chart's own size, 12.5 when it has none. */
const LABEL_FONT_SIZE_STEP = 0.5;
const DEFAULT_LABEL_FONT_SIZE = 12.5;
/** Used only when the chart has no colours of its own. */
const DEFAULT_WIDGET_PALETTE = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#f97316', // orange-500
];
/** Axis name distance from the axis (named / unnamed). */
const X_AXIS_NAME_GAP = 80;
const Y_AXIS_NAME_GAP = 100;
const UNNAMED_AXIS_NAME_GAP = 15;
/** Increased margin from axis line to labels. */
const AXIS_LABEL_MARGIN = 15;
/** Rotated x labels are truncated at this width. */
const ROTATED_LABEL_WIDTH = 100;
const VIEW_ANIMATION_MS = 500;

export interface ChartWidgetOptionInput {
  /** The backend's echarts_config. */
  baseConfig: EChartsOptionConfig;
  chartType: string | undefined;
  customizations: WidgetCustomizations;
  containerSize: { width: number; height: number };
  variant: ChartWidgetVariant;
}

/** `value` mapped with `fn` when it is an array, `fn(value)` when it is an object, else undefined. */
function mapOrApply(
  value: EChartsOptionConfig | EChartsOptionConfig[] | undefined,
  fn: (entry: EChartsOptionConfig) => EChartsOptionConfig
) {
  if (Array.isArray(value)) return value.map(fn);
  return value ? fn(value) : undefined;
}

function axisNameTextStyle() {
  return { fontSize: 14, color: '#374151', fontFamily: WIDGET_FONT_FAMILY };
}

function styleSeries(series: EChartsOptionConfig) {
  return {
    ...series,
    label: {
      ...series.label,
      fontSize: series.label?.fontSize
        ? series.label.fontSize + LABEL_FONT_SIZE_STEP
        : DEFAULT_LABEL_FONT_SIZE,
      fontFamily: WIDGET_FONT_FAMILY,
      fontWeight: 'normal',
    },
  };
}

function styleXAxis(axis: EChartsOptionConfig) {
  return {
    ...axis,
    nameGap: axis.name ? X_AXIS_NAME_GAP : UNNAMED_AXIS_NAME_GAP,
    nameTextStyle: axisNameTextStyle(),
    axisLabel: {
      ...axis.axisLabel,
      interval: 0,
      margin: AXIS_LABEL_MARGIN,
      overflow: 'truncate',
      width: axis.axisLabel?.rotate ? ROTATED_LABEL_WIDTH : undefined,
    },
  };
}

function styleYAxis(axis: EChartsOptionConfig) {
  return {
    ...axis,
    nameGap: axis.name ? Y_AXIS_NAME_GAP : UNNAMED_AXIS_NAME_GAP,
    nameTextStyle: axisNameTextStyle(),
    axisLabel: {
      ...axis.axisLabel,
      margin: AXIS_LABEL_MARGIN,
    },
  };
}

/**
 * The echarts option a dashboard chart widget renders: legend placed for the container size,
 * HTML title instead of echarts' own, label / axis / tooltip styling, the default palette, then
 * per-type number/date formatting and stacked-bar totals.
 * BUILDER-DRIFT: the view adds a 500ms cubicOut animation and an Inter textStyle; the builder doesn't.
 */
export function buildChartWidgetOption({
  baseConfig,
  chartType,
  customizations,
  containerSize,
  variant,
}: ChartWidgetOptionInput): EChartsOptionConfig {
  const isPieChart = chartType === ChartTypes.PIE;
  const isNumberChart = chartType === ChartTypes.NUMBER;
  const isLineChart = chartType === ChartTypes.LINE;
  const isBarChart = chartType === ChartTypes.BAR;

  // Extract legend position from chart's customizations
  const legendPosition = extractLegendPosition(customizations, baseConfig) as LegendPosition;
  const isPaginated = isLegendPaginated(customizations);

  // Use container size for responsive legend (fallback to reasonable defaults)
  const effectiveWidth = containerSize.width > 0 ? containerSize.width : FALLBACK_WIDTH_PX;
  const effectiveHeight = containerSize.height > 0 ? containerSize.height : FALLBACK_HEIGHT_PX;

  // Check if legend should be visible based on container size
  const legendVisible = shouldShowLegend(effectiveWidth, effectiveHeight, chartType);

  // Apply legend positioning (handles both legend config and pie chart center adjustment)
  // Then apply responsive legend on top for size-based adjustments
  let configWithLegend = baseConfig.legend
    ? applyLegendPosition(baseConfig, legendPosition, isPaginated, chartType)
    : baseConfig;
  if (baseConfig.legend) {
    configWithLegend = applyResponsiveLegend(
      configWithLegend,
      effectiveWidth,
      effectiveHeight,
      legendPosition,
      chartType
    );
  }

  const option: EChartsOptionConfig = {
    ...configWithLegend,
    // Disable ECharts internal title since we use HTML titles
    title: {
      ...(configWithLegend.title || {}),
      show: false,
    },
    ...(variant === 'view'
      ? {
          animation: true,
          animationDuration: VIEW_ANIMATION_MS,
          animationEasing: 'cubicOut',
          textStyle: { fontFamily: WIDGET_FONT_FAMILY },
        }
      : {}),
    // Enhanced data labels styling (preserves pie center/radius from configWithLegend)
    series: mapOrApply(configWithLegend.series, styleSeries),
    // Only set default colors if chart doesn't have custom colors
    ...(baseConfig.color ? {} : { color: [...DEFAULT_WIDGET_PALETTE] }),
    // For pie and number charts, completely remove grid and axis configurations
    ...(isPieChart || isNumberChart
      ? { grid: undefined, xAxis: undefined, yAxis: undefined }
      : {
          // For other chart types, apply responsive grid margins based on container size
          grid: (() => {
            const hasRotatedXLabels =
              configWithLegend.xAxis?.axisLabel?.rotate !== undefined &&
              configWithLegend.xAxis?.axisLabel?.rotate !== 0;
            // Check if legend is visible after responsive adjustments
            const hasLegend =
              legendVisible &&
              Boolean(configWithLegend.legend) &&
              configWithLegend.legend?.show !== false;
            const margins = getResponsiveGridMargins(
              effectiveWidth,
              effectiveHeight,
              legendPosition,
              hasLegend,
              hasRotatedXLabels
            );
            return {
              ...configWithLegend.grid,
              containLabel: true,
              left: margins.left,
              bottom: margins.bottom,
              right: margins.right,
              top: margins.top,
            };
          })(),
          xAxis: mapOrApply(configWithLegend.xAxis, styleXAxis),
          yAxis: mapOrApply(configWithLegend.yAxis, styleYAxis),
        }),
    // Enhanced tooltip with bold values
    tooltip: {
      ...configWithLegend.tooltip,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: {
        color: '#1f2937',
        fontSize: 12,
      },
      extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);',
      formatter: createTooltipFormatter(customizations, chartType || ''),
    },
  };

  // Apply number formatting for number charts (same as ChartPreview.tsx)
  if (isNumberChart) {
    applyNumberChartFormatting(option, customizations);
  }

  // Apply number formatting and visibility settings for pie chart data labels
  if (isPieChart) {
    applyPieChartFormatting(option, customizations);
    applyPieDateFormatting(option, customizations);
  }

  // Apply number/date formatting for line/bar charts (separate X-axis and Y-axis formatting)
  if (isLineChart || isBarChart) {
    applyLineBarChartFormatting(option, customizations);
    applyLineBarDateFormatting(option, customizations);
  }

  // Apply stacked bar data labels (shows total at top of each stacked bar)
  if (isBarChart) {
    const stackedConfig = applyStackedBarLabels(option, customizations);
    Object.assign(option, stackedConfig);
  }

  return option;
}
