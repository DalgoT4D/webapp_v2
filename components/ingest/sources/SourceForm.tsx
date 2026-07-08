'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2, Check } from 'lucide-react';
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
import { ConnectorConfigForm, renderField } from '@/components/connectors/ConnectorConfigForm';
import { parseAirbyteSpec } from '@/components/connectors/spec-parser';
import { cleanFormValues, extractSpecDefaults } from '@/components/connectors/utils';
import type { FieldNode, ParsedSpec } from '@/components/connectors/types';
import {
  useSourceDefinitions,
  useSourceSpec,
  useSource,
  createSource,
  updateSource,
  getSourceOAuthConsent,
  completeSourceOAuth,
  GOOGLE_SHEETS_SOURCE_DEFINITION_ID,
} from '@/hooks/api/useSources';
import { openOAuthPopup } from '@/components/connectors/oauth-popup';
import { useBackendWebSocket } from '@/hooks/useBackendWebSocket';
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

  const [loading, setLoading] = useState(false);
  const [setupLogs, setSetupLogs] = useState<string[]>([]);
  const [sourceName, setSourceName] = useState('');

  // Google OAuth: config fragment returned by Airbyte after "Sign in with Google".
  // When present, it is merged over the form config at submit time.
  const [oauthCredentials, setOauthCredentials] = useState<Record<string, unknown> | null>(null);
  const [oauthConnecting, setOauthConnecting] = useState(false);
  // For Google Sheets: 'google' shows only the Sign-in button; 'manual' reveals the
  // credential dropdown (client id/secret/refresh token or service account).
  const [authMode, setAuthMode] = useState<'google' | 'manual'>('google');

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
  // treat as connected if the stored source is OAuth OR the user re-authed this session
  const isConnected = alreadyOAuthConnected || !!oauthCredentials;

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
      // default the auth mode from the stored credentials: service account -> manual,
      // OAuth (Client) or anything else -> google (Sign in with Google)
      const creds = source.connectionConfiguration?.credentials as
        | { auth_type?: string }
        | undefined;
      setAuthMode(creds?.auth_type === 'Service' ? 'manual' : 'google');
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
      setSetupLogs([]);
      setSourceName('');
      setOauthCredentials(null);
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

  // WebSocket for connection check — connects when loading (submit triggered)
  const { sendOrQueue, lastMessage } = useBackendWebSocket(SOURCE_CHECK_WS_PATH, {
    enabled: loading,
    onLoadingChange: setLoading,
  });

  // Build the config to send: cleaned form values, with any Google OAuth
  // credentials merged over the top (OAuth wins over the manual fields).
  const buildConfig = useCallback(() => {
    const formValues = getValues();
    const config = parsedSpec ? cleanFormValues(formValues, parsedSpec.fields) : formValues;
    const useGoogleOAuth = isGoogleSheets && authMode === 'google' && oauthCredentials;
    return useGoogleOAuth ? { ...config, ...oauthCredentials } : config;
  }, [getValues, parsedSpec, oauthCredentials, isGoogleSheets, authMode]);

  // "Connect with Google": get a consent URL, run the popup, let Airbyte store
  // the token, and keep the returned config fragment for submit.
  const handleConnectGoogle = useCallback(async () => {
    if (!selectedDefId) return;
    setOauthConnecting(true);
    try {
      trackEvent(ANALYTICS_EVENTS.SOURCE_OAUTH_STARTED, { source_type: 'Google Sheets' });
      const { consentUrl, state } = await getSourceOAuthConsent(selectedDefId);
      const { code, state: googleState } = await openOAuthPopup(consentUrl);
      const fragment = await completeSourceOAuth({
        sourceDefId: selectedDefId,
        state,
        queryParams: { code, state: googleState },
      });
      setOauthCredentials(fragment);
      trackEvent(ANALYTICS_EVENTS.SOURCE_OAUTH_CONNECTED, { source_type: 'Google Sheets' });
      toastSuccess.generic('Connected with Google');
    } catch (error) {
      toastError.api(error instanceof Error ? error.message : 'Google sign-in failed');
    } finally {
      setOauthConnecting(false);
    }
  }, [selectedDefId]);

  // Handle WebSocket response — v1 pattern: test succeeded → auto-save
  const handleSaveSource = useCallback(async () => {
    const config = buildConfig();

    try {
      if (isEdit && sourceId) {
        await updateSource(sourceId, {
          name: sourceName,
          sourceDefId: selectedDefId!,
          config,
          sourceId,
        });
        trackEvent(ANALYTICS_EVENTS.SOURCE_UPDATED);
        toastSuccess.updated('Source');
      } else {
        await createSource({
          name: sourceName,
          sourceDefId: selectedDefId!,
          config,
        });
        trackEvent(ANALYTICS_EVENTS.SOURCE_CREATED, {
          source_type: definitions?.find((d) => d.sourceDefinitionId === selectedDefId)?.name,
        });
        toastSuccess.created('Source');
      }
      onSuccess();
    } catch (error) {
      toastError.save(error, 'source');
    } finally {
      setLoading(false);
    }
  }, [buildConfig, isEdit, sourceId, sourceName, selectedDefId, definitions, onSuccess]);

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

  const handleSourceDefChange = useCallback(
    (defId: string) => {
      setSelectedDefId(defId);
      reset({});
      setSetupLogs([]);
      setOauthCredentials(null);
      setAuthMode('google');
    },
    [reset]
  );

  // Single submit: store payload in ref, set loading → WS connects → sends on open
  const onSubmit = useCallback(() => {
    if (!sourceName.trim() || !selectedDefId) return;

    const config = buildConfig();

    setSetupLogs([]);
    setLoading(true);
    sendOrQueue({
      name: sourceName,
      sourceDefId: selectedDefId,
      config,
      ...(sourceId ? { sourceId } : {}),
    });
  }, [sourceName, selectedDefId, buildConfig, sourceId, sendOrQueue]);

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

          {/* Authentication — Google Sheets gets a Google-vs-manual choice */}
          {isGoogleSheets && parsedSpec && !specLoading && (
            <div
              className="rounded-md border border-border p-4 space-y-3 bg-muted/50"
              data-testid="gsheets-oauth"
            >
              <div className="text-[15px] font-medium">Authentication</div>

              <div className="flex gap-2" data-testid="gsheets-auth-mode">
                <Button
                  type="button"
                  variant={authMode === 'google' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setAuthMode('google')}
                  disabled={loading}
                  data-testid="gsheets-auth-google"
                >
                  Sign in with Google
                </Button>
                <Button
                  type="button"
                  variant={authMode === 'manual' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setAuthMode('manual')}
                  disabled={loading}
                  data-testid="gsheets-auth-manual"
                >
                  Set up manually
                </Button>
              </div>

              {authMode === 'google' ? (
                <div className="space-y-2">
                  {isConnected && (
                    <div
                      className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400"
                      data-testid="gsheets-oauth-connected"
                    >
                      <Check className="h-4 w-4" />
                      Connected with Google
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleConnectGoogle}
                    disabled={loading || oauthConnecting}
                    data-testid="gsheets-oauth-connect-btn"
                  >
                    {oauthConnecting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    {isConnected ? 'Re-authenticate' : 'Connect with Google'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {isConnected
                      ? 'Already connected. Re-authenticate only if the connection stopped working.'
                      : 'Sign in with Google to connect your spreadsheet — no credentials needed.'}
                  </p>
                </div>
              ) : (
                authField && (
                  <div className="space-y-4">
                    {renderField(authField, control, setValue, loading)}
                  </div>
                )
              )}
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
