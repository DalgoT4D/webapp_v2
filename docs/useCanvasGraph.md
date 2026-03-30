# useCanvasGraph Hook Specification

## Overview

SWR-based hook for fetching and managing the canvas graph data (nodes and edges).

**v1 Source:** Canvas.tsx functions: `fetchDbtProjectGraph`, `syncRemoteToCanvas`, `initializeCanvas`

**v2 Target:** `webapp_v2/src/hooks/api/useCanvasGraph.ts`

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `transform/v2/dbt_project/graph/` | GET | Fetch canvas graph (nodes + edges) |
| `transform/v2/dbt_project/sync_remote_dbtproject_to_canvas/` | POST | Sync remote DBT project to canvas |

---

## Response Types

### DbtProjectGraphResponse
```typescript
interface DbtProjectGraphResponse {
  nodes: CanvasNodeDataResponse[];
  edges: CanvasEdgeDataResponse[];
}
```

---

## Hook Interface

```typescript
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
```

---

## Implementation

```typescript
import useSWR, { KeyedMutator } from 'swr';
import { useState, useCallback } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import type {
  DbtProjectGraphResponse,
  CanvasNodeDataResponse,
  CanvasEdgeDataResponse,
} from '@/types/transform.types';

const GRAPH_KEY = 'transform/v2/dbt_project/graph/';

const fetcher = async (url: string): Promise<DbtProjectGraphResponse> => {
  return apiGet(url);
};

export function useCanvasGraph(options: UseCanvasGraphOptions = {}): UseCanvasGraphReturn {
  const { skipInitialFetch = false, autoSync = false } = options;
  const [isSyncing, setIsSyncing] = useState(false);

  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR<DbtProjectGraphResponse>(
    skipInitialFetch ? null : GRAPH_KEY,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000,
    }
  );

  const syncRemoteToCanvas = useCallback(async () => {
    setIsSyncing(true);
    try {
      await apiPost('transform/v2/dbt_project/sync_remote_dbtproject_to_canvas/', {});
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
  }, [autoSync, skipInitialFetch]);

  return {
    nodes: data?.nodes ?? [],
    edges: data?.edges ?? [],
    isLoading,
    error: error ?? null,
    isSyncing,
    refresh,
    syncAndRefresh,
    mutate,
  };
}
```

---

## Usage in Canvas Component

```typescript
function Canvas() {
  const {
    nodes: rawNodes,
    edges: rawEdges,
    isLoading,
    refresh,
    syncAndRefresh,
  } = useCanvasGraph({ autoSync: true });

  // Transform raw data to React Flow format with layout
  const { nodes, edges } = useMemo(() => {
    if (!rawNodes.length) return { nodes: [], edges: [] };

    const flowNodes: CanvasNodeRender[] = rawNodes.map((node) => ({
      id: node.uuid,
      type: node.node_type,
      data: { ...node, isDummy: false },
      position: { x: 0, y: 0 },
    }));

    const flowEdges: Edge[] = rawEdges.map((edge) => ({
      ...edge,
      ...EdgeStyle,
    }));

    return getLayoutedElements({
      nodes: flowNodes,
      edges: flowEdges,
      options: { direction: 'LR' },
    });
  }, [rawNodes, rawEdges]);

  // ...
}
```

---

## Edge Cases

1. **Empty graph**: Return empty arrays for nodes/edges
2. **Network error**: Set error state, allow retry via refresh()
3. **Sync failure**: Log error, still attempt to fetch graph
4. **Preview mode**: Skip initial fetch, use skipInitialFetch option

---

## Implementation Checklist

- [ ] Create hook file at `hooks/api/useCanvasGraph.ts`
- [ ] Add error handling with toast notifications
- [ ] Add loading state to transform store
- [ ] Test with empty graph
- [ ] Test sync + refresh flow
- [ ] Test error recovery
