import type { ChartBuilderFormData } from '@/types/charts';

/** An entry in the builder's sort-column picker. */
export interface SortOption {
  value: string;
  label: string;
  type: 'column' | 'metric';
  _uniqueId?: string;
}

/** Sort picker entries: the dimension, then every metric that has an alias (or the legacy metric). */
export function getSortOptions(config: ChartBuilderFormData): SortOption[] {
  const options: SortOption[] = [];
  if (config.dimension_column) {
    options.push({
      value: config.dimension_column,
      label: config.dimension_column,
      type: 'column',
    });
  }
  if (config.metrics && config.metrics.length > 0) {
    config.metrics.forEach((metric, metricIndex) => {
      if (metric.alias) {
        options.push({
          value: metric.alias,
          label: metric.alias,
          type: 'metric',
          _uniqueId: `metric-${metricIndex}-${metric.alias}`,
        });
      }
    });
  } else if (config.aggregate_column && config.aggregate_function) {
    const legacyAlias = `${config.aggregate_function}(${config.aggregate_column})`;
    options.push({ value: legacyAlias, label: legacyAlias, type: 'metric' });
  }
  return options;
}

/**
 * Columns a saved sort may keep pointing at. Differs from getSortOptions: an alias-less metric counts
 * as `agg(column)` here, so the sort-reset effect keeps a sort the picker can't show (shown as "None").
 */
export function getSortableColumns(config: ChartBuilderFormData): Set<string> {
  const sortable = new Set<string>();
  if (config.dimension_column) sortable.add(config.dimension_column);
  if (config.metrics?.length) {
    config.metrics.forEach((m) => sortable.add(m.alias || `${m.aggregation}(${m.column})`));
  } else if (config.aggregate_column && config.aggregate_function) {
    sortable.add(`${config.aggregate_function}(${config.aggregate_column})`);
  }
  return sortable;
}
