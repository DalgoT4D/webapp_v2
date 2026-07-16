'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Combobox, highlightText, type ComboboxItem } from '@/components/ui/combobox';
import { extractSpecDefaults } from '@/components/connectors/utils';
import type { FieldNode } from '@/components/connectors/types';
import type { CustomSourceOAuth } from '@/components/ingest/sources/custom/types';
import { SourceConfigFields } from '@/components/ingest/sources/SourceConfigFields';
import { cn } from '@/lib/utils';
import {
  useSourceDefinitions,
  useSource,
  updateSource,
  getSourceOAuthConsent,
  createOAuthSource,
  GOOGLE_SHEETS_SOURCE_DEFINITION_ID,
} from '@/hooks/api/useSources';
import { openOAuthPopup } from '@/components/connectors/oauth-popup';
import { useBackendWebSocket } from '@/hooks/useBackendWebSocket';
import { useSourceSave } from '@/hooks/useSourceSave';
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
  sourceId?: string;
}

export function SourceForm({ open, onClose, onSuccess, sourceId }: SourceFormProps) {
  const isEdit = !!sourceId;

  const { data: definitions } = useSourceDefinitions();
  const { data: source } = useSource(open && sourceId ? sourceId : null);

  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);

  // Google Sheets and KoboToolbox get a hand-tailored form; other sources
  // keep the generic spec-driven form. Resolved by the definition's name.
  const selectedName = definitions.find((d) => d.sourceDefinitionId === selectedDefId)?.name ?? '';

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

  // Edit mode (update an existing source) keeps its own WS-check + save state — the
  // shared useSourceSave hook below only covers the create path (source-add wizard's
  // step 2 reuses it for creation only, never editing).
  const [editLoading, setEditLoading] = useState(false);
  const [editSetupLogs, setEditSetupLogs] = useState<string[]>([]);
  const [sourceName, setSourceName] = useState('');

  // Google OAuth: the credentials never reach the browser. In edit mode "Re-authenticate"
  // only runs consent + popup and stashes the redeemed ref here; the actual update happens
  // when the user clicks "Save Changes And Test" (mirrors the create wizard's two phases).
  const [editOauthConnecting, setEditOauthConnecting] = useState(false);
  const [editOauthRef, setEditOauthRef] = useState<string | null>(null);
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

  // Load source data in edit mode
  useEffect(() => {
    if (open && isEdit && source) {
      setSelectedDefId(source.sourceDefinitionId);
      setSourceName(source.name);
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
      reset({});
    }
  }, [open, isEdit, reset]);

  // Populate spec defaults when spec loads in create mode
  useEffect(() => {
    if (parsedSpec && !isEdit) {
      reset(extractSpecDefaults(parsedSpec));
    }
  }, [parsedSpec, isEdit, reset]);

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

  // "Authenticate" (create) / "Re-authenticate" (edit): get a consent URL and run the
  // popup. In edit mode this only stashes the redeemed ref — the source is not saved
  // until the footer "Save Changes And Test". The OAuth credentials never reach the
  // browser. Create mode keeps its own two-phase flow inside useSourceSave.
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
      const { authUrl } = await getSourceOAuthConsent(selectedDefId);
      const { ref } = await openOAuthPopup(authUrl);
      setEditOauthRef(ref);
      trackEvent(ANALYTICS_EVENTS.SOURCE_OAUTH_CONNECTED, { source_type: 'Google Sheets' });
      toastSuccess.generic('Authorized with Google — click Save Changes And Test to apply');
    } catch (error) {
      toastError.api(error instanceof Error ? error.message : 'Google sign-in failed');
    } finally {
      setEditOauthConnecting(false);
    }
  }, [selectedDefId, sourceName, isEdit, sourceSave]);

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
    },
    [reset]
  );

  // Edit + a fresh OAuth ref: redeem it into an update. The refresh_token lives only in
  // the server-side ref, so there's no client-side WS check here — the backend's
  // update_source runs Airbyte's connection check itself.
  const handleUpdateOAuthSource = useCallback(async () => {
    setEditSetupLogs([]);
    setEditLoading(true);
    try {
      await createOAuthSource({
        sourceDefId: selectedDefId!,
        name: sourceName,
        config: buildConfig(),
        ref: editOauthRef!,
        ...(sourceId ? { sourceId } : {}),
      });
      trackEvent(ANALYTICS_EVENTS.SOURCE_UPDATED, {
        source_type: 'Google Sheets',
        auth_mode: 'oauth',
      });
      toastSuccess.updated('Source');
      onSuccess();
    } catch (error) {
      toastError.save(error, 'source');
    } finally {
      setEditLoading(false);
    }
  }, [selectedDefId, sourceName, buildConfig, editOauthRef, sourceId, onSuccess]);

  // Single submit: edit mode with a fresh OAuth ref redeems it; otherwise edit tests over
  // WS then updates; create mode delegates to the shared useSourceSave hook (WS test →
  // createSource).
  const onSubmit = useCallback(() => {
    if (!sourceName.trim() || !selectedDefId) return;

    if (isEdit) {
      if (editOauthRef) {
        handleUpdateOAuthSource();
        return;
      }
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
  }, [
    sourceName,
    selectedDefId,
    isEdit,
    editOauthRef,
    handleUpdateOAuthSource,
    buildConfig,
    sourceId,
    editSendOrQueue,
    sourceSave,
  ]);

  // Unified display values — edit mode uses its own local state; create mode reads
  // from the shared hook (setupLogs additionally gated by createLogsDismissed, see above).
  const loading = isEdit ? editLoading : sourceSave.loading;
  const oauthConnecting = isEdit ? editOauthConnecting : sourceSave.oauthConnecting;
  const setupLogs = isEdit ? editSetupLogs : createLogsDismissed ? [] : sourceSave.setupLogs;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className={cn('max-h-[85vh] p-0 gap-0 flex flex-col overflow-hidden', 'sm:max-w-3xl')}
        preventOutsideClose
      >
        <DialogHeader className="flex-shrink-0 border-b px-6 pt-6 pb-4 text-left">
          <DialogTitle>{isEdit ? 'Edit Source' : 'Add Source'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update your source connection settings.' : 'Configure a new data source.'}
          </DialogDescription>
        </DialogHeader>

        {/* Edit mode: hold a single loader until the source AND its config spec
            are ready, so we never flash an empty form then a populated one. */}
        {isEdit && (!source || !selectedDefId || specLoading) ? (
          <div
            data-testid="source-form-loading"
            className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-sm text-muted-foreground"
          >
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            Loading source…
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
            data-testid="source-form"
          >
            {/* Only this middle region scrolls; header + footer stay fixed. */}
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-none px-6 py-5">
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

              {/* Config body — spec-loading, custom/generic form, and
                connection-test logs. Shared with the add-source wizard. */}
              <SourceConfigFields
                parsedSpec={parsedSpec}
                specLoading={specLoading}
                custom={custom}
                control={control}
                setValue={setValue}
                disabled={loading}
                mode={isEdit ? 'edit' : 'create'}
                oauth={
                  isGoogleSheetsCustom
                    ? ({
                        connected: isConnected || !!editOauthRef,
                        busy: oauthConnecting,
                        buttonLabel: isEdit
                          ? editOauthRef
                            ? 'Re-authenticated with Google'
                            : 'Re-authenticate with Google'
                          : 'Sign in with Google to authorize Dalgo',
                        lockWhenConnected: false,
                        onClick: handleConnectGoogle,
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
                Google OAuth button inside the form is the alternative create/re-auth action. */}
              <Button
                type="submit"
                variant="primary"
                className="uppercase"
                disabled={loading || !selectedDefId || !sourceName.trim() || !parsedSpec}
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
