'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConnectorConfigForm } from '@/components/connectors/ConnectorConfigForm';
import { parseAirbyteSpec } from '@/components/connectors/spec-parser';
import { cleanFormValues, extractSpecDefaults } from '@/components/connectors/utils';
import type { FieldNode, ParsedSpec } from '@/components/connectors/types';
import {
  useSourceSpec,
  GOOGLE_SHEETS_SOURCE_DEFINITION_ID,
  getSourceOAuthConsent,
  createOAuthSource,
} from '@/hooks/api/useSources';
import { openOAuthPopup } from '@/components/connectors/oauth-popup';
import { useSourceSave } from '@/hooks/useSourceSave';
import { toastError, toastSuccess } from '@/lib/toast';
import type { SourceDefinition } from '@/types/source';
import { SourceHelperPanel } from './SourceHelperPanel';

interface Props {
  def: SourceDefinition;
  onCreated: (sourceId: string) => void;
  onBack: () => void;
}

// Google's multi-colour "G" mark, inlined so the button matches the real
// "Sign in with Google" branding without shipping an external asset.
function GoogleIcon({ className }: { className?: string }) {
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

export function CreateSourceStep({ def, onCreated, onBack }: Props) {
  const isGoogleSheets = def.sourceDefinitionId === GOOGLE_SHEETS_SOURCE_DEFINITION_ID;
  const { data: spec, isLoading: specLoading } = useSourceSpec(def.sourceDefinitionId);
  const [name, setName] = useState('');
  const { control, setValue, getValues, reset } = useForm({
    defaultValues: {} as Record<string, unknown>,
  });

  // Two-phase Google flow: "Sign in with Google" authorizes and stashes the
  // redeem ref; the footer's Next then creates the source from that ref. Kept
  // local (not in useSourceSave, whose one-shot connectGoogle SourceForm still
  // uses) — this component is remounted per source-definition, so the ref never
  // leaks across sources.
  const [oauthRef, setOauthRef] = useState<string | null>(null);
  const [authorizing, setAuthorizing] = useState(false);
  const [creatingGoogle, setCreatingGoogle] = useState(false);
  // Re-entry guards: the button's `disabled` is React state and doesn't apply until the
  // next render, so a fast double-fire would run these twice before it disables — opening
  // two popups that race two polls on the same localStorage key (a success AND a
  // "cancelled" toast). A ref blocks the second call synchronously.
  const authorizingRef = useRef(false);
  const creatingGoogleRef = useRef(false);

  const parsedSpec = useMemo<ParsedSpec | null>(
    () => (spec ? parseAirbyteSpec(spec) : null),
    [spec]
  );

  // The auth block is the oneOf whose discriminator is `auth_type`. For Google Sheets
  // the "Sign in with Google" button replaces it entirely — the raw credential fields
  // (client id/secret/refresh token, service account, etc.) must never render here.
  const authField = useMemo<FieldNode | null>(
    () => parsedSpec?.fields.find((f) => f.type === 'oneOf' && f.constKey === 'auth_type') ?? null,
    [parsedSpec]
  );

  // Everything except the auth block, for Google Sheets only — matches SourceForm's
  // nonAuthSpec pattern. Non-Google sources render the full parsed spec unchanged.
  const nonAuthSpec = useMemo<ParsedSpec | null>(() => {
    if (!parsedSpec) return null;
    if (!isGoogleSheets || !authField) return parsedSpec;
    return { ...parsedSpec, fields: parsedSpec.fields.filter((f) => f !== authField) };
  }, [parsedSpec, isGoogleSheets, authField]);

  // Populate the form with the spec's defaults once per source definition. Guarded by
  // a ref (keyed on def.sourceDefinitionId) rather than depending on `parsedSpec`
  // directly — SWR-backed hooks return a referentially stable object in production,
  // but reacting to `parsedSpec` identity alone would re-fire (and loop, via
  // reset -> re-render -> new parsedSpec ref) if the underlying hook ever returns a
  // fresh object on every render, e.g. under simplified test mocks.
  const defaultsAppliedForDefId = useRef<string | null>(null);
  useEffect(() => {
    if (parsedSpec && defaultsAppliedForDefId.current !== def.sourceDefinitionId) {
      defaultsAppliedForDefId.current = def.sourceDefinitionId;
      reset(extractSpecDefaults(parsedSpec));
    }
  }, [parsedSpec, def.sourceDefinitionId, reset]);

  const getConfig = useCallback(() => {
    const formValues = getValues();
    const fieldsForClean = isGoogleSheets ? nonAuthSpec?.fields : parsedSpec?.fields;
    return fieldsForClean ? cleanFormValues(formValues, fieldsForClean) : formValues;
  }, [getValues, parsedSpec, nonAuthSpec, isGoogleSheets]);

  const { save, loading, setupLogs } = useSourceSave({
    sourceDefId: def.sourceDefinitionId,
    getConfig,
    onSaved: onCreated,
  });

  // Phase 1: open Google consent, stash the redeem ref. No source is created yet.
  const handleAuthorizeGoogle = useCallback(async () => {
    if (authorizingRef.current) return; // a sign-in is already in progress — ignore re-entry
    if (!name.trim()) {
      toastError.api('Enter a source name first');
      return;
    }
    authorizingRef.current = true;
    setAuthorizing(true);
    try {
      const { authUrl } = await getSourceOAuthConsent(def.sourceDefinitionId);
      const { ref } = await openOAuthPopup(authUrl);
      setOauthRef(ref);
      toastSuccess.generic('Authorized with Google');
    } catch (error) {
      toastError.api(error instanceof Error ? error.message : 'Google sign-in failed');
    } finally {
      authorizingRef.current = false;
      setAuthorizing(false);
    }
  }, [name, def.sourceDefinitionId]);

  // Phase 2: create the source from the redeemed ref and advance.
  const handleCreateGoogle = useCallback(async () => {
    if (creatingGoogleRef.current) return; // a create is already in progress — ignore re-entry
    if (!oauthRef) return;
    creatingGoogleRef.current = true;
    setCreatingGoogle(true);
    try {
      const { sourceId } = await createOAuthSource({
        sourceDefId: def.sourceDefinitionId,
        name,
        config: getConfig(),
        ref: oauthRef,
      });
      toastSuccess.created('Source');
      onCreated(sourceId);
    } catch (error) {
      toastError.api(error instanceof Error ? error.message : 'Failed to create source');
    } finally {
      creatingGoogleRef.current = false;
      setCreatingGoogle(false);
    }
  }, [oauthRef, def.sourceDefinitionId, name, getConfig, onCreated]);

  const busy = loading || authorizing || creatingGoogle;

  return (
    <div className="flex flex-1 min-h-0 flex-col" data-testid="create-source-step">
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-[1fr_320px] gap-6">
          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium">
                Source name <span className="text-destructive">*</span>
              </label>
              <Input
                data-testid="wizard-source-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`${def.name} source`}
                className="mt-1.5"
                disabled={busy}
              />
            </div>

            {specLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading configuration…
              </div>
            )}

            {nonAuthSpec && !specLoading && (
              <ConnectorConfigForm
                parsedSpec={nonAuthSpec}
                control={control}
                setValue={setValue}
                disabled={busy}
              />
            )}

            {isGoogleSheets && (
              <div>
                <label className="text-sm font-medium">
                  Authentication <span className="text-destructive">*</span>
                </label>
                <button
                  type="button"
                  data-testid="gsheets-oauth-connect-btn"
                  onClick={handleAuthorizeGoogle}
                  disabled={authorizing || creatingGoogle || !name.trim()}
                  className="mt-1.5 flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {oauthRef ? (
                    <Check className="h-5 w-5 flex-shrink-0 text-primary" />
                  ) : (
                    <GoogleIcon className="h-5 w-5 flex-shrink-0" />
                  )}
                  <span className="font-medium">
                    {oauthRef
                      ? 'Connected — Google authorized'
                      : 'Sign in with Google to authorize Dalgo'}
                  </span>
                  {authorizing && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
                </button>
              </div>
            )}

            {setupLogs.length > 0 && (
              <pre
                data-testid="wizard-setup-logs"
                className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-red-50 p-3 font-mono text-xs text-red-700 dark:bg-red-950 dark:text-red-300"
              >
                {setupLogs.join('\n')}
              </pre>
            )}
          </div>

          <SourceHelperPanel sourceName={def.name} />
        </div>
      </div>

      <div className="flex flex-shrink-0 justify-between border-t px-6 py-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={busy}
          data-testid="wizard-back-btn"
        >
          Back
        </Button>
        {isGoogleSheets ? (
          <Button
            type="button"
            variant="primary"
            data-testid="wizard-next-btn"
            disabled={!oauthRef || creatingGoogle || !name.trim()}
            onClick={handleCreateGoogle}
          >
            {creatingGoogle && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Next
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            data-testid="wizard-next-btn"
            disabled={loading || !name.trim() || !parsedSpec}
            onClick={() => save(name)}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
