'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { SourceGroup, ConnColGroup } from '@/components/ingest/redesign/source-group';
import { SourceRow } from '@/components/ingest/redesign/source-row';
import { groupConnectionsBySource } from '@/components/ingest/redesign/utils';
import type { Connection, ClearStreamData } from '@/types/connections';
import type { Source } from '@/types/source';

/**
 * The steady-state Ingest surface: a control bar (search + New Source + New
 * Connection), the pending-schema-change banner, and the source-grouped
 * connection list. Reuses every classic dialog and the connection row; owns its
 * own dialog state so the classic connections-list stays untouched.
 */
export function SteadyView({ layout = 'accordion' }: { layout?: 'accordion' | 'rows' } = {}) {
  const { data: connections, mutate: mutateConnections } = useConnectionsList();
  const { data: sources, mutate: mutateSources } = useSources();
  const { hasPermission } = useRbac();
  const { confirm, DialogComponent } = useConfirmationDialog();

  const [searchTerm, setSearchTerm] = useState('');
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
  const canCreateSource = hasPermission(PERMISSIONS.CAN_CREATE_SOURCE);
  const canEditSource = hasPermission(PERMISSIONS.CAN_EDIT_SOURCE);
  const canDeleteSource = hasPermission(PERMISSIONS.CAN_DELETE_SOURCE);

  // ============ Grouping + search ============

  const groups = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    const sortedSources = [...sources].sort((a, b) => a.name.localeCompare(b.name));
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
  }, [sources, connections, searchTerm]);

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

  const handleCreateSource = useCallback(() => {
    setSourceEditId(undefined);
    setSourceFormOpen(true);
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
        <div className="flex items-center justify-between gap-4 mb-4">
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
          <div className="flex items-center gap-2">
            {canCreateSource && (
              <Button
                variant="primary"
                className="uppercase"
                onClick={handleCreateSource}
                data-testid="new-source-btn"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Source
              </Button>
            )}
          </div>
        </div>

        <PendingActions connections={connections} onSuccess={() => mutateConnections()} />
      </div>

      {/* Source groups */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 mt-2 space-y-3">
        {hasQuery && groups.length === 0 && (
          <p className="text-base text-gray-400 py-8 text-center">
            No sources or connections matching &quot;{searchTerm}&quot;
          </p>
        )}

        {/* Column labels — layout-aware. */}
        {groups.length > 0 &&
          (layout === 'rows' ? (
            // Rows layout: a fixed source column beside the stacked connection
            // table, so the header separates Sources | Connections | Last sync |
            // Actions, aligned to the SourceRow grid (w-64 left, 45/35/20 right).
            <div
              className="flex px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
              data-testid="ingest-column-labels"
            >
              <div className="w-64 flex-shrink-0 px-4 pb-1">Sources</div>
              <div className="flex-1 min-w-0">
                <table className="table-fixed w-full">
                  <colgroup>
                    <col style={{ width: '45%' }} />
                    <col style={{ width: '35%' }} />
                    <col style={{ width: '20%' }} />
                  </colgroup>
                  <tbody>
                    <tr>
                      <td className="px-2 pb-1">Connections</td>
                      <td className="px-2 pb-1">Last sync</td>
                      <td className="px-2 pb-1 text-right">Actions</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            // Accordion layout: col 1 spans source + connection names.
            <div className="px-2" data-testid="ingest-column-labels">
              <table className="table-fixed w-full">
                <ConnColGroup />
                <tbody>
                  <tr className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <td className="px-2 pb-1">Sources &amp; connections</td>
                    <td className="px-2 pb-1">Last sync</td>
                    <td className="px-2 pb-1" />
                  </tr>
                </tbody>
              </table>
            </div>
          ))}

        {groups.map((group) => {
          const groupProps = {
            group,
            syncingIds,
            canSync,
            canEditConnection,
            canDeleteConnection,
            canReset,
            onSync: handleSync,
            onCancelSync: handleCancelSync,
            onEditConnection: handleEditConnection,
            onDeleteConnection: handleDeleteConnection,
            onViewHistory: handleViewHistory,
            onClearStreams: handleClearStreams,
            onRefreshSchema: handleRefreshSchema,
            canCreateConnection,
            canEditSource,
            canDeleteSource,
            onAddConnection: handleAddConnectionForSource,
            onEditSource: handleEditSource,
            onDeleteSource: handleDeleteSource,
          };
          return layout === 'rows' ? (
            <SourceRow key={group.source.sourceId} {...groupProps} />
          ) : (
            <SourceGroup key={group.source.sourceId} {...groupProps} />
          );
        })}
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
