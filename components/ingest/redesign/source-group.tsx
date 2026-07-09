'use client';

import { Plus, MoreVertical, Pencil, Trash2, Plug } from 'lucide-react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
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
import { SourceRollup } from '@/components/ingest/redesign/source-rollup';
import { summarizeGroup, type SourceGroupData } from '@/components/ingest/redesign/utils';
import type { Connection } from '@/types/connections';
import type { Source } from '@/types/source';

// Shared connection-table column widths. Applied identically to every source
// group so connection rows line up across the whole page (name | status |
// actions). The Source → Destination column is dropped inside groups — the
// source is the group header and the destination is the org's one warehouse.
const CONNECTION_COLUMNS = {
  name: '50%',
  status: '32%',
  actions: '18%',
} as const;

// Shared column template applied to both the source header table and the
// connection table so every cell lines up in one grid down the whole group.
export function ConnColGroup() {
  return (
    <colgroup>
      <col style={{ width: CONNECTION_COLUMNS.name }} />
      <col style={{ width: CONNECTION_COLUMNS.status }} />
      <col style={{ width: CONNECTION_COLUMNS.actions }} />
    </colgroup>
  );
}

export interface SourceGroupProps {
  group: SourceGroupData;
  // Connection permissions + action wiring (passed straight to ConnectionRow)
  syncingIds: string[];
  canSync: boolean;
  canEditConnection: boolean;
  canDeleteConnection: boolean;
  canReset: boolean;
  onSync: (conn: Connection, setTempSync: (v: boolean) => void) => void;
  onCancelSync: (conn: Connection) => void;
  onEditConnection: (conn: Connection) => void;
  onDeleteConnection: (conn: Connection) => void;
  onViewHistory: (conn: Connection) => void;
  onClearStreams: (conn: Connection) => void;
  onRefreshSchema: (conn: Connection) => void;
  // Source permissions + actions
  canCreateConnection: boolean;
  canEditSource: boolean;
  canDeleteSource: boolean;
  onAddConnection: (source: Source) => void;
  onEditSource: (source: Source) => void;
  onDeleteSource: (source: Source) => void;
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
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Source
        </span>
        <p className="font-medium text-lg text-gray-900 truncate leading-tight">{source.name}</p>
        <p className="text-sm text-gray-500 truncate">{source.sourceName}</p>
      </div>
    </div>
  );
}

interface SourceMenuProps {
  source: Source;
  canEditSource: boolean;
  canDeleteSource: boolean;
  onEditSource: (source: Source) => void;
  onDeleteSource: (source: Source) => void;
}

function SourceMenu({
  source,
  canEditSource,
  canDeleteSource,
  onEditSource,
  onDeleteSource,
}: SourceMenuProps) {
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
 * One source, rendered by a consistent rule:
 *   - 0 connections → a plain card row with an "Add a connection" call-to-action
 *   - ≥1 connection → a collapsible group (open by default) whose header shows a
 *     rollup health summary and whose body is the reused connection table.
 */
export function SourceGroup(props: SourceGroupProps) {
  const {
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
  } = props;
  const { source, connections } = group;

  const addConnectionButton = canCreateConnection ? (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onAddConnection(source)}
      className="border-primary text-primary hover:bg-primary/5"
      data-testid={`add-connection-${source.sourceId}`}
    >
      <Plus className="h-4 w-4 mr-1" />
      Add
    </Button>
  ) : null;

  const headerActions = (
    <div className="flex items-center justify-end gap-2">
      {addConnectionButton}
      <SourceMenu
        source={source}
        canEditSource={canEditSource}
        canDeleteSource={canDeleteSource}
        onEditSource={onEditSource}
        onDeleteSource={onDeleteSource}
      />
    </div>
  );

  // ---- 0 connections: plain card row (same 3-column grid) ----
  if (connections.length === 0) {
    return (
      <div
        className="rounded-lg border bg-gray-50 shadow-sm px-2"
        data-testid={`source-group-${source.sourceId}`}
      >
        <table className="table-fixed w-full">
          <ConnColGroup />
          <tbody>
            <tr>
              <td className="p-2 align-middle">
                <SourceIdentity source={source} />
              </td>
              <td className="p-2 align-middle">
                <span className="text-sm text-gray-400">No connections yet</span>
              </td>
              <td className="p-2 align-middle">{headerActions}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // ---- ≥1 connection: collapsible group, open by default ----
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={source.sourceId}
      className="rounded-lg border bg-white shadow-sm"
      data-testid={`source-group-${source.sourceId}`}
    >
      <AccordionItem value={source.sourceId} className="border-b-0">
        {/* Shaded header reads as a section title; shares the exact same grid
            as the connection rows below so columns line up. */}
        <div className="px-2 bg-gray-50 rounded-t-lg">
          <table className="table-fixed w-full">
            <ConnColGroup />
            <tbody>
              <tr>
                <td className="p-2 align-middle">
                  <AccordionTrigger className="justify-start gap-3 py-1 hover:no-underline">
                    <SourceIdentity source={source} />
                  </AccordionTrigger>
                </td>
                <td className="p-2 align-middle">
                  <SourceRollup summary={summarizeGroup(connections)} />
                </td>
                <td className="p-2 align-middle">{headerActions}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <AccordionContent className="p-0">
          <div className="border-t px-2">
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
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
