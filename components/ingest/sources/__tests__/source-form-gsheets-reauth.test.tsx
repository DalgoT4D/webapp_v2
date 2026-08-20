/**
 * Re-authenticating an existing Google Sheets source in the edit dialog.
 *
 * Under the `drive.file` scope, re-authenticating is also re-picking: a fresh consent grants
 * nothing on its own, so the sheet has to be selected in Google's Picker again and the saved
 * config has to follow that selection. Real spec parser, real dialog; only the Google flow
 * and the save call are stubbed.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SourceForm } from '../SourceForm';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet } from '@/test-utils/api';
import { updateOAuthSource } from '@/hooks/api/useSources';
import { connectGoogleSpreadsheet } from '@/components/connectors/google-oauth-connect';

jest.mock('@/hooks/useBackendWebSocket', () => ({
  useBackendWebSocket: () => ({ sendOrQueue: jest.fn(), lastMessage: null }),
}));

jest.mock('@/hooks/api/useSources', () => ({
  ...jest.requireActual('@/hooks/api/useSources'),
  updateOAuthSource: jest.fn(),
}));

jest.mock('@/components/connectors/google-oauth-connect', () => ({
  connectGoogleSpreadsheet: jest.fn(),
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

/** An OAuth-connected source: the Client branch, pointing at the sheet picked last time. */
const SOURCE = {
  sourceId: 'src-1',
  name: 'My sheet',
  sourceDefinitionId: 'gs',
  sourceName: 'Google Sheets',
  connectionConfiguration: {
    spreadsheet_id: 'https://docs.google.com/spreadsheets/d/old-sheet/edit',
    credentials: { auth_type: 'Client' },
  },
};

const PICKED = {
  id: 'new-sheet',
  name: 'Q3 enrolments',
  url: 'https://docs.google.com/spreadsheets/d/new-sheet/edit',
};

beforeEach(() => {
  jest.clearAllMocks();
  (connectGoogleSpreadsheet as jest.Mock).mockResolvedValue({
    ref: 'ref-abc',
    spreadsheet: PICKED,
  });
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

it('re-picks the sheet and saves the newly granted link', async () => {
  const user = userEvent.setup();
  renderDialog();

  await waitFor(() => expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument());
  await user.click(screen.getByTestId('gsheets-oauth-connect-btn'));

  // The Google route renders no link input — the sheet the Picker returned is confirmed by
  // name instead, and the link itself is asserted on the save payload below.
  await waitFor(() => expect(screen.getByText(new RegExp(PICKED.name))).toBeInTheDocument());
  expect(connectGoogleSpreadsheet).toHaveBeenCalledWith('gs', 'Google Sheets');

  await user.click(screen.getByTestId('source-save-btn'));

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

it('leaves the saved sheet alone when the Google flow is abandoned', async () => {
  (connectGoogleSpreadsheet as jest.Mock).mockRejectedValue(
    new Error('No spreadsheet selected — choose one to finish connecting Google')
  );
  const user = userEvent.setup();
  renderDialog();

  await waitFor(() => expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument());
  await user.click(screen.getByTestId('gsheets-oauth-connect-btn'));

  await waitFor(() => expect(updateOAuthSource).not.toHaveBeenCalled());
  // No ref was acquired, so the button stays on its un-authenticated label and nothing claims
  // a sheet was picked.
  expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument();
  expect(screen.queryByText(new RegExp(PICKED.name))).not.toBeInTheDocument();

  // The saved link is untouched underneath: the service-account route is the one that renders
  // it, so switching there reveals the form's current value.
  await user.click(screen.getByTestId('gsheets-service-option-radio'));
  expect(screen.getByLabelText(/Spreadsheet Link/i)).toHaveValue(
    'https://docs.google.com/spreadsheets/d/old-sheet/edit'
  );
});
