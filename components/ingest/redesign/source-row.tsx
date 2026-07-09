'use client';

import { Plus, MoreVertical, Pencil, Trash2, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConnectionRow } from '@/components/connections/connection-row';
import type { SourceGroupProps } from '@/components/ingest/redesign/utils';
import type { Source } from '@/types/source';

// Column widths for the connection table stacked on the right of a source row
// (name | last-sync status | actions). The Source → Destination column is
// dropped: the source is the row's left column and the destination is the org's
// single warehouse.
const CONNECTION_COLUMNS = {
  name: '45%',
  status: '35%',
  actions: '20%',
} as const;

function ConnColGroup() {
  return (
    <colgroup>
      <col style={{ width: CONNECTION_COLUMNS.name }} />
      <col style={{ width: CONNECTION_COLUMNS.status }} />
      <col style={{ width: CONNECTION_COLUMNS.actions }} />
    </colgroup>
  );
}

function SourceIcon({ source }: { source: Source }) {
  if (source.icon) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={source.icon} alt={source.sourceName} className="h-10 w-10 rounded-lg" />;
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
      <Plug className="h-5 w-5 text-primary" />
    </div>
  );
}

function SourceIdentity({ source }: { source: Source }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <SourceIcon source={source} />
      <div className="min-w-0 text-left">
        <p className="font-medium text-lg text-gray-900 truncate">{source.name}</p>
        <p className="text-sm text-gray-500 truncate">{source.sourceName}</p>
      </div>
    </div>
  );
}

function SourceMenu({
  source,
  canEditSource,
  canDeleteSource,
  onEditSource,
  onDeleteSource,
}: {
  source: Source;
  canEditSource: boolean;
  canDeleteSource: boolean;
  onEditSource: (source: Source) => void;
  onDeleteSource: (source: Source) => void;
}) {
  if (!canEditSource && !canDeleteSource) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 p-0 hover:bg-gray-100"
          data-testid={`source-menu-${source.sourceId}`}
        >
          <MoreVertical className="w-4 h-4 text-gray-600" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {canEditSource && (
          <DropdownMenuItem
            onClick={() => onEditSource(source)}
            className="text-[14px]"
            data-testid={`edit-source-${source.sourceId}`}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit Source
          </DropdownMenuItem>
        )}
        {canDeleteSource && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDeleteSource(source)}
              className="text-[14px] text-red-600 focus:text-red-600 focus:bg-red-50"
              data-testid={`delete-source-${source.sourceId}`}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Source
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * One source rendered as a horizontal band for the "Side-by-side" layout:
 * a fixed-width left column (source identity + 3-dots menu + "Add connection"),
 * vertically centered and divided by a vertical rule from the right side, where
 * the source's connections stack as full-width rows. Each connection reuses the
 * shipped ConnectionRow so status + every action stay consistent. A source with
 * no connections shows an "add connection" call-to-action on the right.
 */
export function SourceRow({
  group,
  syncingIds,
  canSync,
  canEditConnection,
  canDeleteConnection,
  canReset,
  onSync,
  onCancelSync,
  onEditConnection,
  onDeleteConnection,
  onViewHistory,
  onClearStreams,
  onRefreshSchema,
  canCreateConnection,
  canEditSource,
  canDeleteSource,
  onAddConnection,
  onEditSource,
  onDeleteSource,
}: SourceGroupProps) {
  const { source, connections } = group;

  return (
    <div
      className="rounded-lg border bg-white shadow-sm flex items-stretch overflow-hidden"
      data-testid={`source-row-${source.sourceId}`}
    >
      {/* Left column — source identity, vertically centered, vertical divider */}
      <div className="w-64 flex-shrink-0 flex flex-col justify-center gap-3 p-4 border-r">
        <div className="flex items-start justify-between gap-2">
          <SourceIdentity source={source} />
          <SourceMenu
            source={source}
            canEditSource={canEditSource}
            canDeleteSource={canDeleteSource}
            onEditSource={onEditSource}
            onDeleteSource={onDeleteSource}
          />
        </div>
        {canCreateConnection && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddConnection(source)}
            className="self-start border-primary text-primary hover:bg-primary/5"
            data-testid={`add-connection-${source.sourceId}`}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add connection
          </Button>
        )}
      </div>

      {/* Right — connections stacked as full-width rows */}
      <div className="flex-1 min-w-0">
        {connections.length === 0 ? (
          <div className="flex h-full min-h-[80px] items-center px-4 py-6">
            {canCreateConnection ? (
              <button
                type="button"
                onClick={() => onAddConnection(source)}
                className="text-sm text-primary hover:underline"
                data-testid={`add-connection-cta-${source.sourceId}`}
              >
                + Add a connection to start syncing
              </button>
            ) : (
              <span className="text-sm text-gray-400">No connections yet</span>
            )}
          </div>
        ) : (
          <Table className="table-fixed w-full">
            <ConnColGroup />
            <TableBody>
              {connections.map((conn) => (
                <ConnectionRow
                  key={conn.connectionId}
                  conn={conn}
                  syncingIds={syncingIds}
                  canSync={canSync}
                  canEdit={canEditConnection}
                  canDelete={canDeleteConnection}
                  canReset={canReset}
                  hideSourceDestination
                  alignActionsEnd
                  onSync={(setTempSync) => onSync(conn, setTempSync)}
                  onCancelSync={() => onCancelSync(conn)}
                  onEdit={() => onEditConnection(conn)}
                  onDelete={() => onDeleteConnection(conn)}
                  onViewHistory={() => onViewHistory(conn)}
                  onClearStreams={() => onClearStreams(conn)}
                  onRefreshSchema={() => onRefreshSchema(conn)}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
