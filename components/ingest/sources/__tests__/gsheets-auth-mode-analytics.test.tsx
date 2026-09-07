/**
 * MANAGED-SA bridge, analytics side. Which auth route a Google Sheets source was created on
 * cannot be read back from its config — the managed option leaves credentials empty on
 * purpose, so empty means "Dalgo fills it in", not "nothing chosen". The form therefore
 * reports the route to its host via onAuthModeChange, and SOURCE_CREATED carries it.
 *
 * Renders the real form against a real parsed spec so the reporting follows the actual radio.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, type FieldValues } from 'react-hook-form';
import { GoogleSheetsForm } from '../custom/GoogleSheetsForm';
import { parseAirbyteSpec } from '@/components/connectors/spec-parser';
import { SOURCE_AUTH_MODES } from '@/constants/analytics';

jest.mock('@/hooks/api/useSources', () => ({
  ...jest.requireActual('@/hooks/api/useSources'),
  useManagedServiceAccount: () => ({
    managed: { email: 'dalgo-gsheets@dalgo-test.iam.gserviceaccount.com' },
    isLoading: false,
  }),
}));

const GSHEETS_SPEC = {
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
          required: ['auth_type'],
          properties: { auth_type: { type: 'string', const: 'Client' } },
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
} as never;

function Harness({ onAuthModeChange }: { onAuthModeChange: (mode: string) => void }) {
  const { control, setValue } = useForm<FieldValues>({ defaultValues: {} });
  return (
    <GoogleSheetsForm
      parsedSpec={parseAirbyteSpec(GSHEETS_SPEC)}
      control={control}
      setValue={setValue}
      mode="create"
      onAuthModeChange={onAuthModeChange}
    />
  );
}

describe('Google Sheets auth-mode reporting', () => {
  it("reports managed_key once the user is on Dalgo's key, and own_key after switching back", async () => {
    const user = userEvent.setup();
    const onAuthModeChange = jest.fn();
    render(<Harness onAuthModeChange={onAuthModeChange} />);

    // A new source defaults to Dalgo's key — that default has to be reported, not just the
    // clicks, or every trial user who simply proceeds would look like they brought their own.
    await waitFor(() =>
      expect(onAuthModeChange).toHaveBeenLastCalledWith(SOURCE_AUTH_MODES.MANAGED_KEY)
    );

    await user.click(screen.getByTestId('gsheets-own-option-radio'));

    await waitFor(() =>
      expect(onAuthModeChange).toHaveBeenLastCalledWith(SOURCE_AUTH_MODES.OWN_KEY)
    );
  });

  it('reports oauth when the source is OAuth-connected, whatever the radio says', async () => {
    const onAuthModeChange = jest.fn();
    render(<OauthHarness onAuthModeChange={onAuthModeChange} />);

    await waitFor(() => expect(onAuthModeChange).toHaveBeenLastCalledWith(SOURCE_AUTH_MODES.OAUTH));
  });
});

function OauthHarness({ onAuthModeChange }: { onAuthModeChange: (mode: string) => void }) {
  const { control, setValue } = useForm<FieldValues>({ defaultValues: {} });
  return (
    <GoogleSheetsForm
      parsedSpec={parseAirbyteSpec(GSHEETS_SPEC)}
      control={control}
      setValue={setValue}
      mode="create"
      oauth={{
        connected: true,
        busy: false,
        buttonLabel: 'Connected',
        lockWhenConnected: true,
        onClick: jest.fn(),
      }}
      onAuthModeChange={onAuthModeChange}
    />
  );
}
