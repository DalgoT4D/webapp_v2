import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { IngestView } from '../ingest-view';
import { useWarehouse } from '@/hooks/api/useWarehouse';
import { useSources } from '@/hooks/api/useSources';
import { useConnectionsList } from '@/hooks/api/useConnections';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import * as rbac from '@/lib/rbac';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/api/useWarehouse');
jest.mock('@/hooks/api/useSources');
jest.mock('@/hooks/api/useConnections');
jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));
// Keep this test focused on state routing — stub the heavy steady subtree. The
// stale flag is surfaced as an attribute so the wizard-completion test can assert
// what gets handed down.
jest.mock('../steady-view', () => ({
  SteadyView: ({ connectionsKnownStale }: { connectionsKnownStale?: boolean }) => (
    <div
      data-testid="ingest-steady-view"
      data-connections-stale={String(!!connectionsKnownStale)}
    />
  ),
}));
// The wizard has its own tests; here we only assert the header wires it up. onClose is
// exposed as a button so the walkthrough tests below can dismiss it, and onComplete so
// the connection-created handoff can be exercised.
jest.mock('@/components/ingest/sources/wizard/AddSourceWizard', () => ({
  AddSourceWizard: ({
    open,
    onClose,
    onComplete,
  }: {
    open: boolean;
    onClose: () => void;
    onComplete: (result: { connectionCreated: boolean }) => void;
  }) =>
    open ? (
      <div data-testid="wizard-open">
        <button type="button" data-testid="wizard-close" onClick={onClose} />
        <button
          type="button"
          data-testid="wizard-complete-with-connection"
          onClick={() => onComplete({ connectionCreated: true })}
        />
      </div>
    ) : null,
}));

const mockWarehouse = useWarehouse as jest.Mock;
const mockSources = useSources as jest.Mock;
const mockConnections = useConnectionsList as jest.Mock;
const mockPermissions = rbac.useRbac as jest.Mock;

function renderView() {
  return render(<IngestView />);
}

describe('IngestView progressive reveal', () => {
  beforeEach(() => {
    mockPermissions.mockReturnValue({ hasPermission: () => true });
    mockConnections.mockReturnValue({ data: [], isLoading: false, mutate: jest.fn() });
  });

  // The wizard creates the connection server-side, then the list is revalidated.
  // SteadyView must be told the list is stale for exactly that window, or the new
  // source renders as "add a connection" until the fetch lands.
  it('marks connections stale while revalidating after the wizard creates one', async () => {
    let resolveMutate!: () => void;
    const mutate = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveMutate = resolve;
        })
    );
    mockConnections.mockReturnValue({ data: [], isLoading: false, mutate });
    mockWarehouse.mockReturnValue({ data: { name: 'wh' }, isLoading: false, mutate: jest.fn() });
    mockSources.mockReturnValue({
      data: [{ sourceId: 's1' }],
      isLoading: false,
      mutate: jest.fn(),
    });
    renderView();

    const steady = () => screen.getByTestId('ingest-steady-view');
    expect(steady()).toHaveAttribute('data-connections-stale', 'false');

    fireEvent.click(screen.getByTestId('new-source-btn'));
    fireEvent.click(screen.getByTestId('wizard-complete-with-connection'));

    expect(steady()).toHaveAttribute('data-connections-stale', 'true');

    await act(async () => {
      resolveMutate();
    });
    await waitFor(() => expect(steady()).toHaveAttribute('data-connections-stale', 'false'));
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

  it('shows the error card — and never the warehouse wizard — when the warehouse fetch fails', () => {
    // Regression: SWR sits at data:undefined/isLoading:false between error retries. That used
    // to read as NO_WAREHOUSE and auto-open the wizard at "Set up your warehouse" for orgs
    // that already had one.
    mockWarehouse.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: new Error('500'),
      mutate: jest.fn(),
    });
    mockSources.mockReturnValue({ data: [], isLoading: false, mutate: jest.fn() });
    renderView();

    expect(screen.getByTestId('ingest-error')).toBeInTheDocument();
    expect(screen.queryByTestId('ingest-empty-warehouse')).not.toBeInTheDocument();
    expect(screen.queryByTestId('wizard-open')).not.toBeInTheDocument();
  });

  it('re-fetches warehouse and sources from the error card retry', () => {
    const warehouseMutate = jest.fn();
    const sourcesMutate = jest.fn();
    mockWarehouse.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: new Error('500'),
      mutate: warehouseMutate,
    });
    mockSources.mockReturnValue({ data: [], isLoading: false, mutate: sourcesMutate });
    renderView();

    fireEvent.click(screen.getByTestId('ingest-error-retry-btn'));
    expect(warehouseMutate).toHaveBeenCalled();
    expect(sourcesMutate).toHaveBeenCalled();
  });

  it('auto-opens the wizard when the server confirms the org has no warehouse', () => {
    mockWarehouse.mockReturnValue({ data: undefined, isLoading: false, mutate: jest.fn() });
    mockSources.mockReturnValue({ data: [], isLoading: false, mutate: jest.fn() });
    renderView();
    expect(screen.getByTestId('wizard-open')).toBeInTheDocument();
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

  it('un-suppresses the coachmark when the page unmounts with the wizard still open', () => {
    const { unmount } = renderView();
    fireEvent.click(screen.getByTestId('new-source-btn'));
    expect(useInsightWalkthroughStore.getState().suppressCoachmark).toBe(true);

    // Leaving the page without closing the dialog (browser back, sidebar nav). The store
    // never resets this itself and it isn't persisted, so a latched `true` hides coachmarks
    // on every other page until a full reload.
    unmount();

    expect(useInsightWalkthroughStore.getState().suppressCoachmark).toBe(false);
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
