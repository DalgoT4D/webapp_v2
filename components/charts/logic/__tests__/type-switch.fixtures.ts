import type { ChartBuilderFormData, ChartMetric } from '@/types/charts';
import type { BuilderColumn } from '@/components/charts/logic/type-switch';

/**
 * The E2E type-switch matrix dataset (production.mart_education_program), reduced to the columns
 * the specs touch, in warehouse order. id/country are text, so auto-prefill picks `id` first.
 */
export const COLUMNS: BuilderColumn[] = [
  ['id', 'character varying'],
  ['country', 'character varying'],
  ['statename', 'character varying'],
  ['districtname', 'character varying'],
  ['districtcode', 'character varying'],
  ['date', 'date'],
  ['students', 'bigint'],
  ['male_score', 'numeric'],
  ['climate_event', 'character varying'],
].map(([name, data_type]) => ({ name, column_name: name, data_type }));

const SUM_STUDENTS: ChartMetric = {
  aggregation: 'sum',
  alias: 'SUM(students)',
  column: 'students',
};
const AVG_SCORE: ChartMetric = {
  aggregation: 'avg',
  alias: 'AVG(male_score)',
  column: 'male_score',
};
const TWO_METRICS = [SUM_STUDENTS, AVG_SCORE];

const BASE: ChartBuilderFormData = {
  title: 'T',
  schema_name: 'production',
  table_name: 'mart_education_program',
  computation_type: 'aggregated',
};

/** Fully configured sources, as each builder holds them (see e2e/charts/helpers-switch.ts). */
const SOURCES: Record<string, ChartBuilderFormData> = {
  bar: {
    ...BASE,
    chart_type: 'bar',
    aggregate_function: 'count',
    dimension_column: 'statename',
    extra_dimension_column: 'climate_event',
    metrics: TWO_METRICS,
    customizations: {
      dataLabelPosition: 'inside',
      legendPosition: 'bottom',
      orientation: 'vertical',
      showDataLabels: true,
      showLegend: true,
      showTooltip: true,
      stacked: false,
      xAxisLabelRotation: '45',
      xAxisTitle: '',
      yAxisLabelRotation: 'horizontal',
      yAxisTitle: '',
    },
  },
  line: {
    ...BASE,
    chart_type: 'line',
    aggregate_function: 'count',
    dimension_column: 'statename',
    extra_dimension_column: 'climate_event',
    metrics: TWO_METRICS,
    customizations: {
      dataLabelPosition: 'bottom',
      legendPosition: 'bottom',
      lineStyle: 'smooth',
      showDataLabels: true,
      showDataPoints: true,
      showLegend: true,
      showTooltip: true,
      xAxisLabelRotation: 'horizontal',
      xAxisTitle: '',
      yAxisLabelRotation: 'horizontal',
      yAxisTitle: '',
    },
  },
  pie: {
    ...BASE,
    chart_type: 'pie',
    aggregate_function: 'count',
    dimension_column: 'statename',
    extra_dimension_column: 'climate_event',
    metrics: [SUM_STUDENTS],
    customizations: {
      chartStyle: 'donut',
      dataLabelPosition: 'inside',
      labelFormat: 'percentage',
      legendPosition: 'bottom',
      showDataLabels: true,
      showLegend: true,
      showTooltip: true,
    },
  },
  number: {
    ...BASE,
    chart_type: 'number',
    aggregate_column: 'students',
    aggregate_function: 'sum',
    metrics: [SUM_STUDENTS],
    customizations: {
      decimalPlaces: 0,
      numberFormat: 'default',
      numberPrefix: '~',
      numberSize: 'medium',
      numberSuffix: '',
      subtitle: 'Across all states',
    },
  },
  map: {
    ...BASE,
    chart_type: 'map',
    aggregate_column: 'students',
    aggregate_function: 'sum',
    geographic_column: 'statename',
    value_column: 'students',
    selected_geojson_id: 35,
    metrics: [SUM_STUDENTS],
    customizations: {
      colorScheme: 'Greens',
      nullValueLabel: 'No Data',
      showLegend: true,
      showTooltip: true,
      title: '',
    },
  },
  table: {
    ...BASE,
    chart_type: 'table',
    aggregate_function: 'count',
    dimension_column: 'statename',
    dimension_columns: ['statename', 'districtname'],
    dimensions: [
      { column: 'statename', enable_drill_down: true },
      { column: 'districtname', enable_drill_down: true },
    ],
    metrics: TWO_METRICS,
    table_columns: ['id', 'country', 'statename', 'districtname', 'districtcode', 'date'],
    customizations: {},
  },
  pivot_table: {
    ...BASE,
    chart_type: 'pivot_table',
    aggregate_function: 'count',
    metrics: TWO_METRICS,
    extra_config: {
      row_dimensions: ['statename', 'districtname'],
      column_dimensions: ['climate_event'],
      show_row_subtotals: true,
      show_column_subtotals: false,
      show_row_grand_total: true,
      show_column_grand_total: true,
    },
    customizations: { decimalPlaces: 0, numberFormat: 'default' },
  },
};

/** What the edit page adds when it loads a saved chart (edit/page.tsx load effect). */
const EDIT_LOAD_DEFAULTS: Partial<ChartBuilderFormData> = {
  filters: [],
  pagination: { enabled: false, page_size: 50 },
  sort: [],
  table_columns: [],
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export function createSource(type: string): ChartBuilderFormData {
  return clone(SOURCES[type]);
}

export function editSource(type: string): ChartBuilderFormData {
  return { ...clone(EDIT_LOAD_DEFAULTS), ...clone(SOURCES[type]) };
}

export const SWITCH_TYPES = ['bar', 'line', 'pie', 'number', 'table', 'map', 'pivot_table'];

/** The fields TYPE-SWITCH-BEHAVIOR.md talks about, in a compact comparable shape. */
export function summarize(config: ChartBuilderFormData) {
  return {
    chart_type: config.chart_type,
    computation_type: config.computation_type,
    dimension_column: config.dimension_column,
    x_axis_column: config.x_axis_column,
    extra_dimension_column: config.extra_dimension_column,
    aggregate_column: config.aggregate_column,
    aggregate_function: config.aggregate_function,
    geographic_column: config.geographic_column,
    value_column: config.value_column,
    metrics: config.metrics?.map((m) => m.alias),
    dimensions: config.dimensions?.map((d) => d.column),
    table_columns: config.table_columns,
    row_dimensions: config.extra_config?.row_dimensions,
    column_dimensions: config.extra_config?.column_dimensions,
    customizations: config.customizations,
  };
}
