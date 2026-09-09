import { groupConnectionsBySource, summarizeGroup, deriveConnectionStatus } from '../utils';
import type { Connection } from '@/types/connections';
import type { Source } from '@/types/source';

// Minimal factories — only the fields the utils read.
function source(id: string, name = id): Source {
  return {
    sourceId: id,
    name,
    sourceDefinitionId: 'def',
    sourceName: 'Postgres',
    connectionConfiguration: {},
  };
}

function conn(id: string, sourceId: string, overrides: Partial<Connection> = {}): Connection {
  return {
    connectionId: id,
    name: id,
    source: { sourceId, name: sourceId, sourceName: 'Postgres' },
    lock: null,
    lastRun: null,
    ...overrides,
  } as Connection;
}

describe('groupConnectionsBySource', () => {
  it('includes a source with zero connections', () => {
    const groups = groupConnectionsBySource([source('s1')], []);
    expect(groups).toHaveLength(1);
    expect(groups[0].connections).toEqual([]);
  });

  it('attaches a single connection to its source', () => {
    const groups = groupConnectionsBySource([source('s1')], [conn('c1', 's1')]);
    expect(groups[0].connections).toHaveLength(1);
    expect(groups[0].connections[0].connectionId).toBe('c1');
  });

  it('groups many connections under the same source', () => {
    const groups = groupConnectionsBySource(
      [source('s1'), source('s2')],
      [conn('c1', 's1'), conn('c2', 's1'), conn('c3', 's2')]
    );
    const s1 = groups.find((g) => g.source.sourceId === 's1');
    const s2 = groups.find((g) => g.source.sourceId === 's2');
    expect(s1?.connections).toHaveLength(2);
    expect(s2?.connections).toHaveLength(1);
  });
});

describe('deriveConnectionStatus', () => {
  it('returns null when there is no lock and no last run', () => {
    expect(deriveConnectionStatus(conn('c1', 's1'))).toBeNull();
  });

  it('returns succeeded for a successful last run', () => {
    expect(
      deriveConnectionStatus(conn('c1', 's1', { lastRun: { status: 'succeeded' } as never }))
    ).toBe('succeeded');
  });

  it('returns failed for a failed last run', () => {
    expect(
      deriveConnectionStatus(conn('c1', 's1', { lastRun: { status: 'failed' } as never }))
    ).toBe('failed');
  });

  it('returns running when locked-running', () => {
    expect(deriveConnectionStatus(conn('c1', 's1', { lock: { status: 'running' } as never }))).toBe(
      'running'
    );
  });
});

describe('summarizeGroup', () => {
  it('counts succeeded, failed, and running connections', () => {
    const connections = [
      conn('c1', 's1', { lastRun: { status: 'succeeded' } as never }),
      conn('c2', 's1', { lastRun: { status: 'succeeded' } as never }),
      conn('c3', 's1', { lastRun: { status: 'failed' } as never }),
      conn('c4', 's1', { lock: { status: 'running' } as never }),
    ];
    const summary = summarizeGroup(connections);
    expect(summary.total).toBe(4);
    expect(summary.succeeded).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.running).toBe(1);
  });
});
