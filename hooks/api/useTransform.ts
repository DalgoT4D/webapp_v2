// hooks/api/useTransform.ts
'use client';

import useSWR from 'swr';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import type { TransformTypeResponse } from '@/types/transform';

export enum TransformTypeEnum {
  GITHUB = 'github',
  UI = 'ui',
}

// Fetch raw SWR response for transform type
export function useTransformTypeSWR() {
  return useSWR<TransformTypeResponse>('/api/dbt/dbt_transform/', apiGet, {
    revalidateOnFocus: false,
  });
}

// Convenience hook with derived booleans
export function useTransformType() {
  const { data, error, isLoading, mutate } = useTransformTypeSWR();

  return {
    data,
    transformType: data?.transform_type,
    isUI: data?.transform_type === TransformTypeEnum.UI,
    isGithub: data?.transform_type === TransformTypeEnum.GITHUB,
    isLoading,
    isError: !!error,
    mutate,
  };
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
