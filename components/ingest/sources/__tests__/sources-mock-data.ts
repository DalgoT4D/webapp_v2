/**
 * Mock Data Factories for Ingest Sources Tests
 */

import type { Source, SourceDefinition } from '@/types/sources';

export const createMockSource = (overrides: Partial<Source> = {}): Source => ({
  sourceId: 'src-1',
  name: 'My Postgres Source',
  sourceDefinitionId: 'def-1',
  sourceName: 'Postgres',
  connectionConfiguration: {},
  ...overrides,
});

export const createMockDefinition = (
  overrides: Partial<SourceDefinition> = {}
): SourceDefinition => ({
  sourceDefinitionId: 'def-1',
  name: 'Postgres',
  dockerRepository: 'airbyte/source-postgres',
  dockerImageTag: '0.4.28',
  ...overrides,
});
