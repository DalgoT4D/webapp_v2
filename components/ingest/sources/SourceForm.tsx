'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { Combobox, highlightText } from '@/components/ui/combobox';
import type { ComboboxItem } from '@/components/ui/combobox';
import { ConnectorConfigForm } from '@/components/connectors/ConnectorConfigForm';
import {
  GoogleSheetsAuth,
  type GsheetsAuthMode,
} from '@/components/ingest/sources/GoogleSheetsAuth';
import { parseAirbyteSpec } from '@/components/connectors/spec-parser';
import { cleanFormValues, extractSpecDefaults } from '@/components/connectors/utils';
import type { FieldNode, ParsedSpec } from '@/components/connectors/types';
import {
  useSourceDefinitions,
  useSourceSpec,
  useSource,
  updateSource,
  getSourceOAuthConsent,
  createOAuthSource,
  GOOGLE_SHEETS_SOURCE_DEFINITION_ID,
} from '@/hooks/api/useSources';
import { openOAuthPopup } from '@/components/connectors/oauth-popup';
import { useBackendWebSocket } from '@/hooks/useBackendWebSocket';
import { useSourceSave } from '@/hooks/useSourceSave';
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
  sourceId?: string;
}

export function SourceForm({ open, onClose, onSuccess, sourceId }: SourceFormProps) {
  const isEdit = !!sourceId;

  const { data: definitions } = useSourceDefinitions();
  const { data: source } = useSource(open && sourceId ? sourceId : null);

  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);
  const { data: spec, isLoading: specLoading } = useSourceSpec(selectedDefId);

  // Edit mode (update an existing source) keeps its own WS-check + save state — the
  // shared useSourceSave hook below only covers the create path (source-add wizard's
  // step 2 reuses it for creation only, never editing).
  const [editLoading, setEditLoading] = useState(false);
  const [editSetupLogs, setEditSetupLogs] = useState<string[]>([]);
  const [sourceName, setSourceName] = useState('');

  // Google OAuth: the credentials never reach the browser. The "Authenticate" action
  // runs consent → complete, and the backend creates/updates the source server-side.
  const [editOauthConnecting, setEditOauthConnecting] = useState(false);
  // For Google Sheets: 'google' shows only the Sign-in button; 'service' reveals the
  // service-account JSON field. The raw OAuth client id/secret/refresh-token inputs are
  // never shown — the OAuth branch is the sign-in button.
  const [authMode, setAuthMode] = useState<GsheetsAuthMode>('google');
  // useSourceSave owns its own setupLogs but has no external reset — this flag lets us
  // hide a stale failure banner the instant the create dialog reopens or the source
  // type changes, without waiting for the next save/connect attempt to clear it.
  const [createLogsDismissed, setCreateLogsDismissed] = useState(false);

  const isGoogleSheets = selectedDefId === GOOGLE_SHEETS_SOURCE_DEFINITION_ID;

  // An existing Google-Sheets source already authed via OAuth: its stored credentials
  // use the Client (OAuth) discriminator. Such a source is already connected — editing
  // it should NOT force a fresh login; re-auth is optional.
  const alreadyOAuthConnected = useMemo(() => {
    if (!isEdit || !isGoogleSheets) return false;
    const creds = source?.connectionConfiguration?.credentials as
      | { auth_type?: string }
      | undefined;
    return creds?.auth_type === 'Client';
  }, [isEdit, isGoogleSheets, source]);
  // an existing source stored with OAuth credentials
  const isConnected = alreadyOAuthConnected;

  // Build combobox items from definitions, sorted alphabetically
  const sourceDefItems = useMemo<ComboboxItem[]>(
    () =>
      [...definitions]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((def) => ({
          value: def.sourceDefinitionId,
          label: def.dockerImageTag ? `${def.name} (${def.dockerImageTag})` : def.name,
          icon: def.icon,
        })),
    [definitions]
  );

  // Parse spec into field tree
  const parsedSpec = useMemo<ParsedSpec | null>(() => {
    if (!spec) return null;
    return parseAirbyteSpec(spec);
  }, [spec]);

  // The auth block is the oneOf whose discriminator is `auth_type`. For Google Sheets
  // we render it ourselves (Google vs manual); for other sources it stays in the form.
  const authField = useMemo<FieldNode | null>(
    () => parsedSpec?.fields.find((f) => f.type === 'oneOf' && f.constKey === 'auth_type') ?? null,
    [parsedSpec]
  );

  // Everything except the auth block — rendered by ConnectorConfigForm for Google Sheets
  // so the auth fields don't validate unless the user chose manual mode.
  const nonAuthSpec = useMemo<ParsedSpec | null>(() => {
    if (!parsedSpec) return null;
    if (!isGoogleSheets || !authField) return parsedSpec;
    return { ...parsedSpec, fields: parsedSpec.fields.filter((f) => f !== authField) };
  }, [parsedSpec, isGoogleSheets, authField]);

  // React Hook Form
  const { control, handleSubmit, setValue, getValues, reset } = useForm({
    defaultValues: {} as Record<string, unknown>,
  });

  // Load source data in edit mode
  useEffect(() => {
    if (open && isEdit && source) {
      setSelectedDefId(source.sourceDefinitionId);
      setSourceName(source.name);
      // default the auth mode from the stored credentials: service account -> service,
      // OAuth (Client) or anything else -> google (Sign in with Google)
      const creds = source.connectionConfiguration?.credentials as
        | { auth_type?: string }
        | undefined;
      setAuthMode(creds?.auth_type === 'Service' ? 'service' : 'google');
    }
  }, [open, isEdit, source]);

  // Populate form values when spec + source are ready in edit mode
  useEffect(() => {
    if (parsedSpec && isEdit && source?.connectionConfiguration) {
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
  }, [parsedSpec, isEdit, source, reset]);

  // Reset form when dialog opens in create mode
  useEffect(() => {
    if (open && !isEdit) {
      setSelectedDefId(null);
      setCreateLogsDismissed(true);
      setSourceName('');
      setAuthMode('google');
      reset({});
    }
  }, [open, isEdit, reset]);

  // Populate spec defaults when spec loads in create mode
  useEffect(() => {
    if (parsedSpec && !isEdit) {
      reset(extractSpecDefaults(parsedSpec));
    }
  }, [parsedSpec, isEdit, reset]);

  // Build the config to send: cleaned form values. For the Google OAuth path the
  // credentials are NOT included here — the backend injects them server-side.
  const buildConfig = useCallback(() => {
    const formValues = getValues();
    return parsedSpec ? cleanFormValues(formValues, parsedSpec.fields) : formValues;
  }, [getValues, parsedSpec]);

  // Tracks which create-path flow (WS test-then-save vs OAuth connect) is in flight so
  // the shared onSaved callback below fires the right analytics events.
  const pendingCreateKindRef = useRef<'ws' | 'oauth' | null>(null);

  // Shared source-create logic (WS check_connection → createSource, and the Google
  // OAuth connect flow) — same hook the source-add wizard's step 2 reuses. Edit mode
  // never calls into this; it keeps its own updateSource path below.
  const sourceSave = useSourceSave({
    sourceDefId: selectedDefId,
    getConfig: buildConfig,
    onSaved: () => {
      if (pendingCreateKindRef.current === 'oauth') {
        trackEvent(ANALYTICS_EVENTS.SOURCE_OAUTH_CONNECTED, { source_type: 'Google Sheets' });
        trackEvent(ANALYTICS_EVENTS.SOURCE_CREATED, {
          source_type: 'Google Sheets',
          auth_mode: 'oauth',
        });
      } else {
        trackEvent(ANALYTICS_EVENTS.SOURCE_CREATED, {
          source_type: definitions?.find((d) => d.sourceDefinitionId === selectedDefId)?.name,
          ...(isGoogleSheets ? { auth_mode: 'service_account' } : {}),
        });
      }
      onSuccess();
    },
  });

  // WebSocket for connection check in edit mode — connects when editLoading (submit
  // triggered). The create path's WS check lives inside useSourceSave.
  const { sendOrQueue: editSendOrQueue, lastMessage: editLastMessage } = useBackendWebSocket(
    SOURCE_CHECK_WS_PATH,
    { enabled: editLoading, onLoadingChange: setEditLoading }
  );

  // "Authenticate": get a consent URL, run the popup, then complete — which on the
  // backend exchanges the code, injects the credentials, and creates/updates the source
  // in one step. The OAuth credentials never reach the browser.
  const handleConnectGoogle = useCallback(async () => {
    if (!selectedDefId) return;
    if (!sourceName.trim()) {
      toastError.api('Enter a source name first');
      return;
    }

    if (!isEdit) {
      pendingCreateKindRef.current = 'oauth';
      setCreateLogsDismissed(false);
      trackEvent(ANALYTICS_EVENTS.SOURCE_OAUTH_STARTED, { source_type: 'Google Sheets' });
      await sourceSave.connectGoogle(sourceName);
      return;
    }

    setEditOauthConnecting(true);
    try {
      trackEvent(ANALYTICS_EVENTS.SOURCE_OAUTH_STARTED, { source_type: 'Google Sheets' });
      const config = buildConfig();
      const { authUrl } = await getSourceOAuthConsent(selectedDefId);
      const { ref } = await openOAuthPopup(authUrl);
      await createOAuthSource({
        sourceDefId: selectedDefId,
        name: sourceName,
        config,
        ref,
        ...(sourceId ? { sourceId } : {}),
      });
      trackEvent(ANALYTICS_EVENTS.SOURCE_OAUTH_CONNECTED, { source_type: 'Google Sheets' });
      trackEvent(ANALYTICS_EVENTS.SOURCE_UPDATED, {
        source_type: 'Google Sheets',
        auth_mode: 'oauth',
      });
      toastSuccess.generic('Source updated');
      onSuccess();
    } catch (error) {
      toastError.api(error instanceof Error ? error.message : 'Google sign-in failed');
    } finally {
      setEditOauthConnecting(false);
    }
  }, [selectedDefId, sourceName, isEdit, sourceSave, buildConfig, sourceId, onSuccess]);

  // Handle WebSocket response for edit mode — v1 pattern: test succeeded → auto-save
  const handleSaveSource = useCallback(async () => {
    const config = buildConfig();

    try {
      await updateSource(sourceId!, {
        name: sourceName,
        sourceDefId: selectedDefId!,
        config,
        sourceId: sourceId!,
      });
      trackEvent(ANALYTICS_EVENTS.SOURCE_UPDATED, {
        ...(isGoogleSheets ? { auth_mode: 'service_account' } : {}),
      });
      toastSuccess.updated('Source');
      onSuccess();
    } catch (error) {
      toastError.save(error, 'source');
    } finally {
      setEditLoading(false);
    }
  }, [buildConfig, sourceId, sourceName, selectedDefId, onSuccess]);

  // Process WebSocket responses in edit mode
  useEffect(() => {
    if (!editLastMessage) return;

    try {
      const response = JSON.parse(editLastMessage.data);

      // WebSocket call itself failed
      if (response.status !== 'success') {
        toastError.api(response.message || 'Connection test failed');
        setEditLoading(false);
        return;
      }

      // Connection test succeeded — save to backend
      if (response.data?.status === AIRBYTE_CHECK_SUCCEEDED) {
        handleSaveSource();
      } else {
        // Connection test failed — show logs
        setEditSetupLogs(response.data?.logs || []);
        toastError.api('Connection test failed');
        setEditLoading(false);
      }
    } catch {
      toastError.api('Invalid response from server');
      setEditLoading(false);
    }
  }, [editLastMessage, handleSaveSource]);

  const handleSourceDefChange = useCallback(
    (defId: string) => {
      setSelectedDefId(defId);
      reset({});
      setEditSetupLogs([]);
      setCreateLogsDismissed(true);
      setAuthMode('google');
    },
    [reset]
  );

  // Single submit: edit mode tests over WS then updates; create mode delegates to the
  // shared useSourceSave hook (WS test → createSource).
  const onSubmit = useCallback(() => {
    if (!sourceName.trim() || !selectedDefId) return;

    if (isEdit) {
      const config = buildConfig();
      setEditSetupLogs([]);
      setEditLoading(true);
      editSendOrQueue({
        name: sourceName,
        sourceDefId: selectedDefId,
        config,
        ...(sourceId ? { sourceId } : {}),
      });
      return;
    }

    pendingCreateKindRef.current = 'ws';
    setCreateLogsDismissed(false);
    sourceSave.save(sourceName);
  }, [sourceName, selectedDefId, isEdit, buildConfig, sourceId, editSendOrQueue, sourceSave]);

  // Unified display values — edit mode uses its own local state; create mode reads
  // from the shared hook (setupLogs additionally gated by createLogsDismissed, see above).
  const loading = isEdit ? editLoading : sourceSave.loading;
  const oauthConnecting = isEdit ? editOauthConnecting : sourceSave.oauthConnecting;
  const setupLogs = isEdit ? editSetupLogs : createLogsDismissed ? [] : sourceSave.setupLogs;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className="sm:max-w-3xl max-h-[85vh] overflow-y-auto overscroll-none"
        preventOutsideClose
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Source' : 'Add Source'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update your source connection settings.' : 'Configure a new data source.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" data-testid="source-form">
          {/* Source Name */}
          <div>
            <label htmlFor="source-name" className="text-[15px] font-medium">
              Source Name <span className="text-destructive">*</span>
            </label>
            <Input
              id="source-name"
              data-testid="source-name-input"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="Enter source name"
              disabled={loading}
              className="mt-1.5"
            />
          </div>

          {/* Source Type Selector */}
          <div>
            <label htmlFor="source-type" className="text-[15px] font-medium">
              Source Type <span className="text-destructive">*</span>
            </label>
            <div className="mt-1.5">
              <Combobox
                id="source-type"
                items={sourceDefItems}
                value={selectedDefId ?? ''}
                onValueChange={handleSourceDefChange}
                placeholder="Select source type"
                searchPlaceholder="Search sources..."
                emptyMessage="No sources found."
                disabled={isEdit || loading}
                renderItem={(item, _isSelected, searchQuery) => (
                  <div className="flex items-center gap-2">
                    <img
                      src={(item.icon as string) || '/icons/connection.svg'}
                      alt=""
                      className="h-4 w-4 flex-shrink-0"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = '/icons/connection.svg';
                      }}
                    />
                    <span className="text-sm">{highlightText(item.label, searchQuery)}</span>
                  </div>
                )}
              />
            </div>
          </div>

          {/* Spec Loading */}
          {specLoading && selectedDefId && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading configuration...
            </div>
          )}

          {/* Authentication — Google Sheets gets an OAuth-vs-service-account dropdown */}
          {isGoogleSheets && parsedSpec && authField && !specLoading && (
            <div
              className="rounded-md border border-border p-4 bg-muted/50"
              data-testid="gsheets-oauth"
            >
              <GoogleSheetsAuth
                authField={authField}
                control={control}
                setValue={setValue}
                disabled={loading}
                mode={authMode}
                onModeChange={setAuthMode}
                oauthButtonLabel={
                  isEdit ? 'Re-authenticate & Save' : 'Authenticate with Google & Create Source'
                }
                onOAuthClick={handleConnectGoogle}
                oauthBusy={oauthConnecting}
                oauthConnected={isConnected}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {authMode === 'service'
                  ? 'Paste the service-account JSON key. Dalgo uses it to read your sheet.'
                  : isConnected
                    ? 'Already connected. Re-authenticate only if the connection stopped working — it will re-save the source.'
                    : 'Enter a name and spreadsheet link above, then authenticate — the source is created on success. No credentials needed.'}
              </p>
            </div>
          )}

          {/* Dynamic Config Form — for Google Sheets the auth block is rendered above */}
          {nonAuthSpec && !specLoading && (
            <ConnectorConfigForm
              parsedSpec={nonAuthSpec}
              control={control}
              setValue={setValue}
              disabled={loading}
            />
          )}

          {/* Error logs from failed connection test */}
          {setupLogs.length > 0 && (
            <div
              className="rounded-md bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300"
              data-testid="connection-logs"
            >
              <pre className="whitespace-pre-wrap font-mono text-xs max-h-48 overflow-y-auto">
                {setupLogs.join('\n')}
              </pre>
            </div>
          )}

          {/* Footer — single "Save changes and test" button like v1 */}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              data-testid="source-cancel-btn"
            >
              Cancel
            </Button>
            {/* On the Google OAuth create path the "Authenticate" button creates the
                source, so the test-and-save button is not shown. */}
            {!(isGoogleSheets && authMode === 'google' && !isEdit) && (
              <Button
                type="submit"
                variant="primary"
                className="uppercase"
                disabled={
                  loading ||
                  !selectedDefId ||
                  !sourceName.trim() ||
                  !parsedSpec ||
                  (isGoogleSheets && authMode === 'google' && !isConnected)
                }
                data-testid="source-save-btn"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Save Changes And Test
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
