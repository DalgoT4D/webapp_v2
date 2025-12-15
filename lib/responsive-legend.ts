/**
 * Responsive Legend Utility
 * Provides functions to make chart legends responsive based on container size.
 * Legends will adapt, paginate, or hide based on available space - Superset-like behavior.
 */

import type { LegendPosition } from './chart-legend-utils';

/**
 * Size thresholds for responsive behavior
 */
export const LEGEND_THRESHOLDS = {
  // Below this, hide legend completely
  HIDE_LEGEND: { width: 180, height: 150 },
  // Below this, use minimal legend (small icons, truncated text)
  MINIMAL_LEGEND: { width: 280, height: 220 },
  // Below this, use compact legend
  COMPACT_LEGEND: { width: 400, height: 320 },
  // Above this, use full legend
  FULL_LEGEND: { width: 400, height: 320 },
} as const;

/**
 * Legend size configurations for different responsive modes
 */
export type LegendMode = 'hidden' | 'minimal' | 'compact' | 'full';

export interface ResponsiveLegendConfig {
  show: boolean;
  type: 'scroll' | 'plain';
  orient: 'horizontal' | 'vertical';
  pageButtonItemGap?: number;
  pageButtonGap?: number;
  pageIconSize?: number | [number, number];
  pageTextStyle?: { fontSize: number; color?: string };
  itemWidth?: number;
  itemHeight?: number;
  itemGap?: number;
  textStyle?: { fontSize: number; width?: number; overflow?: string; ellipsis?: string };
  formatter?: (name: string) => string;
  // Position properties
  top?: string | number;
  bottom?: string | number;
  left?: string | number;
  right?: string | number;
  // Padding
  padding?: number | [number, number] | [number, number, number, number];
}

/**
 * Determine the legend mode based on container size
 * Note: We no longer hide legends - they scale down to minimal instead
 */
export function getLegendMode(containerWidth: number, containerHeight: number): LegendMode {
  // Always show legend - use minimal mode for very small containers
  if (
    containerWidth < LEGEND_THRESHOLDS.MINIMAL_LEGEND.width ||
    containerHeight < LEGEND_THRESHOLDS.MINIMAL_LEGEND.height
  ) {
    return 'minimal';
  }

  if (
    containerWidth < LEGEND_THRESHOLDS.COMPACT_LEGEND.width ||
    containerHeight < LEGEND_THRESHOLDS.COMPACT_LEGEND.height
  ) {
    return 'compact';
  }

  return 'full';
}

/**
 * Check if legend should be shown based on chart type
 * Note: We no longer hide legends based on size - they scale instead
 */
export function shouldShowLegend(
  _containerWidth: number,
  _containerHeight: number,
  chartType?: string
): boolean {
  // Number charts never need legends
  if (chartType === 'number' || chartType === 'gauge') {
    return false;
  }

  // Always show legend for other chart types - it will scale with container
  return true;
}

/**
 * Calculate available space for legend based on position
 */
export function calculateLegendSpace(
  containerWidth: number,
  containerHeight: number,
  position: LegendPosition
): { width: number; height: number; maxItems: number } {
  const mode = getLegendMode(containerWidth, containerHeight);

  // Reserve percentage of space for legend based on position
  let reservedWidth: number;
  let reservedHeight: number;

  if (position === 'left' || position === 'right') {
    // Vertical legend - takes width
    reservedWidth = mode === 'full' ? containerWidth * 0.25 : containerWidth * 0.18;
    reservedHeight = containerHeight * 0.8;
  } else {
    // Horizontal legend - takes height
    reservedWidth = containerWidth * 0.9;
    reservedHeight = mode === 'full' ? containerHeight * 0.15 : containerHeight * 0.12;
  }

  // Calculate max items that can fit
  const itemHeight = mode === 'minimal' ? 16 : mode === 'compact' ? 20 : 24;
  const itemWidth = mode === 'minimal' ? 60 : mode === 'compact' ? 80 : 100;

  let maxItems: number;
  if (position === 'left' || position === 'right') {
    maxItems = Math.floor(reservedHeight / itemHeight);
  } else {
    maxItems = Math.floor(reservedWidth / itemWidth);
  }

  return {
    width: Math.max(60, reservedWidth),
    height: Math.max(20, reservedHeight),
    maxItems: Math.max(2, maxItems),
  };
}

/**
 * Truncate legend text to fit available space
 */
export function truncateLegendText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 2) + '...';
}

/**
 * Get legend text max length based on container size and position
 */
export function getLegendTextMaxLength(
  containerWidth: number,
  containerHeight: number,
  position: LegendPosition
): number {
  const mode = getLegendMode(containerWidth, containerHeight);

  if (mode === 'hidden') return 0;
  if (mode === 'minimal') return 8;
  if (mode === 'compact') return 15;

  // Full mode - depends on position
  if (position === 'left' || position === 'right') {
    // Vertical legend has limited width
    return Math.min(25, Math.floor((containerWidth * 0.2) / 7));
  }
  // Horizontal legend can be wider
  return 30;
}

/**
 * Get responsive legend configuration based on container size
 */
export function getResponsiveLegendConfig(
  containerWidth: number,
  containerHeight: number,
  position: LegendPosition,
  itemCount: number = 5,
  baseLegend?: Partial<ResponsiveLegendConfig>
): ResponsiveLegendConfig {
  const mode = getLegendMode(containerWidth, containerHeight);
  const maxTextLength = getLegendTextMaxLength(containerWidth, containerHeight, position);

  // Hidden mode
  if (mode === 'hidden') {
    return {
      show: false,
      type: 'plain',
      orient: 'horizontal',
    };
  }

  const isVertical = position === 'left' || position === 'right';

  // Base config that adapts to size
  const baseConfig: ResponsiveLegendConfig = {
    show: true,
    type: itemCount > 5 ? 'scroll' : 'plain', // Paginate if many items
    orient: isVertical ? 'vertical' : 'horizontal',
  };

  // Minimal mode - very compact
  if (mode === 'minimal') {
    return {
      ...baseConfig,
      type: 'scroll', // Always paginate in minimal mode
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 6,
      pageIconSize: 10,
      pageButtonItemGap: 4,
      pageButtonGap: 4,
      pageTextStyle: { fontSize: 9, color: '#666' },
      textStyle: {
        fontSize: 10,
        width: 50,
        overflow: 'truncate',
        ellipsis: '...',
      },
      formatter: (name: string) => truncateLegendText(name, maxTextLength),
      padding: 2,
      ...getPositionConfig(position, 'minimal'),
    };
  }

  // Compact mode
  if (mode === 'compact') {
    return {
      ...baseConfig,
      type: itemCount > 4 ? 'scroll' : 'plain',
      itemWidth: 14,
      itemHeight: 10,
      itemGap: 8,
      pageIconSize: 12,
      pageButtonItemGap: 5,
      pageButtonGap: 5,
      pageTextStyle: { fontSize: 10, color: '#666' },
      textStyle: {
        fontSize: 11,
        width: 70,
        overflow: 'truncate',
        ellipsis: '...',
      },
      formatter: (name: string) => truncateLegendText(name, maxTextLength),
      padding: 4,
      ...getPositionConfig(position, 'compact'),
    };
  }

  // Full mode - normal legend
  return {
    ...baseConfig,
    ...baseLegend,
    type: itemCount > 8 ? 'scroll' : 'plain',
    itemWidth: 20,
    itemHeight: 12,
    itemGap: 10,
    pageIconSize: 14,
    pageButtonItemGap: 8,
    pageButtonGap: 8,
    pageTextStyle: { fontSize: 12, color: '#666' },
    textStyle: {
      fontSize: 12,
    },
    padding: 8,
    ...getPositionConfig(position, 'full'),
  };
}

/**
 * Get position configuration based on legend position and mode
 */
function getPositionConfig(
  position: LegendPosition,
  mode: LegendMode
): Pick<ResponsiveLegendConfig, 'top' | 'bottom' | 'left' | 'right'> {
  // Tighter margins for smaller modes
  const margin = mode === 'minimal' ? '1%' : mode === 'compact' ? '2%' : '3%';

  switch (position) {
    case 'bottom':
      return { bottom: margin, left: 'center' };
    case 'left':
      return { left: margin, top: 'center' };
    case 'right':
      return { right: margin, top: 'center' };
    case 'top':
    default:
      return { top: margin, left: 'center' };
  }
}

/**
 * Get responsive pie chart center and radius based on container size and legend
 */
export function getResponsivePiePosition(
  containerWidth: number,
  containerHeight: number,
  position: LegendPosition,
  legendVisible: boolean,
  isDonut: boolean = true
): { center: [string, string]; radius: [string, string] } {
  const innerRadius = isDonut ? '35%' : '0%';

  // If legend is hidden, center the pie and use maximum space
  if (!legendVisible) {
    return {
      center: ['50%', '50%'],
      radius: [innerRadius, '75%'],
    };
  }

  const mode = getLegendMode(containerWidth, containerHeight);

  // Smaller charts need more compact pie
  const outerRadius = mode === 'minimal' ? '55%' : mode === 'compact' ? '60%' : '65%';
  const smallInnerRadius = isDonut ? (mode === 'minimal' ? '25%' : '30%') : '0%';

  switch (position) {
    case 'bottom':
      // Move pie up for bottom legend
      const bottomOffset = mode === 'minimal' ? '40%' : mode === 'compact' ? '42%' : '45%';
      return {
        center: ['50%', bottomOffset],
        radius: [smallInnerRadius, outerRadius],
      };

    case 'left':
      // Move pie right for left legend
      const leftOffset = mode === 'minimal' ? '55%' : mode === 'compact' ? '56%' : '58%';
      return {
        center: [leftOffset, '50%'],
        radius: [smallInnerRadius, mode === 'minimal' ? '50%' : '55%'],
      };

    case 'right':
      // Move pie left for right legend
      const rightOffset = mode === 'minimal' ? '45%' : mode === 'compact' ? '44%' : '42%';
      return {
        center: [rightOffset, '50%'],
        radius: [smallInnerRadius, mode === 'minimal' ? '50%' : '55%'],
      };

    case 'top':
    default:
      // Move pie down for top legend
      const topOffset = mode === 'minimal' ? '55%' : mode === 'compact' ? '54%' : '52%';
      return {
        center: ['50%', topOffset],
        radius: [smallInnerRadius, outerRadius],
      };
  }
}

/**
 * Get responsive grid margins for bar/line charts based on container size
 */
export function getResponsiveGridMargins(
  containerWidth: number,
  containerHeight: number,
  legendPosition: LegendPosition,
  hasLegend: boolean,
  hasRotatedLabels: boolean = false
): { top: string; bottom: string; left: string; right: string } {
  const mode = getLegendMode(containerWidth, containerHeight);

  // Base margins - tighter for smaller containers
  let top = mode === 'minimal' ? '8%' : mode === 'compact' ? '10%' : '12%';
  let bottom = hasRotatedLabels
    ? mode === 'minimal'
      ? '15%'
      : '18%'
    : mode === 'minimal'
      ? '10%'
      : '14%';
  let left = mode === 'minimal' ? '8%' : '10%';
  let right = mode === 'minimal' ? '4%' : '6%';

  // Adjust for legend position
  if (hasLegend) {
    const legendSpace = mode === 'minimal' ? '12%' : mode === 'compact' ? '15%' : '18%';

    switch (legendPosition) {
      case 'top':
        top = legendSpace;
        break;
      case 'bottom':
        bottom = hasRotatedLabels
          ? mode === 'minimal'
            ? '20%'
            : '22%'
          : mode === 'minimal'
            ? '16%'
            : '20%';
        break;
      case 'left':
        left = legendSpace;
        break;
      case 'right':
        right = mode === 'minimal' ? '12%' : '15%';
        break;
    }
  }

  return { top, bottom, left, right };
}

/**
 * Apply responsive legend configuration to a chart config
 */
export function applyResponsiveLegend(
  config: Record<string, any>,
  containerWidth: number,
  containerHeight: number,
  legendPosition: LegendPosition,
  chartType?: string
): Record<string, any> {
  // Check if legend should be shown
  const showLegend = shouldShowLegend(containerWidth, containerHeight, chartType);

  if (!showLegend || !config.legend) {
    return {
      ...config,
      legend: { ...config.legend, show: false },
    };
  }

  // Count legend items
  let itemCount = 5;
  if (config.legend?.data) {
    itemCount = config.legend.data.length;
  } else if (config.series) {
    const series = Array.isArray(config.series) ? config.series : [config.series];
    if (series[0]?.type === 'pie' && series[0]?.data) {
      itemCount = series[0].data.length;
    } else {
      itemCount = series.length;
    }
  }

  // Get responsive legend config
  const responsiveLegend = getResponsiveLegendConfig(
    containerWidth,
    containerHeight,
    legendPosition,
    itemCount,
    config.legend
  );

  const modifiedConfig: Record<string, any> = {
    ...config,
    legend: {
      ...config.legend,
      ...responsiveLegend,
    },
  };

  // For pie charts, also adjust center and radius
  if (chartType === 'pie' && modifiedConfig.series) {
    const isDonut =
      Array.isArray(config.series) &&
      config.series[0]?.radius?.[0] !== '0%' &&
      config.series[0]?.radius?.[0] !== 0;
    const piePosition = getResponsivePiePosition(
      containerWidth,
      containerHeight,
      legendPosition,
      showLegend,
      isDonut
    );

    if (Array.isArray(modifiedConfig.series)) {
      modifiedConfig.series = modifiedConfig.series.map((s: any) =>
        s.type === 'pie' ? { ...s, center: piePosition.center, radius: piePosition.radius } : s
      );
    } else if (modifiedConfig.series.type === 'pie') {
      modifiedConfig.series = {
        ...modifiedConfig.series,
        center: piePosition.center,
        radius: piePosition.radius,
      };
    }
  }

  return modifiedConfig;
}
