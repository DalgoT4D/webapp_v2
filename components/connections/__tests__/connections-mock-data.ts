/**
 * Mock Data Factories for Connections Tests
 */

import type { Connection, SchemaChange } from '@/types/connection';

export const createMockConnection = (overrides: Partial<Connection> = {}): Connection => ({
  connectionId: 'conn-1',
  name: 'My Connection',
  deploymentId: 'deploy-1',
  catalogId: 'catalog-1',
  source: { sourceId: 'src-1', name: 'Prod DB', sourceName: 'Postgres' },
  destination: { destinationId: 'dest-1', name: 'Warehouse', destinationName: 'BigQuery' },
  lock: null,
  lastRun: null,
  normalize: false,
  status: 'active',
  syncCatalog: { streams: [] },
  destinationSchema: 'staging',
  resetConnDeploymentId: null,
  clearConnDeploymentId: null,
  queuedFlowRunWaitTime: null,
  blockId: 'block-1',
  ...overrides,
});

export const createMockSchemaChange = (overrides: Partial<SchemaChange> = {}): SchemaChange => ({
  connection_id: 'conn-1',
  change_type: 'non_breaking',
  ...overrides,
});
