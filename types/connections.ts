// Shared types — canonical definitions in types/common.ts
import type { TaskLock, QueuedRuntimeInfo } from '@/types/common';
export type { TaskLock, QueuedRuntimeInfo };

// ============ Core Connection Types ============

export interface Connection {
  name: string;
  connectionId: string;
  deploymentId: string;
  catalogId: string;
  destination: ConnectionDestination;
  source: ConnectionSource;
  lock: TaskLock | null;
  lastRun: ConnectionLastRun | null;
  normalize: boolean;
  status: string;
  syncCatalog: SyncCatalog;
  destinationSchema?: string;
  resetConnDeploymentId: string | null;
  clearConnDeploymentId: string | null;
  queuedFlowRunWaitTime: QueuedRuntimeInfo | null;
  blockId: string;
}

export interface ConnectionSource {
  sourceId: string;
  name: string;
  sourceName: string;
  icon?: string;
}

export interface ConnectionDestination {
  destinationId: string;
  name: string;
  destinationName: string;
  icon?: string;
}

export interface ConnectionLastRun {
  job_id: number;
  status: string;
  startTime: string;
  last_attempt_no: number;
}

// ============ Stream Configuration Types ============

export interface SourceStream {
  name: string;
  supportsIncremental: boolean;
  selected: boolean;
  syncMode: string;
  destinationSyncMode: string;
  cursorField: string;
  cursorFieldConfig: CursorFieldConfig;
  primaryKey: string[];
  primaryKeyConfig: PrimaryKeyConfig;
  columns: StreamColumn[];
}

export interface CursorFieldConfig {
  sourceDefinedCursor: boolean;
  selected: string[];
  all: string[];
}

export interface PrimaryKeyConfig {
  sourceDefinedPrimaryKey: boolean;
  selected: string[][];
  all: string[][];
}

export interface StreamColumn {
  name: string;
  data_type: string;
  selected: boolean;
}

// ============ Sync Catalog Types ============

export interface SyncCatalog {
  streams: SyncCatalogStream[];
}

export interface SyncCatalogStream {
  stream: {
    name: string;
    namespace?: string;
    jsonSchema: Record<string, unknown>;
    supportedSyncModes: string[];
    sourceDefinedCursor: boolean;
    defaultCursorField: string[];
    sourceDefinedPrimaryKey: string[][];
  };
  config: {
    syncMode: string;
    destinationSyncMode: string;
    cursorField: string[];
    primaryKey: string[][];
    selected: boolean;
    fieldSelectionEnabled: boolean;
    selectedFields: { fieldPath: string[] }[];
  };
}

// ============ Sync History Types ============

export interface ConnectionSyncJob {
  job_type: 'sync' | 'reset_connection';
  last_attempt_no: number;
  bytes_committed: string;
  created_at: string;
  job_id: number;
  logs: string[];
  records_committed: number;
  status: string;
  duration_seconds: number;
  reset_config: unknown | null;
}

// ============ Schema Change Types ============

// Matches the `OrgSchemaChange` model dict returned by
// GET /api/airbyte/v1/connection/schema_change (snake_case from Django)
export interface SchemaChange {
  connection_id: string;
  change_type: string; // e.g. 'breaking' | 'non_breaking'
  created_at?: string;
  updated_at?: string;
  schedule_job?: number | null;
}

export interface CatalogDiff {
  transforms: CatalogTransform[];
}

export interface CatalogTransform {
  transformType: 'add_stream' | 'remove_stream' | 'update_stream';
  streamDescriptor: { name: string; namespace?: string };
  updateStream?: StreamTransform[];
}

export interface StreamTransform {
  transformType: 'add_field' | 'remove_field' | 'update_field_schema';
  fieldName: string[];
  updateFieldSchema?: { oldSchema: unknown; newSchema: unknown };
}

// ============ Other Types ============

export interface ClearStreamData {
  streamName: string;
  streamNamespace?: string;
  selected: boolean;
}

export interface SchemaDiscoveryResponse {
  data: {
    result: {
      catalog: SyncCatalog;
      catalogId: string;
    };
  };
  message: string;
  status: string;
}
