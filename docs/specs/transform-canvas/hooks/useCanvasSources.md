# useCanvasSources Hook Specification

## Overview

Hook for fetching available DBT sources and models that can be added to the canvas.

**v1 Source:** FlowEditor.tsx `fetchSourcesModels`, `syncSources`

**v2 Target:** `webapp_v2/src/hooks/api/useCanvasSources.ts`

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `transform/v2/dbt_project/sources_models/` | GET | Fetch available sources/models |
| `transform/dbt_project/sync_sources/` | POST | Sync sources from warehouse |

---

## Response Types

```typescript
interface DbtModelResponse {
  name: string;
  display_name: string;
  schema: string;
  sql_path: string;
  type: 'source' | 'model';
  source_name: string;
  output_cols: string[];
  uuid: string;
}

interface SyncSourcesResponse {
  task_id: string;
  hashkey: string;
}
```

---

## Hook Interface

```typescript
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
```

---

## Implementation

```typescript
import useSWR, { KeyedMutator } from 'swr';
import { useState, useCallback } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import type { DbtModelResponse } from '@/types/transform.types';

const SOURCES_KEY = 'transform/v2/dbt_project/sources_models/';

export function useCanvasSources(): UseCanvasSourcesReturn {
  const [isSyncing, setIsSyncing] = useState(false);

  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR<DbtModelResponse[]>(
    SOURCES_KEY,
    apiGet,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  );

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const syncSources = useCallback(async () => {
    setIsSyncing(true);
    try {
      const response = await apiPost<{ task_id: string; hashkey: string }>(
        'transform/dbt_project/sync_sources/',
        {}
      );
      return {
        taskId: response.task_id,
        hashKey: response.hashkey,
      };
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    sourcesModels: data ?? [],
    isLoading,
    error: error ?? null,
    isSyncing,
    refresh,
    syncSources,
    mutate,
  };
}
```

---

## Usage

### In ProjectTree Component

```typescript
function ProjectTree({ onNodeClick }: ProjectTreeProps) {
  const { sourcesModels, isLoading, refresh, syncSources, isSyncing } = useCanvasSources();

  const handleSyncClick = async () => {
    const { taskId, hashKey } = await syncSources();
    // Start polling for sync completion
    await pollSyncTask(taskId, hashKey);
    // Refresh list after sync
    await refresh();
  };

  return (
    <div>
      <Button onClick={handleSyncClick} disabled={isSyncing}>
        {isSyncing ? 'Syncing...' : 'Sync Sources'}
      </Button>
      <TreeView
        data={buildTreeFromSources(sourcesModels)}
        onNodeClick={onNodeClick}
      />
    </div>
  );
}
```

### Building Tree Structure

```typescript
function buildTreeFromSources(sources: DbtModelResponse[]) {
  // Group by schema, then by source_name
  const grouped = sources.reduce((acc, model) => {
    const schemaKey = model.schema;
    const sourceKey = model.source_name || 'models';

    if (!acc[schemaKey]) acc[schemaKey] = {};
    if (!acc[schemaKey][sourceKey]) acc[schemaKey][sourceKey] = [];

    acc[schemaKey][sourceKey].push(model);
    return acc;
  }, {} as Record<string, Record<string, DbtModelResponse[]>>);

  // Convert to tree structure for react-arborist
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
```

---

## Sync Task Polling

The sync operation returns a task ID that needs to be polled:

```typescript
async function pollSyncTask(taskId: string, hashKey: string) {
  const setDbtRunLogs = useTransformStore.getState().setDbtRunLogs;

  while (true) {
    const response = await apiGet(`tasks/${taskId}?hashkey=${hashKey}`);

    if (response?.progress) {
      setDbtRunLogs(response.progress.map((p: any) => ({
        level: 0,
        timestamp: new Date(),
        message: p.message,
      })));

      const lastMessage = response.progress[response.progress.length - 1];
      if (lastMessage?.status === 'completed') {
        return;
      }
      if (lastMessage?.status === 'failed') {
        throw new Error('Sync sources failed');
      }
    }

    await delay(3000);
  }
}
```

---

## Edge Cases

1. **Empty sources**: Return empty array, show "No sources" message
2. **Sync already running**: Backend handles, shows current status
3. **Sync failure**: Show error toast, allow retry
4. **Network error**: Show cached data if available

---

## Implementation Checklist

- [ ] Create hook file at `hooks/api/useCanvasSources.ts`
- [ ] Add tree building utility function
- [ ] Integrate with sync task polling
- [ ] Add toast notifications
- [ ] Test empty state
- [ ] Test sync flow
- [ ] Test auto-sync on first load
