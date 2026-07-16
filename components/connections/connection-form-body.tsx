'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { ReadyState } from 'react-use-websocket';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Combobox, highlightText } from '@/components/ui/combobox';
import type { ComboboxItem } from '@/components/ui/combobox';
import { useSources } from '@/hooks/api/useSources';
import {
  useConnection,
  createConnection,
  updateConnection,
  triggerSync,
} from '@/hooks/api/useConnections';
import { useBackendWebSocket } from '@/hooks/useBackendWebSocket';
import { SyncMode, DestinationSyncMode, FormMode } from '@/constants/connections';
import { toastSuccess, toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { SyncCatalog, SchemaDiscoveryResponse } from '@/types/connections';
import { parseCatalogStream } from './utils';
import { useStreamConfig } from './hooks/useStreamConfig';
import { StreamConfigTable } from './stream-config-table';
import { getCustomSource } from '@/components/ingest/sources/custom/registry';
import { ConnectionHelpPanel } from './connection-help-panel';
import { getConnectionHelp, allowsDedup, type ConnectionConceptId } from './constants';

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
  // Fired when the form gains/loses its second (help) column — i.e. once streams
  // are discovered. Lets a host (the wizard) widen its modal only after the
  // streams table needs the room.
  onExpandedChange?: (expanded: boolean) => void;
  // Fired (create/wizard flow) once the source's custom connection view resolves,
  // so the host can put the "<source> created successfully — select your
  // sheets/forms" copy in the modal header instead of the body. Null for
  // generic sources (no custom noun).
  onHeaderInfoChange?: (info: { sourceName: string; streamNoun: string } | null) => void;
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
  onExpandedChange,
  onHeaderInfoChange,
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

  // Declared early so the source-resolution memos below can read it (create-mode
  // combobox selection drives the friendly custom view, same as a preset source).
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(
    presetSourceId ?? lockedSourceId ?? null
  );

  // Read-only source display data: the preset source (wizard, create mode)
  // or the connection's existing source (edit/view mode).
  const presetSource = React.useMemo(
    () => (presetSourceId ? sources.find((s) => s.sourceId === presetSourceId) : undefined),
    [sources, presetSourceId]
  );
  // In create mode the active source may come from a preset (wizard) OR from the
  // source combobox (add-connection-from-list). Resolve either so the friendly
  // custom view (relabels streams, hides incremental/cursor/PK) activates in both.
  const createSelectedSource = React.useMemo(
    () =>
      isCreate && selectedSourceId
        ? sources.find((s) => s.sourceId === selectedSourceId)
        : undefined,
    [isCreate, selectedSourceId, sources]
  );
  const readOnlySource = isCreate ? (presetSource ?? createSelectedSource) : connection?.source;

  // The Airbyte source-definition name (e.g. "Google Sheets"). In edit/view the
  // connection's own source can come back with an empty sourceName, so fall back
  // to the sources list (keyed by sourceId), which always carries it — this is
  // what makes the friendly custom view render identically in edit and create.
  // Edit/view: the single-connection GET returns a sparse source ({ id, name }
  // only — no sourceName/sourceId/icon), so match it against the full sources
  // list by id first, then by the source's display name. Supplies both the
  // definition name (for custom-view detection) and the real icon.
  const sourceListMatch = React.useMemo(() => {
    if (!readOnlySource) return null;
    return (
      (readOnlySource.sourceId && sources.find((s) => s.sourceId === readOnlySource.sourceId)) ||
      (readOnlySource.name && sources.find((s) => s.name === readOnlySource.name)) ||
      null
    );
  }, [readOnlySource, sources]);

  const sourceDefName = readOnlySource?.sourceName || sourceListMatch?.sourceName || null;
  const sourceIcon = readOnlySource?.icon || sourceListMatch?.icon || '/icons/connection.svg';

  // Non-null when the source has a friendly custom connection view (Task 1
  // registry): drives stream relabeling, hides unsupported sync options, and
  // tucks advanced fields behind a collapsible section.
  const connectionView = React.useMemo(
    () => (sourceDefName ? getCustomSource(sourceDefName)?.connectionView : null) ?? null,
    [sourceDefName]
  );
  const [activeConcept, setActiveConcept] = useState<ConnectionConceptId | null>(null);

  // Help-panel cards tailored to this source's capabilities. Custom sources
  // (Sheets/Kobo) only show the concepts that apply; everything else gets the
  // generic full set.
  const helpConcepts = React.useMemo(
    () =>
      getConnectionHelp({
        streamNoun: connectionView?.streamNoun,
        supportsIncremental: connectionView ? connectionView.supportsIncremental : true,
        allowsDedup: connectionView ? allowsDedup(connectionView.allowedDestModes) : true,
        isFlatSource: connectionView ? !connectionView.supportsIncremental : false,
      }),
    [connectionView]
  );

  const [advancedOptionsOpen, setAdvancedOptionsOpen] = useState(false);
  const [advancedStreamsOpen, setAdvancedStreamsOpen] = useState(false);

  const [name, setName] = useState('');
  const [destinationSchema, setDestinationSchema] = useState('staging');
  const [catalogId, setCatalogId] = useState<string>('');
  const [normalize, setNormalize] = useState(false);
  const [discoveredCatalog, setDiscoveredCatalog] = useState<SyncCatalog | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Inline required-field errors, surfaced on Save (matches the alerts/KPI pattern:
  // the button stays clickable and pressing it reveals what's missing).
  const [errors, setErrors] = useState<{ name?: string; source?: string; streams?: string }>({});

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

  // Create mode: prefill a default connection name once the source-definition
  // name resolves (it loads async via useSources). Functional update only fills
  // when the field is still empty, so a user's typed name is never overwritten.
  useEffect(() => {
    if (isCreate && sourceDefName) {
      setName((prev) => (prev === '' ? `${sourceDefName} connection` : prev));
    }
  }, [isCreate, sourceDefName]);

  // Load existing connection data
  useEffect(() => {
    if (connection && !isCreate) {
      setName(connection.name);
      setNormalize(connection.normalize);
      setCatalogId(connection.catalogId || '');
      if (connection.destinationSchema) {
        setDestinationSchema(connection.destinationSchema);
      }
      // Parse existing streams from sync catalog. Guard against stale data: an
      // existing custom-source connection may have been saved before its
      // allowedDestModes were narrowed (e.g. an old gsheet stream stored as
      // append_dedup) — coerce to the first allowed mode so the dest-mode
      // <Select> doesn't render blank.
      const parsed = connection.syncCatalog.streams.map((s) => parseCatalogStream(s));
      setStreams(
        connectionView
          ? parsed.map((s) =>
              connectionView.allowedDestModes.includes(s.destinationSyncMode as DestinationSyncMode)
                ? s
                : { ...s, destinationSyncMode: connectionView.allowedDestModes[0] }
            )
          : parsed
      );
    }
  }, [connection, isCreate, connectionView]);

  // Handle schema discovery WebSocket response
  const handleDiscoveryMessage = useCallback(
    (data: unknown) => {
      try {
        const response = data as SchemaDiscoveryResponse;
        if (response.status === 'success' && response.data?.result?.catalog) {
          const catalog = response.data.result.catalog;
          // Discovery defaults: custom sources auto-select every stream;
          // generic sources start unselected. Always full refresh + overwrite.
          const discoveryDefaults = {
            selected: !!connectionView,
            syncMode: SyncMode.FULL_REFRESH,
            destinationSyncMode: connectionView
              ? connectionView.allowedDestModes[0]
              : DestinationSyncMode.OVERWRITE,
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
    [setStreams, connectionView]
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

  // Required-field check. Returns validity and sets the inline error map; nothing
  // is submitted unless every required field is satisfied.
  const validate = useCallback(() => {
    const next: { name?: string; source?: string; streams?: string } = {};
    if (!name.trim()) next.name = 'Connection name is required';
    if (isCreate && !presetSourceId && !selectedSourceId) next.source = 'Source is required';
    if (!hasSelectedStreams) {
      // Use the friendly noun for custom sources: "one sheet" / "one form".
      const noun = connectionView
        ? connectionView.streamNoun.replace(/s$/i, '').toLowerCase()
        : 'stream';
      next.streams = `Select at least one ${noun}`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [name, isCreate, presetSourceId, selectedSourceId, hasSelectedStreams, connectionView]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;

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
        const sourceType = sources?.find((s) => s.sourceId === selectedSourceId)?.sourceName;
        const created = await createConnection({
          name,
          sourceId: selectedSourceId!,
          destinationSchema: destinationSchema || undefined,
          streams: streamPayload,
          normalize,
          syncCatalog: discoveredCatalog!,
          catalogId: catalogId || undefined,
        });
        trackEvent(ANALYTICS_EVENTS.CONNECTION_CREATED, { source_type: sourceType });
        toastSuccess.created('Connection');

        // Kick off the first sync automatically so a freshly created connection
        // starts pulling data without a separate manual step. A sync failure
        // must not fail the create flow — the connection already exists and can
        // be synced from the list — so this is best-effort.
        try {
          await triggerSync(created.deploymentId);
          trackEvent(ANALYTICS_EVENTS.CONNECTION_SYNC_TRIGGERED, { source_type: sourceType });
          toastSuccess.generic('First sync started');
        } catch (syncError) {
          toastError.api(syncError, 'Connection created, but the first sync could not be started');
        }
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
    validate,
    name,
    streams,
    isCreate,
    selectedSourceId,
    destinationSchema,
    normalize,
    connectionId,
    catalogId,
    discoveredCatalog,
    connection,
    connectionView,
    onSuccess,
  ]);

  // Clear each inline error as soon as the user satisfies it.
  useEffect(() => {
    setErrors((prev) => {
      if (!prev.name && !prev.source && !prev.streams) return prev;
      const next = { ...prev };
      if (name.trim()) delete next.name;
      if (selectedSourceId) delete next.source;
      if (hasSelectedStreams) delete next.streams;
      return next;
    });
  }, [name, selectedSourceId, hasSelectedStreams]);

  // Destination Schema field — shared between the always-visible (generic
  // source) and Advanced-options-collapsed (custom source) layouts.
  const destinationSchemaField = (
    <div>
      <button
        type="button"
        onClick={() => setActiveConcept('schema')}
        className="cursor-pointer text-base font-medium decoration-dotted underline-offset-2 hover:underline"
      >
        <label htmlFor="dest-schema" className="cursor-pointer">
          Destination Schema
        </label>
      </button>
      <Input
        id="dest-schema"
        data-testid="destination-schema-input"
        value={destinationSchema}
        onChange={(e) => setDestinationSchema(e.target.value)}
        onFocus={() => setActiveConcept('schema')}
        placeholder="e.g., public"
        disabled={disabled || isSaving}
        className="mt-1.5"
      />
    </div>
  );

  // Normalize toggle — same sharing rationale as destinationSchemaField.
  const normalizeToggleField = (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={() => setActiveConcept('normalize')}
        className="cursor-pointer text-base font-medium decoration-dotted underline-offset-2 hover:underline"
      >
        Normalize data after sync
      </button>
      <Switch
        checked={normalize}
        onCheckedChange={setNormalize}
        onFocus={() => setActiveConcept('normalize')}
        disabled={disabled || isSaving}
        data-testid="normalize-toggle"
      />
    </div>
  );

  // Advanced-options section (Destination Schema + Normalize behind a chevron),
  // shared by every connection. Rendered below the stream picker so the primary
  // flow reads source → name → streams, with rarely-touched settings last.
  const advancedOptionsSection = (
    <div>
      <button
        type="button"
        data-testid="advanced-options-toggle"
        aria-expanded={advancedOptionsOpen}
        onClick={() => {
          const next = !advancedOptionsOpen;
          setAdvancedOptionsOpen(next);
          if (next) {
            trackEvent(ANALYTICS_EVENTS.CONNECTION_ADVANCED_OPTIONS_EXPANDED, {
              source_type: sourceDefName,
            });
          }
        }}
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground"
      >
        Advanced options
        <ChevronDown
          className={cn('h-4 w-4 transition-transform', advancedOptionsOpen && 'rotate-180')}
        />
      </button>
      {advancedOptionsOpen && (
        <div className="mt-3 space-y-6">
          {destinationSchemaField}
          {normalizeToggleField}
        </div>
      )}
    </div>
  );

  // Docs panel only appears once discovery finishes and streams exist — avoids
  // an empty right-hand column while the schema is still loading. Until then the
  // form uses the full modal width (single column).
  const showHelpPanel = streams.length > 0 && !isDiscovering;

  // Let the host (wizard) keep the modal compact during discovery and widen it
  // only once the streams table + help column need the room.
  useEffect(() => {
    onExpandedChange?.(showHelpPanel);
  }, [showHelpPanel, onExpandedChange]);

  // Report custom-source header copy up to the host (create/edit/view). The
  // dialog/wizard header then names the source + its stream noun, so every mode
  // reads the same as the wizard's connection step (no in-body source chip).
  const headerSourceName =
    readOnlySource?.name || readOnlySource?.sourceName || sourceDefName || null;
  useEffect(() => {
    onHeaderInfoChange?.(
      connectionView && headerSourceName
        ? { sourceName: headerSourceName, streamNoun: connectionView.streamNoun }
        : null
    );
  }, [connectionView, headerSourceName, onHeaderInfoChange]);

  return (
    <>
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden px-6 py-5">
        {/* flex-1 + min-h-0 (not h-full) so the grid inherits a real bounded
            height from the max-h-capped dialog — percentage height would collapse
            to auto and let the column overflow the modal instead of scrolling. */}
        <div
          className={`grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-6 ${
            showHelpPanel ? 'md:grid-cols-[62fr_38fr]' : ''
          }`}
        >
          {/* Plain scrolling block (no flex fill, so children never overlap). The
              streams table scrolls its own rows; when the Advanced-options section
              opens and the content gets taller than the column, the column itself
              scrolls. */}
          <div className="flex min-h-0 flex-col gap-6 overflow-hidden pr-1">
            <div className="flex-shrink-0 space-y-6">
              {/* Source identity for custom sources (Sheets/Kobo) lives in the
                dialog/wizard header for every mode — reported via
                onHeaderInfoChange — so the body carries no source chip. */}

              {/* Success banner — shown right after the wizard creates the source. Generic sources only; custom sources surface identity in the header. */}
              {isCreate && presetSource && !connectionView && (
                <div
                  className="flex items-center gap-2 rounded-lg border border-green-600/30 bg-green-600/5 px-4 py-3 text-base font-medium text-green-600 dark:border-green-400/30 dark:text-green-400"
                  data-testid="source-created-banner"
                >
                  <Check className="h-4 w-4 flex-shrink-0" />
                  {presetSource.name} created successfully
                </div>
              )}

              {/* Connection name */}
              <div>
                <label htmlFor="conn-name" className="text-base font-medium">
                  Connection Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="conn-name"
                  data-testid="connection-name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Connection"
                  disabled={disabled || isSaving}
                  className={cn('mt-1.5', errors.name && 'border-destructive')}
                />
                {errors.name && (
                  <p className="text-xs text-destructive mt-1" data-testid="connection-name-error">
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Source selection (create, no preset) or read-only display (preset / edit / view) */}
              {isCreate && !presetSourceId ? (
                <div>
                  <label htmlFor="source-select-input" className="text-base font-medium">
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
                  {errors.source && (
                    <p
                      className="text-xs text-destructive mt-1"
                      data-testid="connection-source-error"
                    >
                      {errors.source}
                    </p>
                  )}
                </div>
              ) : readOnlySource && !connectionView ? (
                <div>
                  <label className="text-base font-medium">Source</label>
                  <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/50 text-base">
                    <img
                      src={sourceIcon}
                      alt=""
                      className="h-4 w-4"
                      onError={(e) => {
                        e.currentTarget.src = '/icons/connection.svg';
                      }}
                    />
                    <span data-testid="connection-source-name">
                      {readOnlySource.name || readOnlySource.sourceName || '—'}
                    </span>
                    {sourceDefName && (
                      <span className="text-muted-foreground">({sourceDefName})</span>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Destination Schema + Normalize live in the Advanced-options
                section at the bottom for every connection (source → name →
                streams → advanced). */}

            {/* Streams region fills remaining height; the table body scrolls
                internally so the column itself never grows a second scrollbar. */}
            <div className="flex min-h-0 flex-1 flex-col">
              {/* Schema discovery loading */}
              {isDiscovering && (
                <div className="flex items-center gap-2 text-base text-muted-foreground py-4 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {connectionView?.streamNoun
                    ? `Fetching ${connectionView.streamNoun.toLowerCase()}...`
                    : 'Discovering schema...'}
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
                  streamNoun={connectionView?.streamNoun}
                  showIncremental={connectionView ? connectionView.supportsIncremental : true}
                  allowedDestModes={connectionView?.allowedDestModes}
                  onConceptFocus={setActiveConcept}
                  advancedOpen={advancedStreamsOpen}
                  onToggleAdvanced={() => setAdvancedStreamsOpen((o) => !o)}
                  helpText={connectionView?.streamHelp}
                />
              )}
            </div>

            <div className="flex-shrink-0 space-y-6">
              {errors.streams && (
                <p className="text-sm text-destructive" data-testid="connection-streams-error">
                  {errors.streams}
                </p>
              )}

              {/* Advanced options (schema + normalize) last, for every connection. */}
              {advancedOptionsSection}
            </div>
          </div>
          {/* The help panel fills the left column's height and scrolls on its
              own, so its (tall) content never drives the modal taller than the
              form side. Hidden until streams are discovered so the modal never
              shows an empty docs column mid-discovery. */}
          {showHelpPanel && (
            <div className="relative hidden min-h-0 md:block">
              <div className="absolute inset-0">
                <ConnectionHelpPanel activeConcept={activeConcept} concepts={helpConcepts} />
              </div>
            </div>
          )}
        </div>
      </div>

      {!isView &&
        (footerSlot ?? (
          <DialogFooter className="flex-shrink-0 gap-2 border-t px-6 py-4">
            <Button variant="outline" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
            {/* Stays clickable so pressing it surfaces inline required-field errors
                (handleSave validates and blocks). Only disabled while saving. */}
            <Button
              variant="primary"
              className="uppercase"
              onClick={handleSave}
              disabled={isSaving}
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
