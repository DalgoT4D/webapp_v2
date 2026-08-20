import { useEffect } from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  useForm,
  useWatch,
  type FieldValues,
  type UseFormTrigger,
  type UseFormGetValues,
} from 'react-hook-form';
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
      path: ['credentials', 'client_id'],
      title: 'Client ID',
      required: true,
      hidden: false,
      fieldType: 'string',
      isSecret: true,
      parentValue: 'Client',
    },
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

const SAVED_KEY = '{"client_email":"theirs@x.iam.gserviceaccount.com"}';
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/abc/edit';

function Harness({
  connected = false,
  onAuthType,
  parsedSpec = spec,
  onAuthSatisfiedChange,
  savedKey,
  savedLink,
  mode = 'create',
  onServiceValue,
  connectedSheet,
  onGetValues,
  lateLink,
}: {
  connected?: boolean;
  onAuthType?: (v: unknown) => void;
  parsedSpec?: ParsedSpec;
  onAuthSatisfiedChange?: (satisfied: boolean) => void;
  /** Simulates edit mode: a source whose saved config already carries a service-account key. */
  savedKey?: string;
  savedLink?: string;
  mode?: 'create' | 'edit';
  onServiceValue?: (v: unknown) => void;
  connectedSheet?: { name: string; url: string };
  onGetValues?: (get: UseFormGetValues<FieldValues>) => void;
  /** Simulates the edit host, which populates the form with `reset()` in an effect — a commit
   *  after the form mounts, so the saved link is absent on the first render. */
  lateLink?: string;
}) {
  const { control, setValue, getValues, reset } = useForm<FieldValues>({
    defaultValues: savedKey
      ? {
          spreadsheet_id: savedLink,
          credentials: { auth_type: 'Service', service_account_info: savedKey },
        }
      : { spreadsheet_id: savedLink, credentials: { auth_type: 'Client' } },
  });
  onGetValues?.(getValues);
  useEffect(() => {
    if (lateLink) reset({ spreadsheet_id: lateLink, credentials: { auth_type: 'Client' } });
  }, [lateLink, reset]);
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
        buttonLabel: 'Sign in with Google to authorize Dalgo',
        lockWhenConnected: true,
        onClick: () => {},
        connectedSheet,
      }}
    />
  );
}

const serviceKeyField = () => screen.getByRole('textbox', { name: /Service Account/i });

describe('GoogleSheetsForm', () => {
  describe('choosing how to authenticate', () => {
    it('offers the two methods with Google sign-in selected by default', () => {
      render(<Harness />);

      expect(screen.getByTestId('gsheets-oauth-option-radio')).toBeChecked();
      expect(screen.getByTestId('gsheets-service-option-radio')).not.toBeChecked();
      expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument();
    });

    // Under `drive.file` the sheet comes from Google's Picker, so a link input on this route
    // would name a file Dalgo holds no grant for — there is nothing for the user to type.
    it('shows no spreadsheet link input on the Google route', () => {
      render(<Harness />);

      expect(screen.queryByLabelText(/Spreadsheet Link/)).not.toBeInTheDocument();
    });

    it('pins auth_type to Client while the Google route is selected', () => {
      let authType: unknown;
      render(<Harness onAuthType={(v) => (authType = v)} />);

      expect(authType).toBe('Client');
    });

    // The service account has no Picker: the user shares the sheet with the key's address and
    // tells us which sheet by link. So this route owns both inputs.
    it('reveals the link and key inputs when the service-account route is picked', async () => {
      render(<Harness />);

      await userEvent.click(screen.getByTestId('gsheets-service-option-radio'));

      expect(screen.getByLabelText(/Spreadsheet Link/)).toBeEnabled();
      expect(serviceKeyField()).toBeInTheDocument();
      expect(screen.queryByTestId('gsheets-oauth-connect-btn')).not.toBeInTheDocument();
    });

    it('flips auth_type to Service on the service-account route', async () => {
      let authType: unknown;
      render(<Harness onAuthType={(v) => (authType = v)} />);

      await userEvent.click(screen.getByTestId('gsheets-service-option-radio'));

      expect(authType).toBe('Service');
    });

    // Airbyte rejects a config matching two oneOf branches (additionalProperties: false), so
    // leaving the abandoned route's fields behind would fail the save.
    it('clears the service key when the user switches back to Google', async () => {
      const values: unknown[] = [];
      render(<Harness onServiceValue={(v) => values.push(v)} />);

      await userEvent.click(screen.getByTestId('gsheets-service-option-radio'));
      await userEvent.type(serviceKeyField(), '{{"a":1}');
      await userEvent.click(screen.getByTestId('gsheets-oauth-option-radio'));

      expect(values.at(-1) ?? '').toBe('');
    });

    // The whole card is the hit area, not just the radio.
    it('selects a route when its card body is clicked', async () => {
      render(<Harness />);

      await userEvent.click(screen.getByTestId('gsheets-service-option'));

      expect(screen.getByTestId('gsheets-service-option-radio')).toBeChecked();
    });
  });

  describe('reporting whether auth is satisfied', () => {
    it('is unsatisfied on the Google route until sign-in completes', () => {
      const onAuthSatisfiedChange = jest.fn();
      render(<Harness onAuthSatisfiedChange={onAuthSatisfiedChange} />);

      expect(onAuthSatisfiedChange).toHaveBeenLastCalledWith(false);
    });

    it('is satisfied once Google sign-in has connected', () => {
      const onAuthSatisfiedChange = jest.fn();
      render(<Harness connected onAuthSatisfiedChange={onAuthSatisfiedChange} />);

      expect(onAuthSatisfiedChange).toHaveBeenLastCalledWith(true);
    });

    it('is unsatisfied on the service route until a key is pasted', async () => {
      const onAuthSatisfiedChange = jest.fn();
      render(<Harness onAuthSatisfiedChange={onAuthSatisfiedChange} />);

      await userEvent.click(screen.getByTestId('gsheets-service-option-radio'));
      expect(onAuthSatisfiedChange).toHaveBeenLastCalledWith(false);

      await userEvent.type(serviceKeyField(), '{{"a":1}');
      expect(onAuthSatisfiedChange).toHaveBeenLastCalledWith(true);
    });

    // A connected Google source must not read as satisfied after the user moves to the other
    // route — that route still needs its own key.
    it('stops being satisfied when a connected source switches to the service route', async () => {
      const onAuthSatisfiedChange = jest.fn();
      render(<Harness connected onAuthSatisfiedChange={onAuthSatisfiedChange} />);

      await userEvent.click(screen.getByTestId('gsheets-service-option-radio'));

      expect(onAuthSatisfiedChange).toHaveBeenLastCalledWith(false);
    });
  });

  describe('once connected through Google', () => {
    // The confirmation and the sheet name are separate: the name sits beside the button as the
    // answer to "which file?", so it is asserted where it renders rather than inside the pill.
    it('confirms the connection and names the sheet the picker returned', () => {
      render(<Harness connected connectedSheet={{ name: 'hobbit_pantry_2024', url: SHEET_URL }} />);

      expect(screen.getByTestId('gsheets-oauth-connected')).toBeInTheDocument();
      expect(screen.getByTestId('gsheets-picked-sheet')).toHaveTextContent('hobbit_pantry_2024');
    });

    // A long title must not push the button around, and the user still needs the whole name.
    it('keeps the full sheet name reachable when the visible text is truncated', () => {
      const name = 'Quarterly programme outcomes — Northern districts — 2024 consolidated';
      render(<Harness connected connectedSheet={{ name, url: SHEET_URL }} />);

      const link = screen.getByTestId('gsheets-sheet-link');
      expect(link).toHaveAttribute('title', name);
      expect(link).toHaveClass('truncate');
    });

    // The name is the reassurance that the right file was picked, and a click confirms it —
    // the alternative is asking the user to trust a name they cannot check.
    it('links the sheet name to the spreadsheet, opening it in a new tab', () => {
      render(<Harness connected connectedSheet={{ name: 'hobbit_pantry_2024', url: SHEET_URL }} />);

      const link = screen.getByRole('link', { name: /hobbit_pantry_2024/ });
      expect(link).toHaveAttribute('href', SHEET_URL);
      expect(link).toHaveAttribute('target', '_blank');
      // Opening in a new tab without this hands the sheet a reference back to Dalgo's window.
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    });

    // A source connected in an earlier session: Airbyte stored the link, never the title, so
    // there is no name to show — but the link still is worth offering.
    it('falls back to the saved link when no name came from this session', () => {
      render(<Harness mode="edit" connected savedLink={SHEET_URL} />);

      expect(screen.getByRole('link', { name: /Open the connected sheet/i })).toHaveAttribute(
        'href',
        SHEET_URL
      );
    });

    // `spreadsheet_id` accepts a bare id as well as a link, and older sources may hold one.
    // Rendering that as an href would produce a dead relative link.
    it('renders no link when the saved value is a bare id rather than a URL', () => {
      render(<Harness mode="edit" connected savedLink="1hLd9Qqti3UyLXZB2aFfUWDT7BG" />);

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    // The Picker writes the link through setValue on a field this route never renders. RHF
    // keeps values for unregistered names, and buildConfig reads getValues() — so the sheet
    // still reaches the payload. Without that, an OAuth source would save with no sheet.
    it('keeps a picker-supplied link in the form values though no input renders it', () => {
      let get: UseFormGetValues<FieldValues> | undefined;
      const link = 'https://docs.google.com/spreadsheets/d/abc/edit';
      render(<Harness connected savedLink={link} onGetValues={(g) => (get = g)} />);

      expect(screen.queryByLabelText(/Spreadsheet Link/)).not.toBeInTheDocument();
      expect(get!().spreadsheet_id).toBe(link);
    });

    // `drive.file` granted that link to the OAuth token, not to a service account, so offering
    // it pre-filled on the other route promises access the key does not have.
    it('leaves the service route link empty after a pick on the Google route', async () => {
      render(
        <Harness
          connected
          savedLink={SHEET_URL}
          connectedSheet={{ name: 'hobbit_pantry_2024', url: SHEET_URL }}
        />
      );

      await userEvent.click(screen.getByTestId('gsheets-service-option-radio'));

      expect(screen.getByLabelText(/Spreadsheet Link/)).toHaveValue('');
    });

    // ...and the Google route must still submit the sheet it was granted after that detour.
    it('restores the picked link when the user goes back to the Google route', async () => {
      let get: UseFormGetValues<FieldValues> | undefined;
      render(
        <Harness
          connected
          savedLink={SHEET_URL}
          connectedSheet={{ name: 'hobbit_pantry_2024', url: SHEET_URL }}
          onGetValues={(g) => (get = g)}
        />
      );

      await userEvent.click(screen.getByTestId('gsheets-service-option-radio'));
      await userEvent.click(screen.getByTestId('gsheets-oauth-option-radio'));

      expect(get!().spreadsheet_id).toBe(SHEET_URL);
    });

    // Same rule for a source that saved on the Google route in an earlier session: its link was
    // granted to that token too, so the service card starts empty rather than pre-filled.
    it('empties the service route link for a source that saved on the Google route', async () => {
      render(<Harness mode="edit" connected savedLink={SHEET_URL} />);

      await userEvent.click(screen.getByTestId('gsheets-service-option-radio'));

      expect(screen.getByLabelText(/Spreadsheet Link/)).toHaveValue('');
    });

    // The edit host fills the form with `reset()` in an effect, so the saved link is missing on
    // the first render. Reading it only at mount left the card with no sheet at all.
    it('shows the sheet of an OAuth source whose link arrives after mount', async () => {
      render(<Harness mode="edit" connected lateLink={SHEET_URL} />);

      expect(await screen.findByTestId('gsheets-sheet-link')).toHaveAttribute('href', SHEET_URL);
    });

    it('empties the service route link when that late-arriving link is the OAuth one', async () => {
      render(<Harness mode="edit" connected lateLink={SHEET_URL} />);
      await screen.findByTestId('gsheets-sheet-link');

      await userEvent.click(screen.getByTestId('gsheets-service-option-radio'));

      expect(screen.getByLabelText(/Spreadsheet Link/)).toHaveValue('');
    });

    // A service-account source's link was typed, not granted — it is not an OAuth sheet, so the
    // Google card must not offer to open it as one.
    it('shows no connected sheet on the Google card for a service-account source', async () => {
      render(<Harness mode="edit" savedKey={SAVED_KEY} savedLink={SHEET_URL} />);

      await userEvent.click(screen.getByTestId('gsheets-oauth-option-radio'));

      expect(screen.queryByTestId('gsheets-picked-sheet')).not.toBeInTheDocument();
      expect(screen.queryByTestId('gsheets-sheet-link')).not.toBeInTheDocument();
    });

    // The label reads as a result, not a status: the sheet is attached and clickable.
    it('labels the picked sheet as added', () => {
      render(<Harness connected connectedSheet={{ name: 'hobbit_pantry_2024', url: SHEET_URL }} />);

      // The gap between label and name is flex spacing, not a text node.
      expect(screen.getByTestId('gsheets-picked-sheet')).toHaveTextContent(
        /Sheet added\s*hobbit_pantry_2024/
      );
    });
  });

  describe('editing an existing source', () => {
    it('opens on the Google route for a source that authenticated that way', () => {
      render(<Harness mode="edit" connected />);

      expect(screen.getByTestId('gsheets-oauth-option-radio')).toBeChecked();
    });

    // Stored auth_type is Service — the saved key is whatever the user (or the retired managed
    // bridge) put there, and Airbyte returns it masked. Show it as-is; they can replace it.
    it('opens on the service route for a source with a saved key, showing it', () => {
      const link = 'https://docs.google.com/spreadsheets/d/abc/edit';
      render(<Harness mode="edit" savedKey={SAVED_KEY} savedLink={link} />);

      expect(screen.getByTestId('gsheets-service-option-radio')).toBeChecked();
      expect(serviceKeyField()).toHaveValue(SAVED_KEY);
      expect(screen.getByLabelText(/Spreadsheet Link/)).toHaveValue(link);
    });

    it('counts a saved key as satisfying auth without the user touching it', () => {
      const onAuthSatisfiedChange = jest.fn();
      render(
        <Harness mode="edit" savedKey={SAVED_KEY} onAuthSatisfiedChange={onAuthSatisfiedChange} />
      );

      expect(onAuthSatisfiedChange).toHaveBeenLastCalledWith(true);
    });

    it('lets a saved service-account source move to Google sign-in', async () => {
      render(<Harness mode="edit" savedKey={SAVED_KEY} />);

      await userEvent.click(screen.getByTestId('gsheets-oauth-option-radio'));

      expect(screen.getByTestId('gsheets-oauth-connect-btn')).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: /Service Account/i })).not.toBeInTheDocument();
    });
  });

  describe('the rest of the form', () => {
    it('keeps only genuine connector extras under Advanced', async () => {
      render(<Harness />);

      await userEvent.click(screen.getByTestId('gsheets-advanced-trigger'));

      expect(screen.getByText('Convert Column Names to SQL-Compliant Format')).toBeInTheDocument();
      // Both of these belong to the service-account route's card now, not to Advanced.
      expect(screen.queryByRole('textbox', { name: /Service Account/i })).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Spreadsheet Link/)).not.toBeInTheDocument();
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

    // renderField would give the credentials oneOf an auth-mode picker exposing raw
    // client_id/client_secret inputs. Only the radio and the key field stand in for it.
    it('never renders the raw credentials block', async () => {
      render(<Harness />);
      await userEvent.click(screen.getByTestId('gsheets-advanced-trigger'));

      expect(screen.queryByTestId('field-credentials')).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Client ID/)).not.toBeInTheDocument();
    });

    // Regression: the service-account field is required by its own oneOf branch's schema
    // (spec-parser.ts has no notion of "only when this branch is active"). It must not block
    // whole-form validation from the route that doesn't use it — edit save and wizard Next
    // both run RHF validation before their own submit logic.
    it('does not block whole-form validation from the Google route', async () => {
      let trigger: UseFormTrigger<FieldValues> | undefined;
      function TriggerHarness() {
        const {
          control,
          setValue,
          trigger: t,
        } = useForm<FieldValues>({
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

      let isValid: boolean | undefined;
      await act(async () => {
        isValid = await trigger!();
      });

      expect(isValid).toBe(true);
    });
  });
});
