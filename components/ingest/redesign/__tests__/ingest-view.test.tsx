import { render, screen, fireEvent, act } from '@testing-library/react';
import { IngestView } from '../ingest-view';
import { useWarehouse } from '@/hooks/api/useWarehouse';
import { useSources } from '@/hooks/api/useSources';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import * as rbac from '@/lib/rbac';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/api/useWarehouse');
jest.mock('@/hooks/api/useSources');
jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));
// Keep this test focused on state routing — stub the heavy steady subtree.
jest.mock('../steady-view', () => ({
  SteadyView: () => <div data-testid="ingest-steady-view" />,
}));
// The wizard has its own tests; here we only assert the header wires it up. onClose is
// exposed as a button so the walkthrough tests below can dismiss it.
jest.mock('@/components/ingest/sources/wizard/AddSourceWizard', () => ({
  AddSourceWizard: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="wizard-open">
        <button type="button" data-testid="wizard-close" onClick={onClose} />
      </div>
    ) : null,
}));

const mockWarehouse = useWarehouse as jest.Mock;
const mockSources = useSources as jest.Mock;
const mockPermissions = rbac.useRbac as jest.Mock;

function renderView() {
  return render(<IngestView />);
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

  it('shows New Source + warehouse chip in the header and opens the wizard', () => {
    mockWarehouse.mockReturnValue({
      data: { name: 'wh', wtype: 'postgres' },
      isLoading: false,
      mutate: jest.fn(),
    });
    mockSources.mockReturnValue({
      data: [{ sourceId: 's1' }],
      isLoading: false,
      mutate: jest.fn(),
    });
    renderView();

    expect(screen.getByTestId('warehouse-chip')).toBeInTheDocument();
    expect(screen.queryByTestId('wizard-open')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('new-source-btn'));
    expect(screen.getByTestId('wizard-open')).toBeInTheDocument();
  });

  it('renders the warehouse chip as a link to Settings → Warehouse with name and type', () => {
    mockWarehouse.mockReturnValue({
      data: { name: 'hobbit_pantry_1', wtype: 'postgres' },
      isLoading: false,
      mutate: jest.fn(),
    });
    mockSources.mockReturnValue({
      data: [{ sourceId: 's1' }],
      isLoading: false,
      mutate: jest.fn(),
    });
    renderView();

    const chip = screen.getByTestId('warehouse-chip');
    // It navigates (anchor), not a dialog trigger.
    expect(chip.tagName).toBe('A');
    expect(chip).toHaveAttribute('href', '/settings/warehouse');
    expect(chip).toHaveTextContent('Warehouse');
    expect(screen.getByText('hobbit_pantry_1')).toBeInTheDocument();
    expect(screen.getByText('postgres')).toBeInTheDocument(); // uppercased via CSS
    expect(screen.queryByTestId('warehouse-panel-dialog')).not.toBeInTheDocument();
  });

  it('hides New Source when there is no warehouse', () => {
    mockWarehouse.mockReturnValue({ data: undefined, isLoading: false, mutate: jest.fn() });
    mockSources.mockReturnValue({ data: [], isLoading: false, mutate: jest.fn() });
    renderView();
    expect(screen.queryByTestId('new-source-btn')).not.toBeInTheDocument();
  });
});

describe('IngestView walkthrough coachmarks', () => {
  beforeEach(() => {
    mockPermissions.mockReturnValue({ hasPermission: () => true });
    mockWarehouse.mockReturnValue({
      data: { name: 'wh', wtype: 'postgres' },
      isLoading: false,
      mutate: jest.fn(),
    });
    mockSources.mockReturnValue({
      data: [{ sourceId: 's1' }],
      isLoading: false,
      mutate: jest.fn(),
    });
    useInsightWalkthroughStore.setState({
      active: true,
      orgSlug: 'org-a',
      // advanceTo persists under the live flow — without one the store can't advance at all.
      flow: 'insights',
      path: 'own_data',
      stage: 'own_data_ingest',
      trackedConnectionId: null,
      suppressCoachmark: false,
    });
  });

  it('hides the coachmark while the wizard covers a page-level target', () => {
    renderView();
    fireEvent.click(screen.getByTestId('new-source-btn'));

    // Stage is still the New Source button, which the wizard is now sitting on top of.
    expect(useInsightWalkthroughStore.getState().suppressCoachmark).toBe(true);
  });

  it('keeps the coachmark visible once the stage points inside the wizard', () => {
    renderView();
    fireEvent.click(screen.getByTestId('new-source-btn'));

    // Stands in for SelectSourceStep mounting inside the (mocked) wizard. It lands after
    // wizardOpen has already flipped, so this is the regression guard for reading `stage`
    // via getState() instead of subscribing to it — that leaves suppression latched on and
    // the Google Sheets card never gets coached.
    act(() => {
      useInsightWalkthroughStore.setState({ stage: 'own_data_pick_source' });
    });

    expect(useInsightWalkthroughStore.getState().suppressCoachmark).toBe(false);
  });

  it('rewinds to the New Source stage when the wizard is dismissed without a connection', () => {
    renderView();
    fireEvent.click(screen.getByTestId('new-source-btn'));
    act(() => {
      useInsightWalkthroughStore.setState({ stage: 'own_data_pick_source' });
    });

    fireEvent.click(screen.getByTestId('wizard-close'));

    // The Google Sheets card is gone with the dialog; leaving the stage on it would strand
    // the walkthrough waiting for a selector that can't come back on its own.
    expect(useInsightWalkthroughStore.getState().stage).toBe('own_data_ingest');
  });

  it('leaves the stage alone when the wizard produced a tracked connection', () => {
    renderView();
    fireEvent.click(screen.getByTestId('new-source-btn'));
    act(() => {
      useInsightWalkthroughStore.setState({
        stage: 'own_data_pick_source',
        trackedConnectionId: 'conn-1',
      });
    });

    fireEvent.click(screen.getByTestId('wizard-close'));

    // A connection exists, so the fork is now waiting on its first sync — not on the wizard.
    expect(useInsightWalkthroughStore.getState().stage).toBe('own_data_pick_source');
  });
});
