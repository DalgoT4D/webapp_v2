/**
 * Process chart configuration to handle special features like label thresholds
 * This utility transforms backend chart configs to add dynamic formatter functions
 */

/**
 * Process ECharts configuration to add dynamic formatters and other frontend-specific logic
 * @param config - Raw ECharts configuration from backend
 * @returns Processed configuration ready for ECharts
 */
export function processChartConfig(config: any): any {
  if (!config) {
    return config;
  }

  // Create a deep copy to avoid mutating the original
  const processedConfig = JSON.parse(JSON.stringify(config));

  // Process series if it exists
  if (processedConfig.series && Array.isArray(processedConfig.series)) {
    processedConfig.series = processedConfig.series.map((series: any) => {
      // Handle pie chart label threshold
      if (series.type === 'pie' && series.label) {
        const labelThreshold = series.label.labelThreshold;
        const labelFormat = series.label.labelFormat;

        // Only apply formatter if threshold is defined and greater than 0
        if (labelThreshold !== undefined && labelThreshold > 0) {
          // Calculate total value for percentage calculations
          const totalValue =
            series.data?.reduce((sum: number, item: any) => sum + (item.value || 0), 0) || 1;

          // Modify each data item to have individual label and labelLine settings
          if (series.data && Array.isArray(series.data)) {
            series.data = series.data.map((item: any) => {
              const percentage = (item.value / totalValue) * 100;
              const showLabel = percentage >= labelThreshold;

              return {
                ...item,
                label: {
                  show: showLabel,
                  formatter: showLabel
                    ? labelFormat === 'percentage'
                      ? '{d}%'
                      : labelFormat === 'value'
                        ? '{c}'
                        : labelFormat === 'name_percentage'
                          ? '{b}\n{d}%'
                          : labelFormat === 'name_value'
                            ? '{b}\n{c}'
                            : '{d}%'
                    : '',
                },
                labelLine: {
                  show: showLabel,
                },
              };
            });
          }

          // Keep the series-level formatter as fallback but it won't be used for items with individual configs
          series.label.formatter = function (params: any) {
            if (params.percent < labelThreshold) {
              return '';
            }
            switch (labelFormat) {
              case 'percentage':
                return params.percent.toFixed(1) + '%';
              case 'value':
                return String(params.value);
              case 'name_value':
                return params.name + '\n' + params.value;
              case 'name_percentage':
                return params.name + '\n' + params.percent.toFixed(1) + '%';
              default:
                return params.percent.toFixed(1) + '%';
            }
          };
        } else if (labelThreshold === 0 || labelThreshold === undefined) {
          // No threshold or zero threshold - use default formatters
          // Keep the existing formatter string from backend if no threshold
          // This ensures backward compatibility
        }

        // Clean up custom properties that aren't valid ECharts options
        delete series.label.labelThreshold;
        delete series.label.labelFormat;
      }

      return series;
    });
  }

  return processedConfig;
}

/**
 * Check if a chart configuration needs processing
 * @param config - Chart configuration
 * @returns true if the config needs processing
 */
export function needsProcessing(config: any): boolean {
  if (!config || !config.series) {
    return false;
  }

  // Check if any series has custom properties that need processing
  return config.series.some((series: any) => {
    if (series.type === 'pie' && series.label) {
      return series.label.labelThreshold !== undefined;
    }
    return false;
  });
}
