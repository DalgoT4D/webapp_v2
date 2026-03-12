/**
 * Utilities for handling dynamic chart titles in dashboards
 */

export interface ChartTitleConfig {
  titleOverride?: string | null; // null = use original, empty string = no title, string = custom title
  showTitle?: boolean; // toggle title visibility
}

export interface ChartData {
  id: number;
  title: string;
  // ... other chart properties
}

/**
 * Resolves the effective title for a chart in a dashboard context
 * Priority: titleOverride > original chart title
 *
 * @param chartData - The original chart data
 * @param config - Dashboard component configuration
 * @returns The resolved title or null if no title should be shown
 */
export function resolveChartTitle(
  chartData: ChartData | null | undefined,
  config: ChartTitleConfig
): string | null {
  // If showTitle is explicitly false, don't show any title
  if (config.showTitle === false) {
    return null;
  }

  // Check for explicit override
  if (config.titleOverride !== undefined) {
    // titleOverride can be:
    // - null: use original chart title
    // - empty string: no title
    // - string: custom title
    if (config.titleOverride === null) {
      return chartData?.title || null;
    }
    return config.titleOverride; // Could be empty string or custom title
  }

  // Default to chart's original title
  return chartData?.title || null;
}

/**
 * Determines if a title is overridden (different from original)
 * @param chartData - The original chart data
 * @param config - Dashboard component configuration
 * @returns true if title is overridden
 */
export function isTitleOverridden(
  chartData: ChartData | null | undefined,
  config: ChartTitleConfig
): boolean {
  return config.titleOverride !== undefined;
}

/**
 * Gets the display value for title editing (handles null/empty cases)
 * @param chartData - The original chart data
 * @param config - Dashboard component configuration
 * @returns The value to show in the editor
 */
export function getTitleEditorValue(
  chartData: ChartData | null | undefined,
  config: ChartTitleConfig
): string {
  const resolvedTitle = resolveChartTitle(chartData, config);
  return resolvedTitle || '';
}

/**
 * Creates a title update configuration
 * @param newTitle - The new title value
 * @returns Configuration object for updating component
 */
export function createTitleUpdateConfig(newTitle: string | null): ChartTitleConfig {
  if (newTitle === null) {
    // Revert to original title
    return {
      titleOverride: undefined,
      showTitle: true,
    };
  }

  if (newTitle === '') {
    // Hide title
    return {
      titleOverride: '',
      showTitle: false,
    };
  }

  // Set custom title
  return {
    titleOverride: newTitle,
    showTitle: true,
  };
}
