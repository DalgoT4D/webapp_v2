import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, useWatch, type FieldValues, type UseFormTrigger } from 'react-hook-form';
import { GoogleSheetsForm } from '../GoogleSheetsForm';
import type { ParsedSpec, FieldNode } from '@/components/connectors/types';

const credentials: FieldNode = {
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
      path: ['credentials', 'service_account_info'],
      title: 'Service Account Information.',
      required: true,
      hidden: false,
      fieldType: 'string',
      isSecret: true,
      isMultiline: true,
      parentValue: 'Service',
    },
  ],
};

const spec: ParsedSpec = {
  groups: [],
  fields: [
    {
      type: 'basic',
      path: ['spreadsheet_id'],
      title: 'Spreadsheet Link',
      required: true,
      hidden: false,
      fieldType: 'string',
    },
    credentials,
    {
      type: 'boolean',
      path: ['names_conversion'],
      title: 'Convert Column Names to SQL-Compliant Format',
      required: false,
      hidden: false,
      default: false,
    },
  ],
};

function Harness({
  connected = false,
  onAuthType,
  parsedSpec = spec,
}: {
  connected?: boolean;
  onAuthType?: (v: unknown) => void;
  parsedSpec?: ParsedSpec;
}) {
  const { control, setValue } = useForm<FieldValues>({
    defaultValues: { credentials: { auth_type: 'Client' } },
  });
  const authType = useWatch({ control, name: 'credentials.auth_type' });
  onAuthType?.(authType);
  return (
    <GoogleSheetsForm
      parsedSpec={parsedSpec}
      control={control}
      setValue={setValue}
      mode="create"
      oauth={{
        connected,
        busy: false,
        buttonLabel: 'Sign in with Google',
        lockWhenConnected: true,
        onClick: () => {},
      }}
    />
  );
}

describe('GoogleSheetsForm', () => {
  it('renders the spreadsheet link and a Google sign-in button, no auth dropdown', () => {
    render(<Harness />);
    expect(screen.getByText('Spreadsheet Link')).toBeInTheDocument();
    expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('gsheets-auth-mode')).not.toBeInTheDocument();
  });

  it('reveals the SQL toggle and service-account field under Advanced', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByTestId('gsheets-advanced-trigger'));
    expect(screen.getByText('Convert Column Names to SQL-Compliant Format')).toBeInTheDocument();
    expect(screen.getByText('Service Account Information.')).toBeInTheDocument();
  });

  // A future connector version can add fields the form has never heard of; the form is
  // spec-driven, so they must still reach the user — required up front, optional in Advanced.
  it('renders fields the form does not know about, placed by the spec', async () => {
    const futureSpec: ParsedSpec = {
      groups: [],
      fields: [
        ...spec.fields,
        {
          type: 'basic',
          path: ['batch_size'],
          title: 'Batch Size',
          required: false,
          hidden: false,
          fieldType: 'integer',
        },
        {
          type: 'basic',
          path: ['workspace_ref'],
          title: 'Workspace Reference',
          required: true,
          hidden: false,
          fieldType: 'string',
        },
      ],
    };
    render(<Harness parsedSpec={futureSpec} />);

    // Required → primary, visible without opening Advanced.
    expect(screen.getByText('Workspace Reference')).toBeInTheDocument();
    expect(screen.queryByText('Batch Size')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('gsheets-advanced-trigger'));
    expect(screen.getByText('Batch Size')).toBeInTheDocument();
  });

  it('never renders the raw credentials block, even under Advanced', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByTestId('gsheets-advanced-trigger'));
    // renderField would give the credentials oneOf this testid (and an auth-mode picker
    // exposing client_id/secret). Only the sign-in button and the service-account
    // sub-field may stand in for credentials.
    expect(screen.queryByTestId('field-credentials')).not.toBeInTheDocument();
    expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument();
    expect(screen.getByText('Service Account Information.')).toBeInTheDocument();
  });

  it('forces auth_type=Client when OAuth is connected', () => {
    let authType: unknown;
    render(<Harness connected onAuthType={(v) => (authType = v)} />);
    expect(authType).toBe('Client');
  });

  // Regression: the service-account field is required by its own oneOf branch's
  // schema (spec-parser.ts has no notion of "only when this branch is active"),
  // and — unlike every other oneOf sub-field — it's always mounted here so the
  // OAuth button can sit next to it. That RHF rule used to fire even while the
  // field was disabled and unused, blocking form submission outright for any
  // already-OAuth-connected source (edit save / wizard Next both call RHF's
  // whole-form validation before their own submit logic ever runs).
  it('does not block whole-form validation on the empty service field once OAuth is connected', async () => {
    let trigger: UseFormTrigger<FieldValues> | undefined;
    function TriggerHarness() {
      const {
        control,
        setValue,
        trigger: t,
      } = useForm<FieldValues>({
        // spreadsheet_id filled so it isolates the one thing under test: the
        // service-account field's own required-ness must not block validation.
        defaultValues: {
          spreadsheet_id: 'https://docs.google.com/spreadsheets/d/abc',
          credentials: { auth_type: 'Client' },
        },
      });
      trigger = t;
      return (
        <GoogleSheetsForm
          parsedSpec={spec}
          control={control}
          setValue={setValue}
          mode="edit"
          oauth={{
            connected: true,
            busy: false,
            buttonLabel: 'Re-authenticate with Google',
            lockWhenConnected: false,
            onClick: () => {},
          }}
        />
      );
    }
    render(<TriggerHarness />);
    await userEvent.click(screen.getByTestId('gsheets-advanced-trigger'));

    let isValid: boolean | undefined;
    await act(async () => {
      isValid = await trigger!();
    });

    expect(isValid).toBe(true);
    expect(screen.queryByText('Service Account Information. is required')).not.toBeInTheDocument();
  });
});
