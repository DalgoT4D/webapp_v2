/**
 * Map chart configuration transformation utilities
 *
 * Extracts and organizes ECharts map config transformation logic
 * for geographic choropleth maps with data overlays
 */

export interface MapCustomizations {
  title?: string;
  colorScheme?: string;
  showTooltip?: boolean;
  showLegend?: boolean;
  showLabels?: boolean;
  borderColor?: string;
  borderWidth?: number;
  emphasis?: boolean;
  animation?: boolean;
  nullValueLabel?: string;
}

export interface MapDataPoint {
  name: string;
  value: number | null;
}

/**
 * Color scheme definitions for map visualizations
 */
export const MAP_COLOR_SCHEMES: Record<string, string> = {
  Blues: '#1f77b4',
  Reds: '#d62728',
  Greens: '#2ca02c',
  Purples: '#9467bd',
  Oranges: '#ff7f0e',
  Greys: '#7f7f7f',
};

/**
 * Get base color for a color scheme
 */
export function getSchemeBaseColor(colorScheme: string = 'Blues'): string {
  return MAP_COLOR_SCHEMES[colorScheme] || MAP_COLOR_SCHEMES.Blues;
}

/**
 * Calculate min/max values for color scaling with single-value handling
 *
 * When all values are the same, creates a meaningful range for proper visualization
 */
export function calculateValueRange(values: number[]): { min: number; max: number } {
  if (values.length === 0) {
    return { min: 0, max: 100 };
  }

  let minValue = Math.min(...values);
  let maxValue = Math.max(...values);

  // Handle single value scenario
  if (minValue === maxValue) {
    const actualValue = maxValue;

    if (actualValue > 0) {
      // Positive value: range from 0 to value
      minValue = 0;
      maxValue = actualValue;
    } else if (actualValue < 0) {
      // Negative value: range from value to 0
      minValue = actualValue;
      maxValue = 0;
    } else {
      // Value is exactly 0: create a small symmetric range
      minValue = -1;
      maxValue = 1;
    }
  }

  return { min: minValue, max: maxValue };
}

/**
 * Create enhanced series data with individual colors based on value range
 * Used when legend is disabled
 */
export function createEnhancedSeriesData(
  seriesData: MapDataPoint[],
  minValue: number,
  maxValue: number,
  baseColor: string
): Array<MapDataPoint & { itemStyle: { areaColor: string } }> {
  return seriesData.map((item) => {
    const normalizedValue =
      maxValue > minValue && item.value != null
        ? (item.value - minValue) / (maxValue - minValue)
        : 1;
    // Map to opacity range: 0.3 (min) to 1.0 (max) for better visibility
    const opacity = 0.3 + normalizedValue * 0.7;
    return {
      name: item.name,
      value: item.value,
      itemStyle: {
        areaColor: `${baseColor}${Math.round(opacity * 255)
          .toString(16)
          .padStart(2, '0')}`,
      },
    };
  });
}

/**
 * Create tooltip configuration for map
 */
export function createMapTooltip(
  valueColumn: string | undefined,
  customizations: MapCustomizations
) {
  return {
    trigger: 'item' as const,
    show: customizations.showTooltip !== false,
    formatter: function (params: any) {
      if (params.data && params.data.value != null) {
        return `${params.name}<br/>${valueColumn || 'Value'}: ${params.data.value}`;
      }
      return `${params.name}<br/>${customizations.nullValueLabel !== undefined ? customizations.nullValueLabel : 'No Data'}`;
    },
  };
}

/**
 * Create visual map (legend) configuration
 */
export function createVisualMap(
  minValue: number,
  maxValue: number,
  baseColor: string,
  showLegend: boolean
) {
  if (!showLegend) return undefined;

  return {
    min: minValue,
    max: maxValue,
    text: ['High', 'Low'],
    realtime: false,
    calculable: true,
    inRange: {
      color: [
        `${baseColor}4D`, // 30% opacity
        baseColor, // 100% opacity
      ],
    },
    orient: 'vertical' as const,
    left: '20px',
    bottom: '72px',
    itemWidth: 20,
    itemHeight: '120px',
    textStyle: {
      fontSize: 12,
      color: '#666',
    },
  };
}

/**
 * Create map series configuration
 */
export function createMapSeries(
  mapName: string,
  seriesData: MapDataPoint[],
  enhancedSeriesData: Array<MapDataPoint & { itemStyle: { areaColor: string } }>,
  customizations: MapCustomizations,
  zoom: number,
  showLegend: boolean
) {
  return {
    name: 'Map Data',
    type: 'map' as const,
    mapType: mapName,
    roam: 'move' as const,
    layoutCenter: ['50%', '50%'],
    layoutSize: '75%',
    zoom: zoom,
    selectedMode: 'single' as const,
    itemStyle: {
      areaColor: '#f5f5f5',
      borderColor: customizations.borderColor || '#333',
      borderWidth: customizations.borderWidth || 0.5,
    },
    label: {
      show: customizations.showLabels === true,
      fontSize: 12,
      color: '#333',
    },
    emphasis: {
      label: {
        show: customizations.emphasis !== false,
        fontSize: 14,
      },
      itemStyle: {
        areaColor: customizations.emphasis !== false ? '#37a2da' : undefined,
      },
    },
    animation: customizations.animation !== false,
    animationDuration: customizations.animation !== false ? 1000 : 0,
    // Use enhanced data with individual colors when legend is disabled
    data: showLegend === false ? enhancedSeriesData : seriesData,
  };
}

/**
 * Transform map data into ECharts configuration
 *
 * @param mapName - Unique map name for ECharts registration
 * @param mapData - Array of {name, value} data points
 * @param title - Optional chart title
 * @param valueColumn - Column name for tooltip display
 * @param customizations - Map customization options
 * @param zoom - Current zoom level
 * @returns ECharts configuration object
 */
export function transformMapConfig(
  mapName: string,
  mapData: MapDataPoint[] | undefined,
  title: string | undefined,
  valueColumn: string | undefined,
  customizations: MapCustomizations,
  zoom: number
): Record<string, any> {
  // Create series data from map data
  const seriesData: MapDataPoint[] = mapData
    ? mapData.map((item) => ({
        name: item.name,
        value: item.value,
      }))
    : [];

  // Calculate value range
  const values = seriesData.map((item) => item.value).filter((v): v is number => v != null);
  const { min: minValue, max: maxValue } = calculateValueRange(values);

  // Get color scheme
  const baseColor = getSchemeBaseColor(customizations.colorScheme);

  // Create enhanced data for when legend is disabled
  const enhancedSeriesData = createEnhancedSeriesData(seriesData, minValue, maxValue, baseColor);

  const showLegend = customizations.showLegend !== false && values.length > 0;
  const displayTitle = customizations.title || title;

  return {
    title: displayTitle
      ? {
          text: displayTitle,
          left: 'center',
          show: true,
        }
      : undefined,
    tooltip: createMapTooltip(valueColumn, customizations),
    ...(showLegend && {
      visualMap: createVisualMap(minValue, maxValue, baseColor, true),
    }),
    series: [
      createMapSeries(
        mapName,
        seriesData,
        enhancedSeriesData,
        customizations,
        zoom,
        customizations.showLegend
      ),
    ],
  };
}

/**
 * Transform legacy config format to current format
 */
export function transformLegacyMapConfig(config: Record<string, any>): {
  chartConfig: Record<string, any>;
  mapData: any;
  mapName: string;
} {
  let mapData, mapName, chartConfig;

  if (config.echarts_config) {
    mapData = config.geojson;
    mapName = config.geojson?.name || 'customMap';
    chartConfig = config.echarts_config;
  } else {
    mapData = config.mapData;
    mapName = config.mapName || 'customMap';
    chartConfig = { ...config };
    delete chartConfig.mapData;
    delete chartConfig.mapName;
  }

  return { chartConfig, mapData, mapName };
}
