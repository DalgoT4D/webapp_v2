'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { DialogFooter } from '@/components/ui/dialog';
import { Combobox, highlightText, type ComboboxItem } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { parseAirbyteSpec } from '@/components/connectors/spec-parser';
import { ConnectorConfigForm } from '@/components/connectors/ConnectorConfigForm';
import { cleanFormValues, extractSpecDefaults } from '@/components/connectors/utils';
import {
  useDestinationDefinitions,
  useDestinationSpec,
  useDestinationEditSpec,
  createWarehouse,
  updateWarehouse,
} from '@/hooks/api/useWarehouse';
import { useBackendWebSocket } from '@/hooks/useBackendWebSocket';
import { DESTINATION_CHECK_WS_PATH } from '@/constants/warehouse';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { toastSuccess, toastError } from '@/lib/toast';
import type { Warehouse } from '@/types/warehouse';
import type { ParsedSpec } from '@/components/connectors/types';

// Airbyte connection check returns 'succeeded' on success
const AIRBYTE_CHECK_SUCCEEDED = 'succeeded';

interface WarehouseFormBodyProps {
  warehouse?: Warehouse;
  isEditing?: boolean;
  /** Fired after the warehouse is created/updated. The host decides what next
   *  (close the dialog, or advance the add-source wizard to its next step). */
  onSuccess: () => void;
  /** Fired by the Cancel button. */
  onCancel: () => void;
  /** Label for the primary submit button. Defaults to "Save Changes And Test". */
  submitLabel?: string;
}

/**
 * The warehouse configure form: name + destination-type picker + spec-driven
 * connection fields, a WS connection check on submit, then create/update. Renders
 * as a flex-column form (scrollable body + pinned footer) with NO Dialog wrapper —
 * the host owns the outer container and header. Shared by the standalone
 * WarehouseForm dialog (Settings → Warehouse) and the add-source wizard's step 1.
 */
export function WarehouseFormBody({
  warehouse,
  isEditing = false,
  onSuccess,
  onCancel,
  submitLabel = 'Save Changes And Test',
}: WarehouseFormBodyProps) {
  const { data: definitions, isLoading: defsLoading } = useDestinationDefinitions();

  const [selectedDefId, setSelectedDefId] = useState<string | null>(
    warehouse?.destinationDefinitionId ?? null
  );

  // Build combobox items from warehouse definitions (Snowflake excluded)
  const warehouseDefItems = useMemo<ComboboxItem[]>(
    () =>
      definitions
        .filter((def) => !def.name.toLowerCase().includes('snowflake'))
        .map((def) => ({
          value: def.destinationDefinitionId,
          label: def.name,
          icon: def.icon,
        })),
    [definitions]
  );
  const [warehouseName, setWarehouseName] = useState(warehouse?.name ?? '');
  // Inline required-field errors, surfaced on submit (same pattern as the
  // add-source wizard, the source dialog and the connection form).
  const [nameError, setNameError] = useState('');
  const [typeError, setTypeError] = useState('');
  const [loading, setLoading] = useState(false);
  const [setupLogs, setSetupLogs] = useState<string[]>([]);

  // Fetch spec based on mode
  const { data: createSpec, isLoading: createSpecLoading } = useDestinationSpec(
    !isEditing ? selectedDefId : null
  );
  const { data: editSpec, isLoading: editSpecLoading } = useDestinationEditSpec(
    isEditing ? (warehouse?.destinationId ?? null) : null
  );

  const spec = isEditing ? editSpec : createSpec;
  const specLoading = isEditing ? editSpecLoading : createSpecLoading;

  const parsedSpec = useMemo<ParsedSpec | null>(() => {
    if (!spec) return null;
    return parseAirbyteSpec(spec);
  }, [spec]);

  // React Hook Form
  const { control, handleSubmit, setValue, getValues, reset } = useForm({
    defaultValues: isEditing ? (warehouse?.connectionConfiguration ?? {}) : {},
  });

  // Reset form with spec defaults when spec changes (new warehouse type selected)
  useEffect(() => {
    if (!isEditing && parsedSpec) {
      reset(extractSpecDefaults(parsedSpec));
    }
  }, [parsedSpec, isEditing, reset]);

  // WebSocket for connection check — connects when loading (submit triggered)
  const { sendOrQueue, lastMessage } = useBackendWebSocket(DESTINATION_CHECK_WS_PATH, {
    enabled: loading,
    onLoadingChange: setLoading,
  });

  // Save to backend after successful connection test
  const handleSaveWarehouse = useCallback(async () => {
    const formValues = getValues();
    const config = parsedSpec ? cleanFormValues(formValues, parsedSpec.fields) : formValues;

    try {
      if (isEditing && warehouse) {
        await updateWarehouse(warehouse.destinationId, {
          name: warehouseName,
          config,
          destinationDefId: warehouse.destinationDefinitionId,
        });
        trackEvent(ANALYTICS_EVENTS.WAREHOUSE_UPDATED);
        toastSuccess.updated('Warehouse');
      } else {
        const selectedDef = definitions.find((d) => d.destinationDefinitionId === selectedDefId);
        await createWarehouse({
          wtype: (selectedDef?.name ?? '').toLowerCase(),
          name: warehouseName,
          destinationDefId: selectedDefId!,
          airbyteConfig: config,
        });
        trackEvent(ANALYTICS_EVENTS.WAREHOUSE_CREATED, {
          warehouse_type: (selectedDef?.name ?? '').toLowerCase(),
        });
        toastSuccess.created('Warehouse');
      }
      onSuccess();
    } catch (error) {
      toastError.save(error, 'warehouse');
    } finally {
      setLoading(false);
    }
  }, [
    getValues,
    parsedSpec,
    isEditing,
    warehouse,
    warehouseName,
    definitions,
    selectedDefId,
    onSuccess,
  ]);

  // Process WebSocket responses — test succeeded → auto-save
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
        handleSaveWarehouse();
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
  }, [lastMessage, handleSaveWarehouse]);

  // Required-field check for the two host-owned fields (the spec-driven fields
  // self-report via react-hook-form). Sets the inline errors and returns validity.
  // The destination type is fixed in edit mode, so it is only required on create.
  const validateHostFields = useCallback(() => {
    const nameOk = !!warehouseName.trim();
    const typeOk = isEditing || !!selectedDefId;
    setNameError(nameOk ? '' : 'Name is required');
    setTypeError(typeOk ? '' : 'Destination type is required');
    return nameOk && typeOk;
  }, [warehouseName, isEditing, selectedDefId]);

  // Single submit: store payload in ref, set loading → WS connects → sends on open
  const onSubmit = useCallback(() => {
    if (!validateHostFields()) return;
    // A type is picked but its spec is still in flight — nothing to build a config
    // from yet, so swallow the submit rather than sending a partial payload.
    if (!parsedSpec) return;

    const formValues = getValues();
    const config = parsedSpec ? cleanFormValues(formValues, parsedSpec.fields) : formValues;

    setSetupLogs([]);
    setLoading(true);
    sendOrQueue({
      name: warehouseName || 'test',
      config,
      destinationDefId: isEditing ? undefined : selectedDefId,
      destinationId: isEditing ? warehouse?.destinationId : undefined,
    });
  }, [
    validateHostFields,
    warehouseName,
    getValues,
    parsedSpec,
    isEditing,
    selectedDefId,
    warehouse,
    sendOrQueue,
  ]);

  // react-hook-form blocks onSubmit when a spec-driven field fails its own rules —
  // those fields render their own inline errors, but the host-owned name/type
  // fields would stay silent, so validate them on the invalid path too.
  const onInvalid = useCallback(() => {
    validateHostFields();
  }, [validateHostFields]);

  // Gate on actual data presence, not loading flag (avoids SWR false→true→false blip)
  const showForm = isEditing ? !!parsedSpec : true;

  // Loading state — shown until spec data arrives (edit mode)
  if (!showForm) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading configuration...
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit, onInvalid)}
      className="flex flex-col min-h-0 flex-1"
      data-testid="warehouse-form"
    >
      {/* Scrollable middle section */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-5 space-y-5">
        {/* Warehouse name + destination type in one block */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <div>
            <Label htmlFor="warehouse-name" className="text-base">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="warehouse-name"
              data-testid="warehouse-name-input"
              value={warehouseName}
              onChange={(e) => {
                setWarehouseName(e.target.value);
                if (nameError) setNameError('');
              }}
              placeholder="My Warehouse"
              className={`mt-1.5 bg-background ${nameError ? 'border-destructive' : ''}`}
            />
            {nameError && <p className="text-xs text-destructive mt-1">{nameError}</p>}
          </div>

          <div>
            {/* Combobox renders its input as `${id}-input`, so the label must
                target that, not the wrapper id. */}
            <Label htmlFor="warehouse-type-input" className="text-base">
              Select destination type <span className="text-destructive">*</span>
            </Label>
            <div className="mt-1.5">
              <Combobox
                id="warehouse-type"
                items={warehouseDefItems}
                value={selectedDefId ?? ''}
                onValueChange={(val) => {
                  setSelectedDefId(val);
                  if (typeError) setTypeError('');
                }}
                placeholder="Select warehouse type"
                searchPlaceholder="Search warehouses..."
                emptyMessage="No warehouses found."
                disabled={isEditing || loading}
                loading={defsLoading}
                renderItem={(item, _isSelected, searchQuery) => (
                  <div className="flex items-center gap-2">
                    {item.icon && (
                      <img
                        src={item.icon as string}
                        alt=""
                        className="h-4 w-4 flex-shrink-0"
                        loading="lazy"
                      />
                    )}
                    <span className="text-sm">{highlightText(item.label, searchQuery)}</span>
                  </div>
                )}
              />
            </div>
            {typeError && (
              <p className="text-xs text-destructive mt-1" data-testid="warehouse-type-error">
                {typeError}
              </p>
            )}
          </div>
        </div>

        {/* Dynamic spec form */}
        {specLoading && !isEditing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading configuration...
          </div>
        )}

        {parsedSpec && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <h3 className="text-base font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Connection Details
            </h3>
            <ConnectorConfigForm
              parsedSpec={parsedSpec}
              control={control}
              setValue={setValue}
              disabled={loading}
            />
          </div>
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
      </div>

      {/* Pinned footer — single "Save changes and test" button like v1 */}
      <DialogFooter className="flex-shrink-0 gap-2 border-t px-6 py-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          data-testid="warehouse-cancel-btn"
        >
          Cancel
        </Button>
        {/* Stays clickable while fields are empty so pressing it surfaces the inline
            required-field errors (onSubmit validates and blocks). Disabled only for states
            where a click genuinely can't do anything: a request in flight, or a chosen
            destination type whose spec is still loading. */}
        <Button
          type="submit"
          variant="primary"
          className="uppercase"
          disabled={loading || specLoading}
          data-testid="save-warehouse-btn"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
