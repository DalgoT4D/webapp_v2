// hooks/api/useCanvasSources.ts
'use client';

import useSWR, { KeyedMutator } from 'swr';
import { useState, useCallback, useMemo } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import type { DbtModelResponse } from '@/types/transform';

// Stable empty array to prevent infinite loops
const EMPTY_SOURCES: DbtModelResponse[] = [];

const SOURCES_KEY = '/api/transform/v2/dbt_project/sources_models/';
const SYNC_ENDPOINT = '/api/transform/dbt_project/sync_sources/';

interface SyncSourcesResponse {
  task_id: string;
  hashkey: string;
}

interface UseCanvasSourcesReturn {
  /** List of available sources and models */
  sourcesModels: DbtModelResponse[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Syncing sources state */
  isSyncing: boolean;
  /** Refresh the list */
  refresh: () => Promise<void>;
  /** Sync sources from warehouse (starts background task) */
  syncSources: () => Promise<{ taskId: string; hashKey: string }>;
  /** Mutate cache */
  mutate: KeyedMutator<DbtModelResponse[]>;
}

export function useCanvasSources(): UseCanvasSourcesReturn {
  const [isSyncing, setIsSyncing] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<DbtModelResponse[]>(SOURCES_KEY, apiGet, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  });

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const syncSources = useCallback(async () => {
    setIsSyncing(true);
    try {
      const response = await apiPost<SyncSourcesResponse>(SYNC_ENDPOINT, {});
      return {
        taskId: response.task_id,
        hashKey: response.hashkey,
      };
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Memoize to ensure stable reference when data is undefined
  const sourcesModels = useMemo(() => data ?? EMPTY_SOURCES, [data]);

  return {
    sourcesModels,
    isLoading,
    error: error ?? null,
    isSyncing,
    refresh,
    syncSources,
    mutate,
  };
}

// Export key for external cache invalidation
export const CANVAS_SOURCES_KEY = SOURCES_KEY;

// Utility: Build tree structure from sources for react-arborist
export interface TreeNode {
  id: string;
  name: string;
  data?: DbtModelResponse;
  children?: TreeNode[];
}

export function buildTreeFromSources(sources: DbtModelResponse[]): TreeNode[] {
  // Group by schema, then by source_name
  const grouped = sources.reduce(
    (acc, model) => {
      const schemaKey = model.schema;
      const sourceKey = model.source_name || 'models';

      if (!acc[schemaKey]) acc[schemaKey] = {};
      if (!acc[schemaKey][sourceKey]) acc[schemaKey][sourceKey] = [];

      acc[schemaKey][sourceKey].push(model);
      return acc;
    },
    {} as Record<string, Record<string, DbtModelResponse[]>>
  );

  // Convert to tree structure
  return Object.entries(grouped).map(([schema, sources]) => ({
    id: schema,
    name: schema,
    children: Object.entries(sources).map(([sourceName, models]) => ({
      id: `${schema}/${sourceName}`,
      name: sourceName,
      children: models.map((model) => ({
        id: model.uuid,
        name: model.display_name || model.name,
        data: model,
      })),
    })),
  }));
}
