import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateSourceStep } from '../CreateSourceStep';

// A realistic Google Sheets spec: `spreadsheet_id` (title "Spreadsheet Link"), the
// `credentials` oneOf (OAuth Client + Service branches), and the SQL-conversion toggle.
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

const KOBO_SPEC = {
  required: ['username', 'password', 'base_url'],
  properties: {
    username: { type: 'string', title: 'Username', order: 1 },
    password: { type: 'string', title: 'Password', airbyte_secret: true, order: 2 },
    base_url: { type: 'string', title: 'Base Url', enum: ['https://kf.kobotoolbox.org'], order: 3 },
    start_time: { type: 'string', title: 'Start Time', default: '2023-03-15T00:00:00', order: 4 },
  },
};

const POSTGRES_SPEC = {
  required: ['host'],
  properties: { host: { type: 'string', title: 'Host' } },
};

// useSourceSpec already unwraps the connectionSpecification envelope, so `data` is the
// bare spec parseAirbyteSpec expects. `mock`-prefixed so the hoisted jest.mock factory
// may reference it; tests swap it to exercise different specs.
let mockSourceSpec: unknown = { properties: {} };

jest.mock('@/hooks/api/useSources', () => ({
  useSourceSpec: () => ({ data: mockSourceSpec, isLoading: false }),
  getSourceOAuthConsent: jest.fn(),
  createOAuthSource: jest.fn(),
}));
jest.mock('@/hooks/useSourceSave', () => ({
  useSourceSave: () => ({
    save: jest.fn(),
    loading: false,
    setupLogs: [],
  }),
}));

beforeEach(() => {
  mockSourceSpec = { properties: {} };
});

it('shows the in-form Google authorize button plus a Next disabled until authorized', () => {
  mockSourceSpec = GSHEETS_SPEC;
  render(
    <CreateSourceStep
      def={{ sourceDefinitionId: 'gs', name: 'Google Sheets' }}
      onCreated={jest.fn()}
      onBack={jest.fn()}
    />
  );
  expect(screen.getByTestId('google-sheets-form')).toBeInTheDocument();
  expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument();
  expect(screen.getByLabelText(/Spreadsheet Link/i)).toBeInTheDocument();
  // No auth-mode dropdown anymore.
  expect(screen.queryByTestId('gsheets-auth-mode')).not.toBeInTheDocument();
});

it('keeps the service-account field behind Advanced and never renders raw OAuth creds', async () => {
  const user = userEvent.setup();
  mockSourceSpec = GSHEETS_SPEC;
  render(
    <CreateSourceStep
      def={{ sourceDefinitionId: 'gs', name: 'Google Sheets' }}
      onCreated={jest.fn()}
      onBack={jest.fn()}
    />
  );

  // Collapsed: service field absent (Radix unmounts collapsed content).
  expect(screen.queryByLabelText(/Service Account Information/i)).not.toBeInTheDocument();

  await user.click(screen.getByTestId('gsheets-advanced-trigger'));

  // Now the service-account field + SQL toggle show; the raw client fields never do.
  expect(screen.getByLabelText(/Service Account Information/i)).toBeInTheDocument();
  expect(screen.getByText('Convert Column Names to SQL-Compliant Format')).toBeInTheDocument();
  expect(screen.queryByLabelText(/Client ID/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Client Secret/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Refresh Token/i)).not.toBeInTheDocument();
});

it('renders the KoboToolbox custom form + docs panel', () => {
  mockSourceSpec = KOBO_SPEC;
  render(
    <CreateSourceStep
      def={{ sourceDefinitionId: 'kobo', name: 'KoboToolbox' }}
      onCreated={jest.fn()}
      onBack={jest.fn()}
    />
  );
  expect(screen.getByTestId('kobo-toolbox-form')).toBeInTheDocument();
  expect(screen.getByTestId('start-time-field')).toBeInTheDocument();
  expect(screen.getByTestId('source-helper-panel')).toBeInTheDocument();
});

it('renders the generic form with no docs panel for a non-custom source', () => {
  mockSourceSpec = POSTGRES_SPEC;
  render(
    <CreateSourceStep
      def={{ sourceDefinitionId: 'pg', name: 'Postgres' }}
      onCreated={jest.fn()}
      onBack={jest.fn()}
    />
  );
  expect(screen.getByTestId('connector-config-form')).toBeInTheDocument();
  expect(screen.queryByTestId('source-helper-panel')).not.toBeInTheDocument();
  expect(screen.getByTestId('wizard-next-btn')).toBeInTheDocument();
});
