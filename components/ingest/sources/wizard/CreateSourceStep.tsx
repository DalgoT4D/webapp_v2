'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConnectorConfigForm } from '@/components/connectors/ConnectorConfigForm';
import { parseAirbyteSpec } from '@/components/connectors/spec-parser';
import { cleanFormValues, extractSpecDefaults } from '@/components/connectors/utils';
import type { ParsedSpec } from '@/components/connectors/types';
import { useSourceSpec, getSourceOAuthConsent, createOAuthSource } from '@/hooks/api/useSources';
import { openOAuthPopup } from '@/components/connectors/oauth-popup';
import { useSourceSave } from '@/hooks/useSourceSave';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { toastError, toastSuccess } from '@/lib/toast';
import type { SourceDefinition } from '@/types/source';
import { SourceHelperPanel } from './SourceHelperPanel';
import { getCustomSource } from '@/components/ingest/sources/custom/registry';
import { SOURCE_NAME_GOOGLE_SHEETS } from '@/components/ingest/sources/custom/constants';
import type { CustomSourceOAuth } from '@/components/ingest/sources/custom/types';

interface Props {
  def: SourceDefinition;
  onCreated: (sourceId: string) => void;
  onBack: () => void;
}

export function CreateSourceStep({ def, onCreated, onBack }: Props) {
  // Google Sheets and KoboToolbox get a hand-tailored form + docs panel; every other
  // source falls back to the generic spec-driven form with no panel.
  const custom = getCustomSource(def.name);
  const isGoogleSheets = def.name === SOURCE_NAME_GOOGLE_SHEETS;
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
    // Clean against the full spec. cleanFormValues is value-driven, so it keeps whatever
    // the form wrote (service-account creds, or the OAuth discriminator) while coercing
    // number fields — the custom form is the single owner of which auth fields exist.
    return parsedSpec?.fields ? cleanFormValues(formValues, parsedSpec.fields) : formValues;
  }, [getValues, parsedSpec]);

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

  const busy = loading || authorizing || creatingGoogle;
  // Once a Google ref is acquired, the footer Next redeems it into a source. Without a
  // ref (service-account path, or any other source) it falls back to the standard
  // WS-test → createSource flow.
  const useGoogleOAuthFlow = isGoogleSheets && !!oauthRef;

  return (
    <div className="flex flex-1 min-h-0 flex-col" data-testid="create-source-step">
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
        <div className={custom ? 'grid grid-cols-[55fr_45fr] gap-6' : ''}>
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

            {custom && parsedSpec && !specLoading && (
              <custom.Form
                parsedSpec={parsedSpec}
                control={control}
                setValue={setValue}
                disabled={busy}
                mode="create"
                oauth={
                  isGoogleSheets
                    ? ({
                        connected: !!oauthRef,
                        busy: authorizing,
                        buttonLabel: oauthRef
                          ? 'Authenticated with Google'
                          : 'Sign in with Google to authorize Dalgo',
                        lockWhenConnected: true,
                        onClick: handleAuthorizeGoogle,
                      } satisfies CustomSourceOAuth)
                    : undefined
                }
              />
            )}

            {!custom && parsedSpec && !specLoading && (
              <ConnectorConfigForm
                parsedSpec={parsedSpec}
                control={control}
                setValue={setValue}
                disabled={busy}
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

          {custom && <SourceHelperPanel sourceName={def.name} />}
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
            disabled={loading || !name.trim() || !parsedSpec}
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
