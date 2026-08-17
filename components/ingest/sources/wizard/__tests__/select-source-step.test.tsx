import { render, screen, fireEvent } from '@testing-library/react';
import { SelectSourceStep } from '../SelectSourceStep';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import type { WalkthroughStage } from '@/components/onboarding/insight-walkthrough-constants';

jest.mock('@/hooks/api/useSources', () => ({
  useSourceDefinitions: () => ({
    data: [
      { sourceDefinitionId: 'gs', name: 'Google Sheets' },
      { sourceDefinitionId: 'kobo', name: 'KoboToolbox' },
      { sourceDefinitionId: 'cc', name: 'CommCare' },
      { sourceDefinitionId: 'scto', name: 'SurveyCTO' },
      { sourceDefinitionId: 'pg', name: 'Postgres' },
    ],
  }),
}));

it('selects a card, then fires onSelect with the definition on Next', () => {
  const onSelect = jest.fn();
  render(<SelectSourceStep onSelect={onSelect} onClose={jest.fn()} />);
  const card = screen.getByTestId('source-card-Google Sheets');
  expect(card).toBeInTheDocument();
  // Only the two custom-UI sources appear as cards; everything else is search-only.
  expect(screen.getByTestId('source-card-KoboToolbox')).toBeInTheDocument();
  expect(screen.queryByTestId('source-card-CommCare')).not.toBeInTheDocument();
  expect(screen.queryByTestId('source-card-Postgres')).not.toBeInTheDocument();

  // Next is disabled until a source is picked; clicking a card only selects it.
  expect(screen.getByTestId('wizard-select-next-btn')).toBeDisabled();
  fireEvent.click(card);
  expect(onSelect).not.toHaveBeenCalled();

  fireEvent.click(screen.getByTestId('wizard-select-next-btn'));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ sourceDefinitionId: 'gs' }));
});

it('filters the full definition list by the search box', () => {
  render(<SelectSourceStep onSelect={jest.fn()} onClose={jest.fn()} />);
  fireEvent.change(screen.getByTestId('source-search-input'), { target: { value: 'postgres' } });
  expect(screen.getByText('Postgres')).toBeInTheDocument();
});

describe('onboarding walkthrough handoff', () => {
  function setWalkthrough(stage: WalkthroughStage | null, path: 'own_data' | 'automate_pipeline') {
    useInsightWalkthroughStore.setState({
      active: true,
      orgSlug: 'org-a',
      // advanceTo persists under the live flow — without one the store can't advance at all.
      flow: path === 'automate_pipeline' ? 'automate_pipeline' : 'insights',
      path,
      stage,
    });
  }

  it.each([
    ['own_data', 'own_data_ingest', 'own_data_pick_source'],
    ['automate_pipeline', 'pipeline_ingest', 'pipeline_pick_source'],
  ] as const)(
    'unlocks the %s fork’s pick-a-source coachmark when the picker mounts',
    (path, ingestStage, pickStage) => {
      // Mount, not the New Source click: an org with no warehouse never sees that button —
      // the wizard auto-opens on its warehouse step — and those are the users this targets.
      setWalkthrough(ingestStage, path);

      render(<SelectSourceStep onSelect={jest.fn()} onClose={jest.fn()} />);

      expect(useInsightWalkthroughStore.getState().stage).toBe(pickStage);
    }
  );

  it('leaves a stage further along the fork alone', () => {
    // Reaching the picker again (Back from Configure, or a second source) must not rewind
    // a walkthrough that has already moved past ingest.
    setWalkthrough('pipeline_transform_intro', 'own_data');

    render(<SelectSourceStep onSelect={jest.fn()} onClose={jest.fn()} />);

    expect(useInsightWalkthroughStore.getState().stage).toBe('pipeline_transform_intro');
  });

  it.each([
    ['own_data', 'own_data_pick_source', 'own_data_source_next'],
    ['automate_pipeline', 'pipeline_pick_source', 'pipeline_source_next'],
  ] as const)(
    'moves the %s fork’s coachmark onto Next once a popular card is selected',
    (path, pickStage, nextStage) => {
      setWalkthrough(pickStage, path);

      render(<SelectSourceStep onSelect={jest.fn()} onClose={jest.fn()} />);
      fireEvent.click(screen.getByTestId('source-card-Google Sheets'));

      expect(useInsightWalkthroughStore.getState().stage).toBe(nextStage);
    }
  );

  it('moves the coachmark onto Next for a source picked from search too', () => {
    // Any source is a valid choice here, not just the two popular cards — a search result
    // has to hand off exactly the same way or the coachmark strands on the picker.
    setWalkthrough('own_data_pick_source', 'own_data');

    render(<SelectSourceStep onSelect={jest.fn()} onClose={jest.fn()} />);
    fireEvent.change(screen.getByTestId('source-search-input'), { target: { value: 'postgres' } });
    fireEvent.click(screen.getByTestId('source-search-result-Postgres'));

    expect(useInsightWalkthroughStore.getState().stage).toBe('own_data_source_next');
  });

  it('does nothing when no walkthrough is running', () => {
    useInsightWalkthroughStore.setState({
      active: false,
      orgSlug: null,
      flow: null,
      path: null,
      stage: null,
    });

    render(<SelectSourceStep onSelect={jest.fn()} onClose={jest.fn()} />);

    expect(useInsightWalkthroughStore.getState().stage).toBeNull();
  });
});
