'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { ReadyState } from 'react-use-websocket';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSources } from '@/hooks/api/useSources';
import { useConnection, createConnection, updateConnection } from '@/hooks/api/useConnections';
import { useBackendWebSocket } from '@/hooks/useBackendWebSocket';
import { SyncMode, DestinationSyncMode, FormMode } from '@/constants/connections';
import { toastSuccess, toastError } from '@/lib/toast';
import type { SyncCatalog, SchemaDiscoveryResponse } from '@/types/connections';
import { parseCatalogStream } from './utils';
import { useStreamConfig } from './hooks/useStreamConfig';
import { StreamConfigTable } from './stream-config-table';

const SCHEMA_DISCOVERY_WS_PATH = 'airbyte/connection/schema_catalog';

interface ConnectionFormProps {
  mode: FormMode;
  connectionId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConnectionForm({ mode, connectionId, onClose, onSuccess }: ConnectionFormProps) {
  const isCreate = mode === FormMode.CREATE;
  const isView = mode === FormMode.VIEW;
  const disabled = isView;

  const { data: sources } = useSources();
  const { data: connection } = useConnection(!isCreate ? (connectionId ?? null) : null);

  const [name, setName] = useState('');
  const [destinationSchema, setDestinationSchema] = useState('staging');
  const [catalogId, setCatalogId] = useState<string>('');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [normalize, setNormalize] = useState(false);
  const [discoveredCatalog, setDiscoveredCatalog] = useState<SyncCatalog | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    streams,
    setStreams,
    streamSearch,
    setStreamSearch,
    incrementalAllStreams,
    expandedStreams,
    toggleStream,
    toggleAllStreams,
    updateStreamSyncMode,
    updateStreamDestMode,
    updateStreamCursorField,
    updateStreamPrimaryKey,
    toggleColumn,
    toggleStreamExpand,
    handleIncrementalAllToggle,
    filteredStreams,
    allSelected,
    hasSelectedStreams,
  } = useStreamConfig();

  // Load existing connection data
  useEffect(() => {
    if (connection && !isCreate) {
      setName(connection.name);
      setNormalize(connection.normalize);
      setCatalogId(connection.catalogId || '');
      if (connection.destinationSchema) {
        setDestinationSchema(connection.destinationSchema);
      }
      // Parse existing streams from sync catalog
      setStreams(connection.syncCatalog.streams.map((s) => parseCatalogStream(s)));
    }
  }, [connection, isCreate]);

  // Handle schema discovery WebSocket response
  const handleDiscoveryMessage = useCallback(
    (data: unknown) => {
      try {
        const response = data as SchemaDiscoveryResponse;
        if (response.status === 'success' && response.data?.result?.catalog) {
          const catalog = response.data.result.catalog;
          // Discovery defaults: nothing selected, full refresh + overwrite
          const discoveryDefaults = {
            selected: false,
            syncMode: SyncMode.FULL_REFRESH,
            destinationSyncMode: DestinationSyncMode.OVERWRITE,
          };
          setStreams(catalog.streams.map((s) => parseCatalogStream(s, discoveryDefaults)));
          setDiscoveredCatalog(catalog);
          if (response.data.result.catalogId) {
            setCatalogId(response.data.result.catalogId);
          }
        } else {
          toastError.api(response.message || 'Schema discovery failed');
        }
      } finally {
        setIsDiscovering(false);
      }
    },
    [setStreams]
  );

  // WebSocket for schema discovery — stays open in create mode
  const { sendJsonMessage, readyState } = useBackendWebSocket(SCHEMA_DISCOVERY_WS_PATH, {
    enabled: isCreate,
    onLoadingChange: setIsDiscovering,
    onMessage: handleDiscoveryMessage,
  });

  // Send discovery request when source changes or socket opens
  useEffect(() => {
    if (isCreate && selectedSourceId && readyState === ReadyState.OPEN) {
      setIsDiscovering(true);
      sendJsonMessage({ sourceId: selectedSourceId });
    }
  }, [selectedSourceId, readyState, isCreate, sendJsonMessage]);

  const handleSourceChange = useCallback((sourceId: string) => {
    setSelectedSourceId(sourceId);
    setStreams([]);
    setDiscoveredCatalog(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;
    if (!hasSelectedStreams) {
      toastError.api('Please select at least one stream');
      return;
    }

    setIsSaving(true);
    try {
      // Backend expects columns as [{name, data_type, selected}] and
      // converts to Airbyte's fieldSelectionEnabled format internally
      const streamPayload = streams.map((s) => ({
        name: s.name,
        supportsIncremental: s.supportsIncremental,
        selected: s.selected,
        syncMode: s.syncMode,
        destinationSyncMode: s.destinationSyncMode,
        cursorField: s.cursorField,
        primaryKey: s.primaryKey,
        columns: s.columns.map((c) => ({
          name: c.name,
          data_type: c.data_type,
          selected: c.selected,
        })),
      }));

      if (isCreate) {
        await createConnection({
          name,
          sourceId: selectedSourceId!,
          destinationSchema: destinationSchema || undefined,
          streams: streamPayload,
          normalize,
          syncCatalog: discoveredCatalog!,
          catalogId: catalogId || undefined,
        });
        toastSuccess.created('Connection');
      } else if (connectionId) {
        await updateConnection(connectionId, {
          name,
          sourceId: connection?.source?.sourceId,
          streams: streamPayload,
          normalize,
          destinationSchema: destinationSchema || undefined,
          syncCatalog: connection?.syncCatalog,
          catalogId: catalogId || undefined,
        });
        toastSuccess.updated('Connection');
      }
      onSuccess();
    } catch (error) {
      toastError.save(error, 'connection');
    } finally {
      setIsSaving(false);
    }
  }, [
    name,
    hasSelectedStreams,
    streams,
    isCreate,
    selectedSourceId,
    destinationSchema,
    normalize,
    connectionId,
    catalogId,
    discoveredCatalog,
    connection,
    onSuccess,
  ]);

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[70vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle>
            {isCreate ? 'New Connection' : isView ? 'View Connection' : 'Edit Connection'}
          </DialogTitle>
          <DialogDescription>
            {isCreate
              ? 'Set up a new data connection.'
              : isView
                ? 'Connection details (read-only while syncing).'
                : 'Update your connection settings.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-5 space-y-6">
          {/* Connection name */}
          <div>
            <label htmlFor="conn-name" className="text-[15px] font-medium">
              Connection Name <span className="text-destructive">*</span>
            </label>
            <Input
              id="conn-name"
              data-testid="connection-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Connection"
              disabled={disabled || isSaving}
              className="mt-1.5"
            />
          </div>

          {/* Destination schema */}
          <div>
            <label htmlFor="dest-schema" className="text-[15px] font-medium">
              Destination Schema
            </label>
            <Input
              id="dest-schema"
              data-testid="destination-schema-input"
              value={destinationSchema}
              onChange={(e) => setDestinationSchema(e.target.value)}
              placeholder="e.g., public"
              disabled={disabled || isSaving}
              className="mt-1.5"
            />
          </div>

          {/* Source selection (create) or read-only display (edit/view) */}
          {isCreate ? (
            <div>
              <label htmlFor="source-select" className="text-[15px] font-medium">
                Source <span className="text-destructive">*</span>
              </label>
              <Select
                value={selectedSourceId ?? ''}
                onValueChange={handleSourceChange}
                disabled={isSaving}
              >
                <SelectTrigger id="source-select" className="mt-1.5" data-testid="source-select">
                  <SelectValue placeholder="Select a source" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((source) => (
                    <SelectItem key={source.sourceId} value={source.sourceId}>
                      <div className="flex items-center gap-2">
                        {source.icon && <img src={source.icon} alt="" className="h-4 w-4" />}
                        {source.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : connection ? (
            <div>
              <label className="text-[15px] font-medium">Source</label>
              <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/50 text-sm">
                {connection.source?.icon && (
                  <img src={connection.source.icon} alt="" className="h-4 w-4" />
                )}
                <span data-testid="connection-source-name">
                  {connection.source?.name || connection.source?.sourceName || '—'}
                </span>
                <span className="text-muted-foreground">({connection.source?.sourceName})</span>
              </div>
            </div>
          ) : null}

          {/* Normalize toggle */}
          <div className="flex items-center justify-between">
            <label className="text-[15px] font-medium">Normalize data after sync</label>
            <Switch
              checked={normalize}
              onCheckedChange={setNormalize}
              disabled={disabled || isSaving}
              data-testid="normalize-toggle"
            />
          </div>

          {/* Schema discovery loading */}
          {isDiscovering && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Discovering schema...
            </div>
          )}

          {/* Stream configuration table */}
          {streams.length > 0 && !isDiscovering && (
            <StreamConfigTable
              streams={streams}
              filteredStreams={filteredStreams}
              allSelected={allSelected}
              incrementalAllStreams={incrementalAllStreams}
              expandedStreams={expandedStreams}
              streamSearch={streamSearch}
              disabled={disabled}
              isSaving={isSaving}
              onStreamSearchChange={setStreamSearch}
              onToggleAllStreams={toggleAllStreams}
              onIncrementalAllToggle={handleIncrementalAllToggle}
              onToggleStream={toggleStream}
              onUpdateStreamSyncMode={updateStreamSyncMode}
              onUpdateStreamDestMode={updateStreamDestMode}
              onUpdateStreamCursorField={updateStreamCursorField}
              onUpdateStreamPrimaryKey={updateStreamPrimaryKey}
              onToggleStreamExpand={toggleStreamExpand}
              onToggleColumn={toggleColumn}
            />
          )}
        </div>

        {!isView && (
          <DialogFooter className="flex-shrink-0 gap-2 border-t px-6 py-4">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              variant="ghost"
              className="text-white hover:opacity-90 shadow-xs uppercase"
              style={{ backgroundColor: 'var(--primary)' }}
              onClick={handleSave}
              disabled={
                isSaving || !name.trim() || !hasSelectedStreams || (isCreate && !selectedSourceId)
              }
              data-testid="save-connection-btn"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {isCreate ? 'Create' : 'Update'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
