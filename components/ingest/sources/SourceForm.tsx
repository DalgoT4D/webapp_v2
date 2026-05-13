'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { parseAirbyteSpec } from '@/components/connectors/spec-parser';
import { cleanFormValues, extractSpecDefaults } from '@/components/connectors/utils';
import type { FieldNode, ParsedSpec } from '@/components/connectors/types';
import {
  useSourceDefinitions,
  useSourceSpec,
  useSource,
  createSource,
  updateSource,
} from '@/hooks/api/useSources';
import { useBackendWebSocket } from '@/hooks/useBackendWebSocket';
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

  // React Hook Form
  const { control, handleSubmit, setValue, getValues, reset } = useForm({
    defaultValues: {} as Record<string, unknown>,
  });

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
      setSetupLogs([]);
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

  // WebSocket for connection check — connects when loading (submit triggered)
  const { sendOrQueue, lastMessage } = useBackendWebSocket(SOURCE_CHECK_WS_PATH, {
    enabled: loading,
    onLoadingChange: setLoading,
  });

  // Handle WebSocket response — v1 pattern: test succeeded → auto-save
  const handleSaveSource = useCallback(async () => {
    const formValues = getValues();
    const config = parsedSpec ? cleanFormValues(formValues, parsedSpec.fields) : formValues;

    try {
      if (isEdit && sourceId) {
        await updateSource(sourceId, {
          name: sourceName,
          sourceDefId: selectedDefId!,
          config,
          sourceId,
        });
        toastSuccess.updated('Source');
      } else {
        await createSource({
          name: sourceName,
          sourceDefId: selectedDefId!,
          config,
        });
        toastSuccess.created('Source');
      }
      onSuccess();
    } catch (error) {
      toastError.save(error, 'source');
    } finally {
      setLoading(false);
    }
  }, [getValues, parsedSpec, isEdit, sourceId, sourceName, selectedDefId, onSuccess]);

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
    },
    [reset]
  );

  // Single submit: store payload in ref, set loading → WS connects → sends on open
  const onSubmit = useCallback(() => {
    if (!sourceName.trim() || !selectedDefId) return;

    const formValues = getValues();
    const config = parsedSpec ? cleanFormValues(formValues, parsedSpec.fields) : formValues;

    setSetupLogs([]);
    setLoading(true);
    sendOrQueue({
      name: sourceName,
      sourceDefId: selectedDefId,
      config,
      ...(sourceId ? { sourceId } : {}),
    });
  }, [sourceName, selectedDefId, getValues, parsedSpec, sourceId]);

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

          {/* Dynamic Config Form */}
          {parsedSpec && !specLoading && (
            <ConnectorConfigForm
              parsedSpec={parsedSpec}
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
              disabled={loading || !selectedDefId || !sourceName.trim() || !parsedSpec}
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
