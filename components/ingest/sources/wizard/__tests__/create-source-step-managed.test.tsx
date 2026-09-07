import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddSourceWizard } from '../AddSourceWizard';
import { CreateSourceStep } from '../CreateSourceStep';

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
  useSourceSave: () => ({ save: jest.fn(), loading: false, setupLogs: [] }),
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
