/**
 * Mock Data Factories for Ingest Warehouse Tests
 */

import type { Warehouse } from '@/types/warehouse';

export const mockDefinition = {
  destinationDefinitionId: 'destdef-1',
  name: 'Postgres',
  icon: '',
  dockerRepository: 'airbyte/destination-postgres',
  dockerImageTag: '0.5.0',
};

export const createMockWarehouse = (overrides: Partial<Warehouse> = {}): Warehouse => ({
  wtype: 'postgres',
  name: 'My Warehouse',
  destinationId: 'dest-1',
  destinationDefinitionId: 'destdef-1',
  icon: '',
  airbyteDockerRepository: 'airbyte/destination-postgres',
  tag: '0.5.0',
  connectionConfiguration: {
    host: 'db.example.com',
    port: 5432,
    database: 'mydb',
    username: 'admin',
  },
  ...overrides,
});
