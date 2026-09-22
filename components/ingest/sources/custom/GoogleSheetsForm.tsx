'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { GsheetsOAuthCard } from './GsheetsOAuthCard';
import { partitionFields } from './partition-fields';
import type { CustomSourceFormProps } from './types';
import { useGsheetsOAuthLink } from './useGsheetsOAuthLink';

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
      // `undefined`, not '': an empty string is still a key, and JSON keeps it. Airbyte's
      // `credentials` oneOf is additionalProperties:false, so `service_account_info: ''` sent
      // next to auth_type 'Client' matches neither branch and the save is rejected. Undefined
      // drops out of the request body — the same clear the client-branch fields below use.
      if (serviceValue) setValue(servicePath, undefined);
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

  const spreadsheetPath = spreadsheetField?.path.join('.') ?? '__no_spreadsheet__';
  const savedLink = useWatch({ control, name: spreadsheetPath }) as string | undefined;
  const pickedUrl = oauth?.connectedSheet?.url;
  const pickedName = oauth?.connectedSheet?.name;

  // Which link belongs to the Google route, and keeping it out of the service card's input.
  const { oauthLink } = useGsheetsOAuthLink({
    mode,
    connected,
    usingOAuth,
    pickedUrl,
    savedLink,
    spreadsheetPath,
    hasSpreadsheetField: !!spreadsheetField,
    setValue,
  });

  const linkable = !!oauthLink && /^https?:\/\//.test(oauthLink);
  // Airbyte stores the link but never the title, so a source connected in an earlier session has
  // no name to show. "View sheet" is then the whole offer — one click to check the file in Drive,
  // which is what the name was for. A bare id (also valid in this field) would make a dead
  // relative href, so it gets no link.
  const sheetLabel = pickedName ?? 'View sheet';
  // Titles are user-chosen and can run long: cap the width so one cannot push the button around,
  // ellipsize the rest, and keep the whole name in `title`. Roughly 30 characters at this size —
  // enough for most real titles while leaving the button its room in a narrow dialog.
  const sheetNameMaxWidth = 'max-w-[15rem]';
  const sheetLink = linkable ? (
    <a
      href={oauthLink}
      target="_blank"
      rel="noopener noreferrer"
      title={sheetLabel}
      data-testid="gsheets-sheet-link"
      className={`min-w-0 truncate font-medium text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid ${sheetNameMaxWidth}`}
    >
      {sheetLabel}
    </a>
  ) : pickedName ? (
    <span className={`min-w-0 truncate font-medium ${sheetNameMaxWidth}`} title={pickedName}>
      “{pickedName}”
    </span>
  ) : null;

  const oauthSlot = oauth ? (
    <GsheetsOAuthCard
      oauth={oauth}
      disabled={disabled}
      sheetLink={sheetLink}
      // Whether that link carries a real title. With none, the "Syncing"/"Selected" label has
      // no name to introduce and the bare "View sheet" link stands on its own.
      sheetIsNamed={!!pickedName}
      // Straight from the host: which sheet this source syncs today is something only it can
      // still answer, since the field this form reads is overwritten by every pick.
      linkToRepick={oauth.linkToRepick ?? null}
    />
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
      {/* Wrapped so the onboarding walkthrough has one element to point at for "paste your
          sheet link". The fields are spec-driven, so none of them carries a testid of its own.
          `space-y-4` is repeated here because the wrapper collapses these into a single child
          of the parent's stack, which would otherwise close the gaps between them. */}
      <div className="space-y-4" data-testid="gsheets-primary-fields">
        {primary.map((field) => (
          <div key={field.path.join('.')}>{renderField(field, control, setValue, disabled)}</div>
        ))}
      </div>

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
