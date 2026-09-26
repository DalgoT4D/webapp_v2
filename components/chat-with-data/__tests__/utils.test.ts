import { approvalSummary, groupByTable, mergeColumns, tableKey } from '../utils';
import type { ApprovalRequest, PiiColumn } from '@/types/chat-with-data';

const column = (table: string, name: string, hasLiteral = false): PiiColumn => ({
  schema: 'staging',
  table,
  column: name,
  has_literal: hasLiteral,
});

const profile = (name: string, columns?: PiiColumn[] | null): ApprovalRequest => ({
  tool: 'profile_column',
  args: { schema_name: 'staging', table_name: 'visits', column_name: name },
  description: 'Waiting for your go-ahead',
  columns: columns === undefined ? [column('visits', name)] : columns,
});

describe('approvalSummary', () => {
  it('keeps the specific wording for a lone call', () => {
    expect(approvalSummary([profile('district')])).toBe('Profile staging.visits.district?');
  });

  it('names the table once when several calls profile the same one', () => {
    expect(approvalSummary([profile('district'), profile('gender')])).toBe(
      'Profile 2 columns in staging.visits?'
    );
  });

  it('drops the table when the calls span more than one', () => {
    const other: ApprovalRequest = {
      ...profile('name'),
      args: { schema_name: 'staging', table_name: 'workers', column_name: 'name' },
    };
    expect(approvalSummary([profile('district'), other])).toBe('Profile 2 columns?');
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
});

describe('mergeColumns', () => {
  it('unions the columns of every pending call', () => {
    const { columns } = mergeColumns([profile('district'), profile('gender')]);
    expect(columns?.map((entry) => entry.column)).toEqual(['district', 'gender']);
  });

  it('lists a column both calls touch only once', () => {
    const { columns } = mergeColumns([profile('district'), profile('district')]);
    expect(columns).toHaveLength(1);
  });

  it('keeps has_literal when any one call compares against a literal', () => {
    const { columns } = mergeColumns([
      profile('district', [column('visits', 'district')]),
      profile('district', [column('visits', 'district', true)]),
    ]);
    expect(columns?.[0].has_literal).toBe(true);
  });

  it('fails closed when one call could not be resolved', () => {
    expect(mergeColumns([profile('district'), profile('gender', null)])).toEqual({
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
