'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Plus, Search, Loader2 } from 'lucide-react';
import ConnectionIcon from '@/assets/icons/connection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { useUserPermissions } from '@/hooks/api/usePermissions';
import {
  CONNECTION_PERMISSIONS,
  FLOW_RUN_POLL_INTERVAL_MS,
  FlowRunStatus,
  FormMode,
} from '@/constants/connections';
import { toastSuccess, toastError } from '@/lib/toast';
import { ConnectionForm } from './connection-form';
import { ConnectionSyncHistory } from './connection-sync-history';
import { StreamSelectionDialog } from './stream-selection-dialog';
import { PendingActions } from './pending-actions';
import { SchemaChangeForm } from './schema-change-form';
import { ConnectionRow } from './connection-row';
import type { Connection, ClearStreamData } from '@/types/connections';

export function ConnectionsList() {
  const { data: connections, isLoading, mutate } = useConnectionsList();
  const { hasPermission } = useUserPermissions();
  const { confirm, DialogComponent } = useConfirmationDialog();

  const [searchTerm, setSearchTerm] = useState('');
  const [syncingIds, setSyncingIds] = useState<string[]>([]);

  // Dialog state
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [historyConnectionId, setHistoryConnectionId] = useState<string | null>(null);
  const [historyConnectionName, setHistoryConnectionName] = useState('');
  const [clearStreamConnectionId, setClearStreamConnectionId] = useState<string | null>(null);
  const [clearDeploymentId, setClearDeploymentId] = useState<string | null>(null);
  const [schemaRefreshConnectionId, setSchemaRefreshConnectionId] = useState<string | null>(null);
  const [schemaRefreshConnectionName, setSchemaRefreshConnectionName] = useState('');

  const pollTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Cleanup all poll timers on unmount
  useEffect(() => {
    return () => {
      pollTimersRef.current.forEach((timer) => clearTimeout(timer));
      pollTimersRef.current.clear();
    };
  }, []);

  const canCreate = hasPermission(CONNECTION_PERMISSIONS.CREATE);
  const canEdit = hasPermission(CONNECTION_PERMISSIONS.EDIT);
  const canDelete = hasPermission(CONNECTION_PERMISSIONS.DELETE);
  const canReset = hasPermission(CONNECTION_PERMISSIONS.RESET);
  const canSync = hasPermission(CONNECTION_PERMISSIONS.SYNC);

  const filteredConnections = useMemo(() => {
    const sorted = [...connections].sort((a, b) => a.name.localeCompare(b.name));
    if (!searchTerm.trim()) return sorted;
    const q = searchTerm.toLowerCase();
    return sorted.filter(
      (c) => c.name.toLowerCase().includes(q) || c.source.sourceName.toLowerCase().includes(q)
    );
  }, [connections, searchTerm]);

  // ============ Sync Polling ============

  const pollSync = useCallback(
    async (connectionId: string, flowRunId: string) => {
      try {
        const flowRun = await fetchFlowRunStatus(flowRunId);

        // Refresh connection list on every poll so lock status stays current
        mutate();

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
        mutate();
      }
    },
    [mutate]
  );

  // ============ Action Handlers ============

  const handleCreate = useCallback(() => {
    setSelectedConnectionId(null);
    setFormMode(FormMode.CREATE);
  }, []);

  const handleEdit = useCallback((conn: Connection) => {
    setSelectedConnectionId(conn.connectionId);
    setFormMode(conn.lock ? FormMode.VIEW : FormMode.EDIT);
  }, []);

  const handleDelete = useCallback(
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
          toastSuccess.deleted(conn.name);
          mutate();
        } catch (error) {
          toastError.delete(error, conn.name);
        }
      }
    },
    [confirm, mutate]
  );

  const handleSync = useCallback(
    async (conn: Connection, setTempSync?: (v: boolean) => void) => {
      try {
        setSyncingIds((prev) => [...prev, conn.connectionId]);
        const result = await triggerSync(conn.deploymentId);
        // Immediately refresh so the connection's lock status is picked up
        // This activates SWR's smart 3s polling for locked connections
        mutate();
        pollSync(conn.connectionId, result.flow_run_id);
      } catch (error) {
        setSyncingIds((prev) => prev.filter((id) => id !== conn.connectionId));
        setTempSync?.(false);
        toastError.api(error, 'Failed to trigger sync');
      }
    },
    [pollSync, mutate]
  );

  const handleCancelSync = useCallback(
    async (conn: Connection) => {
      if (!conn.lock?.flowRunId) return;
      try {
        await cancelQueuedSync(conn.lock.flowRunId);
        toastSuccess.generic('Sync cancelled');
        mutate();
      } catch (error) {
        toastError.api(error, 'Failed to cancel sync');
      }
    },
    [mutate]
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
    setSchemaRefreshConnectionName(conn.name);
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
            .map((s) => ({
              streamName: s.streamName,
              streamNamespace: s.streamNamespace,
            }));
          await clearSelectedStreams(clearDeploymentId, clearStreamConnectionId, selected);
        }
        toastSuccess.generic('Stream clear initiated');
        setClearStreamConnectionId(null);
        mutate();
      } catch (error) {
        toastError.api(error, 'Failed to clear streams');
      }
    },
    [clearDeploymentId, clearStreamConnectionId, mutate]
  );

  const handleFormSuccess = useCallback(() => {
    setFormMode(null);
    setSelectedConnectionId(null);
    mutate();
  }, [mutate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6">
        <div className="flex items-center justify-between mb-4">
          {/* Search */}
          {connections.length > 0 ? (
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search Connections"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="connection-search-input"
              />
            </div>
          ) : (
            <div />
          )}
          {canCreate && (
            <Button
              variant="ghost"
              className="text-white hover:opacity-90 shadow-xs uppercase"
              style={{ backgroundColor: 'var(--primary)' }}
              onClick={handleCreate}
              data-testid="create-connection-btn"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Connection
            </Button>
          )}
        </div>

        {/* Pending schema changes */}
        <PendingActions connections={connections} onSuccess={() => mutate()} />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 mt-2">
        {/* Empty state */}
        {connections.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-lg border"
            data-testid="connection-empty-state"
          >
            <ConnectionIcon className="h-16 w-16 rounded-lg" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">No connections yet</h3>
            <p className="text-base text-gray-500 text-center max-w-sm mb-6">
              Create your first connection to start syncing data from a source to your warehouse.
            </p>
            {canCreate && (
              <Button
                variant="ghost"
                className="text-white hover:opacity-90 shadow-xs uppercase"
                style={{ backgroundColor: 'var(--primary)' }}
                onClick={handleCreate}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Connection
              </Button>
            )}
          </div>
        )}

        {/* No search results */}
        {connections.length > 0 && filteredConnections.length === 0 && (
          <p className="text-base text-gray-400 py-8 text-center">
            No connections matching &quot;{searchTerm}&quot;
          </p>
        )}

        {/* Connections table */}
        {filteredConnections.length > 0 && (
          <div className="bg-white rounded-lg border shadow-sm">
            <Table data-testid="connections-table">
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="text-base font-medium w-[30%]">
                    Connection details
                  </TableHead>
                  <TableHead className="text-base font-medium w-[30%]">
                    Source → Destination
                  </TableHead>
                  <TableHead className="text-base font-medium w-[25%]">Last sync</TableHead>
                  <TableHead className="text-base font-medium text-right w-[15%]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConnections.map((conn) => (
                  <ConnectionRow
                    key={conn.connectionId}
                    conn={conn}
                    syncingIds={syncingIds}
                    canSync={canSync}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    canReset={canReset}
                    onSync={(setTempSync) => handleSync(conn, setTempSync)}
                    onCancelSync={() => handleCancelSync(conn)}
                    onEdit={() => handleEdit(conn)}
                    onDelete={() => handleDelete(conn)}
                    onViewHistory={() => handleViewHistory(conn)}
                    onClearStreams={() => handleClearStreams(conn)}
                    onRefreshSchema={() => handleRefreshSchema(conn)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <DialogComponent />

      {formMode && (
        <ConnectionForm
          mode={formMode}
          connectionId={selectedConnectionId ?? undefined}
          onClose={() => {
            setFormMode(null);
            setSelectedConnectionId(null);
          }}
          onSuccess={handleFormSuccess}
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
          connectionName={schemaRefreshConnectionName}
          onClose={() => {
            setSchemaRefreshConnectionId(null);
            setSchemaRefreshConnectionName('');
          }}
          onSuccess={() => {
            setSchemaRefreshConnectionId(null);
            setSchemaRefreshConnectionName('');
            mutate();
          }}
        />
      )}
    </div>
  );
}
