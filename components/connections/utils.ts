import { SyncStatus } from '@/constants/connections';
import type { StreamColumn } from '@/types/connections';

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
 * Get status display info (label, color class).
 */
export function getStatusInfo(status: string): {
  label: string;
  className: string;
} {
  switch (status) {
    case SyncStatus.SUCCESS:
      return { label: 'Success', className: 'text-green-600' };
    case SyncStatus.FAILED:
      return { label: 'Failed', className: 'text-red-600' };
    case SyncStatus.CANCELLED:
      return { label: 'Cancelled', className: 'text-yellow-600' };
    case SyncStatus.RUNNING:
      return { label: 'Running', className: 'text-blue-600' };
    case SyncStatus.QUEUED:
      return { label: 'Queued', className: 'text-gray-500' };
    default:
      return { label: status, className: 'text-muted-foreground' };
  }
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
