'use client';

import { useCallback, memo } from 'react';
import {
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Pencil,
  Eye,
  Loader2,
  XCircle,
  Eraser,
  History,
} from 'lucide-react';
import ConnectionIcon from '@/assets/icons/connection';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SyncStatus, ICON_COLOR_DEFAULT, ICON_COLOR_FAILED } from '@/constants/connections';
import { LockStatus } from '@/constants/pipeline';
import { useSyncLock } from '@/hooks/useSyncLock';
import { cn } from '@/lib/utils';
import type { Connection } from '@/types/connections';
import { SyncStatusCell } from './sync-status-cell';

// Gray for inactive/no last run
const ICON_COLOR_INACTIVE = '#9CA3AF';

const MAX_DISPLAY_LENGTH = 20;

function truncateString(input: string): string {
  if (input.length <= MAX_DISPLAY_LENGTH) return input;
  return input.substring(0, MAX_DISPLAY_LENGTH - 3) + '...';
}

export interface ConnectionRowProps {
  conn: Connection;
  syncingIds: string[];
  canSync: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canReset: boolean;
  onSync: (setTempSync: (v: boolean) => void) => void;
  onCancelSync: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewHistory: () => void;
  onClearStreams: () => void;
  onRefreshSchema: () => void;
}

export const ConnectionRow = memo(function ConnectionRow({
  conn,
  syncingIds,
  canSync,
  canEdit,
  canDelete,
  canReset,
  onSync,
  onCancelSync,
  onEdit,
  onDelete,
  onViewHistory,
  onClearStreams,
  onRefreshSchema,
}: ConnectionRowProps) {
  const { tempSyncState, setTempSyncState } = useSyncLock(conn.lock);
  // Connection is locked/syncing if it has a server lock OR optimistic local state
  const isLocked = !!conn.lock || tempSyncState;
  const isSyncing = isLocked || syncingIds.includes(conn.connectionId);

  const handleSyncClick = useCallback(() => {
    setTempSyncState(true);
    onSync(setTempSyncState);
  }, [onSync, setTempSyncState]);
  return (
    <TableRow className="hover:bg-gray-50/50" data-testid={`connection-row-${conn.connectionId}`}>
      {/* Connection name with icon */}
      <TableCell className="py-4">
        <div className="flex items-center gap-3">
          <ConnectionIcon
            className="h-10 w-10 rounded-lg flex-shrink-0"
            bgColor={
              !conn.lastRun
                ? ICON_COLOR_INACTIVE
                : conn.lastRun.status === SyncStatus.FAILED
                  ? ICON_COLOR_FAILED
                  : ICON_COLOR_DEFAULT
            }
          />
          <span
            className="font-medium text-lg text-gray-900"
            data-testid={`connection-name-${conn.connectionId}`}
          >
            {conn.name}
          </span>
        </div>
      </TableCell>

      {/* Source -> Destination (stacked: instance name semibold, type name lighter) */}
      <TableCell className="py-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-base font-medium text-gray-900 truncate">
                    {truncateString(conn.source.name || conn.source.sourceName)}
                  </p>
                </TooltipTrigger>
                <TooltipContent>{conn.source.name || conn.source.sourceName}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-sm text-gray-500 truncate">
                    {truncateString(conn.source.sourceName)}
                  </p>
                </TooltipTrigger>
                <TooltipContent>{conn.source.sourceName}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <span className="text-base text-gray-500 flex-shrink-0">→</span>
          <div className="min-w-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-base font-medium text-gray-900 truncate">
                    {truncateString(conn.destination.name || conn.destination.destinationName)}
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  {conn.destination.name || conn.destination.destinationName}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-sm text-gray-500 truncate">
                    {truncateString(conn.destination.destinationName)}
                  </p>
                </TooltipTrigger>
                <TooltipContent>{conn.destination.destinationName}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </TableCell>

      {/* Last sync status */}
      <TableCell className="py-4">
        <SyncStatusCell conn={conn} syncingIds={syncingIds} />
      </TableCell>

      {/* Actions */}
      <TableCell className="py-4">
        <div className="flex items-center justify-end gap-1">
          {/* History button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onViewHistory}
            className="h-8 w-8 p-0 hover:bg-gray-100"
            data-testid={`view-history-${conn.connectionId}`}
            aria-label="History"
          >
            <History className="w-4 h-4 text-gray-600" />
          </Button>

          {/* Sync / Cancel button */}
          {canSync &&
            (conn.lock?.status === LockStatus.QUEUED ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={onCancelSync}
                className="h-8 w-8 p-0 hover:bg-gray-100"
                data-testid={`cancel-sync-${conn.connectionId}`}
                aria-label="Cancel sync"
              >
                <XCircle className="w-4 h-4 text-red-600" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSyncClick}
                disabled={isSyncing}
                className={cn('h-8 w-8 p-0 hover:bg-gray-100', isSyncing && 'cursor-not-allowed')}
                data-testid={`sync-btn-${conn.connectionId}`}
                aria-label="Sync"
              >
                {isSyncing ? (
                  <Loader2 className="w-4 h-4 text-gray-600 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-gray-600" />
                )}
              </Button>
            ))}

          {/* Three-dot menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 p-0 hover:bg-gray-100"
                data-testid={`connection-menu-${conn.connectionId}`}
              >
                <MoreHorizontal className="w-4 h-4 text-gray-600" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {canEdit && (
                <DropdownMenuItem
                  onClick={onEdit}
                  className="text-[14px]"
                  data-testid={`edit-connection-${conn.connectionId}`}
                >
                  {isLocked ? (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </>
                  ) : (
                    <>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {canEdit && (
                <DropdownMenuItem
                  onClick={onRefreshSchema}
                  disabled={isLocked}
                  className="text-[14px]"
                  data-testid={`refresh-schema-${conn.connectionId}`}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Schema
                </DropdownMenuItem>
              )}
              {canReset && conn.clearConnDeploymentId && (
                <DropdownMenuItem
                  onClick={onClearStreams}
                  disabled={isLocked}
                  className="text-[14px]"
                  data-testid={`clear-streams-${conn.connectionId}`}
                >
                  <Eraser className="h-4 w-4 mr-2" />
                  Clear Streams
                </DropdownMenuItem>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onDelete}
                    disabled={isLocked}
                    className="text-[14px] text-red-600 focus:text-red-600 focus:bg-red-50"
                    data-testid={`delete-connection-${conn.connectionId}`}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
});
