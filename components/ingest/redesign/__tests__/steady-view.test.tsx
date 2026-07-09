import { render, screen, fireEvent } from '@testing-library/react';
import { SteadyView } from '../steady-view';
import { useConnectionsList } from '@/hooks/api/useConnections';
import { useSources } from '@/hooks/api/useSources';
import * as rbac from '@/lib/rbac';
import type { Connection } from '@/types/connections';
import type { Source } from '@/types/source';

jest.mock('@/hooks/api/useConnections');
jest.mock('@/hooks/api/useSources');
jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));
// PendingActions fetches schema changes via its own SWR hook — stub it so this
// smoke test stays focused on SteadyView's own structure.
jest.mock('@/components/connections/pending-actions', () => ({
  PendingActions: (): null => null,
}));
// The full wizard has its own tests; here we only assert SteadyView wires it up.
jest.mock('@/components/ingest/sources/wizard/AddSourceWizard', () => ({
  AddSourceWizard: ({ open }: { open: boolean }) =>
    open ? <div data-testid="wizard-open" /> : null,
}));

const mockConnections = useConnectionsList as jest.Mock;
const mockSources = useSources as jest.Mock;
const mockPermissions = rbac.useRbac as jest.Mock;

function source(id: string, name: string): Source {
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

describe('SteadyView (smoke)', () => {
  beforeEach(() => {
    mockPermissions.mockReturnValue({ hasPermission: () => true });
  });

  it('renders the control bar and a source row', () => {
    mockConnections.mockReturnValue({ data: [conn('c1', 's1')], mutate: jest.fn() });
    mockSources.mockReturnValue({ data: [source('s1', 'Kobo')], mutate: jest.fn() });

    render(<SteadyView />);

    expect(screen.getByTestId('ingest-steady-view')).toBeInTheDocument();
    expect(screen.getByTestId('ingest-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('new-source-btn')).toBeInTheDocument();
    // Top-level "New Connection" was removed — connections are added per source.
    expect(screen.queryByTestId('new-connection-btn')).not.toBeInTheDocument();
    // Populated source: add-connection lives in the 3-dots menu, not inline.
    expect(screen.queryByTestId('add-connection-s1')).not.toBeInTheDocument();
    expect(screen.getByTestId('source-menu-s1')).toBeInTheDocument();
    expect(screen.getByTestId('source-row-s1')).toBeInTheDocument();
    expect(screen.getByTestId('connection-row-c1')).toBeInTheDocument();
  });

  it('shows a source with no connections as a plain add-connection row', () => {
    mockConnections.mockReturnValue({ data: [], mutate: jest.fn() });
    mockSources.mockReturnValue({ data: [source('s2', 'Sheets')], mutate: jest.fn() });

    render(<SteadyView />);

    expect(screen.getByTestId('source-row-s2')).toBeInTheDocument();
    expect(screen.getByTestId('add-connection-s2')).toBeInTheDocument();
  });

  it('labels columns Sources / Connections / Last sync / Actions', () => {
    mockConnections.mockReturnValue({ data: [conn('c1', 's1')], mutate: jest.fn() });
    mockSources.mockReturnValue({ data: [source('s1', 'Kobo')], mutate: jest.fn() });

    render(<SteadyView />);

    const labels = screen.getByTestId('ingest-column-labels');
    expect(labels).toHaveTextContent('Source details');
    expect(labels).toHaveTextContent('Connections');
    expect(labels).toHaveTextContent('Last sync');
    expect(labels).toHaveTextContent('Actions');
  });

  it('opens the AddSourceWizard from the New Source button', () => {
    mockConnections.mockReturnValue({ data: [conn('c1', 's1')], mutate: jest.fn() });
    mockSources.mockReturnValue({ data: [source('s1', 'Kobo')], mutate: jest.fn() });

    render(<SteadyView />);

    expect(screen.queryByTestId('wizard-open')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('new-source-btn'));
    expect(screen.getByTestId('wizard-open')).toBeInTheDocument();
  });
});
