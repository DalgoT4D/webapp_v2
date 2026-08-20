'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useWatch } from 'react-hook-form';
import { renderField } from '@/components/connectors/ConnectorConfigForm';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import type { FieldNode } from '@/components/connectors/types';
import {
  GSHEETS_KEY_CREDENTIALS,
  GSHEETS_AUTH_DISCRIMINATOR,
  GSHEETS_KEY_SPREADSHEET,
  GSHEETS_KEY_SERVICE_INFO,
  GSHEETS_OAUTH_AUTH_TYPE,
  GSHEETS_SERVICE_AUTH_TYPE,
  GSHEETS_AUTH_METHOD_OAUTH,
  GSHEETS_AUTH_METHOD_SERVICE,
  type GsheetsAuthMethodValue,
} from './constants';
import { GsheetsAuthMethod } from './GsheetsAuthMethod';
import { partitionFields } from './partition-fields';
import type { CustomSourceFormProps } from './types';

/** Google's multi-colour "G" mark, inlined (no external asset). */
export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function keyOf(field: FieldNode): string {
  return field.path[field.path.length - 1];
}

/**
 * Google Sheets form: two auth routes, each owning the fields it needs. Google sign-in takes the
 * sheet from the Picker (`drive.file` grants only files chosen there, so a typed link would 403);
 * a service-account key has no Picker, so that route takes a typed link too.
 *
 * Spec-driven like the Kobo form — required fields to primary, the rest to Advanced — so a field
 * from a future connector version renders without a code change. Held back: the `credentials`
 * oneOf (the radio and key field stand in for it, keeping raw client_id/secret out of the form)
 * and the spreadsheet link, rendered by the service-account card.
 */
export function GoogleSheetsForm({
  parsedSpec,
  control,
  setValue,
  disabled,
  mode,
  oauth,
  onAuthSatisfiedChange,
}: CustomSourceFormProps) {
  // Discriminator first, well-known key as fallback: a spec rename must not leak raw
  // client_id/secret inputs into the form.
  const credentialsField = useMemo(
    () =>
      parsedSpec.fields.find(
        (f) =>
          (f.type === 'oneOf' && f.constKey === GSHEETS_AUTH_DISCRIMINATOR) ||
          keyOf(f) === GSHEETS_KEY_CREDENTIALS
      ) ?? null,
    [parsedSpec]
  );

  const spreadsheetField = useMemo(
    () => parsedSpec.fields.find((f) => keyOf(f) === GSHEETS_KEY_SPREADSHEET) ?? null,
    [parsedSpec]
  );

  const { primary, advanced } = useMemo(
    () =>
      partitionFields(parsedSpec.fields, {
        // Both belong to the auth cards below.
        exclude: [
          ...(credentialsField ? [keyOf(credentialsField)] : []),
          ...(spreadsheetField ? [keyOf(spreadsheetField)] : []),
        ],
      }),
    [parsedSpec, credentialsField, spreadsheetField]
  );

  const serviceField = credentialsField?.oneOfSubFields?.find(
    (f) => f.parentValue === GSHEETS_SERVICE_AUTH_TYPE && keyOf(f) === GSHEETS_KEY_SERVICE_INFO
  );
  // spec-parser marks this required per oneOf branch, with no notion of "only when selected".
  // The real "one of the two" invariant is reported by `onAuthSatisfiedChange` below.
  const serviceFieldForRender = serviceField ? { ...serviceField, required: false } : undefined;
  // Cleared when the service route is chosen — Airbyte's additionalProperties:false rejects a
  // config matching two oneOf branches. Same sibling-clear OneOfField.tsx does generically.
  const clientBranchFields = useMemo(
    () =>
      credentialsField?.oneOfSubFields?.filter((f) => f.parentValue === GSHEETS_OAUTH_AUTH_TYPE) ??
      [],
    [credentialsField]
  );
  const discriminatorPath = credentialsField?.constKey
    ? [...credentialsField.path, credentialsField.constKey].join('.')
    : '';
  const servicePath = serviceField?.path.join('.') ?? '__no_service__';
  const serviceValue = useWatch({ control, name: servicePath }) as string | undefined;
  const serviceProvided = !!serviceValue?.trim();

  const connected = !!oauth?.connected;

  // New source: Google sign-in. Existing: the route it saved with — `connected` is the host's
  // read of stored `auth_type === 'Client'`. A plain initializer is safe because both hosts
  // withhold the form until the source has loaded.
  const [authMethod, setAuthMethod] = useState<GsheetsAuthMethodValue>(() => {
    if (!oauth) return GSHEETS_AUTH_METHOD_SERVICE;
    if (mode === 'create') return GSHEETS_AUTH_METHOD_OAUTH;
    return connected ? GSHEETS_AUTH_METHOD_OAUTH : GSHEETS_AUTH_METHOD_SERVICE;
  });
  const usingOAuth = authMethod === GSHEETS_AUTH_METHOD_OAUTH;

  // Exactly one oneOf branch may be populated when the config reaches Airbyte.
  useEffect(() => {
    if (!discriminatorPath) return;

    if (usingOAuth) {
      if (serviceValue) setValue(servicePath, '');
      setValue(discriminatorPath, GSHEETS_OAUTH_AUTH_TYPE);
      return;
    }

    for (const field of clientBranchFields) {
      setValue(field.path.join('.'), undefined);
    }
    setValue(discriminatorPath, GSHEETS_SERVICE_AUTH_TYPE);
  }, [usingOAuth, serviceValue, servicePath, discriminatorPath, clientBranchFields, setValue]);

  // Hosts can't infer this: on the Google route credentials are built server-side from the
  // OAuth ref, so an empty credentials block is expected, not missing.
  useEffect(() => {
    onAuthSatisfiedChange?.(usingOAuth ? connected : serviceProvided);
  }, [onAuthSatisfiedChange, usingOAuth, connected, serviceProvided]);

  const handleMethodChange = useCallback((next: GsheetsAuthMethodValue) => {
    setAuthMethod(next);
  }, []);

  // The synced sheet as an openable link, so the user can verify the right file was picked.
  // A pick this session has both title and link; an older source has only the saved
  // `spreadsheet_id` (Airbyte never stores the title), hence the generic label. That field also
  // accepts a bare id, which would make a dead relative href — so non-URLs get no link.
  const spreadsheetPath = spreadsheetField?.path.join('.') ?? '__no_spreadsheet__';
  const savedLink = useWatch({ control, name: spreadsheetPath }) as string | undefined;
  const sheetHref = oauth?.connectedSheet?.url ?? savedLink;
  const linkable = !!sheetHref && /^https?:\/\//.test(sheetHref);
  const connectedSheet = linkable ? (
    <a
      href={sheetHref}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="gsheets-sheet-link"
      className="font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid"
    >
      {oauth?.connectedSheet?.name ?? 'Open the connected sheet'}
    </a>
  ) : (
    oauth?.connectedSheet?.name && (
      <span className="font-medium">“{oauth.connectedSheet.name}”</span>
    )
  );

  const oauthSlot = oauth ? (
    <div className="space-y-2">
      {connected && oauth.lockWhenConnected ? (
        <div
          data-testid="gsheets-oauth-connected"
          className="flex w-full items-center gap-3 rounded-md border border-green-600/40 bg-green-600/5 px-4 py-3 text-sm dark:border-green-400/40"
        >
          <Check className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
          <span className="min-w-0 font-medium text-green-600 dark:text-green-400">
            {oauth.buttonLabel}
            {connectedSheet && <span className="ml-1 font-normal">— syncing {connectedSheet}</span>}
          </span>
        </div>
      ) : (
        <>
          <button
            type="button"
            data-testid="gsheets-oauth-connect-btn"
            onClick={oauth.onClick}
            disabled={disabled || oauth.busy}
            className="flex w-full cursor-pointer items-center gap-3 rounded-md border bg-background px-4 py-3 text-left text-sm transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {connected ? (
              <Check className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
            ) : (
              <GoogleIcon className="h-5 w-5 flex-shrink-0" />
            )}
            <span
              className={
                connected ? 'font-medium text-green-600 dark:text-green-400' : 'font-medium'
              }
            >
              {oauth.buttonLabel}
            </span>
            {oauth.busy && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
          </button>
          {/* Hosts that keep re-auth clickable still need to confirm which sheet came back. */}
          {connectedSheet ? (
            <p
              className="text-xs text-green-600 dark:text-green-400"
              data-testid="gsheets-picked-sheet"
            >
              Now syncing {connectedSheet}.
            </p>
          ) : (
            // Re-authenticating re-picks the sheet, which is how a source is moved to a
            // different one — worth saying, since "re-authenticate" sounds like a no-op.
            connected && (
              <p className="text-xs text-muted-foreground" data-testid="gsheets-repick-hint">
                Re-authenticating lets you choose a different sheet.
              </p>
            )
          )}
        </>
      )}
    </div>
  ) : null;

  const serviceSlot = (
    <div className="space-y-4" data-testid="gsheets-service-fields">
      {/* Typed only here: a service account has no Picker to name the sheet. */}
      {spreadsheetField && renderField(spreadsheetField, control, setValue, disabled)}
      {serviceFieldForRender && renderField(serviceFieldForRender, control, setValue, disabled)}
    </div>
  );

  return (
    <div className="space-y-4" data-testid="google-sheets-form">
      {primary.map((field) => (
        <div key={field.path.join('.')}>{renderField(field, control, setValue, disabled)}</div>
      ))}

      {oauth ? (
        <GsheetsAuthMethod
          method={authMethod}
          onMethodChange={handleMethodChange}
          disabled={disabled}
          error={oauth.error}
          oauthSlot={oauthSlot}
          serviceSlot={serviceSlot}
        />
      ) : (
        serviceSlot
      )}

      {advanced.length > 0 && (
        <Accordion type="single" collapsible data-testid="gsheets-advanced">
          <AccordionItem value="advanced" className="border-none">
            <AccordionTrigger
              className="text-sm font-semibold text-muted-foreground uppercase tracking-wider py-2 hover:no-underline"
              data-testid="gsheets-advanced-trigger"
            >
              Advanced options
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              {advanced.map((field) => renderField(field, control, setValue, disabled))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
