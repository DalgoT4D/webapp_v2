// hooks/api/useCanvasGraph.ts
'use client';

import useSWR, { KeyedMutator } from 'swr';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import type {
  DbtProjectGraphResponse,
  CanvasNodeDataResponse,
  CanvasEdgeDataResponse,
} from '@/types/transform';

// Stable empty array references to prevent infinite loops
const EMPTY_NODES: CanvasNodeDataResponse[] = [];
const EMPTY_EDGES: CanvasEdgeDataResponse[] = [];

const GRAPH_KEY = '/api/transform/v2/dbt_project/graph/';
const SYNC_ENDPOINT = '/api/transform/v2/dbt_project/sync_remote_dbtproject_to_canvas/';

interface UseCanvasGraphOptions {
  /** Skip initial fetch (for preview mode) */
  skipInitialFetch?: boolean;
  /** Auto-sync with remote on mount */
  autoSync?: boolean;
}

interface UseCanvasGraphReturn {
  /** Raw nodes from API */
  nodes: CanvasNodeDataResponse[];
  /** Raw edges from API */
  edges: CanvasEdgeDataResponse[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Syncing with remote state */
  isSyncing: boolean;
  /** Refresh graph data */
  refresh: () => Promise<void>;
  /** Sync remote to canvas then refresh */
  syncAndRefresh: () => Promise<void>;
  /** Mutate cache directly */
  mutate: KeyedMutator<DbtProjectGraphResponse>;
}

export function useCanvasGraph(options: UseCanvasGraphOptions = {}): UseCanvasGraphReturn {
  const { skipInitialFetch = false, autoSync = false } = options;
  const [isSyncing, setIsSyncing] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<DbtProjectGraphResponse>(
    skipInitialFetch ? null : GRAPH_KEY,
    apiGet,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000,
    }
  );

  const syncRemoteToCanvas = useCallback(async () => {
    setIsSyncing(true);
    try {
      await apiPost(SYNC_ENDPOINT, {});
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const syncAndRefresh = useCallback(async () => {
    await syncRemoteToCanvas();
    await mutate();
  }, [syncRemoteToCanvas, mutate]);

  // Auto-sync on mount if enabled
  useEffect(() => {
    if (autoSync && !skipInitialFetch) {
      syncAndRefresh();
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Memoize to prevent unnecessary re-renders and ensure stable references
  const nodes = useMemo(() => data?.nodes ?? EMPTY_NODES, [data?.nodes]);
  const edges = useMemo(() => data?.edges ?? EMPTY_EDGES, [data?.edges]);

  return {
    nodes,
    edges,
    isLoading,
    error: error ?? null,
    isSyncing,
    refresh,
    syncAndRefresh,
    mutate,
  };
}

// Export the key for external cache invalidation
export const CANVAS_GRAPH_KEY = GRAPH_KEY;
