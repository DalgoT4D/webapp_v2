import { render, screen } from '@testing-library/react';
import { CreateSourceStep } from '../CreateSourceStep';

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

it('shows only the Google sign-in button (no Next) for Google Sheets', () => {
  render(
    <CreateSourceStep
      def={{ sourceDefinitionId: 'gs', name: 'Google Sheets' }}
      onCreated={jest.fn()}
      onBack={jest.fn()}
    />
  );
  expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument();
  expect(screen.queryByTestId('wizard-next-btn')).not.toBeInTheDocument();
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

  // The Google sign-in button replaces auth; no Next button.
  expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument();
  expect(screen.queryByTestId('wizard-next-btn')).not.toBeInTheDocument();
});
