'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FieldNode } from '@/components/connectors/types';
import type { CustomSourceOAuth } from '@/components/ingest/sources/custom/types';
import { SourceConfigFields } from '@/components/ingest/sources/SourceConfigFields';
import { cn } from '@/lib/utils';
import {
  useSourceDefinitions,
  useSource,
  updateSource,
  getSourceOAuthConsent,
  updateOAuthSource,
} from '@/hooks/api/useSources';
import { openOAuthPopup } from '@/components/connectors/oauth-popup';
import { useBackendWebSocket } from '@/hooks/useBackendWebSocket';
import { useSourceConfigForm } from '@/hooks/useSourceConfigForm';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { toastSuccess, toastError } from '@/lib/toast';

// WebSocket endpoint for source connection check
const SOURCE_CHECK_WS_PATH = 'airbyte/source/check_connection';

// Airbyte connection check returns 'succeeded' on success
const AIRBYTE_CHECK_SUCCEEDED = 'succeeded';

interface SourceFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Required: this dialog only edits an existing source. Creation goes through
   *  the add-source wizard (AddSourceWizard). */
  sourceId: string;
}

/**
 * Edit-source dialog. Creation lives entirely in the add-source wizard, so this
 * component has no create path — it always loads an existing source, locks the
 * source type, and updates.
 */
export function SourceForm({ open, onClose, onSuccess, sourceId }: SourceFormProps) {
  const { data: definitions } = useSourceDefinitions();
  // mutate() re-fetches this specific source (a separate SWR key from the list
  // useSources() revalidates on close) — without it, reopening this dialog right
  // after a save serves the stale pre-save response until some later revalidation
  // catches up, e.g. showing a just-removed service-account key one more time.
  const { data: source, mutate: mutateSource } = useSource(open ? sourceId : null);

  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);

  // Google Sheets and KoboToolbox get a hand-tailored form; other sources
  // keep the generic spec-driven form. Resolved by the definition's name.
  const selectedDef = definitions.find((d) => d.sourceDefinitionId === selectedDefId);
  const selectedName = selectedDef?.name ?? '';

  // Shared spec + react-hook-form plumbing (also used by the add-source wizard).
  const {
    specLoading,
    parsedSpec,
    control,
    setValue,
    reset,
    handleSubmit,
    buildConfig,
    custom,
    isGoogleSheetsCustom,
  } = useSourceConfigForm({ sourceDefId: selectedDefId, sourceName: selectedName });

  const [loading, setLoading] = useState(false);
  const [setupLogs, setSetupLogs] = useState<string[]>([]);
  const [sourceName, setSourceName] = useState('');

  // Google OAuth: the credentials never reach the browser. "Re-authenticate" only runs
  // consent + popup and stashes the redeemed ref here; the actual update happens when
  // the user clicks "Save Changes And Test".
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [oauthRef, setOauthRef] = useState<string | null>(null);
  // Inline required-field errors, surfaced on submit (same pattern as the
  // add-source wizard and the connection form: the button stays clickable and
  // pressing it reveals what's missing, rather than a silently disabled button).
  const [nameError, setNameError] = useState<string | null>(null);

  // An existing Google-Sheets source already authed via OAuth: its stored credentials
  // use the Client (OAuth) discriminator. Such a source is already connected — editing
  // it should NOT force a fresh login; re-auth is optional.
  const isConnected = useMemo(() => {
    if (!isGoogleSheetsCustom) return false;
    const creds = source?.connectionConfiguration?.credentials as
      | { auth_type?: string }
      | undefined;
    return creds?.auth_type === 'Client';
  }, [isGoogleSheetsCustom, source]);

  // Load the source being edited
  useEffect(() => {
    if (open && source) {
      setSelectedDefId(source.sourceDefinitionId);
      setSourceName(source.name);
    }
  }, [open, source]);

  // Populate form values once spec + source are both ready
  useEffect(() => {
    if (parsedSpec && source?.connectionConfiguration) {
      const config = structuredClone(source.connectionConfiguration);

      // The API often omits const discriminator keys (e.g. auth_type, tunnel_method).
      // Recursively walk all fields and fill in missing discriminators.
      function inferDiscriminators(fields: FieldNode[], root: Record<string, unknown>) {
        for (const field of fields) {
          if (field.type === 'oneOf' && field.constKey && field.constOptions?.length) {
            // Navigate to (or create) the nested object at field.path
            let target: Record<string, unknown> = root;
            for (const segment of field.path) {
              if (!target[segment] || typeof target[segment] !== 'object') {
                target[segment] = {};
              }
              target = target[segment] as Record<string, unknown>;
            }

            if (target[field.constKey] === undefined) {
              // Infer which option is active from its sub-fields being present
              let inferred = false;
              for (const option of field.constOptions) {
                const subs = field.oneOfSubFields?.filter((sf) => sf.parentValue === option.value);
                if (subs?.some((sf) => target[sf.path[sf.path.length - 1]] !== undefined)) {
                  target[field.constKey] = option.value;
                  inferred = true;
                  break;
                }
              }
              if (!inferred) {
                target[field.constKey] = field.constOptions[0].value;
              }
            }

            // Recurse into oneOf sub-fields (they may contain nested oneOf)
            if (field.oneOfSubFields) {
              inferDiscriminators(field.oneOfSubFields, root);
            }
          }

          // Recurse into array items — each item is its own root for sub-fields
          if (field.type === 'array' && field.arraySubFields) {
            let arrayVal: unknown = root;
            for (const segment of field.path) {
              if (arrayVal && typeof arrayVal === 'object' && !Array.isArray(arrayVal)) {
                arrayVal = (arrayVal as Record<string, unknown>)[segment];
              } else {
                arrayVal = undefined;
                break;
              }
            }
            if (Array.isArray(arrayVal)) {
              for (const item of arrayVal) {
                if (typeof item === 'object' && item !== null) {
                  inferDiscriminators(field.arraySubFields, item as Record<string, unknown>);
                }
              }
            }
          }
        }
      }

      inferDiscriminators(parsedSpec.fields, config);
      reset(config);
    }
  }, [parsedSpec, source, reset]);

  // WebSocket for the connection check — connects once a submit sets `loading`.
  const { sendOrQueue, lastMessage } = useBackendWebSocket(SOURCE_CHECK_WS_PATH, {
    enabled: loading,
    onLoadingChange: setLoading,
  });

  // "Re-authenticate": get a consent URL and run the popup. This only stashes the
  // redeemed ref — the source is not saved until the footer "Save Changes And Test".
  // The OAuth credentials never reach the browser.
  const handleConnectGoogle = useCallback(async () => {
    if (!selectedDefId) return;
    // Same inline treatment as submit — a missing name is a form error, not a toast.
    if (!sourceName.trim()) {
      setNameError('Source name is required');
      return;
    }

    setOauthConnecting(true);
    try {
      trackEvent(ANALYTICS_EVENTS.SOURCE_OAUTH_STARTED, { source_type: 'Google Sheets' });
      const { authUrl } = await getSourceOAuthConsent(selectedDefId, selectedName);
      const { ref } = await openOAuthPopup(authUrl);
      setOauthRef(ref);
      trackEvent(ANALYTICS_EVENTS.SOURCE_OAUTH_CONNECTED, { source_type: 'Google Sheets' });
      toastSuccess.generic('Authorized with Google — click Save Changes And Test to apply');
    } catch (error) {
      toastError.api(error instanceof Error ? error.message : 'Google sign-in failed');
    } finally {
      setOauthConnecting(false);
    }
  }, [selectedDefId, selectedName, sourceName]);

  // WS check succeeded → persist the update (v1 pattern: test, then auto-save).
  const handleSaveSource = useCallback(async () => {
    const config = buildConfig();

    try {
      await updateSource(sourceId, {
        name: sourceName,
        sourceDefId: selectedDefId!,
        sourceDefName: selectedName,
        config,
        sourceId,
      });
      // source_type rides along on every update, same as SOURCE_CREATED — without
      // it, edits can't be broken down by connector in PostHog.
      trackEvent(ANALYTICS_EVENTS.SOURCE_UPDATED, {
        source_type: selectedName,
        ...(isGoogleSheetsCustom ? { auth_mode: 'service_account' } : {}),
      });
      toastSuccess.updated('Source');
      mutateSource();
      onSuccess();
    } catch (error) {
      toastError.save(error, 'source');
    } finally {
      setLoading(false);
    }
  }, [
    buildConfig,
    sourceId,
    sourceName,
    selectedDefId,
    selectedName,
    isGoogleSheetsCustom,
    mutateSource,
    onSuccess,
  ]);

  // Process WebSocket responses
  useEffect(() => {
    if (!lastMessage) return;

    try {
      const response = JSON.parse(lastMessage.data);

      // WebSocket call itself failed
      if (response.status !== 'success') {
        toastError.api(response.message || 'Connection test failed');
        setLoading(false);
        return;
      }

      // Connection test succeeded — save to backend
      if (response.data?.status === AIRBYTE_CHECK_SUCCEEDED) {
        handleSaveSource();
      } else {
        // Connection test failed — show logs
        setSetupLogs(response.data?.logs || []);
        toastError.api('Connection test failed');
        setLoading(false);
      }
    } catch {
      toastError.api('Invalid response from server');
      setLoading(false);
    }
  }, [lastMessage, handleSaveSource]);

  // Required-field check for the host-owned name field (the spec-driven fields
  // self-report via react-hook-form; the source type is locked in edit mode).
  // Sets the inline error and returns validity.
  const validateHostFields = useCallback(() => {
    const nameOk = !!sourceName.trim();
    setNameError(nameOk ? null : 'Source name is required');
    return nameOk;
  }, [sourceName]);

  // A fresh OAuth ref: redeem it into an update. The refresh_token lives only in
  // the server-side ref, so there's no client-side WS check here — the backend's
  // update_source runs Airbyte's connection check itself.
  const handleUpdateOAuthSource = useCallback(async () => {
    setSetupLogs([]);
    setLoading(true);
    try {
      await updateOAuthSource(sourceId, {
        sourceDefId: selectedDefId!,
        sourceName: selectedName,
        name: sourceName,
        config: buildConfig(),
        refresh_token_ref: oauthRef!,
      });
      trackEvent(ANALYTICS_EVENTS.SOURCE_UPDATED, {
        source_type: 'Google Sheets',
        auth_mode: 'oauth',
      });
      toastSuccess.updated('Source');
      mutateSource();
      onSuccess();
    } catch (error) {
      toastError.save(error, 'source');
    } finally {
      setLoading(false);
    }
  }, [
    selectedDefId,
    selectedName,
    sourceName,
    buildConfig,
    oauthRef,
    sourceId,
    mutateSource,
    onSuccess,
  ]);

  // MANAGED-SA: the form reports whether auth is satisfied, because "use Dalgo's key" leaves the
  // credentials empty on purpose — clearing the key field and saving without choosing anything
  // would otherwise hand out Dalgo's key silently.
  const [authSatisfied, setAuthSatisfied] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  useEffect(() => {
    if (authSatisfied) setAuthError(null);
  }, [authSatisfied]);

  // Single submit: a fresh OAuth ref is redeemed directly; otherwise the config is
  // tested over the WebSocket and saved on success.
  const onSubmit = useCallback(() => {
    if (!validateHostFields()) return;
    // The spec is still in flight — nothing to build a config from yet, so swallow
    // the submit rather than sending a partial payload.
    if (!parsedSpec) return;

    if (isGoogleSheetsCustom && !authSatisfied) {
      setAuthError('Paste a service-account key, or tick “Use Dalgo’s service account”');
      return;
    }

    if (oauthRef) {
      handleUpdateOAuthSource();
      return;
    }

    const config = buildConfig();
    setSetupLogs([]);
    setLoading(true);
    sendOrQueue({
      name: sourceName,
      sourceDefId: selectedDefId,
      sourceDefName: selectedName,
      config,
      sourceId,
    });
  }, [
    validateHostFields,
    parsedSpec,
    sourceName,
    selectedDefId,
    oauthRef,
    isGoogleSheetsCustom,
    authSatisfied,
    handleUpdateOAuthSource,
    buildConfig,
    sourceId,
    sendOrQueue,
  ]);

  // react-hook-form blocks onSubmit when a spec-driven field fails its own rules —
  // those fields render their own inline errors, but the host-owned name field
  // would stay silent, so validate it on the invalid path too.
  const onInvalid = useCallback(() => {
    validateHostFields();
  }, [validateHostFields]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className={cn('max-h-[85vh] p-0 gap-0 flex flex-col overflow-hidden', 'sm:max-w-3xl')}
        preventOutsideClose
      >
        {/* Header typography matches the add-source wizard and the connection
            dialog: 2xl bold title + base-size description. */}
        <DialogHeader className="flex-shrink-0 space-y-2 border-b px-6 pt-6 pb-4 text-left">
          <DialogTitle className="text-2xl font-bold">Edit Source</DialogTitle>
          <DialogDescription className="text-base">
            Update your source connection settings.
          </DialogDescription>
        </DialogHeader>

        {/* Hold a single loader until the source AND its config spec are ready, so
            we never flash an empty form then a populated one. */}
        {!source || !selectedDefId || specLoading ? (
          <div
            data-testid="source-form-loading"
            className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-sm text-muted-foreground"
          >
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            Loading source…
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit, onInvalid)}
            className="flex min-h-0 flex-1 flex-col"
            data-testid="source-form"
          >
            {/* Only this middle region scrolls; header + footer stay fixed. */}
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-none px-6 py-5">
              {/* Source Name */}
              <div>
                <Label htmlFor="source-name" className="text-base">
                  Source name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="source-name"
                  data-testid="source-name-input"
                  value={sourceName}
                  onChange={(e) => {
                    setSourceName(e.target.value);
                    if (nameError) setNameError(null);
                  }}
                  placeholder="Enter source name"
                  disabled={loading}
                  className={cn('mt-1.5', nameError && 'border-destructive')}
                />
                {nameError && (
                  <p className="text-xs text-destructive mt-1" data-testid="source-name-error">
                    {nameError}
                  </p>
                )}
              </div>

              {/* Source type — fixed for an existing source, shown read-only so the
                  user can still see what they are editing. */}
              <div>
                <Label className="text-base">Source type</Label>
                <div
                  className="mt-1.5 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-base"
                  data-testid="source-type-display"
                >
                  <img
                    src={selectedDef?.icon || '/icons/connection.svg'}
                    alt=""
                    className="h-4 w-4 flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.src = '/icons/connection.svg';
                    }}
                  />
                  <span>{selectedName || '—'}</span>
                </div>
              </div>

              {/* Config body — custom/generic form and connection-test logs.
                Shared with the add-source wizard. */}
              <SourceConfigFields
                parsedSpec={parsedSpec}
                custom={custom}
                control={control}
                setValue={setValue}
                disabled={loading}
                mode="edit"
                onAuthSatisfiedChange={isGoogleSheetsCustom ? setAuthSatisfied : undefined}
                oauth={
                  isGoogleSheetsCustom
                    ? ({
                        connected: isConnected || !!oauthRef,
                        busy: oauthConnecting,
                        // "Re-" only makes sense once this source has actually used OAuth
                        // before (isConnected, from stored auth_type === 'Client'); a
                        // service-account-only source has never authenticated this way.
                        buttonLabel: oauthRef
                          ? isConnected
                            ? 'Re-authenticated with Google'
                            : 'Authenticated with Google'
                          : isConnected
                            ? 'Re-authenticate with Google'
                            : 'Authenticate with Google',
                        lockWhenConnected: false,
                        onClick: handleConnectGoogle,
                        error: authError ?? undefined,
                      } satisfies CustomSourceOAuth)
                    : undefined
                }
                setupLogs={setupLogs}
                logsTestId="connection-logs"
              />
            </div>

            {/* Footer — single "Save changes and test" button like v1 */}
            <DialogFooter className="flex-shrink-0 gap-2 border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                data-testid="source-cancel-btn"
              >
                Cancel
              </Button>
              {/* Test-and-save handles the service-account (and every non-Google) path. The
                Google OAuth button inside the form is the alternative create/re-auth action.
                Stays clickable while fields are empty so pressing it surfaces the inline
                required-field errors (onSubmit validates and blocks). Disabled only for
                states where a click genuinely can't do anything: a request in flight, or a
                chosen source whose spec is still loading (nothing to validate or submit). */}
              <Button
                type="submit"
                variant="primary"
                className="uppercase"
                disabled={loading || specLoading}
                data-testid="source-save-btn"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Save Changes And Test
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
