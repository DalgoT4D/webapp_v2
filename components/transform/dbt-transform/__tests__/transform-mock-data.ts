/**
 * Mock Data Factories for Transform Tests
 */

import type { TransformTask } from '@/types/transform';

export const createMockTask = (overrides: Partial<TransformTask> = {}): TransformTask => ({
  uuid: 'task-1',
  label: 'DBT Run',
  command: 'dbt run',
  slug: 'dbt-run',
  type: 'dbt',
  deploymentId: 'deploy-1',
  deploymentName: 'dbt-run-deployment',
  generated_by: 'client',
  lock: null,
  ...overrides,
});
