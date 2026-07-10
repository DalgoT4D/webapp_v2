'use client';

import { useMemo } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { type Control, type FieldValues, type UseFormSetValue } from 'react-hook-form';
import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import { renderField } from '@/components/connectors/ConnectorConfigForm';
import type { FieldNode } from '@/components/connectors/types';

export type GsheetsAuthMode = 'google' | 'service';

// Discriminator (`auth_type`) values in the Google Sheets connector spec.
export const GSHEETS_OAUTH_AUTH_TYPE = 'Client';
export const GSHEETS_SERVICE_AUTH_TYPE = 'Service';

// Fallback labels if the spec's oneOf option titles are ever missing.
const OAUTH_LABEL_FALLBACK = 'Authenticate via Google (OAuth)';
const SERVICE_LABEL_FALLBACK = 'Service Account';

// Google's multi-colour "G" mark, inlined so the button matches the real
// "Sign in with Google" branding without shipping an external asset.
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

interface GoogleSheetsAuthProps {
  /** The parsed `auth_type` oneOf — source of the Service branch sub-fields + option titles. */
  authField: FieldNode;
  control: Control<FieldValues>;
  setValue: UseFormSetValue<FieldValues>;
  disabled?: boolean;

  mode: GsheetsAuthMode;
  onModeChange: (mode: GsheetsAuthMode) => void;

  // OAuth button — the parent supplies the label + handler because the create wizard
  // (two-phase authorize → Next) and the edit modal (one-shot re-auth & save) differ.
  oauthButtonLabel: string;
  onOAuthClick: () => void;
  oauthBusy?: boolean;
  /** Show the "Connected with Google" indicator (edit: already OAuth-connected, or ref acquired). */
  oauthConnected?: boolean;
}

/**
 * Google Sheets authentication control shared by the create wizard and the edit modal.
 *
 * Renders a two-option dropdown: "Authenticate via Google (OAuth)" (default) reveals only
 * the Google sign-in button, and "Service Account" reveals only the service-account JSON
 * field. The raw OAuth client id / secret / refresh-token inputs are NEVER rendered — the
 * OAuth branch is handled entirely by the sign-in popup, whose credentials never reach the
 * browser. This is the single source of truth for that invariant.
 */
export function GoogleSheetsAuth({
  authField,
  control,
  setValue,
  disabled,
  mode,
  onModeChange,
  oauthButtonLabel,
  onOAuthClick,
  oauthBusy,
  oauthConnected,
}: GoogleSheetsAuthProps) {
  const discriminatorPath = authField.constKey
    ? [...authField.path, authField.constKey].join('.')
    : '';

  // Only the Service branch is ever rendered as fields; the OAuth (Client) branch is
  // replaced by the sign-in button.
  const serviceSubFields = useMemo(
    () =>
      authField.oneOfSubFields?.filter((f) => f.parentValue === GSHEETS_SERVICE_AUTH_TYPE) ?? [],
    [authField]
  );

  const titleFor = (value: string) => authField.constOptions?.find((o) => o.value === value)?.title;

  const items = useMemo<ComboboxItem[]>(
    () => [
      { value: 'google', label: titleFor(GSHEETS_OAUTH_AUTH_TYPE) ?? OAUTH_LABEL_FALLBACK },
      { value: 'service', label: titleFor(GSHEETS_SERVICE_AUTH_TYPE) ?? SERVICE_LABEL_FALLBACK },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [authField]
  );

  const handleModeChange = (value: string) => {
    const next = value as GsheetsAuthMode;
    if (next === 'service') {
      // Point the discriminator at the Service branch so the emitted config is a valid oneOf.
      if (discriminatorPath) setValue(discriminatorPath, GSHEETS_SERVICE_AUTH_TYPE);
    } else {
      // Clear any service-account values so they don't leak into the OAuth config, and
      // reset the discriminator to the OAuth branch.
      for (const f of serviceSubFields) setValue(f.path.join('.'), undefined);
      if (discriminatorPath) setValue(discriminatorPath, GSHEETS_OAUTH_AUTH_TYPE);
    }
    onModeChange(next);
  };

  return (
    <div className="space-y-3" data-testid="gsheets-auth">
      <div>
        <label htmlFor="gsheets-auth-mode" className="text-sm font-medium">
          Authentication <span className="text-destructive">*</span>
        </label>
        <div className="mt-1.5">
          <Combobox
            id="gsheets-auth-mode"
            items={items}
            value={mode}
            onValueChange={handleModeChange}
            placeholder="Select authentication"
            searchPlaceholder="Search..."
            emptyMessage="No options."
            disabled={disabled}
          />
        </div>
      </div>

      {mode === 'google' ? (
        <div className="space-y-2">
          {oauthConnected && (
            <div
              className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400"
              data-testid="gsheets-oauth-connected"
            >
              <Check className="h-4 w-4" />
              Connected with Google
            </div>
          )}
          <button
            type="button"
            data-testid="gsheets-oauth-connect-btn"
            onClick={onOAuthClick}
            disabled={disabled || oauthBusy}
            className="flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {oauthConnected ? (
              <Check className="h-5 w-5 flex-shrink-0 text-primary" />
            ) : (
              <GoogleIcon className="h-5 w-5 flex-shrink-0" />
            )}
            <span className="font-medium">{oauthButtonLabel}</span>
            {oauthBusy && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
          </button>
        </div>
      ) : (
        <div
          className="ml-3 pl-3 border-l-2 border-muted space-y-4"
          data-testid="gsheets-service-fields"
        >
          {serviceSubFields.map((f) => renderField(f, control, setValue, disabled))}
        </div>
      )}
    </div>
  );
}
