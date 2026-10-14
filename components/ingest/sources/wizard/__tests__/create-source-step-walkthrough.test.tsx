import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateSourceStep } from '../CreateSourceStep';
import { connectGoogleSpreadsheet } from '@/components/connectors/google-oauth-connect';
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

jest.mock('@/components/connectors/google-oauth-connect', () => ({
  connectGoogleSpreadsheet: jest.fn(),
  pickSpreadsheetForRef: jest.fn(),
}));

const mockConnect = connectGoogleSpreadsheet as jest.MockedFunction<
  typeof connectGoogleSpreadsheet
>;

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

  it('picks the walkthrough up at the sign-in coachmark for Google Sheets', () => {
    mockSourceSpec = GSHEETS_SPEC;
    setStage('own_data_source_next');

    renderStep('Google Sheets');

    expect(stage()).toBe('own_data_sheet_auth');
  });

  it('leaves another source alone — its configure step has no sheet to coach', () => {
    // Every stage in this step names part of Google's own sign-in. A Postgres run stays on the
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
    // must not be pulled back to "sign in with Google".
    mockSourceSpec = GSHEETS_SPEC;
    setStage('chart_intro');

    renderStep('Google Sheets');

    expect(stage()).toBe('chart_intro');
  });

  it('moves past the Picker coachmark once a sheet has actually been picked', async () => {
    // The Picker stage cannot advance itself — its target is Google's dialog, and that dialog
    // is gone by the time the pick lands. This step owns the signal.
    mockSourceSpec = GSHEETS_SPEC;
    mockConnect.mockResolvedValue({
      ref: 'ref-1',
      spreadsheet: { id: 'sheet-1', name: 'Support results', url: 'https://sheet' },
    });
    setStage('own_data_sheet_picker');

    renderStep('Google Sheets');
    await userEvent.click(screen.getByTestId('gsheets-oauth-connect-btn'));

    await waitFor(() => expect(stage()).toBe('own_data_config_next'));
  });

  it('does not rewind a run that is already past the wizard when a sheet is re-picked', async () => {
    // "Choose another sheet" is a free correction a user can make at any point. It must not drag
    // someone who has moved on back to the wizard's Next button.
    mockSourceSpec = GSHEETS_SPEC;
    mockConnect.mockResolvedValue({
      ref: 'ref-1',
      spreadsheet: { id: 'sheet-1', name: 'Support results', url: 'https://sheet' },
    });
    setStage('chart_intro');

    renderStep('Google Sheets');
    await userEvent.click(screen.getByTestId('gsheets-oauth-connect-btn'));

    await waitFor(() => expect(mockConnect).toHaveBeenCalled());
    expect(stage()).toBe('chart_intro');
  });
});
