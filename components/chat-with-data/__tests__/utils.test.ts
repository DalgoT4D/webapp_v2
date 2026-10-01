import { approvalSteps, approvalSummary, groupByTable, mergeColumns, tableKey } from '../utils';
import type { ApprovalRequest, PiiColumn } from '@/types/chat-with-data';

const column = (table: string, name: string, hasLiteral = false): PiiColumn => ({
  schema: 'staging',
  table,
  column: name,
  has_literal: hasLiteral,
});

const profile = (
  name: string,
  searchValue?: string,
  columns?: PiiColumn[] | null
): ApprovalRequest => ({
  tool: 'lookup_column_values',
  args: {
    schema_name: 'staging',
    table_name: 'visits',
    column_name: name,
    ...(searchValue ? { search_value: searchValue } : {}),
  },
  description: 'Waiting for your go-ahead',
  columns: columns === undefined ? [column('visits', name)] : columns,
});

describe('approvalSummary', () => {
  it('shows the search value and column for a lone call', () => {
    expect(approvalSummary([profile('district', 'Maharashtra')])).toBe(
      'Look up how "Maharashtra" is stored in `district`?'
    );
  });

  it('falls back to just the column name when no search value', () => {
    expect(approvalSummary([profile('district')])).toBe('Look up values in `district`?');
  });

  it('counts several profile calls rather than repeating one line', () => {
    expect(approvalSummary([profile('district', 'MH'), profile('gender', 'F')])).toBe(
      'Look up values in 2 columns?'
    );
  });

  it('counts several queries rather than repeating one line', () => {
    const query: ApprovalRequest = {
      tool: 'execute_sql',
      args: {},
      description: '',
      sql: 'SELECT 1',
    };
    expect(approvalSummary([query])).toBe('Run this query on your data warehouse?');
    expect(approvalSummary([query, query])).toBe('Run 2 queries on your data warehouse?');
  });

  it('falls back to a plain count for a mixed pause', () => {
    const chart: ApprovalRequest = { tool: 'create_chart', args: {}, description: '' };
    expect(approvalSummary([profile('district'), chart])).toBe('Approve 2 steps?');
  });

  it('describes an empty pause without crashing', () => {
    expect(approvalSummary([])).toBe('Approve this step?');
  });

  it('counts two creations of the same kind as separate steps', () => {
    const chart: ApprovalRequest = { tool: 'create_chart', args: {}, description: '' };
    expect(approvalSummary([chart, chart])).toBe('Approve 2 steps?');
  });

  it('names metric, KPI and report creations instead of the backend fallback', () => {
    const request = (tool: string, args: Record<string, unknown>): ApprovalRequest => ({
      tool,
      args,
      description: 'Waiting for your go-ahead',
    });
    expect(
      approvalSummary([
        request('create_metric', {
          name: 'Total surveys',
          schema_name: 'staging',
          table_name: 'visits',
        }),
      ])
    ).toBe('Create the metric “Total surveys” from staging.visits?');
    expect(approvalSummary([request('create_kpi', { name: 'Coverage' })])).toBe(
      'Create the KPI “Coverage”?'
    );
    expect(approvalSummary([request('create_kpi', { metric_id: 4 })])).toBe(
      'Create a KPI from this metric?'
    );
    expect(approvalSummary([request('create_report', { title: 'Q3 review' })])).toBe(
      'Create the report “Q3 review” from your dashboard?'
    );
  });
});

describe('approvalSteps', () => {
  const chart = (title: string): ApprovalRequest => ({
    tool: 'create_chart',
    args: { title, chart_type: 'bar', schema_name: 'staging', table_name: 'visits' },
    description: '',
  });

  it('spells out each step when the headline is only a count', () => {
    expect(approvalSteps([chart('Visits by district'), chart('Visits by month')])).toEqual([
      'Create the chart “Visits by district” (bar) from staging.visits',
      'Create the chart “Visits by month” (bar) from staging.visits',
    ]);
  });

  it('adds nothing when the headline already describes the pause', () => {
    expect(approvalSteps([chart('Visits by district')])).toEqual([]);
    expect(approvalSteps([profile('district', 'MH'), profile('gender', 'F')])).toEqual([]);
  });
});

describe('mergeColumns', () => {
  it('unions the columns of every pending call', () => {
    const { columns } = mergeColumns([profile('district', 'MH'), profile('gender', 'F')]);
    expect(columns?.map((entry) => entry.column)).toEqual(['district', 'gender']);
  });

  it('lists a column both calls touch only once', () => {
    const { columns } = mergeColumns([profile('district', 'MH'), profile('district', 'MH')]);
    expect(columns).toHaveLength(1);
  });

  it('keeps has_literal when any one call compares against a literal', () => {
    const { columns } = mergeColumns([
      profile('district', 'MH', [column('visits', 'district')]),
      profile('district', 'MH', [column('visits', 'district', true)]),
    ]);
    expect(columns?.[0].has_literal).toBe(true);
  });

  it('fails closed when one call could not be resolved', () => {
    expect(mergeColumns([profile('district', 'MH'), profile('gender', 'F', null)])).toEqual({
      columns: null,
      reviewable: true,
    });
  });

  it('is not reviewable when no call returns values', () => {
    const chart: ApprovalRequest = { tool: 'create_chart', args: {}, description: '' };
    expect(mergeColumns([chart])).toEqual({ columns: [], reviewable: false });
  });
});

describe('groupByTable', () => {
  it('buckets columns under their table in first-seen order', () => {
    expect(
      groupByTable([
        column('visits', 'district'),
        column('workers', 'name'),
        column('visits', 'gender'),
      ])
    ).toEqual([
      {
        table: 'staging.visits',
        columns: [column('visits', 'district'), column('visits', 'gender')],
      },
      { table: 'staging.workers', columns: [column('workers', 'name')] },
    ]);
  });

  it('builds the group key from schema and table', () => {
    expect(tableKey(column('visits', 'district'))).toBe('staging.visits');
  });
});
