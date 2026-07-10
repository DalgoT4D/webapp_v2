'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
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
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { toastError, toastSuccess } from '@/lib/toast';
import type { SourceDefinition } from '@/types/source';
import { SourceHelperPanel } from './SourceHelperPanel';
import {
  GoogleSheetsAuth,
  GSHEETS_SERVICE_AUTH_TYPE,
  type GsheetsAuthMode,
} from '@/components/ingest/sources/GoogleSheetsAuth';

interface Props {
  def: SourceDefinition;
  onCreated: (sourceId: string) => void;
  onBack: () => void;
}

export function CreateSourceStep({ def, onCreated, onBack }: Props) {
  const isGoogleSheets = def.sourceDefinitionId === GOOGLE_SHEETS_SOURCE_DEFINITION_ID;
  const { data: spec, isLoading: specLoading } = useSourceSpec(def.sourceDefinitionId);
  const [name, setName] = useState('');
  const { control, setValue, getValues, reset } = useForm({
    defaultValues: {} as Record<string, unknown>,
  });

  // Google Sheets auth mode: 'google' (Sign in with Google, default) or 'service'
  // (service-account JSON). Existing users authenticate with a service account, so the
  // dropdown must keep that path reachable.
  const [authMode, setAuthMode] = useState<GsheetsAuthMode>('google');

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
  // the GoogleSheetsAuth control replaces it — the raw OAuth credential fields (client
  // id/secret/refresh token) must never render, and the service-account branch is shown
  // only when the user picks it from the dropdown.
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
    // For Google Sheets, clean against nonAuthSpec (the auth block is handled by
    // GoogleSheetsAuth). Field inclusion is value-driven, so the service-account values
    // the dropdown wrote still flow through in service mode.
    const fieldsForClean = isGoogleSheets ? nonAuthSpec?.fields : parsedSpec?.fields;
    return fieldsForClean ? cleanFormValues(formValues, fieldsForClean) : formValues;
  }, [getValues, parsedSpec, nonAuthSpec, isGoogleSheets]);

  const { save, loading, setupLogs } = useSourceSave({
    sourceDefId: def.sourceDefinitionId,
    getConfig,
    onSaved: (sourceId) => {
      trackEvent(ANALYTICS_EVENTS.SOURCE_CREATED, {
        source_type: def.name,
        ...(isGoogleSheets ? { auth_mode: 'service_account' } : {}),
      });
      onCreated(sourceId);
    },
  });

  // Required service-account fields present? Gates the footer Next in service mode so we
  // don't fire a WS test that is guaranteed to fail on empty credentials.
  const watchedCreds = useWatch({
    control,
    name: authField?.path.join('.') ?? '__no_auth__',
  }) as Record<string, unknown> | undefined;
  const serviceReady = useMemo(() => {
    if (!authField) return false;
    const required = (authField.oneOfSubFields ?? []).filter(
      (f) => f.parentValue === GSHEETS_SERVICE_AUTH_TYPE && f.required
    );
    if (required.length === 0) return true;
    return required.every((f) => {
      const val = watchedCreds?.[f.path[f.path.length - 1]];
      return typeof val === 'string' ? val.trim() !== '' : val !== null && val !== undefined;
    });
  }, [authField, watchedCreds]);

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
      trackEvent(ANALYTICS_EVENTS.SOURCE_OAUTH_STARTED, { source_type: 'Google Sheets' });
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
      trackEvent(ANALYTICS_EVENTS.SOURCE_OAUTH_CONNECTED, { source_type: 'Google Sheets' });
      trackEvent(ANALYTICS_EVENTS.SOURCE_CREATED, {
        source_type: 'Google Sheets',
        auth_mode: 'oauth',
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

  // Switching to service-account discards a stale OAuth ref so the two paths never cross.
  const handleAuthModeChange = useCallback((next: GsheetsAuthMode) => {
    setAuthMode(next);
    if (next === 'service') setOauthRef(null);
  }, []);

  const busy = loading || authorizing || creatingGoogle;
  // The footer Next drives the OAuth create path only in google mode; service mode falls
  // back to the standard WS-test → createSource flow (same as non-Google sources).
  const useGoogleOAuthFlow = isGoogleSheets && authMode === 'google';

  return (
    <div className="flex flex-1 min-h-0 flex-col" data-testid="create-source-step">
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-[55fr_45fr] gap-6">
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

            {isGoogleSheets && authField && !specLoading && (
              <GoogleSheetsAuth
                authField={authField}
                control={control}
                setValue={setValue}
                disabled={busy}
                mode={authMode}
                onModeChange={handleAuthModeChange}
                oauthButtonLabel={
                  oauthRef ? 'Authenticated with Google' : 'Sign in with Google to authorize Dalgo'
                }
                onOAuthClick={handleAuthorizeGoogle}
                oauthBusy={authorizing}
                oauthConnected={!!oauthRef}
                lockWhenConnected
              />
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

      <div className="flex flex-shrink-0 justify-end gap-2 border-t px-6 py-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={busy}
          data-testid="wizard-back-btn"
        >
          Back
        </Button>
        {useGoogleOAuthFlow ? (
          <Button
            type="button"
            variant="primary"
            data-testid="wizard-next-btn"
            disabled={!oauthRef || creatingGoogle || !name.trim()}
            onClick={handleCreateGoogle}
          >
            {creatingGoogle && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {creatingGoogle ? 'Adding data source' : 'Next'}
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            data-testid="wizard-next-btn"
            disabled={
              loading ||
              !name.trim() ||
              !parsedSpec ||
              (isGoogleSheets && authMode === 'service' && !serviceReady)
            }
            onClick={() => save(name)}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {loading ? 'Adding data source' : 'Next'}
          </Button>
        )}
      </div>
    </div>
  );
}
