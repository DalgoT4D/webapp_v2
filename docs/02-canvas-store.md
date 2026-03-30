# Canvas Store Specification

## Overview

This document specifies the Zustand store for the Transform Canvas feature, replacing React Context from v1.

**v1 Source Files:**
- `webapp/src/contexts/FlowEditorCanvasContext.tsx`
- State from `webapp/src/components/TransformWorkflow/FlowEditor/FlowEditor.tsx`
- State from `webapp/src/components/TransformWorkflow/FlowEditor/Components/Canvas.tsx`
- `webapp/src/customHooks/useLockCanvas.tsx`

**v2 Target Location:** `webapp_v2/src/stores/transformStore.ts`

---

## 1. v1 State Analysis

### From FlowEditorCanvasContext.tsx (React Contexts)
| Context | State | Type | Purpose |
|---------|-------|------|---------|
| CanvasNodeContext | canvasNode | GenericNodeProps \| null | Currently selected node for operation panel |
| CanvasActionContext | canvasAction | Action | Event bus for canvas actions |

### From FlowEditor.tsx (Component State)
| State | Type | Initial | Purpose |
|-------|------|---------|---------|
| sourcesModels | DbtModelResponse[] | [] | Available sources/models from API |
| refreshEditor | boolean | false | Triggers canvas redraw |
| lowerSectionHeight | number | 300 | Lower tabs height |
| lockUpperSection | boolean | false | Lock during workflow run |
| selectedTab | LowerSectionTabValues | 'logs' | Active lower tab |
| isSyncingSources | boolean | false | Syncing sources loading state |

### From Canvas.tsx (Component State)
| State | Type | Initial | Purpose |
|-------|------|---------|---------|
| openOperationConfig | boolean | false | Right panel visibility |
| canvasLockStatus | object | {...} | Lock info from API |
| publishModalOpen | boolean | false | Publish modal visibility |
| patModalOpen | boolean | false | PAT modal visibility |
| patRequired | boolean | false | PAT setup required flag |
| isViewOnlyMode | boolean | false | Read-only mode |
| gitRepoUrl | string | '' | GitHub repo URL |

### Refs (not in store)
| Ref | Type | Purpose |
|-----|------|---------|
| previewNodeRef | PreviewTableData \| null | Current preview table |
| hasInitializedRef | boolean | First load flag |
| lockRefreshTimerRef | NodeJS.Timeout \| null | Lock refresh timer |
| hasAutoSynced | boolean | Auto sync flag |

---

## 2. Zustand Store Design

### Store Structure

```typescript
// webapp_v2/src/stores/transformStore.ts

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  GenericNodeProps,
  DbtModelResponse,
  CanvasAction,
  PreviewTableData,
  CanvasLockStatus,
} from '@/types/transform.types';

type LowerSectionTab = 'preview' | 'logs' | 'statistics';

interface TransformState {
  // === Canvas Node Selection ===
  selectedNode: GenericNodeProps | null;

  // === Canvas Actions (Event Bus) ===
  canvasAction: CanvasAction;

  // === Data Sources ===
  sourcesModels: DbtModelResponse[];

  // === Canvas State ===
  refreshTrigger: number; // Increment to trigger refresh
  isCanvasLoading: boolean;

  // === Locking State ===
  lockUpperSection: boolean;  // Lock during workflow execution
  tempLockCanvas: boolean;    // Temporary lock
  canvasLockStatus: CanvasLockStatus | null;
  isViewOnlyMode: boolean;

  // === UI Panels ===
  operationPanelOpen: boolean;
  selectedLowerTab: LowerSectionTab;
  lowerSectionHeight: number;

  // === Modals ===
  publishModalOpen: boolean;
  patModalOpen: boolean;
  runWorkflowModalOpen: boolean;

  // === Git Integration ===
  gitRepoUrl: string;
  patRequired: boolean;

  // === Sync State ===
  isSyncingSources: boolean;

  // === Preview ===
  previewData: PreviewTableData | null;

  // === Workflow Execution ===
  isWorkflowRunning: boolean;
  currentTaskId: string | null;

  // === DBT Run Logs (from DbtRunLogsContext) ===
  dbtRunLogs: TaskProgressLog[];

  // === Preview Action (from FlowEditorPreviewContext) ===
  previewAction: PreviewAction;
}

interface TransformActions {
  // === Node Selection ===
  setSelectedNode: (node: GenericNodeProps | null) => void;
  clearSelectedNode: () => void;

  // === Canvas Actions ===
  dispatchCanvasAction: (action: CanvasAction) => void;
  clearCanvasAction: () => void;

  // === Data Sources ===
  setSourcesModels: (models: DbtModelResponse[]) => void;

  // === Canvas State ===
  triggerRefresh: () => void;
  setCanvasLoading: (loading: boolean) => void;

  // === Locking ===
  setLockUpperSection: (lock: boolean) => void;
  setTempLockCanvas: (lock: boolean) => void;
  setCanvasLockStatus: (status: CanvasLockStatus | null) => void;
  setViewOnlyMode: (viewOnly: boolean) => void;

  // === UI Panels ===
  openOperationPanel: () => void;
  closeOperationPanel: () => void;
  setSelectedLowerTab: (tab: LowerSectionTab) => void;
  setLowerSectionHeight: (height: number) => void;

  // === Modals ===
  openPublishModal: () => void;
  closePublishModal: () => void;
  openPatModal: () => void;
  closePatModal: () => void;
  openRunWorkflowModal: () => void;
  closeRunWorkflowModal: () => void;

  // === Git Integration ===
  setGitRepoUrl: (url: string) => void;
  setPatRequired: (required: boolean) => void;

  // === Sync ===
  setSyncingSources: (syncing: boolean) => void;

  // === Preview ===
  setPreviewData: (data: PreviewTableData | null) => void;

  // === Workflow ===
  setWorkflowRunning: (running: boolean) => void;
  setCurrentTaskId: (taskId: string | null) => void;

  // === DBT Run Logs ===
  setDbtRunLogs: (logs: TaskProgressLog[]) => void;
  appendDbtRunLog: (log: TaskProgressLog) => void;
  clearDbtRunLogs: () => void;

  // === Preview Action ===
  setPreviewAction: (action: PreviewAction) => void;
  clearPreviewAction: () => void;

  // === Computed ===
  getFinalLockCanvas: () => boolean;
  canInteractWithCanvas: () => boolean;

  // === Reset ===
  reset: () => void;
}

export type TransformStore = TransformState & TransformActions;
```

---

## 3. Store Implementation

```typescript
const initialState: TransformState = {
  // Canvas Node Selection
  selectedNode: null,

  // Canvas Actions
  canvasAction: { type: null, data: null },

  // Data Sources
  sourcesModels: [],

  // Canvas State
  refreshTrigger: 0,
  isCanvasLoading: false,

  // Locking State
  lockUpperSection: false,
  tempLockCanvas: false,
  canvasLockStatus: null,
  isViewOnlyMode: false,

  // UI Panels
  operationPanelOpen: false,
  selectedLowerTab: 'logs',
  lowerSectionHeight: 300,

  // Modals
  publishModalOpen: false,
  patModalOpen: false,
  runWorkflowModalOpen: false,

  // Git Integration
  gitRepoUrl: '',
  patRequired: false,

  // Sync State
  isSyncingSources: false,

  // Preview
  previewData: null,

  // Workflow Execution
  isWorkflowRunning: false,
  currentTaskId: null,
};

export const useTransformStore = create<TransformStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // === Node Selection ===
      setSelectedNode: (node) => set({ selectedNode: node }),
      clearSelectedNode: () => set({ selectedNode: null }),

      // === Canvas Actions ===
      dispatchCanvasAction: (action) => set({ canvasAction: action }),
      clearCanvasAction: () => set({ canvasAction: { type: null, data: null } }),

      // === Data Sources ===
      setSourcesModels: (models) => set({ sourcesModels: models }),

      // === Canvas State ===
      triggerRefresh: () => set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })),
      setCanvasLoading: (loading) => set({ isCanvasLoading: loading }),

      // === Locking ===
      setLockUpperSection: (lock) => set({ lockUpperSection: lock }),
      setTempLockCanvas: (lock) => set({ tempLockCanvas: lock }),
      setCanvasLockStatus: (status) => set({ canvasLockStatus: status }),
      setViewOnlyMode: (viewOnly) => set({ isViewOnlyMode: viewOnly }),

      // === UI Panels ===
      openOperationPanel: () => set({ operationPanelOpen: true }),
      closeOperationPanel: () => set({ operationPanelOpen: false, selectedNode: null }),
      setSelectedLowerTab: (tab) => set({ selectedLowerTab: tab }),
      setLowerSectionHeight: (height) => set({ lowerSectionHeight: height }),

      // === Modals ===
      openPublishModal: () => set({ publishModalOpen: true }),
      closePublishModal: () => set({ publishModalOpen: false }),
      openPatModal: () => set({ patModalOpen: true }),
      closePatModal: () => set({ patModalOpen: false }),
      openRunWorkflowModal: () => set({ runWorkflowModalOpen: true }),
      closeRunWorkflowModal: () => set({ runWorkflowModalOpen: false }),

      // === Git Integration ===
      setGitRepoUrl: (url) => set({ gitRepoUrl: url }),
      setPatRequired: (required) => set({ patRequired: required }),

      // === Sync ===
      setSyncingSources: (syncing) => set({ isSyncingSources: syncing }),

      // === Preview ===
      setPreviewData: (data) => set({ previewData: data }),

      // === Workflow ===
      setWorkflowRunning: (running) => set({ isWorkflowRunning: running }),
      setCurrentTaskId: (taskId) => set({ currentTaskId: taskId }),

      // === Computed ===
      getFinalLockCanvas: () => {
        const state = get();
        return state.tempLockCanvas || state.lockUpperSection;
      },
      canInteractWithCanvas: () => {
        const state = get();
        const finalLock = state.tempLockCanvas || state.lockUpperSection;
        return !finalLock && !state.isViewOnlyMode;
      },

      // === Reset ===
      reset: () => set(initialState),
    }),
    { name: 'transform-store' }
  )
);
```

---

## 4. Supporting Types

```typescript
// In types/transform.types.ts

export interface CanvasLockStatus {
  locked_by: string | null;
  locked_at: string | null;
  is_locked: boolean;
  locked_by_current_user: boolean;
  lock_id: string | null;
}

export interface CanvasAction {
  type: CanvasActionType;
  data: any;
}

export type CanvasActionType =
  | 'add-srcmodel-node'
  | 'delete-node'
  | 'delete-source-tree-node'
  | 'refresh-canvas'
  | 'open-opconfig-panel'
  | 'close-reset-opconfig-panel'
  | 'sync-sources'
  | 'run-workflow'
  | 'update-canvas-node'
  | ''
  | null;

export interface PreviewTableData {
  table: string;
  schema: string;
}

export interface TaskProgressLog {
  message: string;
  status: string;
  timestamp: string;
}

export interface PreviewAction {
  type: 'preview' | 'clear-preview' | null;
  data: PreviewTableData | null;
}
```

---

## 5. Usage Patterns

### Selecting State
```typescript
// Select specific slices (recommended for performance)
const selectedNode = useTransformStore((state) => state.selectedNode);
const { selectedNode, operationPanelOpen } = useTransformStore(
  (state) => ({ selectedNode: state.selectedNode, operationPanelOpen: state.operationPanelOpen }),
  shallow
);
```

### Dispatching Actions
```typescript
const dispatchCanvasAction = useTransformStore((state) => state.dispatchCanvasAction);

// Add node to canvas
dispatchCanvasAction({ type: 'add-srcmodel-node', data: nodeData });

// Refresh canvas
dispatchCanvasAction({ type: 'refresh-canvas', data: null });

// Run workflow
dispatchCanvasAction({ type: 'run-workflow', data: runParams });
```

### Handling Canvas Actions (useEffect)
```typescript
// In Canvas component
const canvasAction = useTransformStore((state) => state.canvasAction);
const clearCanvasAction = useTransformStore((state) => state.clearCanvasAction);

useEffect(() => {
  if (!canvasAction.type) return;

  switch (canvasAction.type) {
    case 'add-srcmodel-node':
      handleAddNode(canvasAction.data);
      break;
    case 'refresh-canvas':
      fetchGraphData();
      break;
    case 'run-workflow':
      handleRunWorkflow(canvasAction.data);
      break;
    // ... other actions
  }

  clearCanvasAction();
}, [canvasAction]);
```

---

## 6. Migration from v1 Contexts

### v1 Usage
```typescript
// v1 - Using contexts
import { useCanvasNode, useCanvasAction } from '@/contexts/FlowEditorCanvasContext';

const { canvasNode, setCanvasNode } = useCanvasNode();
const { canvasAction, setCanvasAction } = useCanvasAction();
```

### v2 Usage
```typescript
// v2 - Using Zustand store
import { useTransformStore } from '@/stores/transformStore';

const selectedNode = useTransformStore((state) => state.selectedNode);
const setSelectedNode = useTransformStore((state) => state.setSelectedNode);
const dispatchCanvasAction = useTransformStore((state) => state.dispatchCanvasAction);
```

---

## 7. Lock Status Polling

The canvas lock status needs to be refreshed every 30 seconds. This is handled outside the store with a custom hook:

```typescript
// hooks/useCanvasLockPolling.ts
import { useEffect, useRef } from 'react';
import { useTransformStore } from '@/stores/transformStore';
import { apiGet, apiPost } from '@/lib/api';

const LOCK_REFRESH_INTERVAL = 30000; // 30 seconds

export function useCanvasLockPolling() {
  const setCanvasLockStatus = useTransformStore((state) => state.setCanvasLockStatus);
  const setViewOnlyMode = useTransformStore((state) => state.setViewOnlyMode);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const refreshLock = async () => {
    try {
      const status = await apiPost('transform/v2/dbt_project/canvas_lock/refresh/');
      setCanvasLockStatus(status);
      setViewOnlyMode(status.is_locked && !status.locked_by_current_user);
    } catch (error) {
      console.error('Failed to refresh lock:', error);
    }
  };

  const acquireLock = async () => {
    try {
      const status = await apiPost('transform/v2/dbt_project/canvas_lock/acquire/');
      setCanvasLockStatus(status);
      setViewOnlyMode(!status.locked_by_current_user);

      // Start refresh timer
      timerRef.current = setInterval(refreshLock, LOCK_REFRESH_INTERVAL);
    } catch (error) {
      console.error('Failed to acquire lock:', error);
    }
  };

  const releaseLock = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      await apiPost('transform/v2/dbt_project/canvas_lock/release/');
      setCanvasLockStatus(null);
    } catch (error) {
      console.error('Failed to release lock:', error);
    }
  };

  useEffect(() => {
    acquireLock();
    return () => {
      releaseLock();
    };
  }, []);

  return { refreshLock, releaseLock };
}
```

---

## 8. Workflow Execution State

The workflow execution state integrates with the logs pane:

```typescript
// In FlowEditor component
const setWorkflowRunning = useTransformStore((state) => state.setWorkflowRunning);
const setLockUpperSection = useTransformStore((state) => state.setLockUpperSection);
const setCurrentTaskId = useTransformStore((state) => state.setCurrentTaskId);
const setSelectedLowerTab = useTransformStore((state) => state.setSelectedLowerTab);

const handleRunWorkflow = async (runParams: object) => {
  try {
    setLockUpperSection(true);
    setWorkflowRunning(true);
    setSelectedLowerTab('logs');

    const response = await apiPost('dbt/run_dbt_via_celery/', runParams);

    if (response?.task_id) {
      setCurrentTaskId(response.task_id);
      // Polling is handled by LogsPane component
    }
  } catch (error) {
    console.error(error);
  }
};
```

---

## 9. Implementation Checklist

- [ ] Create `stores/transformStore.ts` with full state and actions
- [ ] Add CanvasLockStatus type to `types/transform.types.ts`
- [ ] Create `hooks/useCanvasLockPolling.ts` for lock management
- [ ] Create selector hooks for common state slices
- [ ] Add devtools middleware for debugging
- [ ] Test state updates and computed values
- [ ] Verify action dispatch flow works correctly

---

## 10. Testing Strategy

```typescript
// __tests__/stores/transformStore.test.ts
import { act, renderHook } from '@testing-library/react';
import { useTransformStore } from '@/stores/transformStore';

describe('transformStore', () => {
  beforeEach(() => {
    useTransformStore.getState().reset();
  });

  it('should set selected node', () => {
    const { result } = renderHook(() => useTransformStore());

    act(() => {
      result.current.setSelectedNode({ id: '1', data: {} } as any);
    });

    expect(result.current.selectedNode?.id).toBe('1');
  });

  it('should compute finalLockCanvas correctly', () => {
    const { result } = renderHook(() => useTransformStore());

    expect(result.current.getFinalLockCanvas()).toBe(false);

    act(() => {
      result.current.setLockUpperSection(true);
    });

    expect(result.current.getFinalLockCanvas()).toBe(true);
  });

  it('should dispatch and clear canvas actions', () => {
    const { result } = renderHook(() => useTransformStore());

    act(() => {
      result.current.dispatchCanvasAction({ type: 'refresh-canvas', data: null });
    });

    expect(result.current.canvasAction.type).toBe('refresh-canvas');

    act(() => {
      result.current.clearCanvasAction();
    });

    expect(result.current.canvasAction.type).toBeNull();
  });
});
```

---

## Notes

1. **Refs not in store**: Timer refs and initialization flags should remain as component-level refs, not in the store.

2. **Action-based updates**: The canvas uses an action/event pattern where components dispatch actions and the Canvas component handles them in useEffect.

3. **Lock polling**: Lock status polling is a side effect and should be in a custom hook, not the store.

4. **Devtools**: Use zustand devtools middleware for debugging in development.

5. **Performance**: Use shallow comparison when selecting multiple state slices to prevent unnecessary re-renders.
