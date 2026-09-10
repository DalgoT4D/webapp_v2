import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddSourceWizard } from '../AddSourceWizard';
import { CreateSourceStep } from '../CreateSourceStep';
import { InsightWalkthroughCoachmark } from '@/components/onboarding/insight-walkthrough-coachmark';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';

jest.mock('next/navigation', () => ({ usePathname: () => window.location.pathname }));

// MANAGED-SA bridge — the wizard step with a deployment-managed service account configured, which
// is what every trial deployment runs. Sibling file covers the bridge-off (OAuth) wiring.
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
    names_conversion: {
      type: 'boolean',
      title: 'Convert Column Names to SQL-Compliant Format',
      default: false,
    },
  },
};

jest.mock('@/hooks/api/useSources', () => ({
  useSourceSpec: () => ({ data: GSHEETS_SPEC, isLoading: false }),
  getSourceOAuthConsent: jest.fn(),
  createOAuthSource: jest.fn(),
  useManagedServiceAccount: () => ({
    managed: { email: 'dalgo-gsheets@dalgo-test.iam.gserviceaccount.com' },
    isLoading: false,
  }),
}));
jest.mock('@/hooks/useSourceSave', () => ({
  useSourceSave: (): { save: jest.Mock; loading: boolean; setupLogs: never[] } => ({
    save: jest.fn(),
    loading: false,
    setupLogs: [],
  }),
}));
// Wizard-in-dialog run below only needs the picker to land on Google Sheets; the later steps stay
// stubbed so the dialog itself (Radix overlay + focus scope) is the only extra machinery.
jest.mock('../SelectSourceStep', () => ({
  SelectSourceStep: ({ onSelect }: { onSelect: (def: unknown) => void }) => (
    <button
      data-testid="pick-gsheets"
      onClick={() => onSelect({ sourceDefinitionId: 'gs', name: 'Google Sheets' })}
    >
      pick
    </button>
  ),
}));
jest.mock('@/components/connections/connection-form-body', () => ({
  ConnectionFormBody: () => <div data-testid="conn-body" />,
}));
jest.mock('@/components/ingest/warehouse/warehouse-form-body', () => ({
  WarehouseFormBody: () => <div data-testid="wh-body" />,
}));

function renderStep() {
  return render(
    <CreateSourceStep
      def={{ sourceDefinitionId: 'gs', name: 'Google Sheets' }}
      onCreated={jest.fn()}
      onBack={jest.fn()}
    />
  );
}

it("mounts with Dalgo's key selected", () => {
  renderStep();
  expect(screen.getByTestId('gsheets-managed-option-radio')).toBeChecked();
});

it('switches between the two options, keeping a typed key', async () => {
  const user = userEvent.setup();
  renderStep();

  await user.click(screen.getByTestId('gsheets-own-option'));
  expect(screen.getByTestId('gsheets-own-option-radio')).toBeChecked();

  await user.type(screen.getByLabelText(/Service Account Information/i), '{{"a":1}');

  await user.click(screen.getByTestId('gsheets-managed-option'));
  expect(screen.getByTestId('gsheets-managed-option-radio')).toBeChecked();
});

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
  const sheet = screen.getByLabelText(/Spreadsheet Link/i);
  await user.type(sheet, 'https://docs.google.com/spreadsheets/d/test-sheet/edit');
  await user.click(screen.getByTestId('gsheets-own-option'));
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
  await waitFor(() => expect(button('Back')).toBeVisible());
  await user.click(button('Back'));
  await waitFor(() =>
    expect(useInsightWalkthroughStore.getState().stage).toBe('own_data_sheet_auth')
  );
  await user.click(button('Back'));
  await waitFor(() =>
    expect(useInsightWalkthroughStore.getState().stage).toBe('own_data_sheet_link')
  );
  await user.click(button('Next'));
  await waitFor(() =>
    expect(useInsightWalkthroughStore.getState().stage).toBe('own_data_sheet_auth')
  );
  await user.click(button('Next'));
  expect(useInsightWalkthroughStore.getState().stage).toBe('own_data_config_next');
  expect(sheet).toHaveValue('https://docs.google.com/spreadsheets/d/test-sheet/edit');
  expect(key).toHaveValue(savedKey);
  expect(screen.getByTestId('gsheets-own-option-radio')).toBeChecked();
  act(() =>
    useInsightWalkthroughStore.setState({ active: false, stage: null, reviewReturnStage: null })
  );
});

// The real user path: the step lives inside the wizard's Radix dialog.
it('switches options inside the wizard dialog', async () => {
  const user = userEvent.setup();
  render(<AddSourceWizard open onClose={jest.fn()} onComplete={jest.fn()} />);

  await user.click(screen.getByTestId('pick-gsheets'));
  expect(screen.getByTestId('gsheets-managed-option-radio')).toBeChecked();

  await user.click(screen.getByTestId('gsheets-own-option'));
  expect(screen.getByTestId('gsheets-own-option-radio')).toBeChecked();

  await user.click(screen.getByTestId('gsheets-managed-option'));
  expect(screen.getByTestId('gsheets-managed-option-radio')).toBeChecked();
});
