/**
 * Utility functions for ECharts legend positioning
 * Handles translation of user-friendly position names to ECharts config
 */

export type LegendPosition = 'top' | 'bottom' | 'left' | 'right';

export interface LegendConfig {
  show?: boolean;
  type?: 'plain' | 'scroll';
  orient?: 'horizontal' | 'vertical';
  top?: string | number;
  bottom?: string | number;
  left?: string | number;
  right?: string | number;
  [key: string]: any;
}

export interface PieSeriesCenter {
  center: [string, string];
  radius: [string, string];
}

/**
 * Get ECharts legend configuration based on position
 * @param position - User-selected position (top, bottom, left, right)
 * @param baseLegend - Base legend config to extend
 * @param isPaginated - Whether to use scroll type for many items
 * @returns ECharts legend configuration
 */
export function getLegendConfig(
  position: LegendPosition | undefined,
  baseLegend?: LegendConfig,
  isPaginated: boolean = true
): LegendConfig {
  // If legend is hidden, return as-is
  if (baseLegend?.show === false) {
    return baseLegend;
  }

  const baseConfig: LegendConfig = {
    ...baseLegend,
    show: baseLegend?.show !== false,
    type: isPaginated ? 'scroll' : 'plain',
  };

  // Clear any existing position properties to avoid conflicts
  delete baseConfig.top;
  delete baseConfig.bottom;
  delete baseConfig.left;
  delete baseConfig.right;

  switch (position) {
    case 'bottom':
      return {
        ...baseConfig,
        orient: 'horizontal',
        bottom: '3%',
        left: 'center',
      };

    case 'left':
      return {
        ...baseConfig,
        orient: 'vertical',
        left: '3%',
        top: 'center',
      };

    case 'right':
      return {
        ...baseConfig,
        orient: 'vertical',
        right: '3%',
        top: 'center',
      };

    case 'top':
    default:
      return {
        ...baseConfig,
        orient: 'horizontal',
        top: '3%',
        left: 'center',
      };
  }
}

/**
 * Get pie chart series center and radius based on legend position
 * Adjusts pie position to prevent overlap with legend
 * @param position - Legend position
 * @param isDonut - Whether it's a donut chart (has inner radius)
 * @returns Center and radius configuration for pie series
 */
export function getPieSeriesPosition(
  position: LegendPosition | undefined,
  isDonut: boolean = true
): PieSeriesCenter {
  const innerRadius = isDonut ? '40%' : '0%';
  const outerRadius = '65%';

  switch (position) {
    case 'bottom':
      // Move pie up to make room for bottom legend
      return {
        center: ['50%', '42%'],
        radius: [innerRadius, outerRadius],
      };

    case 'left':
      // Move pie right to make room for left legend
      return {
        center: ['58%', '50%'],
        radius: [innerRadius, '60%'], // Slightly smaller to fit
      };

    case 'right':
      // Move pie left to make room for right legend
      return {
        center: ['42%', '50%'],
        radius: [innerRadius, '60%'], // Slightly smaller to fit
      };

    case 'top':
    default:
      // Move pie down to make room for top legend
      return {
        center: ['50%', '55%'],
        radius: [innerRadius, outerRadius],
      };
  }
}

/**
 * Apply legend positioning to chart config
 * Handles both legend position and pie chart adjustments
 * @param config - Original ECharts config
 * @param legendPosition - User-selected legend position
 * @param isPaginated - Whether to use paginated/scroll legend
 * @param chartType - Type of chart (for pie-specific adjustments)
 * @returns Modified config with proper legend positioning
 */
export function applyLegendPosition(
  config: Record<string, any>,
  legendPosition: LegendPosition | undefined,
  isPaginated: boolean = true,
  chartType?: string
): Record<string, any> {
  if (!config.legend) {
    return config;
  }

  const modifiedConfig = { ...config };

  // Apply legend positioning
  modifiedConfig.legend = getLegendConfig(legendPosition, config.legend, isPaginated);

  // For pie charts, also adjust the series center position
  if (chartType === 'pie' && modifiedConfig.series) {
    const isDonut =
      config.series?.[0]?.radius?.[0] !== '0%' && config.series?.[0]?.radius?.[0] !== 0;
    const piePosition = getPieSeriesPosition(legendPosition, isDonut);

    if (Array.isArray(modifiedConfig.series)) {
      modifiedConfig.series = modifiedConfig.series.map((series: any) => {
        if (series.type === 'pie') {
          return {
            ...series,
            center: piePosition.center,
            radius: piePosition.radius,
          };
        }
        return series;
      });
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

/**
 * Extract legend position from chart customizations or config
 * @param customizations - Chart customizations object
 * @param config - ECharts config (fallback)
 * @returns Legend position string
 */
export function extractLegendPosition(
  customizations?: Record<string, any>,
  config?: Record<string, any>
): LegendPosition {
  // First check customizations
  if (customizations?.legendPosition) {
    return customizations.legendPosition as LegendPosition;
  }

  // Fallback to config legend position if available
  if (config?.legend) {
    if (config.legend.bottom !== undefined) return 'bottom';
    if (config.legend.left !== undefined && config.legend.left !== 'center') return 'left';
    if (config.legend.right !== undefined) return 'right';
  }

  return 'right'; // Default
}

/**
 * Check if legend should be paginated based on display setting
 * @param customizations - Chart customizations object
 * @returns Whether legend should use scroll/pagination
 */
export function isLegendPaginated(customizations?: Record<string, any>): boolean {
  return customizations?.legendDisplay !== 'all';
}
