import { render } from '@testing-library/react';
import { CreateSourceStep } from '../CreateSourceStep';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import type { WalkthroughStage } from '@/components/onboarding/insight-walkthrough-constants';

const GSHEETS_SPEC = {
  required: ['spreadsheet_id'],
  properties: { spreadsheet_id: { type: 'string', title: 'Spreadsheet Link' } },
};

const POSTGRES_SPEC = {
  required: ['host'],
  properties: { host: { type: 'string', title: 'Host' } },
};

let mockSourceSpec: unknown = { properties: {} };

jest.mock('@/hooks/api/useSources', () => ({
  useSourceSpec: () => ({ data: mockSourceSpec, isLoading: false }),
  getSourceOAuthConsent: jest.fn(),
  createOAuthSource: jest.fn(),
  useManagedServiceAccount: () => ({ managed: null, isLoading: false }),
}));

jest.mock('@/hooks/useSourceSave', () => ({
  useSourceSave: () => ({ save: jest.fn(), loading: false, setupLogs: [] }),
}));

function renderStep(sourceName: string) {
  return render(
    <CreateSourceStep
      def={{ sourceDefinitionId: 'sd-1', name: sourceName }}
      onCreated={jest.fn()}
      onBack={jest.fn()}
    />
  );
}

function setStage(stage: WalkthroughStage | null, active = true) {
  useInsightWalkthroughStore.setState({
    active,
    stage,
    path: 'own_data',
    flow: 'insights',
    orgSlug: 'org-a',
  });
}

const stage = () => useInsightWalkthroughStore.getState().stage;

describe('CreateSourceStep handing over to the walkthrough', () => {
  beforeEach(() => {
    mockSourceSpec = { properties: {} };
    setStage(null, false);
  });

  it('picks the walkthrough up at the sheet-link coachmark for Google Sheets', () => {
    mockSourceSpec = GSHEETS_SPEC;
    setStage('own_data_source_next');

    renderStep('Google Sheets');

    expect(stage()).toBe('own_data_sheet_link');
  });

  it('leaves another source alone — its configure step has no sheet to coach', () => {
    // Every stage in this step names one of Google's own fields. A Postgres run stays on the
    // picker's Next stage, exactly where the guidance used to stop for everyone, and rejoins
    // at the connection step.
    mockSourceSpec = POSTGRES_SPEC;
    setStage('own_data_source_next');

    renderStep('Postgres');

    expect(stage()).toBe('own_data_source_next');
  });

  it('does nothing at all when no walkthrough is running', () => {
    mockSourceSpec = GSHEETS_SPEC;
    setStage('own_data_source_next', false);

    renderStep('Google Sheets');

    expect(stage()).toBe('own_data_source_next');
  });

  it('does not drag a run that is already past the wizard backwards', () => {
    // advanceIfBefore is what keeps this safe: someone rebuilding a source mid-chart-flow
    // must not be pulled back to "paste your sheet link".
    mockSourceSpec = GSHEETS_SPEC;
    setStage('chart_intro');

    renderStep('Google Sheets');

    expect(stage()).toBe('chart_intro');
  });
});
