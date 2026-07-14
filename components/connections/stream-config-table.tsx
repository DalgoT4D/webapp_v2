'use client';

import React from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import type { ComboboxItem } from '@/components/ui/combobox';
import { cn } from '@/lib/utils';
import { SyncMode, DestinationSyncMode } from '@/constants/connections';
import type { SourceStream } from '@/types/connections';
import type { ConnectionConceptId } from './constants';

// Base (always-visible) columns: stream name + sync toggle.
const BASE_COLUMN_COUNT = 2;
// Advanced columns shown for every source when advanced is open: destination
// mode + the per-row column-expand chevron.
const ADVANCED_CORE_COLUMN_COUNT = 2;
// Cursor field + primary key. These are incremental-only concepts, so they show
// only when the source supports incremental sync (e.g. hidden for Google Sheets).
const CURSOR_PK_COLUMN_COUNT = 2;

interface StreamConfigTableProps {
  streams: SourceStream[];
  filteredStreams: SourceStream[];
  allSelected: boolean;
  incrementalAllStreams: boolean;
  expandedStreams: Set<string>;
  streamSearch: string;
  disabled: boolean;
  isSaving: boolean;
  onStreamSearchChange: (value: string) => void;
  onToggleAllStreams: (selected: boolean) => void;
  onIncrementalAllToggle: (checked: boolean) => void;
  onToggleStream: (streamName: string) => void;
  onUpdateStreamSyncMode: (streamName: string, syncMode: string) => void;
  onUpdateStreamDestMode: (streamName: string, destinationSyncMode: string) => void;
  onUpdateStreamCursorField: (streamName: string, cursorField: string) => void;
  onUpdateStreamPrimaryKey: (streamName: string, primaryKey: string[]) => void;
  onToggleStreamExpand: (streamName: string) => void;
  onToggleColumn: (streamName: string, columnName: string) => void;
  // Label used for the stream noun in headings/columns (e.g. "Form", "Sheet").
  streamNoun?: string;
  // Hide the Incremental column entirely (some sources never support it).
  showIncremental?: boolean;
  // Restrict which destination sync modes are selectable for this source.
  allowedDestModes?: DestinationSyncMode[];
  // Fired when a column header is clicked, to move the help panel to that concept.
  onConceptFocus?: (id: ConnectionConceptId | null) => void;
  // Shared advanced-settings expand bar state, owned by the parent form.
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  // Friendly blurb shown under the heading (custom sources only).
  helpText?: string;
}

export function StreamConfigTable({
  streams,
  filteredStreams,
  allSelected,
  incrementalAllStreams,
  expandedStreams,
  streamSearch,
  disabled,
  isSaving,
  onStreamSearchChange,
  onToggleAllStreams,
  onIncrementalAllToggle,
  onToggleStream,
  onUpdateStreamSyncMode,
  onUpdateStreamDestMode,
  onUpdateStreamCursorField,
  onUpdateStreamPrimaryKey,
  onToggleStreamExpand,
  onToggleColumn,
  streamNoun = 'Stream',
  showIncremental = true,
  allowedDestModes = [
    DestinationSyncMode.OVERWRITE,
    DestinationSyncMode.APPEND,
    DestinationSyncMode.APPEND_DEDUP,
  ],
  onConceptFocus,
  advancedOpen,
  onToggleAdvanced,
  helpText,
}: StreamConfigTableProps) {
  const showIncrementalColumn = advancedOpen && showIncremental;
  // Cursor field + primary key are incremental-only; hide them for sources that
  // don't support incremental (e.g. Google Sheets keeps only Sync + Destination).
  const showCursorPkColumns = advancedOpen && showIncremental;
  const isCustom = streamNoun !== 'Stream';
  // Singular, lowercased noun for inline copy: "Stream"→"stream", "Sheets"→"sheet".
  const nounSingular = streamNoun.replace(/s$/i, '').toLowerCase();
  const selectedCount = streams.filter((s) => s.selected).length;

  // A column header that, when clicked, moves the help panel to its concept.
  // Falls back to plain text when no help panel is wired up.
  const conceptLabel = (label: string, concept: ConnectionConceptId) =>
    onConceptFocus ? (
      <button
        type="button"
        onClick={() => onConceptFocus(concept)}
        className="cursor-pointer decoration-dotted underline-offset-2 hover:text-foreground hover:underline"
        data-testid={`concept-header-${concept}`}
      >
        {label}
      </button>
    ) : (
      <>{label}</>
    );
  // Incremental / Destination / Cursor / Primary Key columns (and the
  // per-row column-expand chevron) render only when advanced is open. Cursor +
  // primary key drop out when the source has no incremental support.
  const colCount =
    BASE_COLUMN_COUNT +
    (showIncrementalColumn ? 1 : 0) +
    (advancedOpen ? ADVANCED_CORE_COLUMN_COUNT : 0) +
    (showCursorPkColumns ? CURSOR_PK_COLUMN_COUNT : 0);
  return (
    <div>
      {/* Header with stream count + shared advanced toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {isCustom
            ? `Select your ${streamNoun.toLowerCase()} (${selectedCount}/${streams.length} selected)`
            : `Streams (${selectedCount}/${streams.length} selected)`}
        </h3>
        <button
          type="button"
          onClick={onToggleAdvanced}
          className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
          data-testid="advanced-streams-toggle"
          aria-expanded={advancedOpen}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {isCustom ? `Advanced per-${nounSingular} settings` : 'Advanced per-stream settings'}
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', advancedOpen && 'rotate-180')}
          />
        </button>
      </div>
      {helpText && <p className="mt-1 mb-3 text-xs text-muted-foreground">{helpText}</p>}
      {!helpText && <div className="mb-3" />}

      {/* Fixed-height scroll box: rows scroll internally under the sticky header.
          Kept simple (a plain max-height, no flex fill) so it never collides with
          the Advanced-options section below — that just makes the left column
          scroll. */}
      <div className="max-h-[42vh] overflow-y-auto rounded-md border">
        <table className="w-full text-sm table-fixed" data-testid="streams-table">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[60px]" />
            {showIncrementalColumn && <col className="w-[90px]" />}
            {advancedOpen && <col className="w-[18%]" />}
            {showCursorPkColumns && (
              <>
                <col className="w-[22%]" />
                <col className="w-[22%]" />
              </>
            )}
            {advancedOpen && <col className="w-[40px]" />}
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-muted">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                {conceptLabel(streamNoun, 'stream')}
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                Sync?
              </th>
              {showIncrementalColumn && (
                <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                  {conceptLabel('Incremental?', 'sync-mode')}
                </th>
              )}
              {advancedOpen && (
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  {conceptLabel('Destination', 'dest-mode')}
                </th>
              )}
              {showCursorPkColumns && (
                <>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    {conceptLabel('Cursor Field', 'cursor')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    {conceptLabel('Primary Key', 'primary-key')}
                  </th>
                </>
              )}
              {advancedOpen && <th className="px-3 py-2"></th>}
            </tr>
            {/* Global toggle row */}
            <tr className="border-b bg-muted">
              <td className="px-3 py-1.5">
                <Input
                  placeholder="Filter..."
                  value={streamSearch}
                  onChange={(e) => onStreamSearchChange(e.target.value)}
                  className="w-full h-7 text-xs"
                  data-testid="stream-filter-input"
                />
              </td>
              <td className="px-3 py-1.5 text-center">
                <Switch
                  checked={allSelected}
                  onCheckedChange={onToggleAllStreams}
                  disabled={disabled || isSaving}
                  data-testid="toggle-all-streams"
                  className="scale-90"
                />
              </td>
              {showIncrementalColumn && (
                <td className="px-3 py-1.5 text-center">
                  <Switch
                    checked={incrementalAllStreams}
                    onCheckedChange={onIncrementalAllToggle}
                    disabled={disabled || isSaving || !allSelected}
                    data-testid="toggle-incremental-all"
                    className="scale-90"
                  />
                </td>
              )}
              {advancedOpen && <td className="px-3 py-1.5" />}
              {showCursorPkColumns && (
                <>
                  <td className="px-3 py-1.5" />
                  <td className="px-3 py-1.5" />
                </>
              )}
              {advancedOpen && <td className="px-3 py-1.5" />}
            </tr>
          </thead>
          <tbody>
            {filteredStreams.map((stream) => {
              const isIncremental = stream.syncMode === SyncMode.INCREMENTAL;
              const cursorOptions = stream.cursorFieldConfig?.all || [];
              const primaryKeyOptions = stream.primaryKeyConfig?.all || [];

              // Build combobox items for cursor field
              const cursorItems: ComboboxItem[] = (
                Array.isArray(cursorOptions[0])
                  ? cursorOptions.map((o: string | string[]) => (Array.isArray(o) ? o[0] : o))
                  : cursorOptions
              ).map((field: string) => ({
                value: field,
                label: field,
              }));

              // Build combobox items for primary key
              const pkItems: ComboboxItem[] = primaryKeyOptions.map((pk: string | string[]) => {
                const val = Array.isArray(pk) ? pk[0] : pk;
                return { value: val, label: val };
              });

              const isSelected = stream.selected;
              const isIncrementalChecked =
                stream.supportsIncremental && isIncremental && isSelected;

              // Determine why cursor field is disabled (for tooltip)
              const cursorDisabled =
                disabled ||
                isSaving ||
                !isSelected ||
                !stream.supportsIncremental ||
                !isIncremental ||
                !!stream.cursorFieldConfig?.sourceDefinedCursor;
              const cursorDisabledReason = !isSelected
                ? `Enable sync for this ${nounSingular} first`
                : !stream.supportsIncremental
                  ? 'This source does not support incremental sync'
                  : !isIncremental
                    ? 'Switch to incremental sync mode to set a cursor field'
                    : stream.cursorFieldConfig?.sourceDefinedCursor
                      ? 'Cursor field is defined by the source and cannot be changed'
                      : '';

              // Determine why primary key is disabled (for tooltip)
              const pkDisabled =
                disabled ||
                isSaving ||
                !isSelected ||
                !stream.supportsIncremental ||
                !isIncremental ||
                stream.destinationSyncMode !== DestinationSyncMode.APPEND_DEDUP ||
                !!stream.primaryKeyConfig?.sourceDefinedPrimaryKey;
              const pkDisabledReason = !isSelected
                ? `Enable sync for this ${nounSingular} first`
                : !stream.supportsIncremental
                  ? 'This source does not support incremental sync'
                  : !isIncremental
                    ? 'Switch to incremental sync mode to set a primary key'
                    : stream.destinationSyncMode !== DestinationSyncMode.APPEND_DEDUP
                      ? 'Set destination mode to Append / Dedup to configure a primary key'
                      : stream.primaryKeyConfig?.sourceDefinedPrimaryKey
                        ? 'Primary key is defined by the source and cannot be changed'
                        : '';

              return (
                <React.Fragment key={stream.name}>
                  <tr
                    className="border-b last:border-b-0"
                    data-testid={`stream-row-${stream.name}`}
                  >
                    {/* Stream name */}
                    <td className="px-3 py-3">
                      <span className="text-xs font-medium text-foreground">{stream.name}</span>
                    </td>
                    {/* Sync toggle */}
                    <td className="px-3 py-3 text-center">
                      <Switch
                        checked={isSelected}
                        onCheckedChange={() => onToggleStream(stream.name)}
                        disabled={disabled || isSaving}
                        data-testid={`stream-toggle-${stream.name}`}
                        className="scale-90"
                      />
                    </td>
                    {/* Incremental toggle */}
                    {showIncrementalColumn && (
                      <td className="px-3 py-3 text-center">
                        <Switch
                          checked={isIncrementalChecked}
                          onCheckedChange={(checked) => {
                            onUpdateStreamSyncMode(
                              stream.name,
                              checked ? SyncMode.INCREMENTAL : SyncMode.FULL_REFRESH
                            );
                          }}
                          disabled={
                            disabled || isSaving || !isSelected || !stream.supportsIncremental
                          }
                          data-testid={`stream-incremental-${stream.name}`}
                          className="scale-90"
                        />
                      </td>
                    )}
                    {/* Destination mode */}
                    {advancedOpen && (
                      <td className="px-3 py-3">
                        <Select
                          value={stream.destinationSyncMode}
                          onValueChange={(v) => onUpdateStreamDestMode(stream.name, v)}
                          disabled={disabled || isSaving || !isSelected}
                        >
                          <SelectTrigger className="h-7 text-xs w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {allowedDestModes.includes(DestinationSyncMode.OVERWRITE) && (
                              <SelectItem
                                value={DestinationSyncMode.OVERWRITE}
                                disabled={isIncremental}
                              >
                                Overwrite
                              </SelectItem>
                            )}
                            {allowedDestModes.includes(DestinationSyncMode.APPEND) && (
                              <SelectItem value={DestinationSyncMode.APPEND}>Append</SelectItem>
                            )}
                            {allowedDestModes.includes(DestinationSyncMode.APPEND_DEDUP) && (
                              <SelectItem value={DestinationSyncMode.APPEND_DEDUP}>
                                Append / Dedup
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </td>
                    )}
                    {/* Cursor Field + Primary Key — incremental-only, hidden for
                        sources without incremental support (e.g. Google Sheets) */}
                    {showCursorPkColumns && (
                      <>
                        <td className="px-3 py-3 overflow-visible">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Combobox
                                    mode="single"
                                    items={cursorItems}
                                    value={stream.cursorField || ''}
                                    onValueChange={(v) => onUpdateStreamCursorField(stream.name, v)}
                                    disabled={cursorDisabled}
                                    placeholder="Select..."
                                    searchPlaceholder="Search..."
                                    compact
                                    id={`cursor-${stream.name}`}
                                    className="w-full"
                                  />
                                </div>
                              </TooltipTrigger>
                              {cursorDisabled && cursorDisabledReason && (
                                <TooltipContent side="top">
                                  <p className="text-xs">{cursorDisabledReason}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                        {/* Primary Key — always show, disabled when not incremental+append_dedup */}
                        <td className="px-3 py-3 overflow-visible">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Combobox
                                    mode="multi"
                                    items={pkItems}
                                    values={stream.primaryKey || []}
                                    onValuesChange={(vals) =>
                                      onUpdateStreamPrimaryKey(stream.name, vals)
                                    }
                                    disabled={pkDisabled}
                                    searchPlaceholder="Select keys..."
                                    compact
                                    id={`pk-${stream.name}`}
                                    triggerClassName="min-h-[28px]"
                                    className="w-full"
                                  />
                                </div>
                              </TooltipTrigger>
                              {pkDisabled && pkDisabledReason && (
                                <TooltipContent side="top">
                                  <p className="text-xs">{pkDisabledReason}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                      </>
                    )}
                    {/* Column expand */}
                    {advancedOpen && (
                      <td className="px-1 py-3 text-center">
                        {stream.columns.length > 0 && (
                          <button
                            type="button"
                            onClick={() => isSelected && onToggleStreamExpand(stream.name)}
                            disabled={!isSelected}
                            className="p-1 hover:bg-gray-100 rounded cursor-pointer disabled:opacity-30 disabled:cursor-default"
                            data-testid={`expand-columns-${stream.name}`}
                            aria-label="Toggle columns"
                          >
                            <ChevronDown
                              className={`h-4 w-4 text-gray-500 transition-transform ${
                                expandedStreams.has(stream.name) ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                  {/* Expanded column selection — vertical list */}
                  {advancedOpen &&
                    expandedStreams.has(stream.name) &&
                    isSelected &&
                    stream.columns.length > 0 && (
                      <tr key={`cols-${stream.name}`} className="bg-muted/30">
                        <td colSpan={colCount} className="px-4 py-2">
                          <table className="w-full">
                            <tbody>
                              {stream.columns.map((col) => {
                                const isCursorField = stream.cursorField === col.name;
                                const isPrimaryKey = stream.primaryKey?.includes(col.name);
                                const isProtected = isCursorField || isPrimaryKey;

                                return (
                                  <tr
                                    key={col.name}
                                    className="border-b last:border-b-0 border-muted"
                                  >
                                    <td className="py-1.5 px-2 w-10">
                                      <Switch
                                        checked={col.selected}
                                        onCheckedChange={() =>
                                          onToggleColumn(stream.name, col.name)
                                        }
                                        disabled={disabled || isSaving || isProtected}
                                        className="scale-75"
                                        data-testid={`col-toggle-${stream.name}-${col.name}`}
                                      />
                                    </td>
                                    <td className="py-1.5 px-2">
                                      <span
                                        className={`text-xs ${
                                          isProtected ? 'text-muted-foreground' : 'text-foreground'
                                        }`}
                                      >
                                        {col.name}
                                      </span>
                                    </td>
                                    <td className="py-1.5 px-2 text-right">
                                      <span className="text-xs text-muted-foreground">
                                        {col.data_type}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
