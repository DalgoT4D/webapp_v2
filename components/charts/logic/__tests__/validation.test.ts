import { canSaveChart, isChartReady, isMetricValid } from '@/components/charts/logic/validation';
import type { ChartBuilderFormData, ChartMetric } from '@/types/charts';

const SUM_STUDENTS: ChartMetric = { column: 'students', aggregation: 'sum' };
const SUM_WITHOUT_COLUMN: ChartMetric = { aggregation: 'sum' };
const base: ChartBuilderFormData = {
  schema_name: 's',
  table_name: 't',
  computation_type: 'aggregated',
};

describe('isMetricValid', () => {
  it('accepts an expression, a count (any case) or an aggregation with a column', () => {
    expect(isMetricValid({ column_expression: 'a / b' })).toBe(true);
    expect(isMetricValid({ aggregation: 'COUNT' })).toBe(true);
    expect(isMetricValid(SUM_STUDENTS)).toBe(true);
  });
  it('rejects an aggregation without a column, and an empty metric', () => {
    expect(isMetricValid(SUM_WITHOUT_COLUMN)).toBe(false);
    expect(isMetricValid({})).toBe(false);
  });
});

describe('isChartReady', () => {
  it('needs schema, table and type', () => {
    expect(isChartReady({ ...base, schema_name: undefined, chart_type: 'bar' }, 'create')).toBe(
      false
    );
    expect(isChartReady({ ...base }, 'edit')).toBe(false);
  });

  it('bar/line/pie: dimension + every metric valid', () => {
    for (const builder of ['create', 'edit'] as const) {
      expect(
        isChartReady(
          { ...base, chart_type: 'bar', dimension_column: 'd', metrics: [SUM_STUDENTS] },
          builder
        )
      ).toBe(true);
      expect(isChartReady({ ...base, chart_type: 'line', metrics: [SUM_STUDENTS] }, builder)).toBe(
        false
      );
      expect(
        isChartReady(
          { ...base, chart_type: 'pie', dimension_column: 'd', metrics: [SUM_WITHOUT_COLUMN] },
          builder
        )
      ).toBe(false);
    }
  });

  it('legacy bar (no metrics array) uses aggregate_function/aggregate_column', () => {
    const legacy = { ...base, chart_type: 'bar' as const, dimension_column: 'd', metrics: [] };
    expect(isChartReady({ ...legacy, aggregate_function: 'count' }, 'create')).toBe(true);
    expect(isChartReady({ ...legacy, aggregate_function: 'sum' }, 'create')).toBe(false);
    expect(
      isChartReady({ ...legacy, aggregate_function: 'sum', aggregate_column: 'x' }, 'edit')
    ).toBe(true);
  });

  it('number: first metric valid, or legacy count / sum+column', () => {
    expect(isChartReady({ ...base, chart_type: 'number', metrics: [SUM_STUDENTS] }, 'create')).toBe(
      true
    );
    expect(
      isChartReady({ ...base, chart_type: 'number', aggregate_function: 'count' }, 'edit')
    ).toBe(true);
    expect(isChartReady({ ...base, chart_type: 'number', aggregate_function: 'sum' }, 'edit')).toBe(
      false
    );
  });

  it('map with a metric needs geographic column and geojson', () => {
    const map = {
      ...base,
      chart_type: 'map' as const,
      metrics: [SUM_STUDENTS],
      geographic_column: 'state',
    };
    expect(isChartReady({ ...map, selected_geojson_id: 1 }, 'create')).toBe(true);
    expect(isChartReady(map, 'edit')).toBe(false);
  });

  it('legacy map count without value column: create not ready, edit ready (differs between builders)', () => {
    const legacyMap = {
      ...base,
      chart_type: 'map' as const,
      geographic_column: 'state',
      selected_geojson_id: 1,
      aggregate_function: 'count',
    };
    expect(isChartReady(legacyMap, 'create')).toBe(false);
    expect(isChartReady(legacyMap, 'edit')).toBe(true);
    expect(isChartReady({ ...legacyMap, value_column: 'v' }, 'create')).toBe(true);
  });

  it('table: create needs a dimension or valid metrics, edit is always ready (differs between builders)', () => {
    const table = { ...base, chart_type: 'table' as const };
    expect(isChartReady(table, 'create')).toBe(false); // PINNED-BUGS C-B3 edit side: "dataset + title only"
    expect(isChartReady(table, 'edit')).toBe(true);
    expect(isChartReady({ ...table, dimensions: [{ column: 'a' }] }, 'create')).toBe(true);
    expect(isChartReady({ ...table, dimensions: [], dimension_column: 'x' }, 'create')).toBe(true);
    expect(isChartReady({ ...table, metrics: [SUM_STUDENTS] }, 'create')).toBe(true);
    expect(isChartReady({ ...table, metrics: [SUM_WITHOUT_COLUMN] }, 'create')).toBe(false);
    expect(isChartReady({ ...table, dimensions: [{ column: '' }] }, 'create')).toBe(false);
  });

  it('pivot: at least one row dimension and every metric valid', () => {
    const pivot = { ...base, chart_type: 'pivot_table' as const };
    expect(
      isChartReady(
        { ...pivot, extra_config: { row_dimensions: ['r'] }, metrics: [SUM_STUDENTS] },
        'create'
      )
    ).toBe(true);
    expect(
      isChartReady(
        { ...pivot, extra_config: { row_dimensions: [] }, metrics: [SUM_STUDENTS] },
        'edit'
      )
    ).toBe(false);
    expect(
      isChartReady({ ...pivot, extra_config: { row_dimensions: ['r'] }, metrics: [] }, 'edit')
    ).toBe(false);
  });
});

describe('canSaveChart', () => {
  it('needs a title', () => {
    expect(canSaveChart({ ...base, chart_type: 'table' })).toBe(false);
    expect(canSaveChart({ ...base, chart_type: 'table', title: 'T' })).toBe(true);
  });

  it('removing the only bar metric leaves Save enabled via legacy fields (pinned)', () => {
    expect(
      canSaveChart({
        ...base,
        title: 'T',
        chart_type: 'bar',
        dimension_column: 'd',
        metrics: [],
        aggregate_function: 'sum',
        aggregate_column: 'students',
      })
    ).toBe(true);
  });

  it('bar with an invalid metric cannot be saved', () => {
    expect(
      canSaveChart({
        ...base,
        title: 'T',
        chart_type: 'bar',
        dimension_column: 'd',
        metrics: [SUM_WITHOUT_COLUMN],
      })
    ).toBe(false);
  });

  it('legacy map COUNT needs no value column (case-insensitive)', () => {
    expect(
      canSaveChart({
        ...base,
        title: 'T',
        chart_type: 'map',
        geographic_column: 'state',
        selected_geojson_id: 1,
        aggregate_function: 'COUNT',
      })
    ).toBe(true);
  });

  it('legacy number count is savable', () => {
    expect(
      canSaveChart({ ...base, title: 'T', chart_type: 'number', aggregate_function: 'count' })
    ).toBe(true);
  });
});
