import {
  applyConfigPatch,
  createPageReducer,
  editPageReducer,
  hasUnsavedChanges,
  type ChartBuilderState,
} from '@/components/charts/logic/builder-state';
import type { ChartBuilderFormData } from '@/types/charts';

const bar: ChartBuilderFormData = {
  title: 'T',
  chart_type: 'bar',
  schema_name: 's',
  table_name: 't',
  computation_type: 'aggregated',
  dimension_column: 'state',
  customizations: { legendPosition: 'bottom', showLegend: true },
};

describe('applyConfigPatch', () => {
  it('create merges a chart-type patch as is', () => {
    expect(applyConfigPatch(bar, { chart_type: 'line' }, 'create')).toEqual({
      ...bar,
      chart_type: 'line',
    });
  });

  it('edit re-derives a chart-type patch from the old config (differs between builders)', () => {
    const next = applyConfigPatch(bar, { chart_type: 'line' }, 'edit');
    expect(next.customizations).toEqual({
      lineStyle: 'smooth',
      showDataPoints: true,
      showTooltip: true,
      showLegend: true,
      showDataLabels: false,
      dataLabelPosition: 'top',
      xAxisTitle: '',
      yAxisTitle: '',
      xAxisLabelRotation: 'horizontal',
      yAxisLabelRotation: 'horizontal',
      legendDisplay: 'paginated',
      legendPosition: 'top',
    });
  });

  it('edit merges a patch without a type change', () => {
    expect(applyConfigPatch(bar, { title: 'New' }, 'edit')).toEqual({ ...bar, title: 'New' });
  });
});

describe('chart builder reducers', () => {
  const fresh: ChartBuilderState = { config: bar, savedConfig: bar };

  it('PATCH_CONFIG makes the chart dirty; MARK_SAVED clears it', () => {
    const patched = createPageReducer(fresh, { type: 'PATCH_CONFIG', patch: { title: 'X' } });
    expect(hasUnsavedChanges(patched)).toBe(true);
    const saved = createPageReducer(patched, { type: 'MARK_SAVED' });
    expect(hasUnsavedChanges(saved)).toBe(false);
    expect(saved.savedConfig).not.toBe(saved.config);
  });

  it('auto-prefill counts as a change (pinned C-B6)', () => {
    const prefilled = createPageReducer(fresh, {
      type: 'PATCH_CONFIG',
      patch: { metrics: [{ column: null, aggregation: 'count', alias: 'Total Count' }] },
    });
    expect(hasUnsavedChanges(prefilled)).toBe(true);
  });

  it('a key set to undefined still counts as a change (deepEqual compares key counts)', () => {
    const cleared = createPageReducer(fresh, {
      type: 'PATCH_CONFIG',
      patch: { x_axis_column: undefined },
    });
    expect(hasUnsavedChanges(cleared)).toBe(true);
  });

  it('LOAD_SAVED_CHART sets config and baseline to the loaded chart', () => {
    const loaded = editPageReducer(
      { config: bar, savedConfig: null },
      { type: 'LOAD_SAVED_CHART', config: { ...bar, title: 'Saved' } }
    );
    expect(loaded.config.title).toBe('Saved');
    expect(loaded.savedConfig).toBe(loaded.config);
    expect(hasUnsavedChanges(loaded)).toBe(false);
  });

  it('SET_SAVED_BASELINE only fills an empty baseline', () => {
    const empty: ChartBuilderState = { config: { ...bar, title: 'typed' }, savedConfig: null };
    expect(hasUnsavedChanges(empty)).toBe(false);
    const withBaseline = editPageReducer(empty, { type: 'SET_SAVED_BASELINE', config: bar });
    expect(withBaseline.savedConfig).toEqual(bar);
    expect(hasUnsavedChanges(withBaseline)).toBe(true);
    expect(
      editPageReducer(withBaseline, { type: 'SET_SAVED_BASELINE', config: { ...bar, title: 'Z' } })
    ).toBe(withBaseline);
  });
});
