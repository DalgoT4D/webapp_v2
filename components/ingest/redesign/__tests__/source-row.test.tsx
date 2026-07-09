import { render, screen, fireEvent } from '@testing-library/react';
import { SourceRow } from '../source-row';
import type { SourceGroupProps, SourceGroupData } from '../utils';
import type { Connection } from '@/types/connections';
import type { Source } from '@/types/source';

function source(id: string, name = id): Source {
  return {
    sourceId: id,
    name,
    sourceDefinitionId: 'def',
    sourceName: 'Postgres',
    connectionConfiguration: {},
  } as Source;
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

describe('SourceRow', () => {
  it('renders the source identity and one reused connection row per connection', () => {
    const group = {
      source: source('s1', 'Kobo'),
      connections: [conn('c1', 's1'), conn('c2', 's1')],
    };
    render(<SourceRow {...baseProps(group)} />);
    expect(screen.getByTestId('source-row-s1')).toBeInTheDocument();
    expect(screen.getByText('Kobo')).toBeInTheDocument();
    // Each connection is the shipped ConnectionRow (data-testid connection-row-<id>).
    expect(screen.getByTestId('connection-row-c1')).toBeInTheDocument();
    expect(screen.getByTestId('connection-row-c2')).toBeInTheDocument();
  });

  it('shows the left-column "Add connection" button when the user may create connections', () => {
    const group = {
      source: source('s1', 'Kobo'),
      connections: [conn('c1', 's1')],
    };
    render(<SourceRow {...baseProps(group)} />);
    expect(screen.getByTestId('add-connection-s1')).toBeInTheDocument();
  });

  it('hides the left-column "Add connection" button without create permission', () => {
    const group = {
      source: source('s1', 'Kobo'),
      connections: [conn('c1', 's1')],
    };
    render(<SourceRow {...baseProps(group)} canCreateConnection={false} />);
    expect(screen.queryByTestId('add-connection-s1')).not.toBeInTheDocument();
  });

  it('renders an add-connection CTA for a source with zero connections', () => {
    const group: SourceGroupData = { source: source('s1', 'Kobo'), connections: [] };
    const props = baseProps(group);
    render(<SourceRow {...props} />);
    expect(screen.queryByTestId('connection-row-c1')).not.toBeInTheDocument();
    expect(screen.getByTestId('add-connection-cta-s1')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('add-connection-cta-s1'));
    expect(props.onAddConnection).toHaveBeenCalledTimes(1);
  });

  it('shows a "No connections yet" fallback for zero connections without create permission', () => {
    const group: SourceGroupData = { source: source('s1', 'Kobo'), connections: [] };
    render(<SourceRow {...baseProps(group)} canCreateConnection={false} />);
    expect(screen.queryByTestId('add-connection-cta-s1')).not.toBeInTheDocument();
    expect(screen.getByText('No connections yet')).toBeInTheDocument();
  });
});
