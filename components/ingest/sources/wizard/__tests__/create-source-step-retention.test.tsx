import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateSourceStep } from '../CreateSourceStep';
import { InsightWalkthroughCoachmark } from '@/components/onboarding/insight-walkthrough-coachmark';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';

jest.mock('next/navigation', () => ({ usePathname: () => window.location.pathname }));

// The walkthrough's Back/Next buttons re-drive the coachmark over a step that is already filled
// in. Nothing in the form is remounted on purpose, so a regression here would be silent: the
// popover would still walk, and the user's typing would be gone by the time they reached Next.
const GSHEETS_SPEC = {
  required: ['spreadsheet_id', 'credentials'],
  properties: {
    spreadsheet_id: { type: 'string', title: 'Spreadsheet Link' },
    credentials: {
      type: 'object',
      title: 'Authentication',
      oneOf: [
        {
          title: 'Authenticate via Google (OAuth)',
          required: ['auth_type', 'client_id', 'client_secret', 'refresh_token'],
          properties: {
            auth_type: { type: 'string', const: 'Client' },
            client_id: { type: 'string', title: 'Client ID' },
            client_secret: { type: 'string', title: 'Client Secret', airbyte_secret: true },
            refresh_token: { type: 'string', title: 'Refresh Token', airbyte_secret: true },
          },
        },
        {
          title: 'Service Account Key Authentication',
          required: ['auth_type', 'service_account_info'],
          properties: {
            auth_type: { type: 'string', const: 'Service' },
            service_account_info: {
              type: 'string',
              title: 'Service Account Information',
              airbyte_secret: true,
            },
          },
        },
      ],
    },
  },
};

jest.mock('@/hooks/api/useSources', () => ({
  useSourceSpec: () => ({ data: GSHEETS_SPEC, isLoading: false }),
  getSourceOAuthConsent: jest.fn(),
  getSourceOAuthPickerConfig: jest.fn(),
  createOAuthSource: jest.fn(),
}));
jest.mock('@/hooks/useSourceSave', () => ({
  useSourceSave: (): { save: jest.Mock; loading: boolean; setupLogs: never[] } => ({
    save: jest.fn(),
    loading: false,
    setupLogs: [],
  }),
}));

it('retains the sheet URL, authentication choice and entered key during Back/Next review', async () => {
  window.history.replaceState({}, '', '/ingest');
  const user = userEvent.setup();
  render(
    <>
      <CreateSourceStep
        def={{ sourceDefinitionId: 'gs', name: 'Google Sheets' }}
        onCreated={jest.fn()}
        onBack={jest.fn()}
      />
      <InsightWalkthroughCoachmark />
    </>
  );
  await user.click(screen.getByTestId('gsheets-service-option'));
  const sheet = screen.getByLabelText(/Spreadsheet Link/i);
  await user.type(sheet, 'https://docs.google.com/spreadsheets/d/test-sheet/edit');
  const key = screen.getByLabelText(/Service Account Information/i);
  await user.type(key, '{{"test_key":"preserve-me"}');
  const savedKey = (key as HTMLInputElement).value;
  act(() =>
    useInsightWalkthroughStore.setState({
      active: true,
      orgSlug: 'org-a',
      path: 'own_data',
      flow: 'insights',
      stage: 'own_data_config_next',
      reviewReturnStage: null,
      trackedConnectionId: null,
      suppressCoachmark: false,
    })
  );
  const button = (name: string) =>
    within(document.querySelector('.driver-popover') as HTMLElement).getByRole('button', {
      name,
    });
  await waitFor(() => expect(document.querySelector('.driver-popover')).toBeTruthy());
  await waitFor(() => expect(button('Back')).toBeVisible());
  // The Picker stage in between is skipped in both directions: its target is Google's own
  // dialog, which is only on screen while the Picker is actually open (see canReviewStage).
  await user.click(button('Back'));
  await waitFor(() =>
    expect(useInsightWalkthroughStore.getState().stage).toBe('own_data_sheet_auth')
  );
  await waitFor(() => expect(button('Next')).toBeVisible());
  await user.click(button('Next'));
  await waitFor(() =>
    expect(useInsightWalkthroughStore.getState().stage).toBe('own_data_config_next')
  );
  expect(sheet).toHaveValue('https://docs.google.com/spreadsheets/d/test-sheet/edit');
  expect(key).toHaveValue(savedKey);
  expect(screen.getByTestId('gsheets-service-option-radio')).toBeChecked();
  act(() =>
    useInsightWalkthroughStore.setState({ active: false, stage: null, reviewReturnStage: null })
  );
});
