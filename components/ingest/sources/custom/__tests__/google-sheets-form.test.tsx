import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, useWatch, type FieldValues, type UseFormTrigger } from 'react-hook-form';
import { GoogleSheetsForm } from '../GoogleSheetsForm';
import type { ParsedSpec, FieldNode } from '@/components/connectors/types';

// MANAGED-SA bridge. Null = this deployment ships no managed key, which is the pre-bridge
// behaviour every OAuth test below assumes; individual tests opt in by setting it.
let mockManaged: { email: string | null } | null = null;
jest.mock('@/hooks/api/useSources', () => ({
  useManagedServiceAccount: () => ({ managed: mockManaged, isLoading: false }),
}));

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
  onAuthSatisfiedChange,
  savedKey,
  mode = 'create',
  onServiceValue,
}: {
  connected?: boolean;
  onAuthType?: (v: unknown) => void;
  parsedSpec?: ParsedSpec;
  onAuthSatisfiedChange?: (satisfied: boolean) => void;
  /** Simulates edit mode: a source whose saved config already carries a service-account key. */
  savedKey?: string;
  mode?: 'create' | 'edit';
  onServiceValue?: (v: unknown) => void;
}) {
  const { control, setValue } = useForm<FieldValues>({
    defaultValues: savedKey
      ? { credentials: { auth_type: 'Service', service_account_info: savedKey } }
      : { credentials: { auth_type: 'Client' } },
  });
  const authType = useWatch({ control, name: 'credentials.auth_type' });
  onAuthType?.(authType);
  const serviceInfo = useWatch({ control, name: 'credentials.service_account_info' });
  onServiceValue?.(serviceInfo);
  return (
    <GoogleSheetsForm
      parsedSpec={parsedSpec}
      control={control}
      setValue={setValue}
      mode={mode}
      onAuthSatisfiedChange={onAuthSatisfiedChange}
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
  beforeEach(() => {
    mockManaged = null;
  });

  it('renders the spreadsheet link and a Google sign-in button, no auth dropdown', () => {
    render(<Harness />);
    expect(screen.getByText('Spreadsheet Link')).toBeInTheDocument();
    expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('gsheets-auth-mode')).not.toBeInTheDocument();
  });

  // drive.file grants only the sheet the user selects in Google's Picker, so once a connect
  // has happened the link is the Picker's answer — typing over it would name a sheet Dalgo
  // has no grant for, and the sync would 403.
  it('locks the spreadsheet link once connected through Google', () => {
    render(<Harness connected />);

    expect(screen.getByLabelText(/Spreadsheet Link/)).toBeDisabled();
  });

  it('leaves the spreadsheet link editable before connecting (service-account path)', () => {
    render(<Harness />);

    expect(screen.getByLabelText(/Spreadsheet Link/)).toBeEnabled();
  });

  it('tells the user the picker will fill the link in, while sign-in is still pending', () => {
    render(<Harness />);

    expect(screen.getByTestId('gsheets-picker-hint')).toBeInTheDocument();
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

  // MANAGED-SA bridge — remove this block along with the bridge once Google OAuth
  // verification lands and the sign-in button comes back.
  // MANAGED-SA bridge — remove with the bridge.
  describe('with a Dalgo-managed service account', () => {
    const MANAGED_EMAIL = 'dalgo-gsheets@dalgo-test.iam.gserviceaccount.com';
    const OWN_KEY = '{"client_email":"theirs@x.iam.gserviceaccount.com"}';

    beforeEach(() => {
      mockManaged = { email: MANAGED_EMAIL };
    });

    it("replaces Google sign-in with the two options, Dalgo's selected", () => {
      render(<Harness />);

      expect(screen.getByTestId('gsheets-auth-choice')).toBeInTheDocument();
      expect(screen.getByTestId('gsheets-managed-option-radio')).toBeChecked();
      expect(screen.getByTestId('gsheets-own-option-radio')).not.toBeChecked();
      // The own-key card stays collapsed while it isn't the selected route.
      expect(screen.queryByTestId('gsheets-key-field')).not.toBeInTheDocument();
      expect(screen.queryByTestId('gsheets-oauth-connect-btn')).not.toBeInTheDocument();
    });

    it("defaults to Dalgo's key on create, so auth is satisfied with nothing typed", () => {
      const onAuthSatisfiedChange = jest.fn();
      render(<Harness onAuthSatisfiedChange={onAuthSatisfiedChange} />);

      expect(screen.getByTestId('gsheets-managed-steps')).toBeInTheDocument();
      expect(onAuthSatisfiedChange).toHaveBeenLastCalledWith(true);
    });

    // The whole card is the hit area, not just the label text.
    it('selects an option when the card body is clicked, not only the label', async () => {
      render(<Harness />);

      await userEvent.click(screen.getByTestId('gsheets-own-option'));
      expect(screen.getByTestId('gsheets-own-option-radio')).toBeChecked();

      await userEvent.click(screen.getByTestId('gsheets-managed-option'));
      expect(screen.getByTestId('gsheets-managed-option-radio')).toBeChecked();
    });

    it('is unsatisfied once the own-key option is picked, until a key is pasted', async () => {
      const onAuthSatisfiedChange = jest.fn();
      render(<Harness onAuthSatisfiedChange={onAuthSatisfiedChange} />);

      await userEvent.click(screen.getByTestId('gsheets-own-option-radio'));
      expect(onAuthSatisfiedChange).toHaveBeenLastCalledWith(false);

      await userEvent.type(screen.getByRole('textbox', { name: /Service Account/i }), '{{"a":1}');
      expect(onAuthSatisfiedChange).toHaveBeenLastCalledWith(true);
    });

    it('keeps both options visible on create even once a key is typed', async () => {
      render(<Harness />);

      await userEvent.click(screen.getByTestId('gsheets-own-option-radio'));
      await userEvent.type(screen.getByRole('textbox', { name: /Service Account/i }), '{{"a":1}');

      expect(screen.getByTestId('gsheets-managed-option-radio')).toBeInTheDocument();
      expect(screen.getByTestId('gsheets-own-option-radio')).toBeChecked();
    });

    it("switching back to Dalgo's key shows the share steps and satisfies auth", async () => {
      const onAuthSatisfiedChange = jest.fn();
      let authType: unknown;
      render(
        <Harness onAuthSatisfiedChange={onAuthSatisfiedChange} onAuthType={(v) => (authType = v)} />
      );

      // Off and back on, so this exercises the selection itself rather than the create default.
      await userEvent.click(screen.getByTestId('gsheets-own-option-radio'));
      await userEvent.click(screen.getByTestId('gsheets-managed-option-radio'));

      expect(screen.getByTestId('gsheets-managed-steps')).toBeInTheDocument();
      expect(screen.getByTestId('gsheets-managed-email')).toHaveTextContent(MANAGED_EMAIL);
      expect(screen.queryByTestId('gsheets-key-field')).not.toBeInTheDocument();
      expect(onAuthSatisfiedChange).toHaveBeenLastCalledWith(true);
      expect(authType).toBe('Service');
    });

    // The managed route must send an empty slot: the backend injects its key precisely because the
    // slot arrives empty, so nothing cosmetic may ever leak into the form value.
    it("leaves the key slot empty on Dalgo's route", async () => {
      const values: unknown[] = [];
      render(<Harness onServiceValue={(v) => values.push(v)} />);

      await userEvent.click(screen.getByTestId('gsheets-own-option-radio'));
      await userEvent.click(screen.getByTestId('gsheets-managed-option-radio'));

      expect(values.every((v) => !String(v ?? '').includes('*'))).toBe(true);
      expect(values.at(-1) ?? '').toBe('');
    });

    it('gives a typed key back when the own-key option is picked again', async () => {
      render(<Harness />);
      const field = () => screen.getByRole('textbox', { name: /Service Account/i });
      // Switch to own to get at the field, type their own key, go managed, come back.
      await userEvent.click(screen.getByTestId('gsheets-own-option-radio'));
      await userEvent.type(field(), '{{"a":1}');

      await userEvent.click(screen.getByTestId('gsheets-managed-option-radio'));
      expect(screen.queryByTestId('gsheets-key-field')).not.toBeInTheDocument();

      await userEvent.click(screen.getByTestId('gsheets-own-option-radio'));
      expect(field()).toHaveValue('{"a":1}');
    });

    // Edit mode: which key a saved source uses is not recorded, so the choice must not appear
    // (it would imply we know) and the key must survive untouched.
    it('hides the choice and keeps the key when a source already has one', () => {
      render(<Harness mode="edit" savedKey={OWN_KEY} />);

      expect(screen.queryByTestId('gsheets-managed-option-radio')).not.toBeInTheDocument();
      expect(screen.getByTestId('gsheets-saved-key-note')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Service Account/i })).toHaveValue(OWN_KEY);
    });

    // Editing the field means the key on screen is no longer the source's saved one, so the
    // saved-key note must go and the choice must stay available.
    it('brings the choice back as soon as the saved key is edited', async () => {
      render(<Harness mode="edit" savedKey={OWN_KEY} />);

      await userEvent.type(screen.getByRole('textbox', { name: /Service Account/i }), 'x');

      expect(screen.getByTestId('gsheets-own-option-radio')).toBeChecked();
      expect(screen.queryByTestId('gsheets-saved-key-note')).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Service Account/i })).toHaveValue(`${OWN_KEY}x`);
    });

    it('brings the choice back once the saved key is cleared', async () => {
      render(<Harness mode="edit" savedKey={OWN_KEY} />);

      await userEvent.clear(screen.getByRole('textbox', { name: /Service Account/i }));

      expect(screen.getByTestId('gsheets-managed-option-radio')).toBeInTheDocument();
      expect(screen.queryByTestId('gsheets-saved-key-note')).not.toBeInTheDocument();
    });
  });
});
