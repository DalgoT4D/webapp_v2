import {
  SyncStatus,
  SyncMode,
  DestinationSyncMode,
  SYNC_STATUS_CONFIG,
  SYNC_STATUS_DEFAULT,
} from '@/constants/connections';
import type { StreamColumn, SyncCatalogStream, SourceStream } from '@/types/connections';

export function extractColumnsFromSchema(
  jsonSchema: Record<string, unknown>,
  fieldSelectionEnabled: boolean,
  selectedFields: { fieldPath: string[] }[]
): StreamColumn[] {
  const properties = (jsonSchema?.properties as Record<string, { type?: string | string[] }>) || {};
  const selectedFieldNames = new Set(
    selectedFields?.map((f) => f.fieldPath?.[0]).filter(Boolean) || []
  );

  return Object.entries(properties).map(([name, schema]) => {
    const rawType = Array.isArray(schema?.type)
      ? schema.type.filter((t) => t !== 'null')[0] || 'unknown'
      : schema?.type || 'unknown';

    // Capitalize only known types to match v1 display
    const CAPITALIZED_TYPES: Record<string, string> = {
      string: 'String',
      integer: 'Integer',
      boolean: 'Boolean',
    };
    const dataType = CAPITALIZED_TYPES[rawType] || rawType;

    const selected = fieldSelectionEnabled ? selectedFieldNames.has(name) : true;

    return { name, data_type: dataType, selected };
  });
}

/**
 * Format duration in seconds to human-readable string.
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytesStr: string): string {
  const bytes = parseInt(bytesStr, 10);
  if (isNaN(bytes) || bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitSize = 1024;
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(unitSize));
  const value = bytes / Math.pow(unitSize, unitIndex);

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Get status display info (label, color class) from the centralized config.
 */
export function getStatusInfo(status: string): {
  label: string;
  className: string;
} {
  const config = SYNC_STATUS_CONFIG[status] ?? SYNC_STATUS_DEFAULT;
  return { label: config.label, className: config.colorClass };
}

/**
 * Format a date string for display.
 */
export function formatSyncDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

/**
 * Parse a single catalog stream entry into a SourceStream.
 * Used by both existing-connection loading and schema discovery.
 */
export function parseCatalogStream(
  entry: SyncCatalogStream,
  defaults?: { selected: boolean; syncMode: string; destinationSyncMode: string }
): SourceStream {
  const { stream, config } = entry;
  const columnNames = Object.keys(
    (stream.jsonSchema as { properties?: Record<string, unknown> })?.properties || {}
  );
  const isSourceDefinedCursor = stream.sourceDefinedCursor === true;
  const hasSourceDefinedPK =
    Array.isArray(stream.sourceDefinedPrimaryKey) && stream.sourceDefinedPrimaryKey.length > 0;

  // Cursor: source-defined uses config value, otherwise all columns
  const cursorFieldOptions = isSourceDefinedCursor ? config.cursorField || [] : columnNames;
  const cursorField = isSourceDefinedCursor
    ? config.cursorField?.[0] || ''
    : config.cursorField?.[0] || stream.defaultCursorField?.[0] || '';

  // Primary key: source-defined uses config value, otherwise all columns
  const primaryKeyOptions = hasSourceDefinedPK
    ? (config.primaryKey || []).flat().map((col: string) => [col])
    : columnNames.map((col) => [col]);
  const primaryKey = hasSourceDefinedPK ? config.primaryKey?.flat() || [] : [];

  return {
    name: stream.name,
    supportsIncremental: stream.supportedSyncModes.includes(SyncMode.INCREMENTAL),
    selected: defaults?.selected ?? config.selected,
    syncMode: defaults?.syncMode ?? config.syncMode,
    destinationSyncMode: defaults?.destinationSyncMode ?? config.destinationSyncMode,
    cursorField,
    cursorFieldConfig: {
      sourceDefinedCursor: isSourceDefinedCursor,
      selected: isSourceDefinedCursor
        ? config.cursorField || []
        : config.cursorField || stream.defaultCursorField || [],
      all: cursorFieldOptions,
    },
    primaryKey,
    primaryKeyConfig: {
      sourceDefinedPrimaryKey: hasSourceDefinedPK,
      selected: hasSourceDefinedPK ? config.primaryKey || [] : [],
      all: primaryKeyOptions,
    },
    columns: extractColumnsFromSchema(
      stream.jsonSchema,
      defaults ? false : config.fieldSelectionEnabled,
      defaults ? [] : config.selectedFields
    ),
  };
}
