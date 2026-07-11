'use client';

import { useEffect, useMemo } from 'react';
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
  GSHEETS_KEY_SPREADSHEET,
  GSHEETS_KEY_NAMES_CONVERSION,
  GSHEETS_KEY_SERVICE_INFO,
  GSHEETS_OAUTH_AUTH_TYPE,
  GSHEETS_SERVICE_AUTH_TYPE,
} from './constants';
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

function findByKey(fields: FieldNode[], key: string): FieldNode | undefined {
  return fields.find((f) => f.path[f.path.length - 1] === key);
}

/**
 * Google Sheets custom form. Primary shows only the spreadsheet link + a Google
 * OAuth button. Advanced holds the SQL-conversion toggle and the service-account
 * JSON. The raw OAuth credential fields are never rendered — the popup fills them
 * server-side. OAuth wins over service: connecting clears any service JSON.
 */
export function GoogleSheetsForm({
  parsedSpec,
  control,
  setValue,
  disabled,
  oauth,
}: CustomSourceFormProps) {
  const spreadsheetField = findByKey(parsedSpec.fields, GSHEETS_KEY_SPREADSHEET);
  const namesConversionField = findByKey(parsedSpec.fields, GSHEETS_KEY_NAMES_CONVERSION);
  const credentialsField = useMemo(
    () => parsedSpec.fields.find((f) => f.type === 'oneOf' && f.constKey === 'auth_type') ?? null,
    [parsedSpec]
  );
  const serviceField = credentialsField?.oneOfSubFields?.find(
    (f) =>
      f.parentValue === GSHEETS_SERVICE_AUTH_TYPE &&
      f.path[f.path.length - 1] === GSHEETS_KEY_SERVICE_INFO
  );
  const discriminatorPath = credentialsField?.constKey
    ? [...credentialsField.path, credentialsField.constKey].join('.')
    : '';
  const servicePath = serviceField?.path.join('.') ?? '__no_service__';
  const serviceValue = useWatch({ control, name: servicePath }) as string | undefined;

  const connected = !!oauth?.connected;

  // Keep the discriminator consistent with the active path. OAuth wins: once
  // connected, any service JSON is cleared and auth_type is pinned to Client.
  useEffect(() => {
    if (!discriminatorPath) return;
    if (connected) {
      if (serviceValue) setValue(servicePath, undefined);
      setValue(discriminatorPath, GSHEETS_OAUTH_AUTH_TYPE);
    } else {
      setValue(
        discriminatorPath,
        serviceValue ? GSHEETS_SERVICE_AUTH_TYPE : GSHEETS_OAUTH_AUTH_TYPE
      );
    }
  }, [connected, serviceValue, servicePath, discriminatorPath, setValue]);

  const serviceDisabled = disabled || connected;

  return (
    <div className="space-y-4" data-testid="google-sheets-form">
      {spreadsheetField && renderField(spreadsheetField, control, setValue, disabled)}

      {/* Google OAuth button (or static confirmation once connected in create). */}
      {oauth && (
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Authentication <span className="text-destructive">*</span>
          </label>
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
        </div>
      )}

      {(namesConversionField || serviceField) && (
        <Accordion type="single" collapsible data-testid="gsheets-advanced">
          <AccordionItem value="advanced" className="border-none">
            <AccordionTrigger
              className="text-sm font-semibold text-muted-foreground uppercase tracking-wider py-2 hover:no-underline"
              data-testid="gsheets-advanced-trigger"
            >
              Advanced options
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              {namesConversionField &&
                renderField(namesConversionField, control, setValue, disabled)}
              {serviceField && (
                <div
                  className={connected ? 'opacity-60' : undefined}
                  data-testid="gsheets-service-field"
                >
                  <p className="mb-2 text-xs text-muted-foreground">
                    Prefer not to use Google sign-in? Paste a service-account JSON key instead.
                    {connected && ' (Disabled — you are already signed in with Google.)'}
                  </p>
                  {renderField(serviceField, control, setValue, serviceDisabled)}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
