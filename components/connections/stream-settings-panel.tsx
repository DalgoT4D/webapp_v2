'use client';

import { ChevronDown, ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CAST_TYPE_OPTIONS, DestinationSyncMode, SyncMode } from '@/constants/connections';
import type { SourceStream } from '@/types/connections';

interface StreamSettingsPanelProps {
  stream: SourceStream;
  disabled: boolean;
  isSaving: boolean;
  columnsOpen: boolean;
  showCastColumn?: boolean;
  showIncremental?: boolean;
  allowedDestModes?: DestinationSyncMode[];
  onClose: () => void;
  onUpdateStreamSyncMode: (streamName: string, syncMode: string) => void;
  onUpdateStreamDestMode: (streamName: string, destinationSyncMode: string) => void;
  onUpdateStreamCursorField: (streamName: string, cursorField: string) => void;
  onUpdateStreamPrimaryKey: (streamName: string, primaryKey: string[]) => void;
  onToggleColumns: (streamName: string) => void;
  onToggleColumn: (streamName: string, columnName: string) => void;
  onUpdateCastType: (streamName: string, columnName: string, castType: string | null) => void;
}

interface SettingsRowProps {
  label: string;
  description: string;
  children: ReactNode;
}

function SettingsRow({ label, description, children }: SettingsRowProps) {
  return (
    <div className="grid gap-3 border-b px-5 py-5 lg:grid-cols-[140px_minmax(180px,230px)_minmax(220px,1fr)] lg:items-center">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div>{children}</div>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

export function StreamSettingsPanel({
  stream,
  disabled,
  isSaving,
  columnsOpen,
  showCastColumn = false,
  showIncremental = true,
  allowedDestModes = [
    DestinationSyncMode.OVERWRITE,
    DestinationSyncMode.APPEND,
    DestinationSyncMode.APPEND_DEDUP,
  ],
  onClose,
  onUpdateStreamSyncMode,
  onUpdateStreamDestMode,
  onUpdateStreamCursorField,
  onUpdateStreamPrimaryKey,
  onToggleColumns,
  onToggleColumn,
  onUpdateCastType,
}: StreamSettingsPanelProps) {
  const isIncremental = stream.syncMode === SyncMode.INCREMENTAL;
  const isBusy = disabled || isSaving || !stream.selected;
  const cursorOptions = stream.cursorFieldConfig?.all ?? [];
  const primaryKeyOptions = stream.primaryKeyConfig?.all ?? [];

  const cursorItems: ComboboxItem[] = (
    Array.isArray(cursorOptions[0])
      ? cursorOptions.map((option: string | string[]) =>
          Array.isArray(option) ? option[0] : option
        )
      : cursorOptions
  ).map((field: string) => ({ value: field, label: field }));

  const primaryKeyItems: ComboboxItem[] = primaryKeyOptions.map((option: string | string[]) => {
    const field = Array.isArray(option) ? option[0] : option;
    return { value: field, label: field };
  });

  const cursorDisabled =
    isBusy ||
    !stream.supportsIncremental ||
    !isIncremental ||
    !!stream.cursorFieldConfig?.sourceDefinedCursor;
  const cursorDisabledReason = !stream.supportsIncremental
    ? 'This source does not support incremental sync'
    : !isIncremental
      ? 'Turn on incremental sync first'
      : stream.cursorFieldConfig?.sourceDefinedCursor
        ? 'The source defines this cursor field'
        : '';

  const primaryKeyDisabled =
    isBusy ||
    !stream.supportsIncremental ||
    !isIncremental ||
    stream.destinationSyncMode !== DestinationSyncMode.APPEND_DEDUP ||
    !!stream.primaryKeyConfig?.sourceDefinedPrimaryKey;
  const primaryKeyDisabledReason = !isIncremental
    ? 'Turn on incremental sync first'
    : stream.destinationSyncMode !== DestinationSyncMode.APPEND_DEDUP
      ? 'Choose Append + Dedup first'
      : stream.primaryKeyConfig?.sourceDefinedPrimaryKey
        ? 'The source defines this primary key'
        : '';

  const selectedColumnCount = stream.columns.filter((column) => column.selected).length;

  return (
    <aside
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-background"
      data-testid="stream-settings-panel"
    >
      <div className="flex flex-shrink-0 items-start gap-3 border-b px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close advanced settings"
          data-testid="close-stream-settings"
          className="mt-0.5 inline-flex size-8 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-foreground">Advanced settings</h3>
          <p className="truncate text-sm text-muted-foreground" data-testid="settings-stream-name">
            {stream.name}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" data-testid="stream-settings-scroll-area">
        {showIncremental && (
          <SettingsRow
            label="Incremental"
            description="Only bring in records added or changed since the last sync."
          >
            <Switch
              id={`stream-incremental-${stream.name}`}
              checked={stream.supportsIncremental && isIncremental}
              onCheckedChange={(checked) =>
                onUpdateStreamSyncMode(
                  stream.name,
                  checked ? SyncMode.INCREMENTAL : SyncMode.FULL_REFRESH
                )
              }
              disabled={isBusy || !stream.supportsIncremental}
              aria-label={`Use incremental sync for ${stream.name}`}
              data-testid={`stream-incremental-${stream.name}`}
            />
          </SettingsRow>
        )}

        <SettingsRow
          label="Destination"
          description="Choose whether new data is added or replaces the existing table."
        >
          <Select
            value={stream.destinationSyncMode}
            onValueChange={(value) => onUpdateStreamDestMode(stream.name, value)}
            disabled={isBusy}
          >
            <SelectTrigger
              id={`stream-destination-${stream.name}`}
              className="h-9 w-full text-sm"
              aria-label={`Destination mode for ${stream.name}`}
              data-testid={`stream-destination-${stream.name}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedDestModes.includes(DestinationSyncMode.OVERWRITE) && (
                <SelectItem value={DestinationSyncMode.OVERWRITE} disabled={isIncremental}>
                  Overwrite
                </SelectItem>
              )}
              {allowedDestModes.includes(DestinationSyncMode.APPEND) && (
                <SelectItem value={DestinationSyncMode.APPEND}>Append</SelectItem>
              )}
              {allowedDestModes.includes(DestinationSyncMode.APPEND_DEDUP) && (
                <SelectItem value={DestinationSyncMode.APPEND_DEDUP}>Append + Dedup</SelectItem>
              )}
            </SelectContent>
          </Select>
        </SettingsRow>

        {showIncremental && (
          <>
            <SettingsRow
              label="Cursor field"
              description="The field Dalgo uses to identify newer records."
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Combobox
                        mode="single"
                        items={cursorItems}
                        value={stream.cursorField || ''}
                        onValueChange={(value) => onUpdateStreamCursorField(stream.name, value)}
                        disabled={cursorDisabled}
                        placeholder="Select field"
                        searchPlaceholder="Search fields..."
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
            </SettingsRow>

            <SettingsRow
              label="Primary key"
              description="The field that uniquely identifies each record."
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Combobox
                        mode="multi"
                        items={primaryKeyItems}
                        values={stream.primaryKey ?? []}
                        onValuesChange={(values) => onUpdateStreamPrimaryKey(stream.name, values)}
                        disabled={primaryKeyDisabled}
                        searchPlaceholder="Select keys..."
                        compact
                        id={`pk-${stream.name}`}
                        triggerClassName="h-9 !min-h-0 !flex-nowrap overflow-hidden"
                        className="w-full"
                      />
                    </div>
                  </TooltipTrigger>
                  {primaryKeyDisabled && primaryKeyDisabledReason && (
                    <TooltipContent side="top">
                      <p className="text-xs">{primaryKeyDisabledReason}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </SettingsRow>
          </>
        )}

        <div>
          <button
            type="button"
            onClick={() => onToggleColumns(stream.name)}
            aria-expanded={columnsOpen}
            aria-controls={`stream-columns-${stream.name}`}
            data-testid={`toggle-stream-columns-${stream.name}`}
            className="grid w-full gap-3 border-b px-5 py-5 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:grid-cols-[140px_minmax(180px,230px)_minmax(220px,1fr)] lg:items-center"
          >
            <span className="text-sm font-medium text-foreground">Columns</span>
            <span className="flex items-center justify-between gap-3 text-sm text-foreground">
              {selectedColumnCount} selected
              <ChevronDown
                className={cn(
                  'h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform',
                  columnsOpen && 'rotate-180'
                )}
                aria-hidden="true"
              />
            </span>
            <span className="text-sm leading-relaxed text-muted-foreground">
              Choose which source fields arrive in your warehouse.
            </span>
          </button>

          {columnsOpen && (
            <div id={`stream-columns-${stream.name}`} className="px-5 pb-5">
              {showCastColumn && (
                <p className="mb-3 mt-4 text-xs leading-relaxed text-muted-foreground">
                  Cast to converts the value in your warehouse after each sync. Leave it blank to
                  keep the detected type.
                </p>
              )}
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[540px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-muted-foreground">
                      <th className="w-20 px-3 py-2 text-left text-xs font-medium">Include</th>
                      <th className="px-3 py-2 text-left text-xs font-medium">Column</th>
                      <th className="w-32 px-3 py-2 text-left text-xs font-medium">Type</th>
                      {showCastColumn && (
                        <th className="w-40 px-3 py-2 text-left text-xs font-medium">Cast to</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {stream.columns.map((column) => {
                      const isProtected =
                        stream.cursorField === column.name ||
                        stream.primaryKey?.includes(column.name);
                      return (
                        <tr key={column.name} className="border-b last:border-b-0">
                          <td className="px-3 py-2.5">
                            <Switch
                              id={`column-${stream.name}-${column.name}`}
                              checked={column.selected}
                              onCheckedChange={() => onToggleColumn(stream.name, column.name)}
                              disabled={isBusy || isProtected}
                              aria-label={`Include ${column.name}`}
                              data-testid={`col-toggle-${stream.name}-${column.name}`}
                              className="scale-75"
                            />
                          </td>
                          <td className="max-w-[260px] truncate px-3 py-2.5 text-xs font-medium">
                            {column.name}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">
                            {column.data_type}
                          </td>
                          {showCastColumn && (
                            <td className="px-3 py-2">
                              <Select
                                value={column.cast_to_type ?? '__none__'}
                                onValueChange={(value) =>
                                  onUpdateCastType(
                                    stream.name,
                                    column.name,
                                    value === '__none__' ? null : value
                                  )
                                }
                                disabled={isBusy || !column.selected}
                              >
                                <SelectTrigger
                                  className="h-8 w-full text-xs"
                                  aria-label={`Cast ${column.name} to`}
                                  data-testid={`cast-column-${stream.name}-${column.name}`}
                                >
                                  <SelectValue placeholder="Keep detected type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Keep detected type</SelectItem>
                                  {CAST_TYPE_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
