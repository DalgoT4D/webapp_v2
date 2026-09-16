import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateSourceStep } from '../CreateSourceStep';
import { createOAuthSource } from '@/hooks/api/useSources';
import {
  connectGoogleSpreadsheet,
  pickSpreadsheetForRef,
} from '@/components/connectors/google-oauth-connect';
import { PickerCancelledError } from '@/components/connectors/google-picker';

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
const mockSave = jest.fn();
jest.mock('@/hooks/useSourceSave', () => ({
  useSourceSave: () => ({
    save: mockSave,
    loading: false,
    setupLogs: [],
  }),
}));
// consent + popup + Google Picker as one flow (see google-oauth-connect)
jest.mock('@/components/connectors/google-oauth-connect', () => ({
  connectGoogleSpreadsheet: jest.fn(),
  pickSpreadsheetForRef: jest.fn(),
}));

const PICKED = {
  id: 'sheet-id',
  name: 'Q3 enrolments',
  url: 'https://docs.google.com/spreadsheets/d/sheet-id/edit',
};

/** What the user swaps to via "Replace Google Sheet", before anything is saved. */
const REPICKED = {
  id: 'other-sheet-id',
  name: 'Q4 enrolments',
  url: 'https://docs.google.com/spreadsheets/d/other-sheet-id/edit',
};

beforeEach(() => {
  mockSourceSpec = { properties: {} };
  mockSave.mockClear();
  (connectGoogleSpreadsheet as jest.Mock).mockReset();
  (connectGoogleSpreadsheet as jest.Mock).mockResolvedValue({
    ref: 'ref-abc',
    spreadsheet: PICKED,
  });
  (pickSpreadsheetForRef as jest.Mock).mockReset();
  (pickSpreadsheetForRef as jest.Mock).mockResolvedValue(REPICKED);
  (createOAuthSource as jest.Mock).mockReset();
  (createOAuthSource as jest.Mock).mockResolvedValue({ sourceId: 'src-oauth' });
});

/** Render the Google Sheets step and authorize, leaving PICKED as the chosen sheet. */
async function authorizeGoogleSheets(onCreated = jest.fn()) {
  mockSourceSpec = GSHEETS_SPEC;
  render(
    <CreateSourceStep
      def={{ sourceDefinitionId: 'gs', name: 'Google Sheets' }}
      onCreated={onCreated}
      onBack={jest.fn()}
    />
  );
  await userEvent.click(screen.getByTestId('gsheets-oauth-connect-btn'));
  await waitFor(() => expect(screen.getByText(new RegExp(PICKED.name))).toBeInTheDocument());
}

// Under `drive.file` the user names the sheet inside Google's Picker, so the flow has to
// bring that choice back into the form — and save exactly it.
it('fills the spreadsheet link from the Google Picker and saves that link', async () => {
  mockSourceSpec = GSHEETS_SPEC;
  const onCreated = jest.fn();
  render(
    <CreateSourceStep
      def={{ sourceDefinitionId: 'gs', name: 'Google Sheets' }}
      onCreated={onCreated}
      onBack={jest.fn()}
    />
  );

  await userEvent.click(screen.getByTestId('gsheets-oauth-connect-btn'));

  // The Google route renders no link input — the Picker's answer is confirmed by name, and
  // the link itself is asserted on the create payload below.
  await waitFor(() => expect(screen.getByText(new RegExp(PICKED.name))).toBeInTheDocument());
  expect(connectGoogleSpreadsheet).toHaveBeenCalledWith('gs', 'Google Sheets');

  await userEvent.click(screen.getByTestId('wizard-next-btn'));

  await waitFor(() =>
    expect(createOAuthSource).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceDefId: 'gs',
        sourceName: 'Google Sheets',
        refresh_token_ref: 'ref-abc',
        config: expect.objectContaining({ spreadsheet_id: PICKED.url }),
      })
    )
  );
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith('src-oauth'));
});

// Picking the wrong file in the Picker is easy, and before the source exists there is nothing
// to protect — so the chosen sheet stays swappable without another consent round-trip.
it('swaps the chosen sheet through Replace Google Sheet, and creates the source on the new one', async () => {
  await authorizeGoogleSheets();

  await userEvent.click(screen.getByTestId('gsheets-replace-sheet-btn'));

  await waitFor(() => expect(screen.getByText(new RegExp(REPICKED.name))).toBeInTheDocument());
  expect(pickSpreadsheetForRef).toHaveBeenCalledWith('Google Sheets', 'ref-abc');
  // The ref survives the swap, so Google never asks for consent a second time.
  expect(connectGoogleSpreadsheet).toHaveBeenCalledTimes(1);

  await userEvent.click(screen.getByTestId('wizard-next-btn'));

  await waitFor(() =>
    expect(createOAuthSource).toHaveBeenCalledWith(
      expect.objectContaining({
        refresh_token_ref: 'ref-abc',
        config: expect.objectContaining({ spreadsheet_id: REPICKED.url }),
      })
    )
  );
});

it('keeps the sheet already chosen when the replace Picker is closed without choosing', async () => {
  await authorizeGoogleSheets();
  (pickSpreadsheetForRef as jest.Mock).mockRejectedValue(new PickerCancelledError());

  await userEvent.click(screen.getByTestId('gsheets-replace-sheet-btn'));

  // Changing their mind about changing their mind is not an error: the first pick still stands.
  await waitFor(() => expect(screen.getByText(new RegExp(PICKED.name))).toBeInTheDocument());
  expect(screen.getByTestId('gsheets-replace-sheet-btn')).toBeInTheDocument();
});

it('re-runs consent when the ref behind Replace Google Sheet has expired', async () => {
  await authorizeGoogleSheets();
  (pickSpreadsheetForRef as jest.Mock).mockRejectedValue(
    new Error('invalid or expired oauth session')
  );
  (connectGoogleSpreadsheet as jest.Mock).mockResolvedValue({
    ref: 'ref-fresh',
    spreadsheet: REPICKED,
  });

  await userEvent.click(screen.getByTestId('gsheets-replace-sheet-btn'));

  // A ref only lives minutes; an expired one is recoverable by consenting again, so the user
  // lands back in the Picker rather than on an error they can do nothing with.
  await waitFor(() => expect(connectGoogleSpreadsheet).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByText(new RegExp(REPICKED.name))).toBeInTheDocument());
});

// The hint tells an existing source which sheet to pick back. A source being created syncs
// nothing yet, so there is no such sheet — and a link typed on the service-account route is
// not one either.
it('never asks the wizard to pick back a sheet, even after a link is typed on the other route', async () => {
  const user = userEvent.setup();
  mockSourceSpec = GSHEETS_SPEC;
  render(
    <CreateSourceStep
      def={{ sourceDefinitionId: 'gs', name: 'Google Sheets' }}
      onCreated={jest.fn()}
      onBack={jest.fn()}
    />
  );

  await user.click(screen.getByTestId('gsheets-service-option-radio'));
  await user.type(screen.getByLabelText(/Spreadsheet Link/i), PICKED.url);
  await user.click(screen.getByTestId('gsheets-oauth-option-radio'));

  expect(screen.queryByTestId('gsheets-repick-hint')).not.toBeInTheDocument();
});

it('keeps the wizard on the service-account path when the Google flow fails', async () => {
  mockSourceSpec = GSHEETS_SPEC;
  (connectGoogleSpreadsheet as jest.Mock).mockRejectedValue(
    new Error('No spreadsheet selected — choose one to finish connecting Google')
  );
  render(
    <CreateSourceStep
      def={{ sourceDefinitionId: 'gs', name: 'Google Sheets' }}
      onCreated={jest.fn()}
      onBack={jest.fn()}
    />
  );

  await userEvent.click(screen.getByTestId('gsheets-oauth-connect-btn'));

  // no ref was stashed, so the sign-in button is still on offer and nothing was created
  await waitFor(() => expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument());
  expect(createOAuthSource).not.toHaveBeenCalled();
});

it('opens on the Google route, with nothing for the user to fill in but the name', () => {
  mockSourceSpec = GSHEETS_SPEC;
  render(
    <CreateSourceStep
      def={{ sourceDefinitionId: 'gs', name: 'Google Sheets' }}
      onCreated={jest.fn()}
      onBack={jest.fn()}
    />
  );
  expect(screen.getByTestId('google-sheets-form')).toBeInTheDocument();
  expect(screen.getByTestId('gsheets-oauth-option-radio')).toBeChecked();
  expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument();
  // Both belong to the service-account route, which is not the selected one.
  expect(screen.queryByLabelText(/Spreadsheet Link/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Service Account Information/i)).not.toBeInTheDocument();
});

it('keeps the service-account fields on their own route and never renders raw OAuth creds', async () => {
  const user = userEvent.setup();
  mockSourceSpec = GSHEETS_SPEC;
  render(
    <CreateSourceStep
      def={{ sourceDefinitionId: 'gs', name: 'Google Sheets' }}
      onCreated={jest.fn()}
      onBack={jest.fn()}
    />
  );

  await user.click(screen.getByTestId('gsheets-service-option-radio'));

  // This route owns both inputs: no Picker exists for a service account, so the sheet is named
  // by link here.
  expect(screen.getByLabelText(/Service Account Information/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Spreadsheet Link/i)).toBeInTheDocument();
  expect(screen.queryByTestId('gsheets-oauth-connect-btn')).not.toBeInTheDocument();

  // Advanced keeps only genuine connector extras; the raw client fields never render at all.
  await user.click(screen.getByTestId('gsheets-advanced-trigger'));
  expect(screen.getByText('Convert Column Names to SQL-Compliant Format')).toBeInTheDocument();
  expect(screen.queryByLabelText(/Client ID/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Client Secret/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Refresh Token/i)).not.toBeInTheDocument();
});

it('renders the KoboToolbox custom form', () => {
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
  expect(screen.queryByTestId('source-helper-panel')).not.toBeInTheDocument();
});

it('renders the generic form for a non-custom source', () => {
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

it('blocks Next and shows inline required errors for empty spec fields (Kobo)', async () => {
  const user = userEvent.setup();
  mockSourceSpec = KOBO_SPEC;
  render(
    <CreateSourceStep
      def={{ sourceDefinitionId: 'kobo', name: 'KoboToolbox' }}
      onCreated={jest.fn()}
      onBack={jest.fn()}
    />
  );

  // Required username/password/base_url are empty — pressing Next must not save.
  await user.click(screen.getByTestId('wizard-next-btn'));

  expect(await screen.findByText('Username is required')).toBeInTheDocument();
  expect(screen.getByText('Password is required')).toBeInTheDocument();
  expect(mockSave).not.toHaveBeenCalled();
});

it('blocks Next with an inline error when the source name is cleared', async () => {
  const user = userEvent.setup();
  mockSourceSpec = POSTGRES_SPEC;
  render(
    <CreateSourceStep
      def={{ sourceDefinitionId: 'pg', name: 'Postgres' }}
      onCreated={jest.fn()}
      onBack={jest.fn()}
    />
  );

  await user.clear(screen.getByTestId('wizard-source-name'));
  await user.click(screen.getByTestId('wizard-next-btn'));

  expect(await screen.findByTestId('wizard-source-name-error')).toBeInTheDocument();
  expect(mockSave).not.toHaveBeenCalled();
});

it('saves when name and required spec fields are filled (generic source)', async () => {
  const user = userEvent.setup();
  mockSourceSpec = POSTGRES_SPEC;
  render(
    <CreateSourceStep
      def={{ sourceDefinitionId: 'pg', name: 'Postgres' }}
      onCreated={jest.fn()}
      onBack={jest.fn()}
    />
  );

  // Name is prefilled ("Postgres source"); fill the required host, then Next saves.
  await user.type(screen.getByLabelText(/Host/i), 'db.example.com');
  await user.click(screen.getByTestId('wizard-next-btn'));

  await waitFor(() => expect(mockSave).toHaveBeenCalledWith('Postgres source'));
});
