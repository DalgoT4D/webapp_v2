import {
  applyChartTypeChange,
  legacyEditPageTypeSwitch,
} from '@/components/charts/logic/type-switch';
import type { ChartBuilderFormData } from '@/types/charts';
import { COLUMNS, createSource, editSource, summarize, SWITCH_TYPES } from './type-switch.fixtures';
import { EXPECTED_SWITCHES } from './type-switch.expected';

/** Create page: the data-config panel's patch merged in; a map source only sets chart_type (pinned). */
function switchInCreate(src: string, tgt: string): ChartBuilderFormData {
  const prev = createSource(src);
  const patch = src === 'map' ? { chart_type: tgt } : applyChartTypeChange(prev, tgt, COLUMNS);
  return { ...prev, ...patch } as ChartBuilderFormData;
}

/** Edit page: the same patch, then the edit page's own second pass. */
function switchInEdit(src: string, tgt: string): ChartBuilderFormData {
  const prev = editSource(src);
  const patch = src === 'map' ? { chart_type: tgt } : applyChartTypeChange(prev, tgt, COLUMNS);
  return legacyEditPageTypeSwitch(prev, patch as Partial<ChartBuilderFormData>);
}

const TRANSITIONS = SWITCH_TYPES.flatMap((src) =>
  SWITCH_TYPES.filter((tgt) => tgt !== src).map((tgt) => [src, tgt] as const)
);

describe('type switch — TYPE-SWITCH-BEHAVIOR.md, create builder (42 transitions)', () => {
  it.each(TRANSITIONS)('TS-create %s → %s', (src, tgt) => {
    expect(summarize(switchInCreate(src, tgt))).toEqual(EXPECTED_SWITCHES.create[`${src}>${tgt}`]);
  });
});

describe('type switch — TYPE-SWITCH-BEHAVIOR.md, edit builder (42 transitions)', () => {
  it.each(TRANSITIONS)('TS-edit %s → %s', (src, tgt) => {
    expect(summarize(switchInEdit(src, tgt))).toEqual(EXPECTED_SWITCHES.edit[`${src}>${tgt}`]);
  });
});

describe('applyChartTypeChange', () => {
  it('skips auto-prefill while columns are loading', () => {
    const patch = applyChartTypeChange(createSource('number'), 'table', []);
    expect(patch).not.toHaveProperty('dimensions');
    expect(patch).not.toHaveProperty('table_columns');
  });

  it('keeps title, dataset, filters, sort and pagination', () => {
    const prev = {
      ...createSource('bar'),
      filters: [{ column: 'statename', operator: 'equals' as const, value: 'KA' }],
      sort: [{ column: 'statename', direction: 'asc' as const }],
      pagination: { enabled: true, page_size: 20 },
    };
    expect(applyChartTypeChange(prev, 'line', COLUMNS)).toMatchObject({
      title: 'T',
      schema_name: 'production',
      table_name: 'mart_education_program',
      chart_type: 'line',
      filters: prev.filters,
      sort: prev.sort,
      pagination: prev.pagination,
    });
  });

  it('pivot_table: full patch resets the pivot extra_config fields (toStrictEqual)', () => {
    const patch = applyChartTypeChange(createSource('bar'), 'pivot_table', COLUMNS);
    expect(patch).toStrictEqual({
      title: 'T',
      schema_name: 'production',
      table_name: 'mart_education_program',
      chart_type: 'pivot_table',
      computation_type: 'aggregated',
      filters: undefined,
      sort: undefined,
      pagination: undefined,
      extra_config: {
        row_dimensions: [],
        column_dimensions: [],
        show_row_subtotals: false,
        show_column_subtotals: false,
        show_row_grand_total: false,
        show_column_grand_total: false,
        row_subtotal_label: 'Subtotal',
        column_subtotal_label: 'Subtotal',
        row_grand_total_label: 'Grand Total',
        column_grand_total_label: 'Grand Total',
      },
      metrics: [
        { aggregation: 'sum', alias: 'SUM(students)', column: 'students' },
        { aggregation: 'avg', alias: 'AVG(male_score)', column: 'male_score' },
      ],
      customizations: {
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
    });
  });

  it('an unknown target keeps only the shared fields and the prefill (none for unknown types)', () => {
    const patch = applyChartTypeChange(createSource('bar'), 'sankey', COLUMNS);
    expect(Object.keys(patch).sort()).toEqual(
      [
        'chart_type',
        'customizations',
        'filters',
        'pagination',
        'schema_name',
        'sort',
        'table_name',
        'title',
      ].sort()
    );
    expect(patch.customizations).not.toHaveProperty('dataLabelPosition');
  });
});

describe('legacyEditPageTypeSwitch', () => {
  it('merges a patch that does not change the chart type', () => {
    const prev = editSource('bar');
    expect(legacyEditPageTypeSwitch(prev, { title: 'New' })).toEqual({ ...prev, title: 'New' });
    expect(legacyEditPageTypeSwitch(prev, { chart_type: 'bar', dimension_column: 'id' })).toEqual({
      ...prev,
      chart_type: 'bar',
      dimension_column: 'id',
    });
  });

  it('→ table without a dimension_column: x_axis_column fallback feeds table_columns (toStrictEqual)', () => {
    const prev: ChartBuilderFormData = {
      ...editSource('bar'),
      dimension_column: undefined,
      x_axis_column: 'statename',
    };
    const patch = applyChartTypeChange(prev, 'table', COLUMNS);
    const after = legacyEditPageTypeSwitch(prev, patch as Partial<ChartBuilderFormData>);
    expect(after).toStrictEqual({
      filters: [],
      pagination: { enabled: false, page_size: 50 },
      sort: [],
      table_columns: ['statename', 'students', 'male_score'],
      title: 'T',
      schema_name: 'production',
      table_name: 'mart_education_program',
      computation_type: 'aggregated',
      chart_type: 'table',
      aggregate_column: undefined,
      aggregate_function: 'count',
      dimension_column: undefined,
      extra_dimension_column: 'climate_event',
      metrics: [
        { aggregation: 'sum', alias: 'SUM(students)', column: 'students' },
        { aggregation: 'avg', alias: 'AVG(male_score)', column: 'male_score' },
      ],
      customizations: {},
      x_axis_column: 'statename',
      dimensions: [{ column: 'id', enable_drill_down: false }],
      dimension_columns: ['id'],
      y_axis_column: null,
    });
  });

  it('keeps non-blank titles and the subtitle across a switch', () => {
    const prev = { ...editSource('bar'), customizations: { xAxisTitle: 'States', subtitle: '  ' } };
    expect(legacyEditPageTypeSwitch(prev, { chart_type: 'line' }).customizations).toMatchObject({
      xAxisTitle: 'States',
      legendPosition: 'top',
    });
    expect(
      legacyEditPageTypeSwitch(prev, { chart_type: 'line' }).customizations
    ).not.toHaveProperty('subtitle');
  });
});
