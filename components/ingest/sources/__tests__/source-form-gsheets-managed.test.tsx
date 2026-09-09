/**
 * MANAGED-SA bridge — the edit-source dialog for a Google Sheets source saved on the managed route
 * (its stored config carries the Service discriminator and no key, since Dalgo's key is injected
 * server-side). Real spec parser, real dialog: this is the path where switching auth options has to
 * stay stable. Delete with the bridge.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SourceForm } from '../SourceForm';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet } from '@/test-utils/api';

jest.mock('@/hooks/useBackendWebSocket', () => ({
  useBackendWebSocket: () => ({ sendOrQueue: jest.fn(), lastMessage: null }),
}));

jest.mock('@/hooks/api/useSources', () => ({
  ...jest.requireActual('@/hooks/api/useSources'),
  useManagedServiceAccount: () => ({
    managed: { email: 'dalgo-gsheets@dalgo-test.iam.gserviceaccount.com' },
    isLoading: false,
  }),
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

const SOURCE = {
  sourceId: 'src-1',
  name: 'My sheet',
  sourceDefinitionId: 'gs',
  sourceName: 'Google Sheets',
  // Saved on the managed route: Service branch, no key of their own.
  connectionConfiguration: {
    spreadsheet_id: 'https://docs.google.com/spreadsheets/d/abc',
    credentials: { auth_type: 'Service' },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
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

// Regression: Radix announces a radio's checked state by dispatching a bubbling `click` on its
// hidden mirror input. The card-level click handler used to act on that synthetic click, flipping
// the selection back and forth between the two cards until React threw "Maximum update depth
// exceeded". Both entry points — the radio itself and the card body — must settle in one step.
it("switches from the own-key default to Dalgo's key via the radio", async () => {
  const user = userEvent.setup();
  renderDialog();

  // No saved key, so the choice is offered and starts on the own-key option.
  await waitFor(() => expect(screen.getByTestId('gsheets-own-option-radio')).toBeChecked());

  await user.click(screen.getByTestId('gsheets-managed-option-radio'));

  expect(screen.getByTestId('gsheets-managed-option-radio')).toBeChecked();
  expect(screen.getByTestId('gsheets-managed-steps')).toBeInTheDocument();
});

// A key the user pastes themselves is not the source's saved key: the "already has a key saved"
// note (and the hidden choice that goes with it) must stay out of the way while they are editing.
it('keeps the choice visible while the user types their own key', async () => {
  const user = userEvent.setup();
  renderDialog();

  await waitFor(() => expect(screen.getByTestId('gsheets-own-option-radio')).toBeChecked());

  await user.type(screen.getByLabelText(/Service Account Information/i), '{{"a":1}');

  expect(screen.getByTestId('gsheets-own-option-radio')).toBeChecked();
  expect(screen.getByTestId('gsheets-managed-option-radio')).toBeInTheDocument();
  expect(screen.queryByTestId('gsheets-saved-key-note')).not.toBeInTheDocument();
  expect(screen.getByLabelText(/Service Account Information/i)).toHaveValue('{"a":1}');
});

it('switches both ways via the card body', async () => {
  const user = userEvent.setup();
  renderDialog();

  await waitFor(() => expect(screen.getByTestId('gsheets-own-option-radio')).toBeChecked());

  await user.click(screen.getByTestId('gsheets-managed-option'));
  expect(screen.getByTestId('gsheets-managed-option-radio')).toBeChecked();

  await user.click(screen.getByTestId('gsheets-own-option'));
  expect(screen.getByTestId('gsheets-own-option-radio')).toBeChecked();
  expect(screen.getByTestId('gsheets-key-field')).toBeInTheDocument();
});
