import { render, screen } from '@testing-library/react';
import { IngestView } from '../ingest-view';
import { useWarehouse } from '@/hooks/api/useWarehouse';
import { useSources } from '@/hooks/api/useSources';
import * as rbac from '@/lib/rbac';

jest.mock('@/hooks/api/useWarehouse');
jest.mock('@/hooks/api/useSources');
jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));
// Keep this test focused on state routing — stub the heavy steady subtree.
jest.mock('../steady-view', () => ({
  SteadyView: () => <div data-testid="ingest-steady-view" />,
}));

const mockWarehouse = useWarehouse as jest.Mock;
const mockSources = useSources as jest.Mock;
const mockPermissions = rbac.useRbac as jest.Mock;

function renderView() {
  return render(<IngestView mode="new" onModeChange={jest.fn()} />);
}

describe('IngestView progressive reveal', () => {
  beforeEach(() => {
    mockPermissions.mockReturnValue({ hasPermission: () => true });
  });

  it('shows the empty-warehouse card when there is no warehouse', () => {
    mockWarehouse.mockReturnValue({ data: undefined, isLoading: false, mutate: jest.fn() });
    mockSources.mockReturnValue({ data: [], isLoading: false, mutate: jest.fn() });
    renderView();
    expect(screen.getByTestId('ingest-empty-warehouse')).toBeInTheDocument();
    expect(screen.queryByTestId('warehouse-chip')).not.toBeInTheDocument();
  });

  it('shows the empty-source card when warehouse exists but no sources', () => {
    mockWarehouse.mockReturnValue({ data: { name: 'wh' }, isLoading: false, mutate: jest.fn() });
    mockSources.mockReturnValue({ data: [], isLoading: false, mutate: jest.fn() });
    renderView();
    expect(screen.getByTestId('ingest-empty-source')).toBeInTheDocument();
    expect(screen.getByTestId('warehouse-chip')).toBeInTheDocument();
  });

  it('shows the steady view when warehouse and a source exist', () => {
    mockWarehouse.mockReturnValue({ data: { name: 'wh' }, isLoading: false, mutate: jest.fn() });
    mockSources.mockReturnValue({
      data: [{ sourceId: 's1' }],
      isLoading: false,
      mutate: jest.fn(),
    });
    renderView();
    expect(screen.getByTestId('ingest-steady-view')).toBeInTheDocument();
  });
});
