/**
 * GoogleSheetsAuth tests
 *
 * The shared Google Sheets auth control: an OAuth-vs-service-account dropdown where the
 * OAuth branch is a sign-in button (never the raw client id/secret/refresh-token inputs)
 * and the service branch renders only the service-account field.
 */

import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { GoogleSheetsAuth, type GsheetsAuthMode } from '../GoogleSheetsAuth';
import type { FieldNode } from '@/components/connectors/types';

// A parsed `auth_type` oneOf with both branches — the shape spec-parser produces for the
// real Google Sheets connector.
const authField: FieldNode = {
  type: 'oneOf',
  path: ['credentials'],
  title: 'Authentication',
  required: true,
  hidden: false,
  constKey: 'auth_type',
  constOptions: [
    { value: 'Client', title: 'Authenticate via Google (OAuth)' },
    { value: 'Service', title: 'Service Account Key Authentication' },
  ],
  oneOfSubFields: [
    {
      type: 'basic',
      path: ['credentials', 'client_id'],
      title: 'Client ID',
      required: true,
      hidden: false,
      parentValue: 'Client',
      fieldType: 'string',
    },
    {
      type: 'basic',
      path: ['credentials', 'client_secret'],
      title: 'Client Secret',
      required: true,
      hidden: false,
      parentValue: 'Client',
      fieldType: 'string',
      isSecret: true,
    },
    {
      type: 'basic',
      path: ['credentials', 'service_account_info'],
      title: 'Service Account Information',
      required: true,
      hidden: false,
      parentValue: 'Service',
      fieldType: 'string',
      isSecret: true,
    },
  ],
};

function Harness({
  onOAuthClick = jest.fn(),
  oauthConnected,
  initialMode = 'google',
}: {
  onOAuthClick?: () => void;
  oauthConnected?: boolean;
  initialMode?: GsheetsAuthMode;
}) {
  const { control, setValue } = useForm({ defaultValues: {} as Record<string, unknown> });
  const [mode, setMode] = useState<GsheetsAuthMode>(initialMode);
  return (
    <GoogleSheetsAuth
      authField={authField}
      control={control}
      setValue={setValue}
      mode={mode}
      onModeChange={setMode}
      oauthButtonLabel="Sign in with Google to authorize Dalgo"
      onOAuthClick={onOAuthClick}
      oauthConnected={oauthConnected}
    />
  );
}

it('defaults to Google OAuth: sign-in button, no credential fields', () => {
  render(<Harness />);

  expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument();
  expect(screen.queryByTestId('gsheets-service-fields')).not.toBeInTheDocument();
  // Raw OAuth credential inputs must never render.
  expect(screen.queryByLabelText(/Client ID/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Client Secret/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Refresh Token/i)).not.toBeInTheDocument();
});

it('switches to Service Account: shows only the service field, hides the button', async () => {
  const user = userEvent.setup();
  render(<Harness />);

  await user.click(screen.getByRole('combobox'));
  await user.click(screen.getByText('Service Account Key Authentication'));

  expect(screen.getByLabelText(/Service Account Information/i)).toBeInTheDocument();
  expect(screen.queryByTestId('gsheets-oauth-connect-btn')).not.toBeInTheDocument();
  // Still no raw OAuth client fields in service mode.
  expect(screen.queryByLabelText(/Client ID/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Client Secret/i)).not.toBeInTheDocument();
});

it('shows the connected indicator and fires onOAuthClick', async () => {
  const user = userEvent.setup();
  const onOAuthClick = jest.fn();
  render(<Harness onOAuthClick={onOAuthClick} oauthConnected />);

  expect(screen.getByTestId('gsheets-oauth-connected')).toBeInTheDocument();
  await user.click(screen.getByTestId('gsheets-oauth-connect-btn'));
  expect(onOAuthClick).toHaveBeenCalledTimes(1);
});

it('pre-selects Service Account when opened in service mode (edit of a service-account source)', () => {
  render(<Harness initialMode="service" />);

  expect(screen.getByLabelText(/Service Account Information/i)).toBeInTheDocument();
  expect(screen.queryByTestId('gsheets-oauth-connect-btn')).not.toBeInTheDocument();
});
