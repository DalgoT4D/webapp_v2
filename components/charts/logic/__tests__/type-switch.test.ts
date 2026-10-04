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
