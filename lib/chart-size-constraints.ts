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

// Grid configuration
export const GRID_CONFIG = {
  cols: 12,
  rowHeight: 60, // Height of one grid row in pixels
  margin: [10, 10] as [number, number],
} as const;

/**
 * Minimum chart size constraints by chart type
 * Based on typical content requirements for each visualization
 * IMPORTANT: These values account for title space (50px), axis labels (60-80px),
 * legends (40-60px), and chart content to ensure nothing is cut off
 */
export const CHART_SIZE_CONSTRAINTS: Record<string, ChartSizeConstraint> = {
  // Map charts need substantial space for geography and legends
  map: {
    minWidth: 500,
    minHeight: 450,
    defaultWidth: 650,
    defaultHeight: 550,
  },

  // Bar charts need space for axes labels and bars
  // Title: 60px, Y-axis: 100px, X-axis labels: 80px, content: 350px min
  bar: {
    minWidth: 500,
    minHeight: 480,
    defaultWidth: 650,
    defaultHeight: 580,
  },

  // Line charts need space for trend visualization
  // Title: 60px, Y-axis: 100px, X-axis labels: 80px, content: 350px min
  line: {
    minWidth: 500,
    minHeight: 480,
    defaultWidth: 650,
    defaultHeight: 580,
  },

  // Pie charts need substantial space for chart + legend
  // Title: 60px, chart: 320px, legend: 120px height = 500px minimum
  pie: {
    minWidth: 450,
    minHeight: 450,
    defaultWidth: 550,
    defaultHeight: 550,
  },

  // Tables need space for columns and rows
  // Title: 50px, headers: 40px, content rows: minimum 150px
  table: {
    minWidth: 400,
    minHeight: 280,
    defaultWidth: 600,
    defaultHeight: 400,
  },

  // Number cards need space for title and large numbers
  // Title: 60px, number: 120px, description: 50px, padding: 50px = 280px minimum
  // Width: accommodate long titles and large numbers
  number: {
    minWidth: 320,
    minHeight: 320,
    defaultWidth: 400,
    defaultHeight: 420,
  },

  // Text components are flexible but need minimum readability
  text: {
    minWidth: 200,
    minHeight: 120,
    defaultWidth: 350,
    defaultHeight: 180,
  },

  // Default fallback for unknown chart types
  default: {
    minWidth: 350,
    minHeight: 280,
    defaultWidth: 450,
    defaultHeight: 350,
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
    w: Math.max(2, pixelsToGridUnits(constraints.minWidth, true)), // Minimum 2 grid units width
    h: Math.max(2, pixelsToGridUnits(constraints.minHeight, false)), // Minimum 2 grid units height
  };
}

/**
 * Get default grid dimensions for a chart type
 */
export function getDefaultGridDimensions(chartType: string): GridDimensions {
  const constraints = CHART_SIZE_CONSTRAINTS[chartType] || CHART_SIZE_CONSTRAINTS.default;

  return {
    w: Math.min(GRID_CONFIG.cols, pixelsToGridUnits(constraints.defaultWidth, true)),
    h: pixelsToGridUnits(constraints.defaultHeight, false),
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
        if (chartData.echarts_config?.xAxis?.data) {
          const dataPoints = chartData.echarts_config.xAxis.data.length;
          console.log(`📊 Found ${dataPoints} data points in ${chartType} chart`);

          // More sophisticated width calculation based on data density
          // Base space: 500px minimum (title + axes + padding)
          // Per data point: 60px minimum for readability (increased from 45px)
          const contentWidth = Math.max(400, dataPoints * 60); // Content area only
          const totalMinWidth = contentWidth + 150; // Add space for Y-axis (100px) + padding (50px)
          const totalDefaultWidth = contentWidth + 200; // More generous spacing

          minWidth = Math.max(minWidth, totalMinWidth);
          defaultWidth = Math.max(defaultWidth, totalDefaultWidth);

          console.log(`📐 Width calculated for ${dataPoints} data points:`, {
            contentWidth,
            totalMinWidth,
            totalDefaultWidth,
            finalMinWidth: minWidth,
            finalDefaultWidth: defaultWidth,
          });
        }

        // Check for multiple series (affects legend space)
        if (chartData.echarts_config?.series?.length > 1) {
          const seriesCount = chartData.echarts_config.series.length;
          console.log(`📊 Multiple series detected: ${seriesCount} series`);

          // Legend needs space: approximately 25px per series + padding
          const legendHeight = Math.max(40, seriesCount * 25 + 20);
          minHeight += legendHeight;
          defaultHeight += legendHeight + 20;

          console.log(`📐 Height adjusted for legend (${seriesCount} series):`, {
            legendHeight,
            newMinHeight: minHeight,
            newDefaultHeight: defaultHeight,
          });
        }

        // Check for long X-axis labels
        if (chartData.echarts_config?.xAxis?.data?.length > 0) {
          const labels = chartData.echarts_config.xAxis.data.map((label: any) =>
            String(label || '')
          );
          const maxLabelLength = Math.max(...labels.map((label) => label.length));
          const avgLabelLength =
            labels.reduce((sum, label) => sum + label.length, 0) / labels.length;

          console.log(`📝 X-axis label analysis:`, {
            maxLabelLength,
            avgLabelLength,
            totalLabels: labels.length,
            sampleLabels: labels.slice(0, 3),
          });

          // If labels are long, they need rotation or more height
          if (maxLabelLength > 12 || avgLabelLength > 8) {
            const extraHeight = Math.min(120, maxLabelLength * 4); // Cap at 120px extra (increased)
            minHeight += extraHeight;
            defaultHeight += extraHeight + 20; // More generous padding

            console.log(`📐 Height adjusted for long X-axis labels:`, {
              extraHeight,
              reason: `max=${maxLabelLength}chars, avg=${avgLabelLength.toFixed(1)}chars`,
              newMinHeight: minHeight,
              newDefaultHeight: defaultHeight,
            });
          }
        }

        // Check Y-axis values for width requirements
        if (chartData.echarts_config?.series?.length > 0) {
          const allValues = chartData.echarts_config.series.flatMap((s: any) => s.data || []);
          if (allValues.length > 0) {
            const maxValue = Math.max(
              ...allValues.map((v: any) => (typeof v === 'object' ? v.value || 0 : v || 0))
            );
            const valueLength = Math.max(6, String(Math.round(maxValue)).length); // Minimum 6 chars for formatting

            if (valueLength > 6) {
              // Lowered threshold from 8 to 6
              const extraWidth = (valueLength - 6) * 12; // 12px per extra character (increased from 8px)
              minWidth += extraWidth;
              defaultWidth += extraWidth;

              console.log(`📐 Width adjusted for large Y-axis values:`, {
                maxValue,
                valueLength,
                extraWidth,
                newMinWidth: minWidth,
                newDefaultWidth: defaultWidth,
              });
            }
          }
        }
        break;

      case 'pie':
        console.log(`🔍 Analyzing pie chart data:`, {
          hasEchartsConfig: !!chartData.echarts_config,
          hasSeries: !!chartData.echarts_config?.series,
          hasData: !!chartData.echarts_config?.series?.[0]?.data,
        });

        // Analyze pie charts based on segments and legend
        if (chartData.echarts_config?.series?.[0]?.data) {
          const segments = chartData.echarts_config.series[0].data.length;
          console.log(`🥧 Pie chart has ${segments} segments`);

          // More segments need more legend space (both width AND height)
          if (segments > 4) {
            const extraWidth = Math.min(150, segments * 20); // 20px per segment, max 150px
            const extraHeight = Math.min(120, segments * 15); // 15px per segment, max 120px

            minWidth += extraWidth;
            defaultWidth += extraWidth + 30;
            minHeight += extraHeight;
            defaultHeight += extraHeight + 40;

            console.log(`📐 Added space for ${segments} segments:`, {
              extraWidth,
              extraHeight,
              newMinWidth: minWidth,
              newMinHeight: minHeight,
            });
          }

          // Check for long labels (affects both width and height)
          const maxLabelLength = Math.max(
            ...chartData.echarts_config.series[0].data.map((item: any) => item.name?.length || 0)
          );
          if (maxLabelLength > 15) {
            const extraWidth = Math.min(100, (maxLabelLength - 15) * 4);
            const extraHeight = 60; // Long labels need more vertical space for legend

            minWidth += extraWidth;
            defaultWidth += extraWidth + 20;
            minHeight += extraHeight;
            defaultHeight += extraHeight + 20;

            console.log(`📝 Added space for long labels (max: ${maxLabelLength} chars):`, {
              extraWidth,
              extraHeight,
              newMinWidth: minWidth,
              newMinHeight: minHeight,
            });
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

        // Analyze tables based on columns and data
        if (chartData.columns && Array.isArray(chartData.columns)) {
          const columnCount = chartData.columns.length;
          console.log(`📊 Table has ${columnCount} columns:`, chartData.columns.slice(0, 3));

          // More sophisticated width calculation for tables
          // Base width: title (50px) + border/padding (40px) = 90px
          // Per column: minimum 140px for readability (header + content)
          const baseWidth = 90;
          const perColumnWidth = Math.max(140, 160); // Generous column width
          const calculatedMinWidth = baseWidth + columnCount * 140;
          const calculatedDefaultWidth = baseWidth + columnCount * perColumnWidth;

          // Cap maximum width to avoid overly wide tables
          const maxTableWidth = 1000;
          minWidth = Math.max(minWidth, Math.min(calculatedMinWidth, maxTableWidth));
          defaultWidth = Math.max(defaultWidth, Math.min(calculatedDefaultWidth, maxTableWidth));

          console.log(`📐 Width calculated for ${columnCount} columns:`, {
            baseWidth,
            perColumnWidth,
            calculatedMinWidth,
            calculatedDefaultWidth,
            finalMinWidth: minWidth,
            finalDefaultWidth: defaultWidth,
            capped: calculatedDefaultWidth > maxTableWidth,
          });
        }

        if (chartData.data && Array.isArray(chartData.data)) {
          const rowCount = chartData.data.length;
          console.log(`📊 Table has ${rowCount} rows`);

          // Height calculation: title (50px) + header (40px) + rows + padding
          const baseHeight = 110; // Title + header + padding
          const rowHeight = 35; // Per data row
          const calculatedMinHeight = baseHeight + Math.min(rowCount * rowHeight, 350); // Cap at ~10 rows visible
          const calculatedDefaultHeight = baseHeight + Math.min(rowCount * rowHeight, 450); // Cap at ~13 rows visible

          minHeight = Math.max(minHeight, calculatedMinHeight);
          defaultHeight = Math.max(defaultHeight, calculatedDefaultHeight);

          console.log(`📐 Height calculated for ${rowCount} rows:`, {
            baseHeight,
            rowHeight,
            calculatedMinHeight,
            calculatedDefaultHeight,
            finalMinHeight: minHeight,
            finalDefaultHeight: defaultHeight,
            visibleRows: Math.floor((calculatedDefaultHeight - baseHeight) / rowHeight),
          });
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

  // Chart-type-specific minimum grid dimensions to ensure usability
  // These are ABSOLUTE minimums - no chart should be smaller than this
  const chartTypeMinimums = {
    number: { minW: 5, minH: 8 }, // Number cards need much more height: title + large number
    pie: { minW: 6, minH: 9 }, // Pie charts need more height for chart + legends
    bar: { minW: 7, minH: 10 }, // Bar charts need more height for proper aspect ratio
    line: { minW: 7, minH: 10 }, // Line charts need more height for proper aspect ratio
    table: { minW: 6, minH: 5 }, // Tables need column space + title
    map: { minW: 7, minH: 7 }, // Maps need substantial space
    default: { minW: 5, minH: 5 }, // Conservative default with buffer
  };

  const typeMinimums = chartTypeMinimums[chartType] || chartTypeMinimums.default;

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
