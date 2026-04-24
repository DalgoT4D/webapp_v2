'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
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
import { SyncMode, DestinationSyncMode } from '@/constants/connections';
import type { SourceStream } from '@/types/connections';

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
}: StreamConfigTableProps) {
  return (
    <div>
      {/* Header with stream count */}
      <div className="mb-3">
        <h3 className="text-sm font-semibold">
          Streams ({streams.filter((s) => s.selected).length}/{streams.length} selected)
        </h3>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm table-fixed" data-testid="streams-table">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[60px]" />
            <col className="w-[90px]" />
            <col className="w-[18%]" />
            <col className="w-[22%]" />
            <col className="w-[22%]" />
            <col className="w-[40px]" />
          </colgroup>
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Stream
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                Sync?
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                Incremental?
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Destination
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Cursor Field
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Primary Key
              </th>
              <th className="px-3 py-2"></th>
            </tr>
            {/* Global toggle row */}
            <tr className="border-b bg-muted/30">
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
              <td className="px-3 py-1.5 text-center">
                <Switch
                  checked={incrementalAllStreams}
                  onCheckedChange={onIncrementalAllToggle}
                  disabled={disabled || isSaving || !allSelected}
                  data-testid="toggle-incremental-all"
                  className="scale-90"
                />
              </td>
              <td className="px-3 py-1.5" />
              <td className="px-3 py-1.5" />
              <td className="px-3 py-1.5" />
              <td className="px-3 py-1.5" />
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
                ? 'Enable sync for this stream first'
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
                ? 'Enable sync for this stream first'
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
                    {/* Destination mode */}
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
                          <SelectItem
                            value={DestinationSyncMode.OVERWRITE}
                            disabled={isIncremental}
                          >
                            Overwrite
                          </SelectItem>
                          <SelectItem value={DestinationSyncMode.APPEND}>Append</SelectItem>
                          <SelectItem value={DestinationSyncMode.APPEND_DEDUP}>
                            Append / Dedup
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    {/* Cursor Field — always show, disabled when not incremental */}
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
                    {/* Column expand */}
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
                  </tr>
                  {/* Expanded column selection — vertical list */}
                  {expandedStreams.has(stream.name) && isSelected && stream.columns.length > 0 && (
                    <tr key={`cols-${stream.name}`} className="bg-muted/30">
                      <td colSpan={7} className="px-4 py-2">
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
                                      onCheckedChange={() => onToggleColumn(stream.name, col.name)}
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
