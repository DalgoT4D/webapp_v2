import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateSourceStep } from '../CreateSourceStep';

// A realistic Google Sheets spec: the `credentials` oneOf carries the OAuth (Client)
// and Service-Account branches. The real connector always ships this block — the auth
// dropdown + service-account field are driven off it.
const GSHEETS_SPEC = {
  properties: {
    spreadsheet_link: { type: 'string', title: 'Spreadsheet Link' },
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

// useSourceSpec's real contract already unwraps the API's connectionSpecification
// envelope (see hooks/api/useSources.ts), so its `data` is the bare ConnectionSpecification
// that parseAirbyteSpec expects — same shape SourceForm.tsx relies on. `mock`-prefixed
// so the jest.mock factory (hoisted) may reference it; individual tests swap it to
// exercise different specs.
let mockSourceSpec: unknown = { properties: {} };

jest.mock('@/hooks/api/useSources', () => ({
  useSourceSpec: () => ({ data: mockSourceSpec, isLoading: false }),
  GOOGLE_SHEETS_SOURCE_DEFINITION_ID: 'gs',
}));
jest.mock('@/hooks/useSourceSave', () => ({
  useSourceSave: () => ({
    save: jest.fn(),
    connectGoogle: jest.fn(),
    loading: false,
    oauthConnecting: false,
    setupLogs: [],
  }),
}));

beforeEach(() => {
  mockSourceSpec = { properties: {} };
});

it('shows the in-form Google authorize button plus a Next that is disabled until authorized', () => {
  mockSourceSpec = GSHEETS_SPEC;
  render(
    <CreateSourceStep
      def={{ sourceDefinitionId: 'gs', name: 'Google Sheets' }}
      onCreated={jest.fn()}
      onBack={jest.fn()}
    />
  );
  // Default mode is Google OAuth: authentication happens in the form; Next (footer)
  // creates the source from the OAuth ref, so it stays disabled until the user has
  // authorized.
  expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument();
  expect(screen.getByTestId('wizard-next-btn')).toBeDisabled();
});

it('reveals the service-account field (and no OAuth button) when Service Account is picked', async () => {
  const user = userEvent.setup();
  mockSourceSpec = GSHEETS_SPEC;
  render(
    <CreateSourceStep
      def={{ sourceDefinitionId: 'gs', name: 'Google Sheets' }}
      onCreated={jest.fn()}
      onBack={jest.fn()}
    />
  );

  // Default: OAuth button visible, service field hidden.
  expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument();
  expect(screen.queryByTestId('gsheets-service-fields')).not.toBeInTheDocument();

  // Open the auth dropdown and choose Service Account.
  await user.click(screen.getByRole('combobox'));
  await user.click(screen.getByText('Service Account Key Authentication'));

  // Now the service-account field shows and the OAuth button is gone. The raw OAuth
  // client fields must never appear in either mode.
  expect(screen.getByTestId('gsheets-service-fields')).toBeInTheDocument();
  expect(screen.getByLabelText(/Service Account Information/i)).toBeInTheDocument();
  expect(screen.queryByTestId('gsheets-oauth-connect-btn')).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Client ID/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Client Secret/i)).not.toBeInTheDocument();
});

it('shows a Next button for non-Google sources', () => {
  render(
    <CreateSourceStep
      def={{ sourceDefinitionId: 'kobo', name: 'KoboToolbox' }}
      onCreated={jest.fn()}
      onBack={jest.fn()}
    />
  );
  expect(screen.getByTestId('wizard-next-btn')).toBeInTheDocument();
  expect(screen.getByTestId('source-helper-panel')).toBeInTheDocument();
});

// Regression guard for the whole reason this step exists: for Google Sheets the raw
// auth-credential fields (the `auth_type` oneOf: OAuth client id/secret/refresh token +
// service-account branch) must be stripped from the spec before it reaches
// ConnectorConfigForm — the "Sign in with Google" button replaces them, and the
// credentials never touch the browser. A future edit that drops the nonAuthSpec
// filtering would re-render these inputs; this test fails loudly if that happens.
it('hides the raw Google credential fields but keeps the non-auth fields', () => {
  mockSourceSpec = {
    properties: {
      spreadsheet_link: { type: 'string', title: 'Spreadsheet Link' },
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

  render(
    <CreateSourceStep
      def={{ sourceDefinitionId: 'gs', name: 'Google Sheets' }}
      onCreated={jest.fn()}
      onBack={jest.fn()}
    />
  );

  // Non-auth field renders.
  expect(screen.getByLabelText(/Spreadsheet Link/i)).toBeInTheDocument();

  // Raw credential fields must NOT render — neither by their titles nor their raw keys.
  expect(screen.queryByLabelText(/Client ID/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Client Secret/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Refresh Token/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Service Account/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/client_id/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/client_secret/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/refresh_token/i)).not.toBeInTheDocument();

  // The in-form Google sign-in button replaces the raw credential fields; the
  // footer Next creates the source once authorized.
  expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument();
  expect(screen.getByTestId('wizard-next-btn')).toBeInTheDocument();
});
