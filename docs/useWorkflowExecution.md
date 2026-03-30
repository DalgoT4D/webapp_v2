# useWorkflowExecution Hook Specification

## Overview

Hook for executing DBT workflows and polling for task completion.

**v1 Source:** FlowEditor.tsx `handleRunWorkflow`, `pollForTaskRun`, `checkForAnyRunningDbtJob`

**v2 Target:** `webapp_v2/src/hooks/api/useWorkflowExecution.ts`

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `dbt/run_dbt_via_celery/` | POST | Start DBT run (workflow execution) |
| `tasks/{task_id}?hashkey={hashkey}` | GET | Poll task progress |
| `prefect/tasks/transform/` | GET | Check for running tasks |

---

## Request/Response Types

```typescript
interface RunWorkflowParams {
  /** Run type: 'run', 'run-to-node', 'run-from-node' */
  run_type: 'run' | 'run-to-node' | 'run-from-node';
  /** Target node UUID (for run-to/from) */
  target_node?: string;
}

interface RunWorkflowResponse {
  task_id: string;
}

interface TaskProgressLog {
  level: number;
  timestamp: string;
  message: string;
  status?: 'completed' | 'failed' | 'running';
}

interface TaskProgressResponse {
  progress: TaskProgressLog[];
}

interface TransformTask {
  lock?: {
    celeryTaskId: string;
  };
}
```

---

## Hook Interface

```typescript
interface UseWorkflowExecutionReturn {
  /** Current task logs */
  logs: TaskProgressLog[];
  /** Whether workflow is running */
  isRunning: boolean;
  /** Current task ID */
  taskId: string | null;
  /** Run workflow */
  runWorkflow: (params: RunWorkflowParams) => Promise<void>;
  /** Check for existing running tasks */
  checkRunningTasks: () => Promise<string | null>;
  /** Clear logs */
  clearLogs: () => void;
}
```

---

## Implementation

```typescript
import { useState, useCallback, useRef } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { useTransformStore } from '@/stores/transformStore';
import { useAuthStore } from '@/stores/authStore';

const POLL_INTERVAL = 2000; // 2 seconds
const TASK_CHECK_INTERVAL = 5000; // 5 seconds

export function useWorkflowExecution(): UseWorkflowExecutionReturn {
  const { selectedOrgSlug } = useAuthStore();
  const setLockUpperSection = useTransformStore((s) => s.setLockUpperSection);
  const setSelectedLowerTab = useTransformStore((s) => s.setSelectedLowerTab);
  const triggerRefresh = useTransformStore((s) => s.triggerRefresh);

  const [logs, setLogs] = useState<TaskProgressLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);

  const pollingRef = useRef(false);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const pollTaskProgress = useCallback(async (taskId: string) => {
    if (pollingRef.current) return;
    pollingRef.current = true;

    const hashKey = `run-dbt-commands-${selectedOrgSlug}`;

    try {
      while (true) {
        const response = await apiGet<TaskProgressResponse>(
          `tasks/${taskId}?hashkey=${hashKey}`
        );

        setLogs(response.progress);

        const lastLog = response.progress[response.progress.length - 1];
        if (lastLog?.status === 'completed' || lastLog?.status === 'failed') {
          break;
        }

        await delay(POLL_INTERVAL);
      }
    } finally {
      pollingRef.current = false;
      setIsRunning(false);
      setTaskId(null);
      triggerRefresh();
    }
  }, [selectedOrgSlug, triggerRefresh]);

  const runWorkflow = useCallback(async (params: RunWorkflowParams) => {
    setIsRunning(true);
    setLockUpperSection(true);
    setSelectedLowerTab('logs');
    clearLogs();

    try {
      const response = await apiPost<RunWorkflowResponse>(
        'dbt/run_dbt_via_celery/',
        params
      );

      if (response?.task_id) {
        setTaskId(response.task_id);
        await delay(POLL_INTERVAL);
        await pollTaskProgress(response.task_id);
      }
    } catch (error) {
      setIsRunning(false);
      throw error;
    } finally {
      setLockUpperSection(false);
    }
  }, [setLockUpperSection, setSelectedLowerTab, clearLogs, pollTaskProgress]);

  const checkRunningTasks = useCallback(async (): Promise<string | null> => {
    try {
      const tasks = await apiGet<TransformTask[]>('prefect/tasks/transform/');

      for (const task of tasks) {
        if (task.lock?.celeryTaskId) {
          return task.lock.celeryTaskId;
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to check running tasks:', error);
      return null;
    }
  }, []);

  return {
    logs,
    isRunning,
    taskId,
    runWorkflow,
    checkRunningTasks,
    clearLogs,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

---

## Usage

### In Canvas Header (Run Menu)

```typescript
function CanvasHeader() {
  const { runWorkflow, isRunning } = useWorkflowExecution();
  const selectedNode = useTransformStore((s) => s.selectedNode);
  const [runMenuAnchor, setRunMenuAnchor] = useState<HTMLElement | null>(null);

  const handleRunClick = (runType: 'run' | 'run-to-node' | 'run-from-node') => {
    const params: RunWorkflowParams = {
      run_type: runType,
      ...(runType !== 'run' && selectedNode && { target_node: selectedNode.id }),
    };

    runWorkflow(params);
    setRunMenuAnchor(null);
  };

  return (
    <>
      <Button onClick={(e) => setRunMenuAnchor(e.currentTarget)} disabled={isRunning}>
        {isRunning ? 'Running...' : 'Run'}
      </Button>
      <Menu open={!!runMenuAnchor} onClose={() => setRunMenuAnchor(null)}>
        <MenuItem onClick={() => handleRunClick('run')}>Run workflow</MenuItem>
        <MenuItem
          onClick={() => handleRunClick('run-to-node')}
          disabled={!selectedNode}
        >
          Run to node
        </MenuItem>
        <MenuItem
          onClick={() => handleRunClick('run-from-node')}
          disabled={!selectedNode}
        >
          Run from node
        </MenuItem>
      </Menu>
    </>
  );
}
```

### In LogsPane

```typescript
function LogsPane() {
  const { logs, isRunning } = useWorkflowExecution();

  return (
    <div>
      {isRunning && <Spinner />}
      {logs.map((log, index) => (
        <LogEntry key={index} log={log} />
      ))}
    </div>
  );
}
```

### On Canvas Mount (Check Running Tasks)

```typescript
function Canvas() {
  const { checkRunningTasks, pollTaskProgress } = useWorkflowExecution();

  useEffect(() => {
    const checkExisting = async () => {
      const taskId = await checkRunningTasks();
      if (taskId) {
        // Resume polling for existing task
        await pollTaskProgress(taskId);
      }
    };

    checkExisting();
  }, []);

  // ...
}
```

---

## Run Types

| Type | Description | Requires Node |
|------|-------------|---------------|
| `run` | Run full workflow | No |
| `run-to-node` | Run from start to selected node | Yes |
| `run-from-node` | Run from selected node to end | Yes |

---

## Edge Cases

1. **Task already running**: Show existing logs, continue polling
2. **Network error during poll**: Retry with backoff
3. **Task failed**: Show error status, unlock canvas
4. **User navigates away**: Continue in background, show on return

---

## Implementation Checklist

- [ ] Create hook file at `hooks/api/useWorkflowExecution.ts`
- [ ] Add polling with proper cleanup
- [ ] Handle existing running tasks on mount
- [ ] Integrate with LogsPane component
- [ ] Add toast notifications for completion/failure
- [ ] Test all run types
- [ ] Test error recovery
