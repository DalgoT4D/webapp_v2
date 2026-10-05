import { ChartTypes, type ChartBuilderFormData, type ChartType } from '@/types/charts';
import { generateAutoPrefilledConfig } from '@/lib/chartAutoPrefill';
import { sanitizeCustomizationsForChartType } from '@/components/charts/chart-types/echarts/data-labels';
import { getDefaultCustomizations } from '@/components/charts/chart-types/default-customizations';

/** A partial chart config to merge over the current one. */
export type ChartConfigPatch = Partial<ChartBuilderFormData>;

/** A warehouse column as the data-config panels normalise it. */
export interface BuilderColumn {
  name: string;
  column_name: string;
  data_type: string;
}

type ConfigRecord = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Pass 1 — the data-config panel's switch (both builders, non-map sources)
// Adapted from ChartDataConfigurationV3.handleChartTypeChange (logic unchanged; the dev-only
// console.log was dropped and a couple of array literals were given explicit types).
// ---------------------------------------------------------------------------

const PIVOT_RESET_EXTRA_CONFIG = {
  row_dimensions: [] as string[],
  column_dimensions: [] as string[],
  show_row_subtotals: false,
  show_column_subtotals: false,
  show_row_grand_total: false,
  show_column_grand_total: false,
  row_subtotal_label: 'Subtotal',
  column_subtotal_label: 'Subtotal',
  row_grand_total_label: 'Grand Total',
  column_grand_total_label: 'Grand Total',
};

function numberFields(prev: ChartBuilderFormData): ChartConfigPatch {
  return {
    aggregate_column: prev.aggregate_column,
    aggregate_function: prev.aggregate_function,
    x_axis_column: null,
    y_axis_column: null,
    dimension_column: null,
    extra_dimension_column: null,
    metrics: prev.metrics && prev.metrics.length > 0 ? [prev.metrics[0]] : [],
  } as ChartConfigPatch;
}

function pieFields(prev: ChartBuilderFormData): ChartConfigPatch {
  return {
    x_axis_column: prev.x_axis_column,
    y_axis_column: null,
    // PINNED-BUGS: "Number/pivot → bar/line/pie … X empty" (prev.dimension_column is already unset)
    dimension_column: prev.dimension_column,
    aggregate_column: prev.aggregate_column,
    aggregate_function: prev.aggregate_function,
    extra_dimension_column: prev.extra_dimension_column,
    metrics: prev.metrics && prev.metrics.length > 0 ? [prev.metrics[0]] : prev.metrics,
    computation_type: prev.computation_type || 'aggregated',
  } as ChartConfigPatch;
}

function barLineFields(prev: ChartBuilderFormData): ChartConfigPatch {
  return {
    x_axis_column: prev.x_axis_column,
    y_axis_column: prev.y_axis_column,
    // PINNED-BUGS: "Number/pivot → bar/line/pie … X empty" (prev.dimension_column is already unset)
    dimension_column: prev.dimension_column,
    aggregate_column: prev.aggregate_column,
    aggregate_function: prev.aggregate_function,
    extra_dimension_column: prev.extra_dimension_column,
    metrics: prev.metrics,
    computation_type: prev.computation_type || 'aggregated',
  };
}

function pivotFields(prev: ChartBuilderFormData): ChartConfigPatch {
  return {
    computation_type: 'aggregated',
    metrics: prev.metrics,
    // PINNED-BUGS: "Any → pivot … rows/cols reset to empty → Save disabled"
    extra_config: { ...(prev.extra_config || {}), ...PIVOT_RESET_EXTRA_CONFIG },
  };
}

function tableFields(prev: ChartBuilderFormData): ChartConfigPatch {
  return {
    computation_type: prev.computation_type || 'aggregated',
    x_axis_column: prev.x_axis_column,
    y_axis_column: null,
    dimension_column: prev.dimension_column,
    aggregate_column: prev.aggregate_column,
    aggregate_function: prev.aggregate_function,
    extra_dimension_column: prev.extra_dimension_column,
    metrics: prev.metrics,
  } as ChartConfigPatch;
}

function mapFields(prev: ChartBuilderFormData): ChartConfigPatch {
  return {
    computation_type: prev.computation_type || 'aggregated',
    ...(prev.metrics && prev.metrics.length > 0 && { metrics: [prev.metrics[0]] }),
    ...(prev.geographic_column && { geographic_column: prev.geographic_column }),
    ...(prev.value_column && { value_column: prev.value_column }),
    ...(prev.aggregate_column && { aggregate_column: prev.aggregate_column }),
    ...(prev.aggregate_function && { aggregate_function: prev.aggregate_function }),
    x_axis_column: null,
    y_axis_column: null,
    dimension_column: null,
    extra_dimension_column: null,
  } as ChartConfigPatch;
}

/** Fields each target type keeps from (or clears on) the source chart. Unknown types keep nothing. */
const TARGET_TYPE_FIELDS: Record<string, (prev: ChartBuilderFormData) => ChartConfigPatch> = {
  [ChartTypes.NUMBER]: numberFields,
  [ChartTypes.PIE]: pieFields,
  [ChartTypes.BAR]: barLineFields,
  [ChartTypes.LINE]: barLineFields,
  [ChartTypes.PIVOT_TABLE]: pivotFields,
  [ChartTypes.TABLE]: tableFields,
  [ChartTypes.MAP]: mapFields,
};

/**
 * The patch the data-config panel applies when the user picks another chart type:
 * auto-prefill for the new type, then the fields the new type keeps, then the shared settings.
 * `columns` are the dataset's normalised columns (empty while loading → no auto-prefill).
 */
export function applyChartTypeChange(
  prev: ChartBuilderFormData,
  nextType: string,
  columns: BuilderColumn[]
): ChartConfigPatch {
  const autoPrefilled =
    columns.length > 0 ? generateAutoPrefilledConfig(nextType as ChartType, columns) : {};
  const typeFields = TARGET_TYPE_FIELDS[nextType]?.(prev) ?? {};

  return {
    title: prev.title,
    schema_name: prev.schema_name,
    table_name: prev.table_name,
    chart_type: nextType as ChartType,
    ...autoPrefilled, // PINNED-BUGS: "Any → table takes dimension from auto-prefill (id)"
    ...typeFields,
    filters: prev.filters,
    // PINNED-BUGS: "Create: bar/line/pie → map then Save fails (422)" — only dataLabelPosition is fixed
    customizations: sanitizeCustomizationsForChartType(prev.customizations, nextType),
    sort: prev.sort,
    pagination: prev.pagination,
  };
}

// ---------------------------------------------------------------------------
// Pass 2 — the edit page's own switch, applied on top of pass 1
// Adapted from the edit page's handleFormChange (logic unchanged).
// ---------------------------------------------------------------------------

const AGGREGATED_CHART_TYPES: string[] = [
  ChartTypes.BAR,
  ChartTypes.LINE,
  ChartTypes.PIE,
  ChartTypes.NUMBER,
];

function legacyComputationType(prev: ChartBuilderFormData, newType: string) {
  const alwaysAggregated: string[] = [ChartTypes.NUMBER, ChartTypes.MAP, ChartTypes.TABLE];
  return alwaysAggregated.includes(newType) ? 'aggregated' : prev.computation_type || 'aggregated';
}

/** Map/table source → bar/line/pie/number. PINNED-BUGS: "Edit: table → others … id / country". */
function legacyToAggregatedFields(prev: ChartBuilderFormData, oldType: string): ConfigRecord {
  const fields: ConfigRecord = {};
  if (oldType === ChartTypes.MAP) {
    if (prev.geographic_column) fields.dimension_column = prev.geographic_column;
    if (prev.value_column) fields.aggregate_column = prev.value_column;
    if (prev.aggregate_function) fields.aggregate_function = prev.aggregate_function;
  } else if (oldType === ChartTypes.TABLE && prev.table_columns?.length > 0) {
    if (prev.table_columns[0]) fields.dimension_column = prev.table_columns[0];
    if (prev.table_columns[1]) fields.aggregate_column = prev.table_columns[1];
    fields.aggregate_function = prev.aggregate_function || 'sum';
  }
  return fields;
}

/** → map. PINNED-BUGS: "Edit: bar/line → map keeps 2 metric rows". */
function legacyToMapFields(prev: ChartBuilderFormData, oldType: string): ConfigRecord {
  const fields: ConfigRecord = {};
  if (AGGREGATED_CHART_TYPES.includes(oldType)) {
    if (prev.dimension_column) fields.geographic_column = prev.dimension_column;
    if (prev.aggregate_column) fields.value_column = prev.aggregate_column;
    if (prev.aggregate_function) fields.aggregate_function = prev.aggregate_function;
    if (prev.metrics) fields.metrics = prev.metrics;
  } else if (oldType === ChartTypes.TABLE && prev.table_columns?.length > 0) {
    if (prev.table_columns[0]) fields.geographic_column = prev.table_columns[0];
    if (prev.table_columns[1]) fields.value_column = prev.table_columns[1];
    fields.aggregate_function = prev.aggregate_function || 'sum';
  }
  return fields;
}

/** → table: table_columns rebuilt from the source's columns. */
function legacyToTableFields(prev: ChartBuilderFormData, oldType: string): ConfigRecord {
  const fields: ConfigRecord = {};
  const tableColumns: string[] = [];
  if (AGGREGATED_CHART_TYPES.includes(oldType)) {
    let dimensionForTable: string | null = null;
    if (prev.dimension_column && prev.dimension_column !== 'undefined') {
      dimensionForTable = prev.dimension_column;
    } else if (prev.x_axis_column && prev.x_axis_column !== 'undefined') {
      dimensionForTable = prev.x_axis_column;
    }
    if (dimensionForTable) {
      tableColumns.push(dimensionForTable);
      fields.x_axis_column = dimensionForTable;
    }
    if (prev.aggregate_column && prev.aggregate_column !== prev.dimension_column) {
      tableColumns.push(prev.aggregate_column);
    }
    prev.metrics?.forEach((metric) => {
      if (metric.column && !tableColumns.includes(metric.column)) tableColumns.push(metric.column);
    });
  } else if (oldType === ChartTypes.MAP) {
    if (prev.geographic_column) {
      tableColumns.push(prev.geographic_column);
      fields.x_axis_column = prev.geographic_column;
    }
    if (prev.value_column && prev.value_column !== prev.geographic_column) {
      tableColumns.push(prev.value_column);
    }
  }
  if (tableColumns.length > 0) fields.table_columns = tableColumns;
  return fields;
}

function legacyColumnMapping(prev: ChartBuilderFormData, newType: string): ConfigRecord {
  const oldType = prev.chart_type;
  if (!oldType || oldType === newType) return {};
  if (AGGREGATED_CHART_TYPES.includes(newType)) return legacyToAggregatedFields(prev, oldType);
  if (newType === ChartTypes.MAP) return legacyToMapFields(prev, oldType);
  if (newType === ChartTypes.TABLE) return legacyToTableFields(prev, oldType);
  return {};
}

/**
 * PINNED-BUGS: "Edit: every switch resets styling to target defaults (keeps only tooltip/legend/labels
 * on-off, titles, raw label position)" and "Edit: bar↔line, line→pie, pie→line then Save fails (422)" —
 * reads the PRE-switch customizations, so pass 1's sanitized label position is overwritten.
 */
function legacyCustomizations(prev: ChartBuilderFormData, newType: string): ConfigRecord {
  const existing = (prev.customizations || {}) as ConfigRecord;
  const newDefaults = getDefaultCustomizations(newType, 'edit');
  const preserved: ConfigRecord = {};
  ['showTooltip', 'showLegend', 'showDataLabels'].forEach((field) => {
    if (field in existing && field in newDefaults) preserved[field] = existing[field];
  });
  ['xAxisTitle', 'yAxisTitle', 'subtitle'].forEach((field) => {
    if ((existing[field] as string | undefined)?.trim()) preserved[field] = existing[field];
  });
  if (existing.dataLabelPosition && newDefaults.dataLabelPosition) {
    preserved.dataLabelPosition = existing.dataLabelPosition;
  }
  return { ...newDefaults, ...preserved };
}

/**
 * The edit page's second pass. Runs on EVERY patch the edit page receives: a patch that changes
 * chart_type is re-derived from the pre-switch config; any other patch is merged as is.
 * PINNED-BUGS: see TYPE-SWITCH-BEHAVIOR.md "Edit builder".
 */
export function legacyEditPageTypeSwitch(
  prev: ChartBuilderFormData,
  patch: ChartConfigPatch
): ChartBuilderFormData {
  const newType = patch.chart_type;
  if (!newType || newType === prev.chart_type) return { ...prev, ...patch };

  return {
    ...prev,
    ...patch,
    computation_type: legacyComputationType(prev, newType),
    ...legacyColumnMapping(prev, newType),
    customizations: legacyCustomizations(prev, newType),
  };
}
