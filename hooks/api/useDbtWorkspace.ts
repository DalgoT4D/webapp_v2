// hooks/api/useDbtWorkspace.ts
'use client';

import useSWR from 'swr';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import type { DbtWorkspace, DbtWorkspaceFormData } from '@/types/transform';

// Fetch DBT workspace info
export function useDbtWorkspace() {
  return useSWR<DbtWorkspace>('/api/dbt/dbt_workspace', apiGet, {
    revalidateOnFocus: false,
    shouldRetryOnError: false, // Don't retry on 404 (workspace not created yet)
  });
}

// Connect Git repository (mutation)
export async function connectGitRepository(data: DbtWorkspaceFormData) {
  return apiPost('/api/dbt/dbt_workspace', {
    gitrepo_url: data.gitrepoUrl,
    gitrepo_access_token: data.gitrepoAccessToken,
    default_schema: data.defaultSchema,
  });
}

// Update Git repository (mutation)
export async function updateGitRepository(data: DbtWorkspaceFormData) {
  return apiPut('/api/dbt/dbt_workspace', {
    gitrepo_url: data.gitrepoUrl,
    gitrepo_access_token: data.gitrepoAccessToken,
    default_schema: data.defaultSchema,
  });
}

// Update only the default schema (when git repo hasn't changed)
export async function updateSchema(schema: string) {
  return apiPut('/api/dbt/v1/schema/', {
    target_configs_schema: schema,
  });
}

// Connect/update git remote (v1 endpoint used for smart update)
export async function connectGitRemote(gitrepoUrl: string, gitrepoAccessToken: string) {
  return apiPut('/api/dbt/connect_git_remote/', {
    gitrepoUrl,
    gitrepoAccessToken,
  });
}
