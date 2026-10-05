import { formatNumber } from '@/lib/formatters';
import { escapeHtml, getMapValueRange, lightenColor } from './map-scale';

/** Base colour per scheme; unknown schemes use Blues. */
export const MAP_SCHEME_BASE_COLORS: Record<string, string> = {
  Blues: '#1f77b4',
  Reds: '#d62728',
  Greens: '#2ca02c',
  Purples: '#9467bd',
  Oranges: '#ff7f0e',
  Greys: '#7f7f7f',
};

/** When the container hasn't been measured yet, size decisions assume this box. */
const FALLBACK_SIZE = { width: 400, height: 300 };

export interface MapSize {
  width: number;
  height: number;
}

export interface MapRegionValue {
  name: string;
  value: number | null;
}

export interface MapChartOptionInput {
  mapName: string;
  mapData: MapRegionValue[] | undefined;
  customizations: Record<string, any>;
  title: string | undefined;
  valueColumn: string | undefined;
  /** Container size at build time (0×0 until the ResizeObserver reports). */
  containerSize: MapSize;
  /** Series zoom — the value captured when the init callback was last created. */
  zoom: number;
}

function effectiveSize(size: MapSize): MapSize {
  return {
    width: size.width > 0 ? size.width : FALLBACK_SIZE.width,
    height: size.height > 0 ? size.height : FALLBACK_SIZE.height,
  };
}

/** Item tooltip; padding, font size and name truncation follow the build-time container size. */
export function buildMapTooltip(
  customizations: Record<string, any>,
  valueColumn: string | undefined,
  containerSize: MapSize
) {
  const { width: effectiveWidth, height: effectiveHeight } = effectiveSize(containerSize);
  const isVerySmall = effectiveWidth < 250 || effectiveHeight < 200;
  const isSmall = effectiveWidth < 350 || effectiveHeight < 280;

  return {
    trigger: 'item',
    show: customizations.showTooltip !== false,
    // Responsive padding and font size
    padding: isVerySmall ? [4, 6] : isSmall ? [6, 8] : [8, 12],
    textStyle: {
      fontSize: isVerySmall ? 10 : isSmall ? 11 : 12,
    },
    // Constrain tooltip size for small containers
    extraCssText: isVerySmall
      ? 'max-width: 120px; white-space: normal; line-height: 1.3;'
      : isSmall
        ? 'max-width: 150px; white-space: normal; line-height: 1.4;'
        : '',
    formatter: function (params: any) {
      const rawLabel = valueColumn || 'Value';
      const label = escapeHtml(rawLabel);
      const rawName = params.name ?? '';
      if (params.data && params.data.value != null) {
        // Truncate long names for small containers, then escape
        const truncatedName =
          isVerySmall && rawName.length > 15
            ? rawName.substring(0, 13) + '...'
            : isSmall && rawName.length > 20
              ? rawName.substring(0, 18) + '...'
              : rawName;
        const name = escapeHtml(truncatedName);
        // Apply number formatting if configured
        let formattedValue: string | number = params.data.value;
        if (customizations.numberFormat || customizations.decimalPlaces !== undefined) {
          formattedValue = formatNumber(params.data.value, {
            format: customizations.numberFormat || 'default',
            decimalPlaces: customizations.decimalPlaces,
          });
        }
        // Escape formattedValue for defense-in-depth
        const safeFormattedValue = escapeHtml(String(formattedValue));
        return `<b>${name}</b><br/>${label}: ${safeFormattedValue}`;
      }
      const rawNullLabel =
        customizations.nullValueLabel !== undefined
          ? String(customizations.nullValueLabel)
          : 'No Data';
      const nullLabel = escapeHtml(rawNullLabel);
      // Truncate long names for small containers, then escape
      const truncatedName =
        isVerySmall && rawName.length > 15
          ? rawName.substring(0, 13) + '...'
          : isSmall && rawName.length > 20
            ? rawName.substring(0, 18) + '...'
            : rawName;
      const name = escapeHtml(truncatedName);
      return `<b>${name}</b><br/>${nullLabel}`;
    },
  };
}

/** Continuous legend (hidden below 200×180), sized and positioned for the build-time container. */
export function buildMapVisualMap(
  customizations: Record<string, any>,
  containerSize: MapSize,
  minValue: number,
  maxValue: number,
  baseColor: string
) {
  const { width: effectiveWidth, height: effectiveHeight } = effectiveSize(containerSize);

  // Determine legend mode based on container size
  const isVerySmall = effectiveWidth < 200 || effectiveHeight < 180;
  const isSmall = effectiveWidth < 300 || effectiveHeight < 250;
  const isCompact = effectiveWidth < 400 || effectiveHeight < 320;

  // Hide legend for very small containers
  if (isVerySmall) {
    return { show: false };
  }

  // Responsive sizing based on container
  const itemWidth = isSmall ? 12 : isCompact ? 16 : 20;
  const itemHeight = isSmall ? 50 : isCompact ? 70 : 100;
  const fontSize = isSmall ? 10 : isCompact ? 11 : 12;
  const margin = isSmall ? 8 : isCompact ? 12 : 20;

  // Legend positioning - defaults to bottom-left, users can change in customizations
  // Any unrecognized value defaults to bottom-left
  const legendPosition = customizations.legendPosition || 'bottom-left';
  let positionConfig;
  switch (legendPosition) {
    case 'top-right':
      positionConfig = {
        orient: 'vertical',
        right: `${margin}px`,
        top: `${margin}px`,
      };
      break;
    case 'top-left':
      positionConfig = {
        orient: 'vertical',
        left: `${margin}px`,
        top: `${margin}px`,
      };
      break;
    case 'bottom-right':
      positionConfig = {
        orient: 'vertical',
        right: `${margin}px`,
        bottom: `${margin}px`,
      };
      break;
    case 'bottom-left':
    default:
      positionConfig = {
        orient: 'vertical',
        left: `${margin}px`,
        bottom: `${margin}px`,
      };
      break;
  }

  return {
    show: true,
    min: minValue,
    max: maxValue,
    text: isSmall ? ['H', 'L'] : ['High', 'Low'],
    realtime: false,
    calculable: true,
    inRange: {
      color: [
        `${baseColor}4D`, // 30% opacity
        baseColor, // 100% opacity
      ],
    },
    ...positionConfig,
    itemWidth,
    itemHeight,
    textStyle: {
      fontSize,
      color: '#666',
    },
  };
}

/** Share of the container the map occupies; smaller containers use more of it. */
export function getMapLayoutSize(containerSize: MapSize): string {
  const { width: effectiveWidth, height: effectiveHeight } = effectiveSize(containerSize);
  // For smaller containers, use more of the available space
  if (effectiveWidth < 250 || effectiveHeight < 200) return '95%';
  if (effectiveWidth < 350 || effectiveHeight < 280) return '90%';
  if (effectiveWidth < 450 || effectiveHeight < 350) return '85%';
  return '80%'; // Standard size for larger containers
}

/** The full ECharts option for a GeoJSON map with an optional data overlay. */
export function buildMapChartOption({
  mapName,
  mapData,
  customizations,
  title,
  valueColumn,
  containerSize,
  zoom,
}: MapChartOptionInput) {
  // Create map series data
  let seriesData: any[] = [];
  if (mapData && mapData.length > 0) {
    // We have data to overlay on the map
    seriesData = mapData.map((item) => ({
      name: item.name,
      value: item.value,
    }));
  }

  // Calculate min/max values for color scaling
  const values = seriesData.map((item) => item.value).filter((v) => v != null);
  const { minValue, maxValue } = getMapValueRange(values);

  // Get color scheme from customizations
  const colorScheme = customizations.colorScheme || 'Blues';
  const baseColor = MAP_SCHEME_BASE_COLORS[colorScheme] || MAP_SCHEME_BASE_COLORS.Blues;

  // Create a lighter version of the base color for emphasis/highlight
  const emphasisColor = lightenColor(baseColor, 0.4); // 40% lighter

  // Create color-mapped data points based on scheme
  const enhancedSeriesData = seriesData.map((item) => {
    const normalizedValue =
      maxValue > minValue ? (item.value - minValue) / (maxValue - minValue) : 1; // Use 1.0 for single value case
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

  // Create ECharts configuration with applied customizations
  return {
    title:
      customizations.title || title
        ? {
            text: customizations.title || title,
            left: 'center',
            show: true,
          }
        : undefined,
    tooltip: buildMapTooltip(customizations, valueColumn, containerSize),
    // Add legend based on customizations - responsive to container size
    // For single values, show range from 0 to actual value for meaningful context
    ...(customizations.showLegend !== false &&
      values.length > 0 && {
        visualMap: buildMapVisualMap(customizations, containerSize, minValue, maxValue, baseColor),
      }),
    series: [
      {
        name: 'Map Data',
        type: 'map',
        mapType: mapName,
        // Enable move only (panning) - zoom handled by our custom buttons
        roam: 'move',
        // Responsive map sizing - use more space for smaller containers
        layoutCenter: ['50%', '50%'],
        layoutSize: getMapLayoutSize(containerSize),
        // Set initial zoom level
        zoom,
        // Apply selection settings - ALWAYS enable for clicks to work
        selectedMode: 'single',
        // Configure how regions without data should appear (default styling)
        itemStyle: {
          areaColor: '#f5f5f5', // Light gray for regions without data
          borderColor: '#000',
          borderWidth: 0,
        },
        label: {
          show: customizations.showLabels === true,
          fontSize: 12,
          color: '#333',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
          },
          itemStyle: {
            areaColor: emphasisColor,
          },
        },
        // Animation settings
        animation: true,
        animationDuration: 1000,
        // Use enhanced data with individual colors when legend is disabled
        ...(customizations.showLegend === false
          ? {
              data: enhancedSeriesData,
            }
          : {
              data: seriesData, // Use original data when visualMap is enabled
            }),
      },
    ],
  };
}

/** Tooltip / legend / layout updates applied on container resize without a full re-init. Moved verbatim from MapPreview. */
export function computeResponsiveMapOptions(width: number, height: number, legendPosition: string) {
  const isVerySmall = width < 250 || height < 200;
  const isSmall = width < 350 || height < 280;
  const isCompact = width < 400 || height < 320;

  // Compute layoutSize
  let layoutSize = '80%';
  if (width < 250 || height < 200) layoutSize = '95%';
  else if (width < 350 || height < 280) layoutSize = '90%';
  else if (width < 450 || height < 350) layoutSize = '85%';

  // Compute tooltip options
  const tooltipOptions = {
    padding: isVerySmall ? [4, 6] : isSmall ? [6, 8] : [8, 12],
    textStyle: {
      fontSize: isVerySmall ? 10 : isSmall ? 11 : 12,
    },
    extraCssText: isVerySmall
      ? 'max-width: 120px; white-space: normal; line-height: 1.3;'
      : isSmall
        ? 'max-width: 150px; white-space: normal; line-height: 1.4;'
        : '',
  };

  // Compute visualMap options (legend)
  const isVerySmallLegend = width < 200 || height < 180;
  const isSmallLegend = width < 300 || height < 250;
  const itemWidth = isSmallLegend ? 12 : isCompact ? 16 : 20;
  const itemHeight = isSmallLegend ? 50 : isCompact ? 70 : 100;
  const fontSize = isSmallLegend ? 10 : isCompact ? 11 : 12;
  const margin = isSmallLegend ? 8 : isCompact ? 12 : 20;

  // Compute legend position based on user customization
  // Any unrecognized value defaults to bottom-left
  let positionConfig;
  switch (legendPosition) {
    case 'top-right':
      positionConfig = { orient: 'vertical', right: `${margin}px`, top: `${margin}px` };
      break;
    case 'top-left':
      positionConfig = { orient: 'vertical', left: `${margin}px`, top: `${margin}px` };
      break;
    case 'bottom-right':
      positionConfig = { orient: 'vertical', right: `${margin}px`, bottom: `${margin}px` };
      break;
    case 'bottom-left':
    default:
      positionConfig = { orient: 'vertical', left: `${margin}px`, bottom: `${margin}px` };
      break;
  }

  const visualMapOptions = isVerySmallLegend
    ? { show: false }
    : {
        text: isSmallLegend ? ['H', 'L'] : ['High', 'Low'],
        itemWidth,
        itemHeight,
        textStyle: { fontSize, color: '#666' },
        ...positionConfig,
      };

  return { layoutSize, tooltipOptions, visualMapOptions };
}
