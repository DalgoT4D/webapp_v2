import { render, screen } from '@testing-library/react';
import { SourceGroup, type SourceGroupProps } from '../source-group';
import type { Connection } from '@/types/connections';
import type { Source } from '@/types/source';
import type { SourceGroupData } from '../utils';

function source(id: string, name = id): Source {
  return {
    sourceId: id,
    name,
    sourceDefinitionId: 'def',
    sourceName: 'Postgres',
    connectionConfiguration: {},
  };
}

function conn(id: string, sourceId: string): Connection {
  return {
    connectionId: id,
    name: id,
    deploymentId: `dep-${id}`,
    source: { sourceId, name: sourceId, sourceName: 'Postgres' },
    destination: { destinationId: 'd1', name: 'wh', destinationName: 'Postgres' },
    lock: null,
    lastRun: null,
    queuedFlowRunWaitTime: null,
    clearConnDeploymentId: null,
  } as Connection;
}

function baseProps(group: SourceGroupData): SourceGroupProps {
  return {
    group,
    syncingIds: [],
    canSync: true,
    canEditConnection: true,
    canDeleteConnection: true,
    canReset: true,
    onSync: jest.fn(),
    onCancelSync: jest.fn(),
    onEditConnection: jest.fn(),
    onDeleteConnection: jest.fn(),
    onViewHistory: jest.fn(),
    onClearStreams: jest.fn(),
    onRefreshSchema: jest.fn(),
    canCreateConnection: true,
    canEditSource: true,
    canDeleteSource: true,
    onAddConnection: jest.fn(),
    onEditSource: jest.fn(),
    onDeleteSource: jest.fn(),
  };
}

describe('SourceGroup', () => {
  it('renders a plain row (no connection rows) for a source with zero connections', () => {
    const group: SourceGroupData = { source: source('s1', 'Kobo'), connections: [] };
    render(<SourceGroup {...baseProps(group)} />);
    expect(screen.getByTestId('source-group-s1')).toBeInTheDocument();
    expect(screen.getByText('No connections yet')).toBeInTheDocument();
    expect(screen.queryByTestId('source-rollup')).not.toBeInTheDocument();
  });

  it('renders a collapsible group with connection rows and a rollup for a source with connections', () => {
    const group = {
      source: source('s1', 'Kobo'),
      connections: [conn('c1', 's1'), conn('c2', 's1')],
    };
    render(<SourceGroup {...baseProps(group)} />);
    expect(screen.getByTestId('source-rollup')).toBeInTheDocument();
    expect(screen.getByTestId('connection-row-c1')).toBeInTheDocument();
    expect(screen.getByTestId('connection-row-c2')).toBeInTheDocument();
  });
});
