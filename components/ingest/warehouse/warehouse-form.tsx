'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import useWebSocket from 'react-use-websocket';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Combobox, highlightText } from '@/components/ui/combobox';
import type { ComboboxItem } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
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
import { generateWebSocketUrl, isAuthCloseCode } from '@/lib/websocket';
import { DESTINATION_CHECK_WS_PATH } from '@/constants/warehouse';
import { toastSuccess, toastError } from '@/lib/toast';
import type { Warehouse } from '@/types/warehouse';
import type { ParsedSpec } from '@/components/connectors/types';

// Airbyte connection check returns 'succeeded' on success
const AIRBYTE_CHECK_SUCCEEDED = 'succeeded';

interface WarehouseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse?: Warehouse;
  isEditing?: boolean;
  onSuccess: () => void;
}

export function WarehouseForm({
  open,
  onOpenChange,
  warehouse,
  isEditing = false,
  onSuccess,
}: WarehouseFormProps) {
  const { data: definitions, isLoading: defsLoading } = useDestinationDefinitions();

  const [selectedDefId, setSelectedDefId] = useState<string | null>(
    warehouse?.destinationDefinitionId ?? null
  );

  // Build combobox items from warehouse definitions
  const warehouseDefItems = useMemo<ComboboxItem[]>(
    () =>
      definitions.map((def) => ({
        value: def.destinationDefinitionId,
        label: def.name,
        icon: def.icon,
      })),
    [definitions]
  );
  const [warehouseName, setWarehouseName] = useState(warehouse?.name ?? '');
  const [nameError, setNameError] = useState('');
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

  // WebSocket for connection check — always connected when dialog is open
  const wsUrl = useMemo(() => generateWebSocketUrl(DESTINATION_CHECK_WS_PATH), []);

  const pendingPayload = useRef<Record<string, unknown> | null>(null);

  const { sendJsonMessage, lastMessage, readyState } = useWebSocket(loading ? wsUrl : null, {
    share: false,
    shouldReconnect: (closeEvent) => !isAuthCloseCode(closeEvent.code),
    reconnectAttempts: 3,
    reconnectInterval: 2000,
    onClose: (event) => {
      if (isAuthCloseCode(event.code)) {
        toastError.api('Session expired, please refresh the page');
        setLoading(false);
      }
    },
    onError: () => {
      toastError.api('WebSocket connection error');
      setLoading(false);
    },
  });

  // Send pending payload once WebSocket connects
  useEffect(() => {
    if (readyState === 1 && pendingPayload.current) {
      sendJsonMessage(pendingPayload.current);
      pendingPayload.current = null;
    }
  }, [readyState, sendJsonMessage]);

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
        toastSuccess.updated('Warehouse');
      } else {
        const selectedDef = definitions.find((d) => d.destinationDefinitionId === selectedDefId);
        await createWarehouse({
          wtype: (selectedDef?.name ?? '').toLowerCase(),
          name: warehouseName,
          destinationDefId: selectedDefId!,
          airbyteConfig: config,
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

  // Single submit: store payload in ref, set loading → WS connects → sends on open
  const onSubmit = useCallback(() => {
    if (!warehouseName.trim()) {
      setNameError('Name is required');
      return;
    }

    const formValues = getValues();
    const config = parsedSpec ? cleanFormValues(formValues, parsedSpec.fields) : formValues;

    pendingPayload.current = {
      name: warehouseName || 'test',
      config,
      destinationDefId: isEditing ? undefined : selectedDefId,
      destinationId: isEditing ? warehouse?.destinationId : undefined,
    };

    setSetupLogs([]);
    setLoading(true);
  }, [warehouseName, getValues, parsedSpec, isEditing, selectedDefId, warehouse]);

  // Gate on actual data presence, not loading flag (avoids SWR false→true→false blip)
  const showForm = isEditing ? !!parsedSpec : true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Pinned header */}
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle>{isEditing ? 'Edit Warehouse' : 'Set Up Warehouse'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update your warehouse connection settings.'
              : 'Configure your data warehouse destination.'}
          </DialogDescription>
        </DialogHeader>

        {/* Loading state — shown until spec data arrives (edit mode) */}
        {!showForm && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-16">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading configuration...
          </div>
        )}

        {/* Scrollable form body + pinned footer */}
        {showForm && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col min-h-0 flex-1"
            data-testid="warehouse-form"
          >
            {/* Scrollable middle section */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-5 space-y-5">
              {/* Warehouse name + destination type in one block */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                <div>
                  <label htmlFor="warehouse-name" className="text-[15px] font-medium">
                    Name <span className="text-destructive">*</span>
                  </label>
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
                  <label htmlFor="warehouse-type" className="text-[15px] font-medium">
                    Select destination type <span className="text-destructive">*</span>
                  </label>
                  <div className="mt-1.5">
                    <Combobox
                      id="warehouse-type"
                      items={warehouseDefItems}
                      value={selectedDefId ?? ''}
                      onValueChange={(val) => setSelectedDefId(val)}
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
                onClick={() => onOpenChange(false)}
                disabled={loading}
                data-testid="warehouse-cancel-btn"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="ghost"
                className="text-white hover:opacity-90 shadow-xs uppercase"
                style={{ backgroundColor: 'var(--primary)' }}
                disabled={!parsedSpec || loading}
                data-testid="save-warehouse-btn"
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
