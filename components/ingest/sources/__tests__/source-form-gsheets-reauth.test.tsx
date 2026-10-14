/**
 * Re-authenticating an existing Google Sheets source in the edit dialog.
 *
 * One flow, and what it does with the answer is the point of these tests. Every consent ends in
 * Google's Picker, because under `drive.file` the grant a fresh token can act on is the one the
 * Picker creates — so re-auth always asks for the sheet again. Picking the sheet the source
 * already syncs is the expected answer; picking a different one is allowed but warned about,
 * since the connections built on this source read the old sheet's tabs.
 *
 * Real spec parser, real dialog; only the Google flow and the save call are stubbed.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SourceForm } from '../SourceForm';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet } from '@/test-utils/api';
import { updateOAuthSource } from '@/hooks/api/useSources';
import {
  connectGoogleSpreadsheet,
  pickSpreadsheetForRef,
} from '@/components/connectors/google-oauth-connect';

const mockSendOrQueue = jest.fn();
jest.mock('@/hooks/useBackendWebSocket', () => ({
  useBackendWebSocket: () => ({ sendOrQueue: mockSendOrQueue, lastMessage: null }),
}));

jest.mock('@/hooks/api/useSources', () => ({
  ...jest.requireActual('@/hooks/api/useSources'),
  updateOAuthSource: jest.fn(),
}));

jest.mock('@/components/connectors/google-oauth-connect', () => ({
  connectGoogleSpreadsheet: jest.fn(),
  pickSpreadsheetForRef: jest.fn(),
}));

const GSHEETS_SPEC = {
  connectionSpecification: {
    type: 'object',
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
  },
};

const SAVED_SHEET = 'https://docs.google.com/spreadsheets/d/old-sheet/edit';

/** An OAuth-connected source: the Client branch, pointing at the sheet picked last time. */
const SOURCE = {
  sourceId: 'src-1',
  name: 'My sheet',
  sourceDefinitionId: 'gs',
  sourceName: 'Google Sheets',
  connectionConfiguration: {
    spreadsheet_id: SAVED_SHEET,
    credentials: { auth_type: 'Client' },
  },
};

/** The same source on the other route: its link was typed, so no `drive.file` grant exists. */
const SERVICE_SOURCE = {
  ...SOURCE,
  connectionConfiguration: {
    spreadsheet_id: SAVED_SHEET,
    credentials: { auth_type: 'Service', service_account_info: '{"client_email":"a@b.iam"}' },
  },
};

/** A pick that moves the source somewhere else — the case that has to be warned about. */
const PICKED = {
  id: 'new-sheet',
  name: 'Q3 enrolments',
  url: 'https://docs.google.com/spreadsheets/d/new-sheet/edit',
};

/** Title of the sheet the source syncs today, resolved from Drive during the flow — Airbyte
 *  stores the link only, so this name never comes from the saved config. */
const PREVIOUS_SHEET_NAME = 'Support Tickets Tracker';

/** The expected pick on re-auth: the sheet the source already reads. */
const SAME_SHEET_PICK = { id: 'old-sheet', name: 'My sheet', url: SAVED_SHEET };

beforeEach(() => {
  jest.clearAllMocks();
  (connectGoogleSpreadsheet as jest.Mock).mockResolvedValue({
    ref: 'ref-abc',
    spreadsheet: PICKED,
    previousSheetName: PREVIOUS_SHEET_NAME,
  });
  (pickSpreadsheetForRef as jest.Mock).mockResolvedValue(PICKED);
  (updateOAuthSource as jest.Mock).mockResolvedValue({ sourceId: 'src-1' });
  mockApiGet.mockImplementation((url: string) => {
    if (url === '/api/airbyte/source_definitions')
      return Promise.resolve([{ sourceDefinitionId: 'gs', name: 'Google Sheets' }]);
    if (url === '/api/airbyte/sources/src-1') return Promise.resolve(SOURCE);
    if (url.includes('/specifications')) return Promise.resolve(GSHEETS_SPEC);
    return Promise.resolve(undefined);
  });
});

function renderDialog() {
  return render(<SourceForm open onClose={jest.fn()} onSuccess={jest.fn()} sourceId="src-1" />, {
    wrapper: TestWrapper,
  });
}

// Re-auth re-picks. Under `drive.file` a token reads only what was handed over in the Picker,
// so the pick is what makes the new token able to read this sheet at all.
it('re-authenticates through the Picker and saves the sheet picked back', async () => {
  (connectGoogleSpreadsheet as jest.Mock).mockResolvedValue({
    ref: 'ref-abc',
    spreadsheet: SAME_SHEET_PICK,
  });
  const user = userEvent.setup();
  renderDialog();

  await waitFor(() => expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument());
  await user.click(screen.getByTestId('gsheets-oauth-connect-btn'));

  await waitFor(() =>
    expect(connectGoogleSpreadsheet).toHaveBeenCalledWith('gs', 'Google Sheets', {
      previousSheet: SAVED_SHEET,
    })
  );
  // The sheet came back unchanged, so there is nothing to warn about.
  expect(screen.queryByTestId('gsheets-sheet-mismatch')).not.toBeInTheDocument();

  await user.click(screen.getByTestId('source-save-btn'));

  await waitFor(() =>
    expect(updateOAuthSource).toHaveBeenCalledWith(
      'src-1',
      expect.objectContaining({
        refresh_token_ref: 'ref-abc',
        config: expect.objectContaining({ spreadsheet_id: SAVED_SHEET }),
      })
    )
  );
});

it('warns that the sheet has to be picked again, and links the one to look for', async () => {
  renderDialog();

  await waitFor(() => expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument());

  expect(screen.getByTestId('gsheets-repick-hint')).toHaveTextContent(/choose the sheet again/i);
  // One link, not two: the sheet row above the note is what opens the current sheet.
  expect(screen.getByTestId('gsheets-sheet-link')).toHaveAttribute('href', SAVED_SHEET);
  expect(screen.queryByTestId('gsheets-repick-link')).not.toBeInTheDocument();
});

// The card is two rows in both hosts: authentication on top, the sheet and the button that
// changes it below. A saved source offers the swap too — changing its sheet is allowed, it is
// just warned about.
it('offers the sheet row and its swap button on a saved source', async () => {
  renderDialog();

  await waitFor(() => expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument());

  const sheetRow = screen.getByTestId('gsheets-sheet-row');
  expect(sheetRow).toContainElement(screen.getByTestId('gsheets-sheet-link'));
  expect(sheetRow).toContainElement(screen.getByTestId('gsheets-replace-sheet-btn'));
  // The authentication row holds the sign-in control and nothing else.
  expect(screen.getByTestId('gsheets-auth-row')).not.toContainElement(
    screen.getByTestId('gsheets-replace-sheet-btn')
  );
});

// No ref is held until a consent happens, and a pick without one grants nothing — so on a
// saved source this button has to run the whole flow, not just the Picker.
it('runs consent then the Picker when the sheet is swapped before any sign-in', async () => {
  const user = userEvent.setup();
  renderDialog();

  await waitFor(() => expect(screen.getByTestId('gsheets-replace-sheet-btn')).toBeInTheDocument());
  await user.click(screen.getByTestId('gsheets-replace-sheet-btn'));

  await waitFor(() =>
    expect(connectGoogleSpreadsheet).toHaveBeenCalledWith('gs', 'Google Sheets', {
      previousSheet: SAVED_SHEET,
    })
  );
  // A different sheet came back, so the same warning applies as when re-authenticating.
  expect(await screen.findByTestId('gsheets-sheet-mismatch')).toHaveTextContent(/different sheet/i);
});

// Once a consent has happened this session the ref is in hand, so swapping again costs only
// the Picker — no second trip through Google's consent screen.
it('reopens only the Picker when the sheet is swapped after signing in', async () => {
  (pickSpreadsheetForRef as jest.Mock).mockResolvedValue(SAME_SHEET_PICK);
  const user = userEvent.setup();
  renderDialog();

  await waitFor(() => expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument());
  await user.click(screen.getByTestId('gsheets-oauth-connect-btn'));
  await screen.findByTestId('gsheets-sheet-mismatch');

  await user.click(screen.getByTestId('gsheets-replace-sheet-btn'));

  await waitFor(() =>
    expect(pickSpreadsheetForRef).toHaveBeenCalledWith('Google Sheets', 'ref-abc')
  );
  expect(connectGoogleSpreadsheet).toHaveBeenCalledTimes(1);
  // Swapped back to the sheet the source syncs, so the warning goes.
  await waitFor(() =>
    expect(screen.queryByTestId('gsheets-sheet-mismatch')).not.toBeInTheDocument()
  );
});

// The warning says the wrong sheet was picked; without the link the user has nothing to
// navigate by to find the right one, which is exactly when they need it most.
it('keeps the link to the right sheet on screen while the mismatch warning is up', async () => {
  const user = userEvent.setup();
  renderDialog();

  await waitFor(() => expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument());
  await user.click(screen.getByTestId('gsheets-oauth-connect-btn'));

  await screen.findByTestId('gsheets-sheet-mismatch');
  expect(screen.getByTestId('gsheets-repick-link')).toHaveAttribute('href', SAVED_SHEET);
});

it('leaves the saved sheet alone when the consent flow fails', async () => {
  (connectGoogleSpreadsheet as jest.Mock).mockRejectedValue(new Error('Popup closed'));
  const user = userEvent.setup();
  renderDialog();

  await waitFor(() => expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument());
  await user.click(screen.getByTestId('gsheets-oauth-connect-btn'));

  await waitFor(() => expect(updateOAuthSource).not.toHaveBeenCalled());

  // The saved link is untouched underneath — the Google card still offers the old sheet.
  expect(screen.getByTestId('gsheets-sheet-link')).toHaveAttribute('href', SAVED_SHEET);

  // ...and the service-account route starts from it too: moving to a key swaps credentials,
  // not sheets, so the user only has to paste the key.
  await user.click(screen.getByTestId('gsheets-service-option-radio'));
  expect(screen.getByLabelText(/Spreadsheet Link/i)).toHaveValue(SAVED_SHEET);
});

// OAuth → key on the same source: the link is already there, the key is the only input, and the
// save updates this source (by id) with the Service branch alone.
it('moves an OAuth source to a service-account key keeping its sheet', async () => {
  const user = userEvent.setup();
  renderDialog();

  await waitFor(() => expect(screen.getByTestId('gsheets-oauth-option-radio')).toBeChecked());
  await user.click(screen.getByTestId('gsheets-service-option-radio'));

  expect(screen.getByLabelText(/Spreadsheet Link/i)).toHaveValue(SAVED_SHEET);
  expect(screen.queryByTestId('gsheets-service-sheet-mismatch')).not.toBeInTheDocument();

  await user.type(screen.getByLabelText(/Service Account/i), '{{"client_email":"k@x.iam"}');
  await user.click(screen.getByTestId('source-save-btn'));

  await waitFor(() => expect(mockSendOrQueue).toHaveBeenCalled());
  const sent = mockSendOrQueue.mock.calls[0][0];
  expect(sent.sourceId).toBe('src-1');
  expect(sent.config.spreadsheet_id).toBe(SAVED_SHEET);
  expect(sent.config.credentials).toEqual({
    auth_type: 'Service',
    service_account_info: '{"client_email":"k@x.iam"}',
  });
  expect(updateOAuthSource).not.toHaveBeenCalled();
});

it('warns when an OAuth source moving to a key is given a different link', async () => {
  const user = userEvent.setup();
  renderDialog();

  await waitFor(() => expect(screen.getByTestId('gsheets-oauth-option-radio')).toBeChecked());
  await user.click(screen.getByTestId('gsheets-service-option-radio'));

  const input = screen.getByLabelText(/Spreadsheet Link/i);
  await user.clear(input);
  await user.type(input, 'https://docs.google.com/spreadsheets/d/another-sheet-id-000000000/edit');

  expect(screen.getByTestId('gsheets-service-sheet-mismatch')).toHaveTextContent(
    /orphaned in the warehouse/i
  );
  expect(screen.getByTestId('gsheets-service-saved-sheet-link')).toHaveAttribute(
    'href',
    SAVED_SHEET
  );
});

/** Serve the service-account variant of the source instead of the OAuth one. */
function serveServiceSource() {
  mockApiGet.mockImplementation((url: string) => {
    if (url === '/api/airbyte/source_definitions')
      return Promise.resolve([{ sourceDefinitionId: 'gs', name: 'Google Sheets' }]);
    if (url === '/api/airbyte/sources/src-1') return Promise.resolve(SERVICE_SOURCE);
    if (url.includes('/specifications')) return Promise.resolve(GSHEETS_SPEC);
    return Promise.resolve(undefined);
  });
}

/** Switch to the Google card on a service-account source and click through to the Picker. */
async function switchToGoogleAndConnect(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByTestId('gsheets-service-option-radio')).toBeChecked());
  await user.click(screen.getByTestId('gsheets-oauth-option-radio'));
  await user.click(screen.getByTestId('gsheets-oauth-connect-btn'));
}

// The flow for a source that was set up with a pasted service-account key: sign in, pick the
// sheet, save. It updates the SAME source, so its connections survive — but the config that
// goes up must describe one route only. Airbyte's `credentials` oneOf sets
// additionalProperties: false, so an emptied `service_account_info` riding along with
// auth_type 'Client' matches neither branch and the save is rejected.
it('sends only the Google branch when a service-account source switches over', async () => {
  serveServiceSource();
  (connectGoogleSpreadsheet as jest.Mock).mockResolvedValue({
    ref: 'ref-abc',
    spreadsheet: SAME_SHEET_PICK,
  });
  const user = userEvent.setup();
  renderDialog();

  await switchToGoogleAndConnect(user);
  await waitFor(() => expect(connectGoogleSpreadsheet).toHaveBeenCalled());
  await user.click(screen.getByTestId('source-save-btn'));

  await waitFor(() => expect(updateOAuthSource).toHaveBeenCalled());
  const payload = (updateOAuthSource as jest.Mock).mock.calls[0][1];
  // Exact, not objectContaining: the whole point is that no key from the other branch is left.
  expect(payload.config.credentials).toEqual({ auth_type: 'Client' });
});

it('offers only sign-in, not a sheet swap, on a service-account source until it signs in', async () => {
  serveServiceSource();
  (connectGoogleSpreadsheet as jest.Mock).mockResolvedValue({
    ref: 'ref-abc',
    spreadsheet: SAME_SHEET_PICK,
  });
  const user = userEvent.setup();
  renderDialog();

  await waitFor(() => expect(screen.getByTestId('gsheets-service-option-radio')).toBeChecked());
  await user.click(screen.getByTestId('gsheets-oauth-option-radio'));

  expect(screen.getByTestId('gsheets-oauth-connect-btn')).toHaveTextContent('Sign in with Google');
  expect(screen.queryByTestId('gsheets-replace-sheet-btn')).not.toBeInTheDocument();

  await user.click(screen.getByTestId('gsheets-oauth-connect-btn'));
  expect(await screen.findByTestId('gsheets-replace-sheet-btn')).toBeInTheDocument();
});

it('runs the same pick flow for a source switching off a service-account key', async () => {
  serveServiceSource();
  (connectGoogleSpreadsheet as jest.Mock).mockResolvedValue({
    ref: 'ref-abc',
    spreadsheet: SAME_SHEET_PICK,
  });
  const user = userEvent.setup();
  renderDialog();

  await waitFor(() => expect(screen.getByTestId('gsheets-service-option-radio')).toBeChecked());
  await user.click(screen.getByTestId('gsheets-oauth-option-radio'));

  // The sheet it syncs today is named, so the user knows which file to find in the Picker.
  expect(screen.getByTestId('gsheets-repick-link')).toHaveAttribute('href', SAVED_SHEET);

  await user.click(screen.getByTestId('gsheets-oauth-connect-btn'));

  await waitFor(() =>
    expect(connectGoogleSpreadsheet).toHaveBeenCalledWith('gs', 'Google Sheets', {
      previousSheet: SAVED_SHEET,
    })
  );
  expect(await screen.findByText(new RegExp(SAME_SHEET_PICK.name))).toBeInTheDocument();
});

// This update keeps the source's id, so its connections survive it — and their catalogs describe
// the tabs of the sheet it reads today. A different pick may still be what the user meant, so it
// is taken and warned about rather than refused.
it('warns when the pick is a different spreadsheet, and still lets it be saved', async () => {
  const user = userEvent.setup();
  renderDialog();

  await waitFor(() => expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument());
  await user.click(screen.getByTestId('gsheets-oauth-connect-btn'));

  const warning = await screen.findByTestId('gsheets-sheet-mismatch');
  // Plain instruction: keep the old sheet (named when Drive gave its title), and why.
  expect(warning).toHaveTextContent(new RegExp(PREVIOUS_SHEET_NAME));
  expect(warning).toHaveTextContent(/orphaned in the warehouse/i);

  await user.click(screen.getByTestId('source-save-btn'));

  // Warned, not blocked: the sheet the user chose is what gets saved.
  await waitFor(() =>
    expect(updateOAuthSource).toHaveBeenCalledWith(
      'src-1',
      expect.objectContaining({
        refresh_token_ref: 'ref-abc',
        config: expect.objectContaining({ spreadsheet_id: PICKED.url }),
      })
    )
  );
});

// Drive names the old sheet on a best-effort basis: the grant may have been revoked, the file
// deleted, or the saved value may be a bare id no rule can parse. The warning still has to say
// what happened.
it('warns without the old name when Drive would not give one', async () => {
  (connectGoogleSpreadsheet as jest.Mock).mockResolvedValue({
    ref: 'ref-abc',
    spreadsheet: PICKED,
    previousSheetName: undefined,
  });
  const user = userEvent.setup();
  renderDialog();

  await waitFor(() => expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument());
  await user.click(screen.getByTestId('gsheets-oauth-connect-btn'));

  const warning = await screen.findByTestId('gsheets-sheet-mismatch');
  expect(warning).toHaveTextContent(/different sheet/i);
  expect(warning).toHaveTextContent(/orphaned in the warehouse/i);
  expect(warning).not.toHaveTextContent(/“/);
});

it('drops the warning once the right spreadsheet is picked', async () => {
  const user = userEvent.setup();
  renderDialog();

  await waitFor(() => expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument());
  await user.click(screen.getByTestId('gsheets-oauth-connect-btn'));
  await screen.findByTestId('gsheets-sheet-mismatch');

  // The hint told them which file to find; re-authenticating again is how they correct it.
  (connectGoogleSpreadsheet as jest.Mock).mockResolvedValue({
    ref: 'ref-def',
    spreadsheet: SAME_SHEET_PICK,
  });
  await user.click(screen.getByTestId('gsheets-oauth-connect-btn'));

  await waitFor(() =>
    expect(screen.queryByTestId('gsheets-sheet-mismatch')).not.toBeInTheDocument()
  );
});

it('warns rather than refuses when a source leaving a service-account key picks elsewhere', async () => {
  serveServiceSource();
  const user = userEvent.setup();
  renderDialog();

  await switchToGoogleAndConnect(user);

  expect(await screen.findByTestId('gsheets-sheet-mismatch')).toHaveTextContent(
    new RegExp(PREVIOUS_SHEET_NAME)
  );
  // The pick is accepted, so the source now reads as connected to the sheet just chosen.
  expect(screen.getByTestId('gsheets-picked-sheet')).toHaveTextContent(new RegExp(PICKED.name));
});

// Which route the dialog opens on is read from the SAVED config, and Airbyte does not always
// return const discriminator keys — the form has `inferDiscriminators` precisely because
// `auth_type` can be missing. The route has to be inferred from the branch's own fields, or an
// OAuth source opens on the service-account card and looks like it needs a key pasted.
describe('opening on the route the source actually saved with', () => {
  function serveSource(credentials: Record<string, unknown>) {
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/airbyte/source_definitions')
        return Promise.resolve([{ sourceDefinitionId: 'gs', name: 'Google Sheets' }]);
      if (url === '/api/airbyte/sources/src-1')
        return Promise.resolve({
          ...SOURCE,
          connectionConfiguration: { spreadsheet_id: SAVED_SHEET, credentials },
        });
      if (url.includes('/specifications')) return Promise.resolve(GSHEETS_SPEC);
      return Promise.resolve(undefined);
    });
  }

  it('opens on Google for a source whose stored auth_type says Client', async () => {
    serveSource({ auth_type: 'Client' });
    renderDialog();

    await waitFor(() => expect(screen.getByTestId('gsheets-oauth-option-radio')).toBeChecked());
  });

  it('opens on the key route for a source whose stored auth_type says Service', async () => {
    serveSource({ auth_type: 'Service', service_account_info: '{"client_email":"a@b.iam"}' });
    renderDialog();

    await waitFor(() => expect(screen.getByTestId('gsheets-service-option-radio')).toBeChecked());
  });

  it('opens on Google when auth_type is missing but the OAuth fields are there', async () => {
    serveSource({ client_id: 'cid', client_secret: '****', refresh_token: '****' });
    renderDialog();

    await waitFor(() => expect(screen.getByTestId('gsheets-oauth-option-radio')).toBeChecked());
  });

  it('opens on the key route when auth_type is missing but a key is there', async () => {
    serveSource({ service_account_info: '{"client_email":"a@b.iam"}' });
    renderDialog();

    await waitFor(() => expect(screen.getByTestId('gsheets-service-option-radio')).toBeChecked());
  });
});
