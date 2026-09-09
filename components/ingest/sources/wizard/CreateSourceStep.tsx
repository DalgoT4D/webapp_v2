'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWatch } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { extractSpecDefaults } from '@/components/connectors/utils';
import { getSourceOAuthConsent, createOAuthSource } from '@/hooks/api/useSources';
import { openOAuthPopup } from '@/components/connectors/oauth-popup';
import { useSourceSave } from '@/hooks/useSourceSave';
import { useSourceConfigForm } from '@/hooks/useSourceConfigForm';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS, SOURCE_AUTH_MODES, type SourceAuthMode } from '@/constants/analytics';
import { toastError, toastSuccess } from '@/lib/toast';
import type { SourceDefinition } from '@/types/source';
import { SourceConfigFields } from '@/components/ingest/sources/SourceConfigFields';
import {
  GSHEETS_KEY_SERVICE_INFO,
  GSHEETS_SERVICE_AUTH_TYPE,
} from '@/components/ingest/sources/custom/constants';
import { isGoogleSheetsSource } from '@/components/ingest/sources/custom/registry';
import type { CustomSourceOAuth } from '@/components/ingest/sources/custom/types';

interface Props {
  def: SourceDefinition;
  onCreated: (sourceId: string) => void;
  onBack: () => void;
}

export function CreateSourceStep({ def, onCreated, onBack }: Props) {
  // Google Sheets and KoboToolbox get a hand-tailored form; every other
  // source falls back to the generic spec-driven form with no panel.
  const isGoogleSheets = isGoogleSheetsSource(def.name);

  // Shared spec + react-hook-form plumbing (also used by the edit-source dialog).
  const { parsedSpec, specLoading, control, setValue, reset, trigger, buildConfig, custom } =
    useSourceConfigForm({ sourceDefId: def.sourceDefinitionId, sourceName: def.name });

  // Default the source name to "<Source> source" so the user can proceed without
  // typing. The step is keyed by sourceDefinitionId in the wizard, so this
  // initializer re-runs (fresh default) whenever a different source is picked,
  // and stays editable.
  const [name, setName] = useState(`${def.name} source`);
  // Inline required-field errors surfaced on Next (matches the alerts/KPI pattern):
  // the source name lives in local state (not react-hook-form), and Google's
  // "sign in OR paste a service-account JSON" choice isn't a single form field, so
  // both need their own error strings. Spec-driven fields self-report via RHF.
  const [nameError, setNameError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

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

  // Required-name check: sets the inline error and returns validity.
  const validateName = useCallback(() => {
    if (!name.trim()) {
      setNameError('Source name is required');
      return false;
    }
    setNameError(null);
    return true;
  }, [name]);

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

  // Reported by GoogleSheetsForm — the config alone can't distinguish Dalgo's managed key
  // from the user's own, since the managed route deliberately leaves credentials empty.
  // Declared above useSourceSave: its onSaved closure reads it.
  const [formAuthMode, setFormAuthMode] = useState<SourceAuthMode | null>(null);

  const { save, loading, setupLogs } = useSourceSave({
    sourceDefId: def.sourceDefinitionId,
    sourceDefName: def.name,
    getConfig: buildConfig,
    onSaved: (sourceId) => {
      // auth_mode says which of the three routes the user actually finished on — the flat
      // 'service_account' it replaced couldn't tell Dalgo's managed key from the user's own,
      // which is the whole point of offering the managed one.
      trackEvent(ANALYTICS_EVENTS.SOURCE_CREATED, {
        source_id: sourceId,
        source_type: def.name,
        ...(isGoogleSheets ? { auth_mode: formAuthMode ?? SOURCE_AUTH_MODES.OWN_KEY } : {}),
      });
      onCreated(sourceId);
    },
  });

  // Phase 1: open Google consent, stash the redeem ref. No source is created yet.
  const handleAuthorizeGoogle = useCallback(async () => {
    if (authorizingRef.current) return; // a sign-in is already in progress — ignore re-entry
    if (!validateName()) return;
    authorizingRef.current = true;
    setAuthorizing(true);
    try {
      trackEvent(ANALYTICS_EVENTS.SOURCE_OAUTH_STARTED, { source_type: 'Google Sheets' });
      const { authUrl } = await getSourceOAuthConsent(def.sourceDefinitionId, def.name);
      const { ref } = await openOAuthPopup(authUrl);
      setOauthRef(ref);
      toastSuccess.generic('Authorized with Google');
    } catch (error) {
      toastError.api(error instanceof Error ? error.message : 'Google sign-in failed');
    } finally {
      authorizingRef.current = false;
      setAuthorizing(false);
    }
  }, [validateName, def.sourceDefinitionId, def.name]);

  // Phase 2: create the source from the redeemed ref and advance.
  const handleCreateGoogle = useCallback(async () => {
    if (creatingGoogleRef.current) return; // a create is already in progress — ignore re-entry
    if (!oauthRef) return;
    creatingGoogleRef.current = true;
    setCreatingGoogle(true);
    try {
      const { sourceId } = await createOAuthSource({
        sourceDefId: def.sourceDefinitionId,
        sourceName: def.name,
        name,
        config: buildConfig(),
        refresh_token_ref: oauthRef,
      });
      trackEvent(ANALYTICS_EVENTS.SOURCE_OAUTH_CONNECTED, { source_type: 'Google Sheets' });
      trackEvent(ANALYTICS_EVENTS.SOURCE_CREATED, {
        source_id: sourceId,
        source_type: 'Google Sheets',
        auth_mode: SOURCE_AUTH_MODES.OAUTH,
      });
      toastSuccess.created('Source');
      onCreated(sourceId);
    } catch (error) {
      toastError.api(error instanceof Error ? error.message : 'Failed to create source');
    } finally {
      creatingGoogleRef.current = false;
      setCreatingGoogle(false);
    }
  }, [oauthRef, def.sourceDefinitionId, def.name, name, buildConfig, onCreated]);

  const busy = loading || authorizing || creatingGoogle;
  // Once a Google ref is acquired, the footer Next redeems it into a source. Without a
  // ref (service-account path, or any other source) it falls back to the standard
  // WS-test → createSource flow.
  const useGoogleOAuthFlow = isGoogleSheets && !!oauthRef;

  // Google Sheets auth-gating: besides the (required) spreadsheet link — which the
  // spec-driven form validates via react-hook-form — the user must supply one auth
  // method: a Google OAuth ref (the ref state above) or a pasted service-account
  // JSON. The service path comes from the parsed spec so it tracks the same
  // discriminator layout GoogleSheetsForm renders.
  const servicePath = useMemo(() => {
    if (!isGoogleSheets || !parsedSpec) return '';
    const credentials = parsedSpec.fields.find((f) => f.type === 'oneOf');
    const service = credentials?.oneOfSubFields?.find(
      (f) =>
        f.parentValue === GSHEETS_SERVICE_AUTH_TYPE &&
        f.path[f.path.length - 1] === GSHEETS_KEY_SERVICE_INFO
    );
    return service?.path.join('.') ?? '';
  }, [isGoogleSheets, parsedSpec]);

  // useWatch needs a name even when a path is unresolved; '__none__' never matches
  // a real field, so the watched value stays undefined for non-Google sources.
  const serviceValue = useWatch({ control, name: servicePath || '__none__' }) as string | undefined;
  const serviceProvided = !!serviceValue?.trim();

  // MANAGED-SA: "use Dalgo's key" leaves credentials empty on purpose, so watching form fields
  // can't tell it from "nothing chosen" — the form reports its own verdict.
  const [formAuthSatisfied, setFormAuthSatisfied] = useState(false);
  const authSatisfied = !!oauthRef || serviceProvided || formAuthSatisfied;

  // Clear the auth error the moment any auth method is satisfied.
  useEffect(() => {
    if (authSatisfied) setAuthError(null);
  }, [authSatisfied]);

  // Validate required fields, then run the appropriate create flow. Spec-driven
  // fields self-report inline via react-hook-form's `trigger`; the source name and
  // (for Google) the sign-in-or-service-account choice are checked here. Nothing
  // submits unless every required field is satisfied.
  const handleNext = useCallback(async () => {
    const nameOk = validateName();
    const fieldsOk = await trigger();

    let authOk = true;
    if (isGoogleSheets && !authSatisfied) {
      setAuthError('Paste a service-account key, or tick “Use Dalgo’s service account”');
      authOk = false;
    }

    if (!nameOk || !fieldsOk || !authOk) return;

    if (useGoogleOAuthFlow) {
      handleCreateGoogle();
    } else {
      save(name);
    }
  }, [
    validateName,
    trigger,
    isGoogleSheets,
    authSatisfied,
    useGoogleOAuthFlow,
    handleCreateGoogle,
    save,
    name,
  ]);

  // Source-name field. For custom sources (Google Sheets / Kobo) it renders inside
  // the form's left column via the nameField slot so it lines up with the other
  // inputs; for generic sources it renders full-width above the spec-driven form.
  const nameField = (
    <div>
      <Label htmlFor="wizard-source-name" className="text-base">
        Source name <span className="text-destructive">*</span>
      </Label>
      <Input
        id="wizard-source-name"
        data-testid="wizard-source-name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (nameError) setNameError(null);
        }}
        placeholder={`${def.name} source`}
        className={`mt-1.5 ${nameError ? 'border-destructive' : ''}`}
        disabled={busy}
      />
      {nameError && (
        <p className="text-xs text-destructive mt-1" data-testid="wizard-source-name-error">
          {nameError}
        </p>
      )}
    </div>
  );

  return (
    <div className="flex flex-1 min-h-0 flex-col" data-testid="create-source-step">
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
        {/* Hold a single full-panel loader until the config spec is ready, so the
            step never flashes a bare name field then a populated form — same
            treatment the edit-source dialog gives its initial load. */}
        {specLoading ? (
          <div
            data-testid="create-source-step-loading"
            className="flex flex-col items-center justify-center gap-3 py-24 text-sm text-muted-foreground"
          >
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            Loading configuration…
          </div>
        ) : (
          <div className="space-y-5">
            {!custom && nameField}

            <SourceConfigFields
              parsedSpec={parsedSpec}
              custom={custom}
              control={control}
              setValue={setValue}
              disabled={busy}
              mode="create"
              nameField={custom ? nameField : undefined}
              onAuthSatisfiedChange={isGoogleSheets ? setFormAuthSatisfied : undefined}
              onAuthModeChange={isGoogleSheets ? setFormAuthMode : undefined}
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
                      error: authError ?? undefined,
                    } satisfies CustomSourceOAuth)
                  : undefined
              }
              setupLogs={setupLogs}
              logsTestId="wizard-setup-logs"
            />
          </div>
        )}
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
        {/* Button stays clickable so pressing Next surfaces inline required-field
            errors (handleNext validates and blocks). Only disabled while a request
            is in flight or the spec hasn't loaded yet (nothing to validate). */}
        {useGoogleOAuthFlow ? (
          <Button
            type="button"
            variant="primary"
            className="uppercase"
            data-testid="wizard-next-btn"
            disabled={creatingGoogle}
            onClick={handleNext}
          >
            {creatingGoogle && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {creatingGoogle ? 'Adding data source' : 'Next'}
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            className="uppercase"
            data-testid="wizard-next-btn"
            disabled={loading || !parsedSpec}
            onClick={handleNext}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {loading ? 'Adding data source' : 'Next'}
          </Button>
        )}
      </div>
    </div>
  );
}
