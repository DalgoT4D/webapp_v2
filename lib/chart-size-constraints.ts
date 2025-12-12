/**
 * Chart size constraints for dashboard layout
 * Defines minimum dimensions for proper chart rendering
 */

export interface ChartSizeConstraint {
  minWidth: number;
  minHeight: number;
  defaultWidth: number;
  defaultHeight: number;
}

export interface GridDimensions {
  w: number; // Grid units width
  h: number; // Grid units height
}

// Grid configuration - must match dashboard-builder-v2.tsx rowHeight
export const GRID_CONFIG = {
  cols: 12,
  rowHeight: 20, // Height of one grid row in pixels (matches dashboard builder)
  margin: [10, 10] as [number, number],
} as const;

// Standard default size for new charts - a consistent square-ish starting point
// Width: 4 columns (~356px at 1200px container), Height: calculated to be visually square
// At rowHeight=20px: 18 rows × 20px = 360px ≈ 4 cols × 89px = 356px
export const STANDARD_DEFAULT_SIZE = {
  w: 4, // 4 columns (responsive - scales with container width)
  h: 18, // 18 rows (18 × 20px = 360px, making it roughly square with 4 cols)
} as const;

/**
 * Minimum chart size constraints by chart type
 * These are flexible minimums that allow charts to be very small while remaining functional.
 * Charts adapt their content (legends, labels) responsively based on available space.
 * Superset-like approach: allow very small sizes, let charts be fully responsive.
 *
 * NOTE: minWidth/minHeight are set to ~80px to allow 1 grid column minimum
 * (1 column ≈ 89px at 1200px container width with 12 columns)
 */
export const CHART_SIZE_CONSTRAINTS: Record<string, ChartSizeConstraint> = {
  // Map charts - can be compact, content scales
  map: {
    minWidth: 80,
    minHeight: 40,
    defaultWidth: 500,
    defaultHeight: 400,
  },

  // Bar charts - responsive axes and legends
  bar: {
    minWidth: 80,
    minHeight: 40,
    defaultWidth: 500,
    defaultHeight: 400,
  },

  // Line charts - responsive axes and legends
  line: {
    minWidth: 80,
    minHeight: 40,
    defaultWidth: 500,
    defaultHeight: 400,
  },

  // Pie charts - legend adapts, chart scales
  pie: {
    minWidth: 80,
    minHeight: 40,
    defaultWidth: 400,
    defaultHeight: 400,
  },

  // Tables - scrollable content, responsive columns
  table: {
    minWidth: 80,
    minHeight: 40,
    defaultWidth: 500,
    defaultHeight: 350,
  },

  // Number cards - very compact, just show the number
  number: {
    minWidth: 80,
    minHeight: 20,
    defaultWidth: 250,
    defaultHeight: 180,
  },

  // Text components - flexible
  text: {
    minWidth: 80,
    minHeight: 20,
    defaultWidth: 300,
    defaultHeight: 150,
  },

  // Default fallback for unknown chart types
  default: {
    minWidth: 80,
    minHeight: 20,
    defaultWidth: 400,
    defaultHeight: 300,
  },
};

/**
 * Convert pixel dimensions to grid units
 */
export function pixelsToGridUnits(pixels: number, isWidth: boolean): number {
  if (isWidth) {
    // Calculate available width per grid column
    const containerWidth = 1200; // Typical dashboard width
    const totalMargins = GRID_CONFIG.margin[0] * (GRID_CONFIG.cols + 1);
    const availableWidth = containerWidth - totalMargins;
    const widthPerCol = availableWidth / GRID_CONFIG.cols;
    return Math.ceil(pixels / widthPerCol);
  } else {
    // Height calculation
    return Math.ceil(pixels / GRID_CONFIG.rowHeight);
  }
}

/**
 * Get minimum grid dimensions for a chart type
 */
export function getMinGridDimensions(chartType: string): GridDimensions {
  const constraints = CHART_SIZE_CONSTRAINTS[chartType] || CHART_SIZE_CONSTRAINTS.default;

  return {
    w: Math.max(1, pixelsToGridUnits(constraints.minWidth, true)), // Minimum 1 grid unit width
    h: Math.max(1, pixelsToGridUnits(constraints.minHeight, false)), // Minimum 1 grid unit height
  };
}

/**
 * Get default grid dimensions for a chart type
 * Uses STANDARD_DEFAULT_SIZE (4 cols × 18 rows) as the baseline for consistent square-ish charts.
 * At rowHeight=20px: 4 cols ≈ 356px width, 18 rows × 20px = 360px height (~square).
 */
export function getDefaultGridDimensions(_chartType: string): GridDimensions {
  // Use standard default size for consistent starting point
  // This ensures all new charts start as a roughly square shape (4 cols × 18 rows ≈ 356px × 360px)
  // The standard size is responsive - it scales proportionally with the grid
  return {
    w: STANDARD_DEFAULT_SIZE.w,
    h: STANDARD_DEFAULT_SIZE.h,
  };
}

/**
 * Validate if grid dimensions meet minimum requirements
 */
export function validateGridDimensions(
  chartType: string,
  dimensions: GridDimensions
): { isValid: boolean; minRequired: GridDimensions } {
  const minRequired = getMinGridDimensions(chartType);
  const isValid = dimensions.w >= minRequired.w && dimensions.h >= minRequired.h;

  return { isValid, minRequired };
}

/**
 * Adjust grid dimensions to meet minimum requirements
 */
export function adjustToMinimumSize(chartType: string, dimensions: GridDimensions): GridDimensions {
  const minRequired = getMinGridDimensions(chartType);

  return {
    w: Math.max(dimensions.w, minRequired.w),
    h: Math.max(dimensions.h, minRequired.h),
  };
}

/**
 * Analyze chart data to determine content-based minimum dimensions
 * Accounts for: title space, axis labels, legends, data density, and content structure
 */
export function analyzeChartContent(chartData: any, chartType: string): ChartSizeConstraint {
  const baseConstraints = CHART_SIZE_CONSTRAINTS[chartType] || CHART_SIZE_CONSTRAINTS.default;

  if (!chartData) {
    console.log(
      `⚠️  No chart data provided for ${chartType}, using base constraints:`,
      baseConstraints
    );
    return baseConstraints;
  }

  // Start with base constraints that already account for title + basic axis space
  let minWidth = baseConstraints.minWidth;
  let minHeight = baseConstraints.minHeight;
  let defaultWidth = baseConstraints.defaultWidth;
  let defaultHeight = baseConstraints.defaultHeight;

  console.log(`🔍 Analyzing ${chartType} chart content, base constraints:`, {
    minWidth,
    minHeight,
    defaultWidth,
    defaultHeight,
  });

  try {
    switch (chartType) {
      case 'bar':
      case 'line':
        console.log(`📊 Analyzing ${chartType} chart data:`, {
          hasEchartsConfig: !!chartData.echarts_config,
          hasXAxis: !!chartData.echarts_config?.xAxis,
          hasYAxis: !!chartData.echarts_config?.yAxis,
          hasSeries: !!chartData.echarts_config?.series,
        });

        // Analyze bar/line charts based on data points and labels
        // NOTE: Using Superset-like approach - keep minimums small, let charts adapt
        // Charts will show what fits and use scrolling/pagination for the rest
        if (chartData.echarts_config?.xAxis?.data) {
          const dataPoints = chartData.echarts_config.xAxis.data.length;
          console.log(`📊 Found ${dataPoints} data points in ${chartType} chart`);

          // Only inflate DEFAULT size for many data points, not minimum
          // This allows users to make charts smaller if they want
          if (dataPoints > 10) {
            const contentWidth = Math.min(800, dataPoints * 40); // Cap at 800px
            defaultWidth = Math.max(defaultWidth, contentWidth);
          }

          console.log(`📐 Width calculated for ${dataPoints} data points:`, {
            dataPoints,
            finalMinWidth: minWidth,
            finalDefaultWidth: defaultWidth,
          });
        }

        // Check for multiple series (affects legend space)
        // Only inflate DEFAULT size, keep minimum small for flexibility
        if (chartData.echarts_config?.series?.length > 1) {
          const seriesCount = chartData.echarts_config.series.length;
          console.log(`📊 Multiple series detected: ${seriesCount} series`);

          // Legend will paginate/hide at small sizes, so only adjust default
          if (seriesCount > 5) {
            const legendHeight = Math.min(80, seriesCount * 15);
            defaultHeight += legendHeight;
          }
        }

        // Check for long X-axis labels - only affects default size
        if (chartData.echarts_config?.xAxis?.data?.length > 0) {
          const labels = chartData.echarts_config.xAxis.data.map((label: any) =>
            String(label || '')
          );
          const maxLabelLength = Math.max(...labels.map((label) => label.length));

          // Only adjust default, not minimum - labels will truncate at small sizes
          if (maxLabelLength > 15) {
            const extraHeight = Math.min(60, (maxLabelLength - 15) * 3);
            defaultHeight += extraHeight;
          }
        }

        // Y-axis values don't need to inflate minimum - they adapt
        break;

      case 'pie':
        console.log(`🔍 Analyzing pie chart data:`, {
          hasEchartsConfig: !!chartData.echarts_config,
          hasSeries: !!chartData.echarts_config?.series,
          hasData: !!chartData.echarts_config?.series?.[0]?.data,
        });

        // Analyze pie charts - only inflate DEFAULT size, keep minimum small
        // Legend will paginate/hide at small sizes (responsive legend system)
        if (chartData.echarts_config?.series?.[0]?.data) {
          const segments = chartData.echarts_config.series[0].data.length;
          console.log(`🥧 Pie chart has ${segments} segments`);

          // Only adjust default size for many segments
          if (segments > 8) {
            const extraSize = Math.min(100, segments * 10);
            defaultWidth += extraSize;
            defaultHeight += extraSize;
          }
        }
        break;

      case 'table':
        console.log(`🔍 Analyzing table chart data:`, {
          columns: chartData.columns?.length,
          dataRows: chartData.data?.length,
          hasColumns: !!chartData.columns,
          hasData: !!chartData.data,
        });

        // Tables are scrollable, so only inflate DEFAULT size, not minimum
        // This allows compact table views with horizontal/vertical scroll
        if (chartData.columns && Array.isArray(chartData.columns)) {
          const columnCount = chartData.columns.length;

          // Only inflate default size for many columns
          if (columnCount > 4) {
            const extraWidth = Math.min(300, (columnCount - 4) * 60);
            defaultWidth += extraWidth;
          }
        }

        if (chartData.data && Array.isArray(chartData.data)) {
          const rowCount = chartData.data.length;

          // Only inflate default height for many rows
          if (rowCount > 10) {
            const extraHeight = Math.min(150, (rowCount - 10) * 10);
            defaultHeight += extraHeight;
          }
        }
        break;

      case 'number':
        console.log(`🔍 Analyzing number chart data:`, {
          hasEchartsConfig: !!chartData.echarts_config,
          hasSeries: !!chartData.echarts_config?.series,
          hasTitle: !!chartData.echarts_config?.title,
        });

        // Analyze number cards based on value and label length
        let numberValue = '';
        let numberLabel = '';

        if (chartData.echarts_config?.series?.[0]?.data?.[0]) {
          const dataPoint = chartData.echarts_config.series[0].data[0];
          numberValue = String(
            typeof dataPoint === 'object' ? dataPoint.value || '' : dataPoint || ''
          );
        }

        if (chartData.echarts_config?.title?.text) {
          numberLabel = chartData.echarts_config.title.text;
        }

        console.log(`📊 Number card content:`, {
          numberValue,
          numberLabel,
          valueLength: numberValue.length,
          labelLength: numberLabel.length,
        });

        // More sophisticated sizing for number cards
        // Base: 320x420 already accounts for basic title + number + padding

        // Ensure adequate height for large numbers (they need big font sizes)
        if (numberValue.length > 4) {
          // Large numbers need extra height for proper display
          const extraHeight = Math.min(100, (numberValue.length - 4) * 15); // 15px per extra digit
          minHeight = Math.max(minHeight, minHeight + extraHeight);
          defaultHeight = Math.max(defaultHeight, defaultHeight + extraHeight);

          console.log(`📏 Added height for large number (${numberValue.length} digits):`, {
            numberValue,
            extraHeight,
            newMinHeight: minHeight,
            newDefaultHeight: defaultHeight,
          });
        }

        // Adjust width based on number length (large numbers need more width)
        if (numberValue.length > 6) {
          const extraWidth = (numberValue.length - 6) * 12; // 12px per extra digit/character
          minWidth = Math.max(minWidth, minWidth + extraWidth);
          defaultWidth = Math.max(defaultWidth, defaultWidth + extraWidth);
        }

        // Adjust dimensions based on label length
        if (numberLabel.length > 20) {
          const extraWidth = Math.min(80, (numberLabel.length - 20) * 3); // 3px per extra char, cap at 80px
          minWidth = Math.max(minWidth, minWidth + extraWidth);
          defaultWidth = Math.max(defaultWidth, defaultWidth + extraWidth);
        }

        if (numberLabel.length > 40) {
          // Very long labels need more height for word wrapping
          const extraHeight = 60; // Increased from 40px
          minHeight = Math.max(minHeight, minHeight + extraHeight);
          defaultHeight = Math.max(defaultHeight, defaultHeight + extraHeight);
        }

        console.log(`📐 Number card sizing:`, {
          numberValue,
          numberLabel,
          finalMinWidth: minWidth,
          finalMinHeight: minHeight,
          finalDefaultWidth: defaultWidth,
          finalDefaultHeight: defaultHeight,
        });
        break;

      case 'map':
        // Maps always need substantial space - keep current large minimums
        break;

      default:
        // For unknown chart types, try to analyze echarts config
        if (chartData.echarts_config) {
          // Check for complex visualizations that need more space
          if (chartData.echarts_config.legend) {
            minHeight += 40;
            defaultHeight += 50;
          }

          if (chartData.echarts_config.dataZoom) {
            minHeight += 50;
            defaultHeight += 60;
          }
        }
        break;
    }
  } catch (error) {
    console.warn('Error analyzing chart content for sizing:', error);
    // Return base constraints if analysis fails
    return baseConstraints;
  }

  // Final validation and logging
  const finalConstraints = {
    minWidth: Math.max(minWidth, baseConstraints.minWidth),
    minHeight: Math.max(minHeight, baseConstraints.minHeight),
    defaultWidth: Math.max(defaultWidth, baseConstraints.defaultWidth),
    defaultHeight: Math.max(defaultHeight, baseConstraints.defaultHeight),
  };

  console.log(`✅ Content analysis complete for ${chartType}:`, {
    chartType,
    baseConstraints,
    calculatedConstraints: { minWidth, minHeight, defaultWidth, defaultHeight },
    finalConstraints,
    hasData: !!chartData,
    analysisIncrease: {
      minWidth: finalConstraints.minWidth - baseConstraints.minWidth,
      minHeight: finalConstraints.minHeight - baseConstraints.minHeight,
      defaultWidth: finalConstraints.defaultWidth - baseConstraints.defaultWidth,
      defaultHeight: finalConstraints.defaultHeight - baseConstraints.defaultHeight,
    },
  });

  return finalConstraints;
}

/**
 * Get content-aware grid dimensions for a chart
 * Converts pixel-based constraints to grid units with detailed logging
 */
export function getContentAwareGridDimensions(
  chartData: any,
  chartType: string,
  isDefault: boolean = false
): GridDimensions {
  console.log(
    `🔧 Getting content-aware grid dimensions for ${chartType} (${isDefault ? 'default' : 'minimum'} size)`
  );

  const contentConstraints = analyzeChartContent(chartData, chartType);

  // Add padding buffer to ensure charts have breathing room
  const paddingBuffer = isDefault ? 20 : 10; // More padding for default sizes

  const targetWidth =
    (isDefault ? contentConstraints.defaultWidth : contentConstraints.minWidth) + paddingBuffer;
  const targetHeight =
    (isDefault ? contentConstraints.defaultHeight : contentConstraints.minHeight) + paddingBuffer;

  console.log(`🎯 Target dimensions for ${chartType}:`, {
    targetWidth: `${targetWidth}px`,
    targetHeight: `${targetHeight}px`,
    sizeType: isDefault ? 'default' : 'minimum',
    gridConfig: GRID_CONFIG,
  });

  // Calculate grid units with detailed logging
  const rawGridW = pixelsToGridUnits(targetWidth, true);
  const rawGridH = pixelsToGridUnits(targetHeight, false);

  // Chart-type-specific minimum grid dimensions - very flexible for user control
  // Charts can be made very small - content (legends, labels) will scale responsively
  const chartTypeMinimums = {
    number: { minW: 1, minH: 1 }, // Number cards can be very compact
    pie: { minW: 1, minH: 1 }, // Pie charts - legend scales with size
    bar: { minW: 1, minH: 2 }, // Bar charts - axes adapt
    line: { minW: 1, minH: 2 }, // Line charts - axes adapt
    table: { minW: 1, minH: 2 }, // Tables - scrollable
    map: { minW: 1, minH: 2 }, // Maps - legend scales with size
    default: { minW: 1, minH: 1 }, // Flexible default
  };

  const typeMinimums = chartTypeMinimums[chartType] || chartTypeMinimums.default;

  // For default sizing, ALWAYS use STANDARD_DEFAULT_SIZE for consistent square charts
  // Content analysis is ignored for defaults - users can resize after adding if needed
  // For minimum sizing, use the chart-type-specific minimums
  if (isDefault) {
    return {
      w: STANDARD_DEFAULT_SIZE.w,
      h: STANDARD_DEFAULT_SIZE.h,
    };
  }

  const finalGridW = Math.max(typeMinimums.minW, Math.min(GRID_CONFIG.cols, rawGridW));
  const finalGridH = Math.max(typeMinimums.minH, rawGridH);

  // Calculate actual pixel dimensions that will result from grid units
  const actualPixelWidth = finalGridW * ((1200 - 130) / GRID_CONFIG.cols);
  const actualPixelHeight = finalGridH * GRID_CONFIG.rowHeight;

  console.log(`📐 Grid conversion for ${chartType}:`, {
    pixelInput: { width: targetWidth, height: targetHeight },
    rawGridUnits: { w: rawGridW, h: rawGridH },
    typeMinimums: typeMinimums,
    finalGridUnits: { w: finalGridW, h: finalGridH },
    minimumEnforced: {
      width: finalGridW > rawGridW,
      height: finalGridH > rawGridH,
    },
    actualPixelResult: {
      width: Math.round(actualPixelWidth),
      height: Math.round(actualPixelHeight),
    },
    sizingAdequate: {
      width: actualPixelWidth >= (targetWidth - paddingBuffer) * 0.9,
      height: actualPixelHeight >= (targetHeight - paddingBuffer) * 0.9,
    },
    gridUtilization: {
      widthPct: Math.round((finalGridW / GRID_CONFIG.cols) * 100),
      heightUnits: finalGridH,
    },
  });

  // Warn if the grid conversion resulted in significantly smaller dimensions
  if (actualPixelWidth < targetWidth * 0.8 || actualPixelHeight < targetHeight * 0.8) {
    console.warn(`⚠️  Grid conversion may result in too small dimensions for ${chartType}:`, {
      requested: { width: targetWidth, height: targetHeight },
      actual: { width: Math.round(actualPixelWidth), height: Math.round(actualPixelHeight) },
      shortfall: {
        width: Math.round(targetWidth - actualPixelWidth),
        height: Math.round(targetHeight - actualPixelHeight),
      },
    });
  }

  return {
    w: finalGridW,
    h: finalGridH,
  };
}

/**
 * Calculate text dimensions based on content and styling
 * Returns pixel dimensions needed to display text without clipping
 */
export function calculateTextDimensions(config: {
  content: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  type: 'paragraph' | 'heading';
  textAlign: 'left' | 'center' | 'right';
}): { width: number; height: number } {
  const { content, fontSize, fontWeight, type } = config;

  // Return minimum dimensions for empty content
  if (!content || content.trim() === '') {
    // For empty textboxes, provide space for default placeholder text
    // "Click to add text..." at default font size, or user's chosen font size
    const placeholderContent = 'Click to add text...';
    const placeholderWidth = placeholderContent.length * fontSize * 0.6 + 40; // Account for placeholder

    return {
      width: Math.max(250, placeholderWidth), // Minimum empty textbox width to fit placeholder
      height: 180, // Always use the default textbox height (same as when first added)
    };
  }

  // Calculate character width multiplier based on font properties
  const baseCharWidth = fontSize * 0.6; // Approximate character width in pixels
  const weightMultiplier = fontWeight === 'bold' ? 1.1 : 1.0;
  const charWidth = baseCharWidth * weightMultiplier;

  // Split content into lines and calculate dimensions for each line
  const lines = content.split('\n');
  const maxLineLength = Math.max(...lines.map((line) => line.length));

  // Calculate width needed for the longest line
  const contentWidth = maxLineLength * charWidth;

  // Add padding for text container (40px total: 20px each side)
  const totalWidth = Math.max(200, contentWidth + 40);

  // Calculate height based on number of lines and font size
  const lineHeight = type === 'heading' ? fontSize * 1.2 : fontSize * 1.5;
  const contentHeight = lines.length * lineHeight;

  // Add padding for text container (40px total: 20px top/bottom)
  const totalHeight = Math.max(120, contentHeight + 40);

  return {
    width: Math.ceil(totalWidth),
    height: Math.max(Math.ceil(totalHeight), 180), // Enforce absolute minimum height of 180px (default textbox height)
  };
}

/**
 * Get minimum grid dimensions for text content with dynamic sizing
 * Calculates based on actual text content, font size, and formatting
 */
export function getTextGridDimensions(textConfig: {
  content: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  type: 'paragraph' | 'heading';
  textAlign: 'left' | 'center' | 'right';
}): { min: GridDimensions; default: GridDimensions } {
  const textDimensions = calculateTextDimensions(textConfig);

  // Convert to grid units
  const minGridW = Math.max(1, pixelsToGridUnits(textDimensions.width, true));
  const minGridH = Math.max(1, pixelsToGridUnits(textDimensions.height, false));

  // Default size is 25% larger than minimum for better editing experience
  const defaultGridW = Math.max(minGridW, Math.ceil(minGridW * 1.25));
  const defaultGridH = Math.max(minGridH, Math.ceil(minGridH * 1.25));

  return {
    min: { w: minGridW, h: minGridH },
    default: { w: Math.min(defaultGridW, GRID_CONFIG.cols), h: defaultGridH },
  };
}

/**
 * Get chart type from component config
 */
export function getChartTypeFromConfig(config: any): string {
  // Handle different component types
  if (config.componentType === 'text') {
    return 'text';
  }

  // Check for chart type in config
  if (config.chartType) {
    return config.chartType;
  }

  // Check for chart_type (alternate format)
  if (config.chart_type) {
    return config.chart_type;
  }

  // If has chartId but no type, assume it's a chart but use default sizing
  if (config.chartId) {
    return 'default';
  }

  // For text content configs
  if (config.content !== undefined || config.type === 'paragraph') {
    return 'text';
  }

  // Fallback to default
  return 'default';
}
