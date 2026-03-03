// hooks/api/useTransform.ts
'use client';

import useSWR from 'swr';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import type { TransformTypeResponse } from '@/types/transform';

// Fetch transform type
export function useTransformType() {
  return useSWR<TransformTypeResponse>('/api/dbt/dbt_transform/', apiGet, {
    revalidateOnFocus: false,
  });
}

// Setup workspace (mutation)
export async function setupTransformWorkspace(defaultSchema: string = 'intermediate') {
  return apiPost('/api/transform/dbt_project/', { default_schema: defaultSchema });
}

// Create transform tasks (mutation)
export async function createTransformTasks() {
  return apiPost('/api/prefect/tasks/transform/', {});
}

// Sync sources (mutation)
export async function syncSources() {
  return apiPost('/api/transform/dbt_project/sync_sources/', {});
}

// Delete DBT repo (cleanup mutation)
export async function deleteDbtRepo() {
  return apiDelete('/api/transform/dbt_project/dbtrepo');
}
