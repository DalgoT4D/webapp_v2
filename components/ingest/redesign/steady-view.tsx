'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Search, ArrowUp, ArrowDown, ArrowUpDown, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
  useConnectionsList,
  deleteConnection,
  triggerSync,
  cancelQueuedSync,
  fetchFlowRunStatus,
  clearAllStreams,
  clearSelectedStreams,
} from '@/hooks/api/useConnections';
import { useSources, deleteSource } from '@/hooks/api/useSources';
import { PERMISSIONS, useRbac } from '@/lib/rbac';
import { FLOW_RUN_POLL_INTERVAL_MS, FlowRunStatus, FormMode } from '@/constants/connections';
import { toastSuccess, toastError } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { ConnectionForm } from '@/components/connections/connection-form';
import { ConnectionSyncHistory } from '@/components/connections/connection-sync-history';
import { StreamSelectionDialog } from '@/components/connections/stream-selection-dialog';
import { PendingActions } from '@/components/connections/pending-actions';
import { SchemaChangeForm } from '@/components/connections/schema-change-form';
import { SourceForm } from '@/components/ingest/sources/SourceForm';
import { SourceRow } from '@/components/ingest/redesign/source-row';
import { groupConnectionsBySource } from '@/components/ingest/redesign/utils';
import type { Connection, ClearStreamData } from '@/types/connections';
import type { Source } from '@/types/source';

// Source-list sort. Clicking the "Source details" header cycles through these in
// order: created_desc (default, newest first) → name_asc → name_desc → back.
type SortOption = 'created_desc' | 'name_asc' | 'name_desc';

const SORT_CYCLE: SortOption[] = ['created_desc', 'name_asc', 'name_desc'];

function nextSort(current: SortOption): SortOption {
  const i = SORT_CYCLE.indexOf(current);
  return SORT_CYCLE[(i + 1) % SORT_CYCLE.length];
}

// Small info icon + tooltip shown beside each column header to explain the column
// in plain language. `label` names the icon for screen readers and testids.
function ColumnInfo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info
          className="h-3.5 w-3.5 flex-shrink-0 cursor-help text-muted-foreground hover:text-foreground"
          aria-label={`About ${label}`}
          data-testid={`column-info-${label.toLowerCase().replace(/\s+/g, '-')}`}
        />
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs font-normal leading-relaxed">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

function compareSources(a: Source, b: Source, sort: SortOption): number {
  switch (sort) {
    case 'name_asc':
      return a.name.localeCompare(b.name);
    case 'name_desc':
      return b.name.localeCompare(a.name);
    case 'created_desc':
    default:
      // Newest first; fall back to name so order stays stable when timestamps
      // are equal or missing.
      return (b.createdAt ?? 0) - (a.createdAt ?? 0) || a.name.localeCompare(b.name);
  }
}

/**
 * The steady-state Ingest surface: a control bar (search + New Source), the
 * pending-schema-change banner, and the source-grouped connection list rendered
 * as side-by-side rows. Owns its own dialog state for the connection and source
 * forms.
 */
export function SteadyView() {
  const { data: connections, mutate: mutateConnections } = useConnectionsList();
  const { data: sources, mutate: mutateSources } = useSources();
  const { hasPermission } = useRbac();
  const { confirm, DialogComponent } = useConfirmationDialog();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('created_desc');
  const [syncingIds, setSyncingIds] = useState<string[]>([]);

  // Connection dialog state
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  // Source the "Add connection" flow was launched from — preselected and locked
  // in the connection form so it cannot be changed.
  const [addConnectionSourceId, setAddConnectionSourceId] = useState<string | undefined>(undefined);
  const [historyConnectionId, setHistoryConnectionId] = useState<string | null>(null);
  const [historyConnectionName, setHistoryConnectionName] = useState('');
  const [clearStreamConnectionId, setClearStreamConnectionId] = useState<string | null>(null);
  const [clearDeploymentId, setClearDeploymentId] = useState<string | null>(null);
  const [schemaRefreshConnectionId, setSchemaRefreshConnectionId] = useState<string | null>(null);

  // Source dialog state
  // sourceFormOpen/sourceEditId drive SourceForm, which now only handles editing
  // an existing source. Creating a new source goes through the guided
  // AddSourceWizard, which the page header (IngestView) owns.
  const [sourceFormOpen, setSourceFormOpen] = useState(false);
  const [sourceEditId, setSourceEditId] = useState<string | undefined>(undefined);

  const pollTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    return () => {
      pollTimersRef.current.forEach((timer) => clearTimeout(timer));
      pollTimersRef.current.clear();
    };
  }, []);

  const canCreateConnection = hasPermission(PERMISSIONS.CAN_CREATE_CONNECTION);
  const canEditConnection = hasPermission(PERMISSIONS.CAN_EDIT_CONNECTION);
  const canDeleteConnection = hasPermission(PERMISSIONS.CAN_DELETE_CONNECTION);
  const canReset = hasPermission(PERMISSIONS.CAN_RESET_CONNECTION);
  const canSync = hasPermission(PERMISSIONS.CAN_SYNC_SOURCES);
  const canEditSource = hasPermission(PERMISSIONS.CAN_EDIT_SOURCE);
  const canDeleteSource = hasPermission(PERMISSIONS.CAN_DELETE_SOURCE);

  // ============ Grouping + search ============

  const groups = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    const sortedSources = [...sources].sort((a, b) => compareSources(a, b, sortOption));
    const visibleConnections = q
      ? connections.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.source.sourceName.toLowerCase().includes(q) ||
            c.source.name.toLowerCase().includes(q)
        )
      : connections;

    const allGroups = groupConnectionsBySource(sortedSources, visibleConnections).map((group) => ({
      ...group,
      connections: [...group.connections].sort((a, b) => a.name.localeCompare(b.name)),
    }));

    if (!q) return allGroups;
    // While searching, keep a group only if its source name matches or it has
    // a matching connection.
    return allGroups.filter(
      (group) => group.source.name.toLowerCase().includes(q) || group.connections.length > 0
    );
  }, [sources, connections, searchTerm, sortOption]);

  const handleSortSources = useCallback(() => {
    setSortOption((prev) => nextSort(prev));
  }, []);

  // ============ Connection sync polling (mirrors connections-list) ============

  const pollSync = useCallback(
    async (connectionId: string, flowRunId: string) => {
      try {
        const flowRun = await fetchFlowRunStatus(flowRunId);
        mutateConnections();

        if (
          flowRun.state_type === FlowRunStatus.COMPLETED ||
          flowRun.state_type === FlowRunStatus.FAILED ||
          flowRun.state_type === FlowRunStatus.CANCELLED
        ) {
          pollTimersRef.current.delete(connectionId);
          setSyncingIds((prev) => prev.filter((id) => id !== connectionId));
          if (flowRun.state_type === FlowRunStatus.COMPLETED) {
            toastSuccess.generic('Sync completed successfully');
          } else if (flowRun.state_type === FlowRunStatus.FAILED) {
            toastError.api('Sync failed');
          }
          return;
        }

        const timer = setTimeout(
          () => pollSync(connectionId, flowRunId),
          FLOW_RUN_POLL_INTERVAL_MS
        );
        pollTimersRef.current.set(connectionId, timer);
      } catch {
        pollTimersRef.current.delete(connectionId);
        setSyncingIds((prev) => prev.filter((id) => id !== connectionId));
        mutateConnections();
      }
    },
    [mutateConnections]
  );

  // ============ Connection handlers ============

  const handleEditConnection = useCallback((conn: Connection) => {
    setSelectedConnectionId(conn.connectionId);
    setFormMode(conn.lock ? FormMode.VIEW : FormMode.EDIT);
  }, []);

  const handleDeleteConnection = useCallback(
    async (conn: Connection) => {
      const confirmed = await confirm({
        title: 'Delete Connection',
        description: `Are you sure you want to delete "${conn.name}"? This will also delete all sync history. This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
      });
      if (confirmed) {
        try {
          await deleteConnection(conn.connectionId);
          trackEvent(ANALYTICS_EVENTS.CONNECTION_DELETED);
          toastSuccess.deleted(conn.name);
          mutateConnections();
        } catch (error) {
          toastError.delete(error, conn.name);
        }
      }
    },
    [confirm, mutateConnections]
  );

  const handleSync = useCallback(
    async (conn: Connection, setTempSync?: (v: boolean) => void) => {
      try {
        setSyncingIds((prev) => [...prev, conn.connectionId]);
        const result = await triggerSync(conn.deploymentId);
        trackEvent(ANALYTICS_EVENTS.CONNECTION_SYNC_TRIGGERED, {
          source_type: conn.source?.sourceName,
        });
        mutateConnections();
        pollSync(conn.connectionId, result.flow_run_id);
      } catch (error) {
        setSyncingIds((prev) => prev.filter((id) => id !== conn.connectionId));
        setTempSync?.(false);
        toastError.api(error, 'Failed to trigger sync');
      }
    },
    [pollSync, mutateConnections]
  );

  const handleCancelSync = useCallback(
    async (conn: Connection) => {
      if (!conn.lock?.flowRunId) return;
      try {
        await cancelQueuedSync(conn.lock.flowRunId);
        trackEvent(ANALYTICS_EVENTS.CONNECTION_SYNC_CANCELLED);
        toastSuccess.generic('Sync cancelled');
        mutateConnections();
      } catch (error) {
        toastError.api(error, 'Failed to cancel sync');
      }
    },
    [mutateConnections]
  );

  const handleViewHistory = useCallback((conn: Connection) => {
    setHistoryConnectionId(conn.connectionId);
    setHistoryConnectionName(conn.name);
  }, []);

  const handleClearStreams = useCallback((conn: Connection) => {
    setClearStreamConnectionId(conn.connectionId);
    setClearDeploymentId(conn.clearConnDeploymentId);
  }, []);

  const handleRefreshSchema = useCallback((conn: Connection) => {
    setSchemaRefreshConnectionId(conn.connectionId);
  }, []);

  const handleClearStreamsConfirm = useCallback(
    async (streams: ClearStreamData[]) => {
      if (!clearDeploymentId || !clearStreamConnectionId) return;
      const allSelected = streams.every((s) => s.selected);
      try {
        if (allSelected) {
          await clearAllStreams(clearDeploymentId);
        } else {
          const selected = streams
            .filter((s) => s.selected)
            .map((s) => ({ streamName: s.streamName, streamNamespace: s.streamNamespace }));
          await clearSelectedStreams(clearDeploymentId, clearStreamConnectionId, selected);
        }
        trackEvent(ANALYTICS_EVENTS.CONNECTION_RESET, {
          reset_type: allSelected ? 'all' : 'selected',
        });
        toastSuccess.generic('Stream clear initiated');
        setClearStreamConnectionId(null);
        mutateConnections();
      } catch (error) {
        toastError.api(error, 'Failed to clear streams');
      }
    },
    [clearDeploymentId, clearStreamConnectionId, mutateConnections]
  );

  const handleConnectionFormSuccess = useCallback(() => {
    setFormMode(null);
    setSelectedConnectionId(null);
    setAddConnectionSourceId(undefined);
    mutateConnections();
  }, [mutateConnections]);

  // ============ Source handlers ============

  const handleAddConnectionForSource = useCallback((source: Source) => {
    // Launched from a specific source: preselect + lock it in the form.
    setSelectedConnectionId(null);
    setAddConnectionSourceId(source.sourceId);
    setFormMode(FormMode.CREATE);
  }, []);

  const handleEditSource = useCallback((source: Source) => {
    setSourceEditId(source.sourceId);
    setSourceFormOpen(true);
  }, []);

  const handleDeleteSource = useCallback(
    async (source: Source) => {
      const confirmed = await confirm({
        title: 'Delete Source',
        description: `Are you sure you want to delete "${source.name}"? This will also delete all connections using this source. This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
      });
      if (confirmed) {
        try {
          await deleteSource(source.sourceId);
          trackEvent(ANALYTICS_EVENTS.SOURCE_DELETED);
          toastSuccess.deleted(source.name);
          mutateSources();
          mutateConnections();
        } catch (error) {
          toastError.delete(error, source.name);
        }
      }
    },
    [confirm, mutateSources, mutateConnections]
  );

  const handleSourceFormSuccess = useCallback(() => {
    setSourceFormOpen(false);
    setSourceEditId(undefined);
    mutateSources();
  }, [mutateSources]);

  const hasQuery = searchTerm.trim().length > 0;

  return (
    <div className="h-full flex flex-col" data-testid="ingest-steady-view">
      {/* Control bar */}
      <div className="flex-shrink-0 px-6 pt-6">
        <div className="mb-4">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sources or connections"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="ingest-search-input"
            />
          </div>
        </div>

        <PendingActions connections={connections} onSuccess={() => mutateConnections()} />
      </div>

      {/* Source groups */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 mt-2">
        {hasQuery && groups.length === 0 && (
          <p className="text-base text-muted-foreground py-8 text-center">
            No sources or connections matching &quot;{searchTerm}&quot;
          </p>
        )}

        {/* One continuous table: a sticky grey header row followed by flush,
            hairline-divided source rows — no per-row cards or gaps. The header
            stays a sibling of the rows body (not inside its overflow-hidden
            wrapper) so `sticky` still resolves against the scroll container. */}
        {groups.length > 0 && (
          <div className="rounded-lg border bg-muted/50">
            <TooltipProvider delayDuration={150}>
              <div
                className="sticky top-0 z-10 flex rounded-t-lg border-b bg-muted py-3 text-sm font-semibold text-muted-foreground"
                data-testid="ingest-column-labels"
              >
                <div className="w-[30%] flex-shrink-0 flex items-center gap-1.5 px-4">
                  <button
                    type="button"
                    onClick={handleSortSources}
                    className="flex items-center gap-2 text-left font-semibold text-muted-foreground transition-colors cursor-pointer hover:text-foreground"
                    data-testid="sort-source-details"
                    aria-label="Sort sources"
                  >
                    Source details
                    {sortOption === 'name_asc' ? (
                      <ArrowUp className="h-4 w-4 text-foreground" />
                    ) : sortOption === 'name_desc' ? (
                      <ArrowDown className="h-4 w-4 text-foreground" />
                    ) : (
                      <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  <ColumnInfo label="Source">
                    <p>
                      A <strong>source</strong> is where your data comes from — like Google Sheets
                      or KoboToolbox.
                    </p>
                    <p className="mt-1.5">
                      To pull data in, add a <strong>connection</strong>: open the ⋮ menu on a
                      source and choose <em>Add connection</em>. One source can have several
                      connections.
                    </p>
                  </ColumnInfo>
                </div>
                <div className="flex-1 min-w-0">
                  <table className="table-fixed w-full">
                    <colgroup>
                      <col style={{ width: '45%' }} />
                      <col style={{ width: '35%' }} />
                      <col style={{ width: '20%' }} />
                    </colgroup>
                    <tbody>
                      <tr>
                        <td className="px-2">
                          <span className="inline-flex items-center gap-1.5">
                            Connections
                            <ColumnInfo label="Connections">
                              <p>
                                A <strong>connection</strong> links a source to your warehouse and
                                decides what gets copied over — which sheets, tables or forms. One
                                source can have several connections.
                              </p>
                            </ColumnInfo>
                          </span>
                        </td>
                        <td className="px-2">
                          <span className="inline-flex items-center gap-1.5">
                            Last sync
                            <ColumnInfo label="Last sync">
                              <p>
                                A <strong>sync</strong> is one run that copies the latest data from
                                the source into your warehouse. This shows when it last ran and
                                whether it worked.
                              </p>
                            </ColumnInfo>
                          </span>
                        </td>
                        <td className="px-2 text-right">
                          <span className="inline-flex items-center gap-1.5">
                            Actions
                            <ColumnInfo label="Actions">
                              <p>What you can do with a connection:</p>
                              <ul className="mt-1 list-disc space-y-1 pl-4">
                                <li>
                                  <strong>View history</strong> — see past sync runs.
                                </li>
                                <li>
                                  <strong>Sync now</strong> — pull the latest data right away.
                                </li>
                                <li>
                                  <strong>Clear</strong> — remove the data already copied into the
                                  warehouse (the connection stays).
                                </li>
                                <li>
                                  <strong>Refresh schema</strong> — check the source for new or
                                  changed columns, tables or forms.
                                </li>
                              </ul>
                            </ColumnInfo>
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </TooltipProvider>

            <div className="flex flex-col gap-2 rounded-b-lg p-2">
              {groups.map((group) => (
                <SourceRow
                  key={group.source.sourceId}
                  group={group}
                  syncingIds={syncingIds}
                  canSync={canSync}
                  canEditConnection={canEditConnection}
                  canDeleteConnection={canDeleteConnection}
                  canReset={canReset}
                  onSync={handleSync}
                  onCancelSync={handleCancelSync}
                  onEditConnection={handleEditConnection}
                  onDeleteConnection={handleDeleteConnection}
                  onViewHistory={handleViewHistory}
                  onClearStreams={handleClearStreams}
                  onRefreshSchema={handleRefreshSchema}
                  canCreateConnection={canCreateConnection}
                  canEditSource={canEditSource}
                  canDeleteSource={canDeleteSource}
                  onAddConnection={handleAddConnectionForSource}
                  onEditSource={handleEditSource}
                  onDeleteSource={handleDeleteSource}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <DialogComponent />

      {formMode && (
        <ConnectionForm
          mode={formMode}
          connectionId={selectedConnectionId ?? undefined}
          lockedSourceId={formMode === FormMode.CREATE ? addConnectionSourceId : undefined}
          onClose={() => {
            setFormMode(null);
            setSelectedConnectionId(null);
            setAddConnectionSourceId(undefined);
          }}
          onSuccess={handleConnectionFormSuccess}
        />
      )}

      {historyConnectionId && (
        <ConnectionSyncHistory
          connectionId={historyConnectionId}
          connectionName={historyConnectionName}
          lock={connections.find((c) => c.connectionId === historyConnectionId)?.lock ?? null}
          onClose={() => {
            setHistoryConnectionId(null);
            setHistoryConnectionName('');
          }}
        />
      )}

      {clearStreamConnectionId && (
        <StreamSelectionDialog
          connectionId={clearStreamConnectionId}
          onClose={() => {
            setClearStreamConnectionId(null);
            setClearDeploymentId(null);
          }}
          onConfirm={handleClearStreamsConfirm}
        />
      )}

      {schemaRefreshConnectionId && (
        <SchemaChangeForm
          connectionId={schemaRefreshConnectionId}
          onClose={() => setSchemaRefreshConnectionId(null)}
          onSuccess={() => {
            setSchemaRefreshConnectionId(null);
            mutateConnections();
          }}
        />
      )}

      {sourceFormOpen && (
        <SourceForm
          open={sourceFormOpen}
          sourceId={sourceEditId}
          onClose={() => {
            setSourceFormOpen(false);
            setSourceEditId(undefined);
          }}
          onSuccess={handleSourceFormSuccess}
        />
      )}
    </div>
  );
}
