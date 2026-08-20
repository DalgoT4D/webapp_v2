/**
 * Re-authenticating an existing Google Sheets source in the edit dialog.
 *
 * Two flows meet here, and which one runs is the point of these tests. A source already on the
 * Google route only re-consents: Google records the `drive.file` grant against (client, user,
 * file), so a fresh token still reads its sheet, and showing a file chooser would only invite an
 * accidental repoint. A source moving over from a service-account key has no grant to inherit —
 * its link was typed — so that one runs the full pick.
 *
 * Real spec parser, real dialog; only the Google flows and the save call are stubbed.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SourceForm } from '../SourceForm';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet } from '@/test-utils/api';
import { updateOAuthSource } from '@/hooks/api/useSources';
import {
  connectGoogleSpreadsheet,
  reconnectGoogle,
} from '@/components/connectors/google-oauth-connect';

jest.mock('@/hooks/useBackendWebSocket', () => ({
  useBackendWebSocket: () => ({ sendOrQueue: jest.fn(), lastMessage: null }),
}));

jest.mock('@/hooks/api/useSources', () => ({
  ...jest.requireActual('@/hooks/api/useSources'),
  updateOAuthSource: jest.fn(),
}));

jest.mock('@/components/connectors/google-oauth-connect', () => ({
  connectGoogleSpreadsheet: jest.fn(),
  reconnectGoogle: jest.fn(),
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

/** A pick that moves the source somewhere else — the case the guard has to refuse. */
const PICKED = {
  id: 'new-sheet',
  name: 'Q3 enrolments',
  url: 'https://docs.google.com/spreadsheets/d/new-sheet/edit',
};

/** The correct pick when switching auth method: the sheet the source already reads. */
const SAME_SHEET_PICK = { id: 'old-sheet', name: 'My sheet', url: SAVED_SHEET };

beforeEach(() => {
  jest.clearAllMocks();
  (connectGoogleSpreadsheet as jest.Mock).mockResolvedValue({
    ref: 'ref-abc',
    spreadsheet: PICKED,
  });
  (reconnectGoogle as jest.Mock).mockResolvedValue({ ref: 'ref-abc' });
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

it('reconnects without the Picker and saves the same sheet', async () => {
  const user = userEvent.setup();
  renderDialog();

  await waitFor(() => expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument());
  await user.click(screen.getByTestId('gsheets-oauth-connect-btn'));

  await waitFor(() => expect(reconnectGoogle).toHaveBeenCalledWith('gs', 'Google Sheets'));
  // No file chooser: a stray click in one is how a source silently ends up on another sheet,
  // changing its streams and breaking the connection built on them.
  expect(connectGoogleSpreadsheet).not.toHaveBeenCalled();

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

it('says that reconnecting keeps the sheet, and where to go to change it', async () => {
  renderDialog();

  await waitFor(() => expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument());

  expect(screen.getByTestId('gsheets-reconnect-hint')).toHaveTextContent(/same sheet/i);
  expect(screen.getByTestId('gsheets-reconnect-hint')).toHaveTextContent(/new source/i);
});

it('leaves the saved sheet alone when the consent flow fails', async () => {
  (reconnectGoogle as jest.Mock).mockRejectedValue(new Error('Popup closed'));
  const user = userEvent.setup();
  renderDialog();

  await waitFor(() => expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument());
  await user.click(screen.getByTestId('gsheets-oauth-connect-btn'));

  await waitFor(() => expect(updateOAuthSource).not.toHaveBeenCalled());

  // The saved link is untouched underneath — the Google card still offers the old sheet.
  expect(screen.getByTestId('gsheets-sheet-link')).toHaveAttribute('href', SAVED_SHEET);

  // ...but it stays out of the service-account route's input: `drive.file` granted that link to
  // the OAuth token, so pre-filling it there promises a key access it does not have.
  await user.click(screen.getByTestId('gsheets-service-option-radio'));
  expect(screen.getByLabelText(/Spreadsheet Link/i)).toHaveValue('');
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

// A service-account source moving to Google is the one edit-mode case that DOES pick: its link
// was typed, so no `drive.file` grant exists for it and a fresh token would read nothing.
it('runs the full pick flow for a source switching off a service-account key', async () => {
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

  await waitFor(() => expect(connectGoogleSpreadsheet).toHaveBeenCalledWith('gs', 'Google Sheets'));
  expect(reconnectGoogle).not.toHaveBeenCalled();
  expect(await screen.findByText(new RegExp(SAME_SHEET_PICK.name))).toBeInTheDocument();
});

// This update keeps the source's id, so its connections survive it — and their catalogs describe
// the tabs of the sheet it reads today. A different pick would leave them on streams that are
// gone, so the pick is rejected rather than warned about.
it('rejects a pick that is a different spreadsheet', async () => {
  serveServiceSource();
  const user = userEvent.setup();
  renderDialog();

  await switchToGoogleAndConnect(user);

  const error = await screen.findByTestId('gsheets-auth-error');
  expect(error).toHaveTextContent(/different spreadsheet/i);
  expect(error).toHaveTextContent(/new source/i);
});

it('keeps the source on its service-account key when a pick is rejected', async () => {
  serveServiceSource();
  const user = userEvent.setup();
  renderDialog();

  await switchToGoogleAndConnect(user);
  await screen.findByTestId('gsheets-auth-error');

  // No ref was kept, so nothing claims the source is connected. The error names the rejected
  // sheet, but no confirmation chip does — that would read as "added".
  expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument();
  expect(screen.queryByTestId('gsheets-picked-sheet')).not.toBeInTheDocument();

  await user.click(screen.getByTestId('gsheets-service-option-radio'));
  expect(screen.getByLabelText(/Spreadsheet Link/i)).toHaveValue(SAVED_SHEET);
});
