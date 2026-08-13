'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useWatch } from 'react-hook-form';
import { renderField } from '@/components/connectors/ConnectorConfigForm';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { FieldNode } from '@/components/connectors/types';
import { useManagedServiceAccount } from '@/hooks/api/useSources';
import {
  GSHEETS_KEY_CREDENTIALS,
  GSHEETS_AUTH_DISCRIMINATOR,
  GSHEETS_KEY_SPREADSHEET,
  GSHEETS_KEY_SERVICE_INFO,
  GSHEETS_OAUTH_AUTH_TYPE,
  GSHEETS_SERVICE_AUTH_TYPE,
} from './constants';
import { GsheetsAuthChoice } from './GsheetsAuthChoice';
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
 * Google Sheets custom form. Primary shows the spreadsheet link + a Google OAuth
 * button; Advanced holds everything else, including the service-account JSON. The
 * raw OAuth credential fields are never rendered — the popup fills them server-side.
 * OAuth wins over service: connecting clears any service JSON.
 *
 * Spec-driven like the Kobo form: every field the connector spec sends is rendered
 * somewhere (primary if the spec marks it required, Advanced otherwise), so a field
 * added in a future Google Sheets connector version shows up without a code change.
 * The only field held back is the `credentials` oneOf, which the sign-in button and
 * the service-account field below stand in for.
 *
 * MANAGED-SA bridge: with a deployment key configured, the sign-in button is replaced by a
 * two-way choice — Dalgo's key or your own. Delete with the bridge.
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
  // Matched on the discriminator first (the spec's own shape) and on the well-known key
  // as a fallback, so a renamed discriminator still can't leak raw client_id/secret
  // inputs into the form.
  const credentialsField = useMemo(
    () =>
      parsedSpec.fields.find(
        (f) =>
          (f.type === 'oneOf' && f.constKey === GSHEETS_AUTH_DISCRIMINATOR) ||
          keyOf(f) === GSHEETS_KEY_CREDENTIALS
      ) ?? null,
    [parsedSpec]
  );

  const { primary, advanced } = useMemo(
    () =>
      partitionFields(parsedSpec.fields, {
        // The spreadsheet link leads the form even if a future spec drops its required flag.
        pinned: [GSHEETS_KEY_SPREADSHEET],
        exclude: credentialsField ? [keyOf(credentialsField)] : [],
      }),
    [parsedSpec, credentialsField]
  );

  const serviceField = credentialsField?.oneOfSubFields?.find(
    (f) =>
      f.parentValue === GSHEETS_SERVICE_AUTH_TYPE &&
      f.path[f.path.length - 1] === GSHEETS_KEY_SERVICE_INFO
  );
  // The parser marks this required from its own oneOf branch's schema alone — it has
  // no notion of "only when this branch is actually selected" (spec-parser.ts's
  // `optionRequired`, applied unconditionally per branch). Every other oneOf field
  // dodges this because OneOfField only ever mounts the active branch's Controllers;
  // this one is always mounted (so the OAuth button can sit next to it), so its RHF
  // rule fires even while disabled and unused, blocking submit outright. The real
  // "provide one of the two" invariant is already enforced correctly elsewhere
  // (CreateSourceStep's authError check, driven by actual oauthRef/serviceProvided
  // state) — so this field itself is never RHF-required.
  const serviceFieldForRender = serviceField ? { ...serviceField, required: false } : undefined;
  // Every field belonging to the OAuth (Client) branch — cleared when the user
  // deliberately switches to a service-account key, the same generic sibling-clear
  // OneOfField.tsx does for every other connector's oneOf. Without this, stale
  // client_id/client_secret/refresh_token would ride along next to
  // service_account_info and fail Airbyte's additionalProperties:false schema.
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

  // MANAGED-SA bridge. Sign-in stays hidden until our OAuth client is verified, so with a key
  // configured this form offers only the two service-account options. No carve-out for a
  // connected OAuth source — none can exist, sign-in was never released. Unset the key and the
  // OAuth code below takes over again, untouched.
  const { managed } = useManagedServiceAccount(true);
  const managedEmail = managed?.email ?? null;
  const useManagedChoice = !!managedEmail;
  // Opting into Dalgo's key. Never seeded from the saved config — which key a source uses is
  // not recorded, and Airbyte returns the stored one masked, so on edit this stays false and the
  // checkbox is simply not offered while a key is present.
  const [useManagedKey, setUseManagedKey] = useState(false);

  // A key typed before ticking is parked here, so unticking gives it back rather than eating it.
  const parkedKey = useRef<string | undefined>(undefined);
  const handleUseManagedKeyChange = useCallback(
    (next: boolean) => {
      if (next) {
        // The backend fills the slot precisely because it arrives empty, so clear it for real —
        // the asterisks the user sees are a stand-in that never enters the form.
        parkedKey.current = serviceValue;
        if (serviceValue) setValue(servicePath, undefined);
      } else if (parkedKey.current) {
        setValue(servicePath, parkedKey.current);
        parkedKey.current = undefined;
      }
      setUseManagedKey(next);
    },
    [serviceValue, servicePath, setValue]
  );

  // Deliberate escape hatch off an already-connected OAuth source: the service
  // field stays disabled while connected (see serviceDisabled below), so typing
  // alone can't switch away — the discriminator effect just fights it, since
  // `connected` reflects real persisted/session state and never changes on its
  // own. Clicking "Use a service-account key instead" flips this once, telling
  // the effect below to stop forcing Client for the rest of the session.
  const [serviceUnlocked, setServiceUnlocked] = useState(false);
  const effectiveConnected = connected && !serviceUnlocked;

  // Keep the discriminator consistent with the active path. OAuth wins by
  // default: while effectively connected, any service JSON is cleared and
  // auth_type is pinned to Client. Once unlocked (or never connected), typing a
  // service JSON flips auth_type to Service and strips the stale Client-branch
  // fields so the config only ever matches one oneOf branch at a time.
  useEffect(() => {
    if (!discriminatorPath) return;

    // MANAGED-SA: both options are the Service branch. Managed sends the discriminator and no
    // key — the backend reads that empty slot as "use ours".
    if (useManagedChoice) {
      for (const field of clientBranchFields) {
        setValue(field.path.join('.'), undefined);
      }
      setValue(discriminatorPath, GSHEETS_SERVICE_AUTH_TYPE);
      return;
    }

    if (effectiveConnected) {
      if (serviceValue) setValue(servicePath, undefined);
      setValue(discriminatorPath, GSHEETS_OAUTH_AUTH_TYPE);
    } else {
      if (serviceValue) {
        for (const field of clientBranchFields) {
          setValue(field.path.join('.'), undefined);
        }
      }
      setValue(
        discriminatorPath,
        serviceValue ? GSHEETS_SERVICE_AUTH_TYPE : GSHEETS_OAUTH_AUTH_TYPE
      );
    }
  }, [
    effectiveConnected,
    serviceValue,
    servicePath,
    discriminatorPath,
    clientBranchFields,
    setValue,
    useManagedChoice,
  ]);

  // The host can't infer this: "use Dalgo's key" leaves credentials empty on purpose, so an
  // empty config is a valid choice rather than a missing one.
  useEffect(() => {
    if (!onAuthSatisfiedChange) return;
    if (useManagedChoice) {
      onAuthSatisfiedChange(useManagedKey || serviceProvided);
      return;
    }
    onAuthSatisfiedChange(connected || serviceProvided);
  }, [onAuthSatisfiedChange, useManagedChoice, useManagedKey, serviceProvided, connected]);

  const serviceDisabled = disabled || effectiveConnected;

  // Block the OAuth button while a service-account key is already present and no
  // OAuth connection exists yet — switching methods is deliberate (clear the key
  // first), not a silent one-click overwrite of a working credential.
  const oauthBlocked = !connected && serviceProvided;

  // Auto-open Advanced once, whichever reason surfaces it first: an existing
  // service key blocking the OAuth button, or the user unlocking the service
  // field on a connected source. Never auto-closes after that — the user's own
  // toggling wins from here on.
  const [advancedValue, setAdvancedValue] = useState('');
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if ((oauthBlocked || serviceUnlocked) && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      setAdvancedValue('advanced');
    }
  }, [oauthBlocked, serviceUnlocked]);

  return (
    <div className="space-y-4" data-testid="google-sheets-form">
      {primary.map((field) => renderField(field, control, setValue, disabled))}

      {/* MANAGED-SA: with a key configured, the two options replace sign-in entirely. */}
      {useManagedChoice && managedEmail ? (
        <GsheetsAuthChoice
          email={managedEmail}
          useManagedKey={useManagedKey}
          onUseManagedKeyChange={handleUseManagedKeyChange}
          hasKey={serviceProvided}
          mode={mode}
          disabled={disabled}
          error={oauth?.error}
          keyField={
            serviceFieldForRender
              ? renderField(serviceFieldForRender, control, setValue, disabled)
              : null
          }
          keyFieldLabel={serviceField?.title ?? 'Service Account Information.'}
        />
      ) : (
        oauth && (
          <div className="space-y-2">
            <Label>
              Authentication <span className="text-destructive">*</span>
            </Label>
            {connected && oauth.lockWhenConnected ? (
              <div
                data-testid="gsheets-oauth-connected"
                className="flex w-full items-center gap-3 rounded-md border border-green-600/40 bg-green-600/5 px-4 py-3 text-sm dark:border-green-400/40"
              >
                <Check className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
                <span className="font-medium text-green-600 dark:text-green-400">
                  {oauth.buttonLabel}
                </span>
              </div>
            ) : oauthBlocked ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block">
                    <button
                      type="button"
                      data-testid="gsheets-oauth-connect-btn"
                      disabled
                      className="flex w-full cursor-not-allowed items-center gap-3 rounded-md border px-4 py-3 text-left text-sm opacity-60"
                    >
                      <GoogleIcon className="h-5 w-5 flex-shrink-0" />
                      <span className="font-medium">Authenticate with Google</span>
                    </button>
                  </span>
                </TooltipTrigger>
                <TooltipContent data-testid="gsheets-oauth-blocked-tooltip">
                  Remove the service-account key below to authenticate with Google instead.
                </TooltipContent>
              </Tooltip>
            ) : (
              <button
                type="button"
                data-testid="gsheets-oauth-connect-btn"
                onClick={oauth.onClick}
                disabled={disabled || oauth.busy}
                className="flex w-full cursor-pointer items-center gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
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
            )}
            {connected && !serviceUnlocked && (
              <button
                type="button"
                onClick={() => setServiceUnlocked(true)}
                data-testid="gsheets-use-service-key-btn"
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Use a service-account key instead
              </button>
            )}
            {serviceUnlocked && (
              <p className="text-xs text-muted-foreground" data-testid="gsheets-unlock-note">
                Paste a service-account key below — saving will replace your Google connection with
                it.
              </p>
            )}
            {oauth.error && (
              <p className="text-xs text-destructive mt-1" data-testid="gsheets-auth-error">
                {oauth.error}
              </p>
            )}
          </div>
        )
      )}

      {(advanced.length > 0 || (serviceField && !useManagedChoice)) && (
        <Accordion
          type="single"
          collapsible
          value={advancedValue}
          onValueChange={setAdvancedValue}
          data-testid="gsheets-advanced"
        >
          <AccordionItem value="advanced" className="border-none">
            <AccordionTrigger
              className="text-sm font-semibold text-muted-foreground uppercase tracking-wider py-2 hover:no-underline"
              data-testid="gsheets-advanced-trigger"
            >
              Advanced options
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              {advanced.map((field) => renderField(field, control, setValue, disabled))}
              {/* MANAGED-SA: on the managed path this renders under the "own key" radio. */}
              {serviceField && !useManagedChoice && (
                <div
                  className={effectiveConnected ? 'opacity-60' : undefined}
                  data-testid="gsheets-service-field"
                >
                  <p className="mb-2 text-xs text-muted-foreground">
                    Prefer not to use Google sign-in? Paste a service-account JSON key instead.
                    {effectiveConnected && ' (Disabled — you are already signed in with Google.)'}
                  </p>
                  {renderField(serviceFieldForRender, control, setValue, serviceDisabled)}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
