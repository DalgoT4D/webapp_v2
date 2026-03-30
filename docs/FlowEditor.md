# FlowEditor Specification

## Overview

Main layout component that orchestrates the Transform Canvas, containing the project tree, canvas, and lower section tabs.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/FlowEditor.tsx` (~429 lines)

**v2 Target:** `webapp_v2/src/components/transform/layout/FlowEditor.tsx`

**Complexity:** High

---

## Visual Design

```
┌─────────────────────────────────────────────────────────────────────┐
│ ┌──────────────┬──────────────────────────────────────────────────┐ │
│ │              │                                                  │ │
│ │  ProjectTree │                    Canvas                        │ │
│ │              │                                                  │ │
│ │  (280-550px) │              (ReactFlowProvider)                 │ │
│ │              │                                                  │ │
│ │              │                                                  │ │
│ │              │                                                  │ │
│ │              ▓                                                  │ │
│ │              ▓ ← Resize handle                                  │ │
│ │              │                                                  │ │
│ └──────────────┴──────────────────────────────────────────────────┘ │
│ ════════════════════════════════════════════════════════════════════│ ← Resize handle
│ ┌───────────────────────────────────────────────────────────────────┐
│ │ [Preview] [Logs] [Statistics]                              [⛶]   │
│ ├───────────────────────────────────────────────────────────────────┤
│ │                                                                   │
│ │                      Tab Content (height: 300px default)          │
│ │                                                                   │
│ └───────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Fetch Sources/Models
```typescript
GET transform/v2/dbt_project/sources_models/
// Response: DbtModelResponse[]
```

### Check Running Tasks
```typescript
GET prefect/tasks/transform/
// Response: TransformTask[] (with lock.celeryTaskId)
```

### Run DBT via Celery
```typescript
POST dbt/run_dbt_via_celery/
{
  // run parameters from canvas action
}
// Response: { task_id: string }
```

### Sync Sources
```typescript
POST transform/dbt_project/sync_sources/
// Response: { task_id: string, hashkey: string }
```

### Poll Task Progress
```typescript
GET tasks/{taskId}?hashkey={hashKey}
// Response: { progress: TaskProgressLog[] }
```

---

## Props Interface

```typescript
interface FlowEditorProps {
  onClose?: () => void;  // Optional close handler for embedded mode
}
```

---

## Implementation

```typescript
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Maximize2 } from 'lucide-react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import ProjectTree from './ProjectTree';
import Canvas from '../canvas/Canvas';
import PreviewPane from '../tabs/PreviewPane';
import LogsPane from '../tabs/LogsPane';
import StatisticsPane from '../tabs/StatisticsPane';
import { useCanvasStore } from '@/stores/canvasStore';
import { useLockCanvas } from '@/hooks/useLockCanvas';
import { useSourcesModels } from '@/hooks/api/useSourcesModels';
import { apiGet, apiPost } from '@/lib/api';
import { toast } from 'sonner';
import { delay } from '@/utils/common';
import type { DbtModelResponse, TaskProgressLog } from '@/types/transform.types';

type LowerSectionTab = 'preview' | 'logs' | 'statistics';

interface FlowEditorProps {
  onClose?: () => void;
}

export default function FlowEditor({ onClose }: FlowEditorProps) {
  // Data state
  const { data: sourcesModels, mutate: refreshSourcesModels } = useSourcesModels();

  // UI state
  const [refreshEditor, setRefreshEditor] = useState(false);
  const [selectedTab, setSelectedTab] = useState<LowerSectionTab>('logs');
  const [lowerSectionHeight, setLowerSectionHeight] = useState(300);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isSyncingSources, setIsSyncingSources] = useState(false);
  const [lockUpperSection, setLockUpperSection] = useState(false);

  // Canvas action handling
  const { canvasAction, setCanvasAction, dbtRunLogs, setDbtRunLogs } = useCanvasStore();

  // Lock management
  const { finalLockCanvas, setTempLockCanvas } = useLockCanvas(lockUpperSection);

  // Auto-sync ref
  const hasAutoSynced = useRef(false);

  // Poll for task progress
  const pollForTaskRun = useCallback(async (taskId: string, hashKey?: string) => {
    try {
      const url = hashKey
        ? `tasks/${taskId}?hashkey=${hashKey}`
        : `tasks/${taskId}`;
      const response = await apiGet(url);

      setDbtRunLogs(response.progress);

      const lastMessage = response.progress[response.progress.length - 1];

      if (!['completed', 'failed'].includes(lastMessage.status)) {
        await delay(2000);
        await pollForTaskRun(taskId, hashKey);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message);
    }
  }, [setDbtRunLogs]);

  // Check for running DBT jobs on mount
  const checkForRunningTasks = useCallback(async () => {
    setLockUpperSection(true);
    try {
      const response = await apiGet('prefect/tasks/transform/');
      for (const task of response) {
        if (task.lock?.celeryTaskId) {
          setSelectedTab('logs');
          await pollForTaskRun(task.lock.celeryTaskId);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLockUpperSection(false);
    }
  }, [pollForTaskRun]);

  // Handle run workflow action
  const handleRunWorkflow = useCallback(async (runParams: object) => {
    try {
      setLockUpperSection(true);
      setSelectedTab('logs');
      setDbtRunLogs([]);

      const response = await apiPost('dbt/run_dbt_via_celery/', runParams);
      toast.success('DBT run initiated');

      if (response?.task_id) {
        await delay(2000);
        await pollForTaskRun(response.task_id);
        setRefreshEditor((prev) => !prev);
      }

      setCanvasAction({ type: 'refresh-canvas', data: null });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to run workflow');
    } finally {
      setLockUpperSection(false);
    }
  }, [pollForTaskRun, setCanvasAction, setDbtRunLogs]);

  // Handle sync sources action
  const syncSources = useCallback(async () => {
    try {
      setIsSyncingSources(true);
      setSelectedTab('logs');
      setDbtRunLogs([]);

      const response = await apiPost('transform/dbt_project/sync_sources/', {});

      if (response?.task_id && response?.hashkey) {
        await pollForSyncTask(response.task_id, response.hashkey);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to sync sources');
    } finally {
      setIsSyncingSources(false);
    }
  }, [setDbtRunLogs]);

  // Poll for sync sources task
  const pollForSyncTask = async (taskId: string, hashKey: string) => {
    try {
      const response = await apiGet(`tasks/${taskId}?hashkey=${hashKey}`);

      if (response?.progress) {
        setDbtRunLogs(
          response.progress.map((p: any) => ({
            timestamp: new Date().toISOString(),
            message: p.message,
          }))
        );

        const lastMessage = response.progress[response.progress.length - 1];

        if (lastMessage.status === 'completed') {
          toast.success('Sync sources completed');
          refreshSourcesModels();
          return;
        }

        if (lastMessage.status === 'failed') {
          toast.error('Sync sources failed');
          return;
        }
      }

      await delay(3000);
      await pollForSyncTask(taskId, hashKey);
    } catch (error: any) {
      console.error(error);
    }
  };

  // Initialize on mount
  useEffect(() => {
    checkForRunningTasks();
  }, []);

  // Handle canvas actions
  useEffect(() => {
    if (canvasAction.type === 'run-workflow') {
      handleRunWorkflow(canvasAction.data || {});
    }

    if (canvasAction.type === 'sync-sources') {
      (async () => {
        await syncSources();
        refreshSourcesModels();
      })();
    }
  }, [canvasAction]);

  // Auto-sync on first open
  useEffect(() => {
    if (!hasAutoSynced.current && sourcesModels) {
      hasAutoSynced.current = true;
      setCanvasAction({ type: 'sync-sources', data: null });
    }
  }, [sourcesModels, setCanvasAction]);

  // Handle node click from project tree
  const handleNodeClick = (nodes: any[]) => {
    if (nodes.length > 0 && nodes[0].isLeaf) {
      setCanvasAction({ type: 'add-srcmodel-node', data: nodes[0].data });
    }
  };

  // Handle sync click from project tree
  const handleSyncClick = () => {
    setCanvasAction({ type: 'sync-sources', data: null });
  };

  // Toggle fullscreen for lower section
  const toggleFullScreen = () => {
    setIsFullScreen((prev) => !prev);
    setLowerSectionHeight(isFullScreen ? 300 : window.innerHeight - 100);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">
      {/* Upper Section: ProjectTree + Canvas */}
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1"
      >
        {/* Project Tree Panel */}
        <ResizablePanel
          defaultSize={20}
          minSize={15}
          maxSize={40}
        >
          <ProjectTree
            sourcesModels={sourcesModels || []}
            handleNodeClick={handleNodeClick}
            handleSyncClick={handleSyncClick}
            isSyncing={isSyncingSources}
            onClose={onClose}
          />
        </ResizablePanel>

        <ResizableHandle />

        {/* Canvas Panel */}
        <ResizablePanel defaultSize={80}>
          <ReactFlowProvider>
            <Canvas
              redrawGraph={refreshEditor}
              setRedrawGraph={setRefreshEditor}
              finalLockCanvas={finalLockCanvas}
              setTempLockCanvas={setTempLockCanvas}
            />
          </ReactFlowProvider>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Lower Section: Tabs */}
      <ResizablePanelGroup direction="vertical">
        <ResizableHandle />
        <ResizablePanel
          defaultSize={30}
          minSize={10}
          style={{ height: lowerSectionHeight }}
        >
          <div className="h-full border-t">
            {/* Tab Header */}
            <div className="h-12 flex items-center bg-muted/50 border-b px-4">
              <Tabs
                value={selectedTab}
                onValueChange={(v) => setSelectedTab(v as LowerSectionTab)}
              >
                <TabsList>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="logs">Logs</TabsTrigger>
                  <TabsTrigger value="statistics">Data statistics</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                onClick={toggleFullScreen}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Tab Content */}
            <div className="h-[calc(100%-48px)] overflow-auto">
              {selectedTab === 'preview' && (
                <PreviewPane height={lowerSectionHeight - 48} />
              )}
              {selectedTab === 'logs' && (
                <LogsPane
                  height={lowerSectionHeight - 48}
                  dbtRunLogs={dbtRunLogs}
                  isLoading={finalLockCanvas}
                />
              )}
              {selectedTab === 'statistics' && (
                <StatisticsPane height={lowerSectionHeight - 48} />
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
```

---

## State Management

### Canvas Store Integration

```typescript
// canvasStore additions for FlowEditor
interface CanvasStore {
  // Existing...

  // Run logs
  dbtRunLogs: TaskProgressLog[];
  setDbtRunLogs: (logs: TaskProgressLog[]) => void;

  // Canvas action
  canvasAction: CanvasAction;
  setCanvasAction: (action: CanvasAction) => void;
}

type CanvasAction =
  | { type: 'run-workflow'; data: object | null }
  | { type: 'sync-sources'; data: null }
  | { type: 'refresh-canvas'; data: null }
  | { type: 'add-srcmodel-node'; data: DbtModelResponse };
```

---

## Key Features

1. **Resizable panels**: Horizontal (tree/canvas) and vertical (upper/lower)
2. **Tab-based lower section**: Preview, Logs, Statistics
3. **Task polling**: Monitors DBT runs and sync operations
4. **Auto-sync**: Syncs sources on first open
5. **Fullscreen toggle**: Expand lower section to full height
6. **Lock management**: Prevents edits during runs

---

## Integration Points

- **ProjectTree**: Receives sources, emits node clicks and sync requests
- **Canvas**: Receives redraw trigger and lock state
- **LowerSection tabs**: Receive height and relevant data
- **CanvasStore**: Central state for actions and logs

---

## Implementation Checklist

- [ ] Create main layout structure
- [ ] Implement ResizablePanelGroup for horizontal split
- [ ] Implement ResizablePanelGroup for vertical split
- [ ] Add tab navigation
- [ ] Integrate ProjectTree
- [ ] Wrap Canvas with ReactFlowProvider
- [ ] Implement task polling
- [ ] Handle canvas actions
- [ ] Add fullscreen toggle
- [ ] Add loading states
- [ ] Style with Tailwind
