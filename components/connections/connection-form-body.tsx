'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { ReadyState } from 'react-use-websocket';
import { Loader2 } from 'lucide-react';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Combobox, highlightText } from '@/components/ui/combobox';
import type { ComboboxItem } from '@/components/ui/combobox';
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

export interface ConnectionFormBodyProps {
  mode: FormMode;
  connectionId?: string;
  // When creating a connection for a source that was just set up (e.g. the
  // add-source wizard's step 3), the source is fixed: it is preselected and
  // shown as a read-only display instead of the picker.
  presetSourceId?: string;
  // When creating a connection from within a specific source's row (e.g. the
  // Ingest source row's "Add connection"), the source is preselected but the
  // picker stays visible, just disabled.
  lockedSourceId?: string;
  onSuccess: () => void;
  onCancel: () => void;
  // Optional custom footer (e.g. the wizard's own Back/Done buttons). Falls
  // back to the default Cancel/Create-Update footer when not provided.
  footerSlot?: React.ReactNode;
}

// The Dialog-free core of the connection create/edit/view form. Rendered
// inside a <Dialog><DialogContent> by ConnectionForm for the standalone
// dialog, or directly by the add-source wizard's step 3 (no Dialog wrapper —
// so this component must not depend on Radix Dialog context).
export function ConnectionFormBody({
  mode,
  connectionId,
  presetSourceId,
  lockedSourceId,
  onSuccess,
  onCancel,
  footerSlot,
}: ConnectionFormBodyProps) {
  const isCreate = mode === FormMode.CREATE;
  const isView = mode === FormMode.VIEW;
  const disabled = isView;

  const { data: sources } = useSources();
  const { data: connection } = useConnection(!isCreate ? (connectionId ?? null) : null);

  const sourceItems = React.useMemo<ComboboxItem[]>(
    () =>
      sources.map((source) => ({
        value: source.sourceId,
        label: source.name,
        icon: source.icon,
      })),
    [sources]
  );

  // Read-only source display data: the preset source (wizard, create mode)
  // or the connection's existing source (edit/view mode).
  const presetSource = React.useMemo(
    () => (presetSourceId ? sources.find((s) => s.sourceId === presetSourceId) : undefined),
    [sources, presetSourceId]
  );
  const readOnlySource = isCreate ? presetSource : connection?.source;

  const [name, setName] = useState('');
  const [destinationSchema, setDestinationSchema] = useState('staging');
  const [catalogId, setCatalogId] = useState<string>('');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(
    presetSourceId ?? lockedSourceId ?? null
  );
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

  // Send discovery request when source changes or socket opens — this also
  // covers the presetSourceId case (selectedSourceId is initialised from it).
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
        trackEvent(ANALYTICS_EVENTS.CONNECTION_CREATED, {
          source_type: sources?.find((s) => s.sourceId === selectedSourceId)?.sourceName,
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
        trackEvent(ANALYTICS_EVENTS.CONNECTION_UPDATED, {
          source_type: connection?.source?.sourceName,
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
    <>
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

        {/* Source selection (create, no preset) or read-only display (preset / edit / view) */}
        {isCreate && !presetSourceId ? (
          <div>
            <label htmlFor="source-select-input" className="text-[15px] font-medium">
              Source <span className="text-destructive">*</span>
            </label>
            <div className="mt-1.5">
              <Combobox
                id="source-select"
                items={sourceItems}
                value={selectedSourceId ?? ''}
                onValueChange={handleSourceChange}
                placeholder="Select a source"
                searchPlaceholder="Search sources..."
                emptyMessage="No sources found."
                disabled={isSaving || !!lockedSourceId}
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
        ) : readOnlySource ? (
          <div>
            <label className="text-[15px] font-medium">Source</label>
            <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/50 text-sm">
              <img
                src={readOnlySource.icon || '/icons/connection.svg'}
                alt=""
                className="h-4 w-4"
                onError={(e) => {
                  e.currentTarget.src = '/icons/connection.svg';
                }}
              />
              <span data-testid="connection-source-name">
                {readOnlySource.name || readOnlySource.sourceName || '—'}
              </span>
              <span className="text-muted-foreground">({readOnlySource.sourceName})</span>
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

      {!isView &&
        (footerSlot ?? (
          <DialogFooter className="flex-shrink-0 gap-2 border-t px-6 py-4">
            <Button variant="outline" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="uppercase"
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
        ))}
    </>
  );
}
