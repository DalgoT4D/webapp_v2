'use client';

import { useState, useCallback, useMemo } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSchemaChanges } from '@/hooks/api/useConnections';
import { SchemaChangeForm } from './schema-change-form';
import { SCHEMA_CHANGE_BREAKING } from '@/constants/connections';
import type { SchemaChange, Connection } from '@/types/connections';

interface PendingActionsProps {
  connections: Connection[];
  onSuccess: () => void;
}

export function PendingActions({ connections, onSuccess }: PendingActionsProps) {
  const { data: schemaChanges, mutate } = useSchemaChanges();
  const [expanded, setExpanded] = useState(false);
  const [selectedChange, setSelectedChange] = useState<SchemaChange | null>(null);

  // Build a lookup map: connectionId -> connection name
  const connectionNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const conn of connections) {
      map.set(conn.connectionId, conn.name);
    }
    return map;
  }, [connections]);

  // Build a lookup map: connectionId -> has active lock
  const connectionLockMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const conn of connections) {
      map.set(conn.connectionId, !!conn.lock);
    }
    return map;
  }, [connections]);

  const getConnectionName = useCallback(
    (connectionId: string) => connectionNameMap.get(connectionId) || connectionId,
    [connectionNameMap]
  );

  const handleSchemaChangeSuccess = useCallback(() => {
    setSelectedChange(null);
    mutate();
    onSuccess();
  }, [mutate, onSuccess]);

  if (schemaChanges.length === 0) return null;

  return (
    <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950">
      {/* Header */}
      <button
        type="button"
        className="flex items-center justify-between w-full px-4 py-3 text-left cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        data-testid="pending-actions-toggle"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <span className="text-sm font-medium">
            Pending Schema Changes ({schemaChanges.length})
          </span>
        </div>
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {/* Expanded list */}
      {expanded && (
        <div className="border-t border-yellow-300 dark:border-yellow-700">
          {schemaChanges.map((change) => {
            const isBreaking = change.change_type === SCHEMA_CHANGE_BREAKING;
            const isLocked = !!connectionLockMap.get(change.connection_id);
            return (
              <div
                key={change.connection_id}
                className="flex items-center justify-between px-4 py-2 border-b last:border-b-0 border-yellow-200 dark:border-yellow-800"
                data-testid={`schema-change-${change.connection_id}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {getConnectionName(change.connection_id)}
                  </span>
                  <Badge variant={isBreaking ? 'destructive' : 'outline'} className="text-xs">
                    {isBreaking ? 'Breaking' : 'Updates'}
                  </Badge>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedChange(change)}
                          disabled={isLocked}
                          data-testid={`view-schema-change-${change.connection_id}`}
                        >
                          View
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {isLocked && (
                      <TooltipContent>
                        Schema changes cannot be accepted while a connection is syncing
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
            );
          })}
        </div>
      )}

      {/* Schema change form dialog */}
      {selectedChange && (
        <SchemaChangeForm
          connectionId={selectedChange.connection_id}
          onClose={() => setSelectedChange(null)}
          onSuccess={handleSchemaChangeSuccess}
        />
      )}
    </div>
  );
}
