# DBT Transform Tab - Gap Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring webapp_v2's DBT Transform tab to full feature parity with webapp v1, fixing bugs and code quality issues along the way.

**Architecture:** The DBT Transform tab follows a parent-child pattern: `DBTTransformTab` owns log state and orchestrates, while `DBTTaskList` handles execution. We add a non-deployment execution path, fix the repository card's smart-update logic, add proper log pagination via Prefect's flow_run/logs endpoint, filter out `dbt-docs-generate` tasks, fix the broken permission check, and replace raw `toast()` calls with the project's `toastSuccess`/`toastError` helpers.

**Tech Stack:** Next.js 15, React 19, SWR, React Hook Form, Radix UI, Tailwind CSS v4, TypeScript

---

## Phase 1: Foundation — Constants, Types, and Bug Fixes

These are small, independent fixes that unblock later phases.

---

### Task 1: Add DBT task slug constants

v1 has named constants for task slugs (`TASK_DBTRUN`, `TASK_DBTTEST`, `TASK_DOCSGENERATE`, etc.). v2 only has them hardcoded locally in `CreateTaskDialog.tsx`. We need them project-wide.

**Files:**
- Create: `constants/dbt-tasks.ts`

**Step 1: Create the constants file**

```typescript
// constants/dbt-tasks.ts

// DBT task slug constants (matching backend slugs)
export const TASK_DBTRUN = 'dbt-run';
export const TASK_DBTTEST = 'dbt-test';
export const TASK_DBTCLEAN = 'dbt-clean';
export const TASK_DBTDEPS = 'dbt-deps';
export const TASK_GITPULL = 'git-pull';
export const TASK_DOCSGENERATE = 'dbt-docs-generate';
export const TASK_DBTCLOUD_JOB = 'dbt-cloud-job';

// Log pagination
export const FLOW_RUN_LOGS_OFFSET_LIMIT = 200;
```

**Step 2: Update CreateTaskDialog to use shared constants**

In `components/transform/CreateTaskDialog.tsx`, remove lines 35-36 (local constants) and import from the new file:

```typescript
import { TASK_GITPULL, TASK_DBTCLEAN } from '@/constants/dbt-tasks';
```

**Step 3: Commit**

```bash
git add constants/dbt-tasks.ts components/transform/CreateTaskDialog.tsx
git commit -m "feat: add shared DBT task slug constants"
```

---

### Task 2: Fix broken permission check in DBTRepositoryCard

**Bug:** `DBTRepositoryCard.tsx` line 39-40 uses `permissions.includes('can_create_dbt_workspace')`. But `permissions` is `Permission[]` (objects with `{slug, name}`), so `.includes(string)` always returns `false`. The Connect/Edit button is never disabled for missing permissions — it's always enabled.

**Files:**
- Modify: `components/transform/DBTRepositoryCard.tsx`

**Step 1: Fix the permission check**

Replace:
```typescript
const { permissions } = useUserPermissions();
```
with:
```typescript
const { hasPermission } = useUserPermissions();
```

Replace:
```typescript
const canCreate = permissions.includes('can_create_dbt_workspace');
const canEdit = permissions.includes('can_edit_dbt_workspace');
```
with:
```typescript
const canCreate = hasPermission('can_create_dbt_workspace');
const canEdit = hasPermission('can_edit_dbt_workspace');
```

**Step 2: Commit**

```bash
git add components/transform/DBTRepositoryCard.tsx
git commit -m "fix: use hasPermission() instead of broken includes() check in DBTRepositoryCard"
```

---

### Task 3: Replace raw `toast()` with project toast helpers

**Convention violation:** Multiple files import `toast` from `sonner` directly instead of using `toastSuccess`/`toastError` from `lib/toast.ts`.

**Files:**
- Modify: `components/transform/DBTTaskList.tsx`
- Modify: `components/transform/DBTRepositoryCard.tsx`
- Modify: `components/transform/CreateTaskDialog.tsx`

**Step 1: Fix DBTTaskList.tsx**

Remove: `import { toast } from 'sonner';`
Add: `import { toastSuccess, toastError } from '@/lib/toast';`

Replace all toast calls:
- `toast.error('No deployment found for this task')` → `toastError.api('No deployment found for this task')`
- `toast.error('Something went wrong - no flow run ID returned')` → `toastError.api('Something went wrong - no flow run ID returned')`
- `toast.success(\`${task.label} started successfully\`)` → `toastSuccess.generic(\`${task.label} started successfully\`)`
- `toast.error(error.message || \`Failed to run ${task.label}\`)` → `toastError.api(error, \`Failed to run ${task.label}\`)`
- `toast.success('Task deleted successfully')` → `toastSuccess.deleted('Task')`
- `toast.error(error.message || 'Failed to delete task')` → `toastError.delete(error, 'task')`

**Step 2: Fix DBTRepositoryCard.tsx**

Remove: `import { toast } from 'sonner';`
Add: `import { toastSuccess, toastError } from '@/lib/toast';`

Replace:
- `toast.success('Git repository updated successfully')` → `toastSuccess.updated('Git repository')`
- `toast.success('Git repository connected successfully')` → `toastSuccess.generic('Git repository connected successfully')`
- `toast.error(error.message || 'Failed to save Git repository')` → `toastError.save(error, 'Git repository')`

**Step 3: Fix CreateTaskDialog.tsx**

Remove: `import { toast } from 'sonner';`
Add: `import { toastSuccess, toastError } from '@/lib/toast';`

Replace:
- `toast.error('Please select a task')` → `toastError.api('Please select a task')`
- `toast.success('Org Task created successfully')` → `toastSuccess.created('Org Task')`
- `toast.error(error.message || 'Failed to create task')` → `toastError.create(error, 'task')`

**Step 4: Commit**

```bash
git add components/transform/DBTTaskList.tsx components/transform/DBTRepositoryCard.tsx components/transform/CreateTaskDialog.tsx
git commit -m "fix: replace raw toast() with project toastSuccess/toastError helpers"
```

---

### Task 4: Fix hardcoded color values

**Convention violation:** Several files use `style={{ backgroundColor: '#06887b' }}` instead of `style={{ backgroundColor: 'var(--primary)' }}`.

**Files:**
- Modify: `components/transform/DBTTransformTab.tsx` (line 75)
- Modify: `components/transform/DBTTaskList.tsx` (line 195)
- Modify: `components/transform/CreateTaskDialog.tsx` (line 315)

**Step 1: Replace all hardcoded hex colors**

In all three files, find `'#06887b'` and replace with `'var(--primary)'`.

**Step 2: Commit**

```bash
git add components/transform/DBTTransformTab.tsx components/transform/DBTTaskList.tsx components/transform/CreateTaskDialog.tsx
git commit -m "fix: replace hardcoded hex color with var(--primary) CSS variable"
```

---

## Phase 2: Task Execution — Non-Deployment Path

This is the **most critical gap**. v1 supports two execution paths:
1. **Deployment-based** (`POST prefect/v1/flows/{deploymentId}/flow_run/`) — for `dbt-run` or any task with a `deploymentId`
2. **Direct execution** (`POST prefect/tasks/{uuid}/run/`) — for `dbt-test`, `dbt-deps`, `dbt-seed`, etc.

v2 only has path 1 and errors out for tasks without a `deploymentId`.

---

### Task 5: Add direct task execution API function

**Files:**
- Modify: `hooks/api/usePrefectTasks.ts`

**Step 1: Add the `runPrefectTask` mutation function**

Add after the existing `runPrefectDeployment` function:

```typescript
// Run a Prefect task directly (non-deployment, e.g., dbt-test, dbt-deps)
export async function runPrefectTask(taskUuid: string): Promise<{
  status: string;
  result: Array<string | { id?: string; state_details?: { flow_run_id?: string } }>;
}> {
  return apiPost(`/api/prefect/tasks/${taskUuid}/run/`, {});
}
```

**Step 2: Add the flow run log fetching function**

Add below:

```typescript
// Fetch flow run logs (for dbt-test results that return flow state)
export async function fetchFlowRunLogs(
  flowRunId: string,
  offset: number = 0,
  limit: number = 200
): Promise<{ logs: { logs: Array<{ level: number; timestamp: string; message: string }> } }> {
  return apiGet(`/api/prefect/flow_runs/${flowRunId}/logs?offset=${offset}&limit=${limit}`);
}
```

**Step 3: Add flow run status fetch function**

```typescript
// Fetch flow run status (for polling during deployment execution)
export async function fetchFlowRunStatus(flowRunId: string): Promise<string> {
  try {
    const flowRun: PrefectFlowRun = await apiGet(`/api/prefect/flow_runs/${flowRunId}`);
    return flowRun?.state_type || 'FAILED';
  } catch {
    return 'FAILED';
  }
}
```

**Step 4: Commit**

```bash
git add hooks/api/usePrefectTasks.ts
git commit -m "feat: add direct task execution and flow run log API functions"
```

---

### Task 6: Implement dual execution paths in DBTTaskList

v1 logic (lines 132-138 of v1 `DBTTaskList.tsx`):
- If `task.slug === 'dbt-run'` OR `task.deploymentId` → deployment-based execution with polling loop
- Else → direct execution via `POST prefect/tasks/{uuid}/run/`

**Files:**
- Modify: `components/transform/DBTTaskList.tsx`
- Modify: `components/transform/DBTTransformTab.tsx`

**Step 1: Add imports to DBTTaskList**

```typescript
import {
  usePrefectTasks,
  runPrefectDeployment,
  runPrefectTask,
  fetchFlowRunLogs,
  fetchFlowRunStatus,
  deletePrefectTask,
} from '@/hooks/api/usePrefectTasks';
import { TASK_DBTRUN, TASK_DBTTEST, TASK_DOCSGENERATE } from '@/constants/dbt-tasks';
```

**Step 2: Rewrite `handleRunTask` to support both paths**

Replace the current `handleRunTask` function (lines 68-98) with:

```typescript
const handleRunTask = async (task: TransformTask) => {
  setRunningTask(task.uuid);
  setDbtRunLogs([]);
  setExpandLogs(true);

  try {
    // Path A: Deployment-based execution (dbt-run or any task with deploymentId)
    if (task.slug === TASK_DBTRUN || task.deploymentId) {
      await handleDeploymentRun(task);
    }
    // Path B: Direct execution (dbt-test, dbt-deps, dbt-seed, etc.)
    else {
      await handleDirectRun(task);
    }
  } catch (error: unknown) {
    toastError.api(error, `Failed to run ${task.label}`);
  } finally {
    setRunningTask(null);
    mutate(); // Refresh task list
  }
};

const handleDeploymentRun = async (task: TransformTask) => {
  if (!task.deploymentId) {
    toastError.api('No deployment found for this task');
    return;
  }

  const response = await runPrefectDeployment(task.deploymentId);

  if (!response.flow_run_id) {
    toastError.api('Something went wrong - no flow run ID returned');
    return;
  }

  setFlowRunId(response.flow_run_id);
  fetchLogs(response.flow_run_id);
  toastSuccess.generic(`${task.label} started successfully`);
  mutate();
};

const handleDirectRun = async (task: TransformTask) => {
  const response = await runPrefectTask(task.uuid);

  if (response?.status === 'success') {
    toastSuccess.generic(`${task.label} ran successfully`);
  } else {
    toastError.api(`${task.label} failed`);
  }

  // dbt-test special handling: if result contains a flow state object,
  // we need a separate API call to fetch the actual logs
  if (task.slug === TASK_DBTTEST && response?.result?.[0]) {
    const firstResult = response.result[0];
    if (typeof firstResult === 'object' && firstResult !== null && 'id' in firstResult) {
      const flowRunId = (firstResult as { state_details?: { flow_run_id?: string } })
        ?.state_details?.flow_run_id;
      if (flowRunId) {
        try {
          const logResponse = await fetchFlowRunLogs(flowRunId);
          if (logResponse?.logs?.logs?.length > 0) {
            const logsArray = logResponse.logs.logs.map(
              (logObj) => `- ${logObj.message}`
            );
            setDbtRunLogs(logsArray);
          }
        } catch {
          // Log fetch failed, fall through to direct result display
        }
        return;
      }
    }
  }

  // Default: set the result array directly as logs
  if (response?.result) {
    const logs = response.result.map((r) =>
      typeof r === 'string' ? r : JSON.stringify(r)
    );
    setDbtRunLogs(logs);
  }
};
```

**Step 3: Filter out dbt-docs-generate tasks from the table**

In the `tasks.map()` call (around line 154), add a filter:

Change:
```typescript
{tasks.map((task) => (
```
to:
```typescript
{tasks.filter((task) => task.slug !== TASK_DOCSGENERATE).map((task) => (
```

**Step 4: Commit**

```bash
git add components/transform/DBTTaskList.tsx
git commit -m "feat: add non-deployment task execution path and dbt-docs-generate filtering"
```

---

## Phase 3: Log System — Real Pagination via Prefect API

v2's log system uses `useTaskStatus` which polls a different endpoint (`/api/tasks/{id}?hashkey=...`) than v1's Prefect flow_run/logs endpoint. The "Load More Logs" button is non-functional. We need to support both log sources:
- **Task progress logs** (from `useTaskStatus`) — for real-time progress during execution
- **Prefect flow run logs** (from `GET prefect/flow_runs/{id}/logs`) — for detailed deployment execution logs with pagination

---

### Task 7: Add Prefect flow run log fetching to DBTTransformTab

**Files:**
- Modify: `components/transform/DBTTransformTab.tsx`
- Modify: `components/transform/LogCard.tsx`

**Step 1: Add log fetching with real pagination to DBTTransformTab**

Import the new API function:
```typescript
import { usePrefectTasks, useTaskStatus } from '@/hooks/api/usePrefectTasks';
import { fetchFlowRunLogs } from '@/hooks/api/usePrefectTasks';
import { FLOW_RUN_LOGS_OFFSET_LIMIT } from '@/constants/dbt-tasks';
```

Replace the log-related state and functions (lines 23-57) with:

```typescript
const [flowRunId, setFlowRunId] = useState('');
const [maxLogs, setMaxLogs] = useState<number>(FLOW_RUN_LOGS_OFFSET_LIMIT);
const [expandLogs, setExpandLogs] = useState<boolean>(false);
const [dbtSetupLogs, setDbtSetupLogs] = useState<string[]>([]);
const [showCreateDialog, setShowCreateDialog] = useState(false);
const dbtSetupLogsRef = useRef<string[]>([]);

// Check if any task is locked
const isAnyTaskLocked = tasks?.some((task) => task.lock) ?? false;

// Check permissions
const canCreateTask = hasPermission('can_create_orgtask');

// Poll for task progress logs (non-deployment path)
const { data: taskData } = useTaskStatus(flowRunId || null);

// Keep ref in sync with state for closure-safe access
useEffect(() => {
  dbtSetupLogsRef.current = dbtSetupLogs;
}, [dbtSetupLogs]);

// Update logs from task progress polling
useEffect(() => {
  if (taskData?.progress) {
    const logs = taskData.progress.map((p) => `[${p.status}] ${p.message}`);
    setDbtSetupLogs(logs);
  }
}, [taskData]);

// Fetch Prefect flow run logs with real offset/limit pagination
const fetchPrefectLogs = async (flow_run_id: string = flowRunId, maxLogsLimit: number = maxLogs) => {
  if (!flow_run_id) return;
  setExpandLogs(true);

  const currLogsCount = dbtSetupLogsRef.current.length;
  if (currLogsCount >= maxLogsLimit) return;

  try {
    const response = await fetchFlowRunLogs(
      flow_run_id,
      currLogsCount,
      maxLogsLimit - currLogsCount
    );

    if (response?.logs?.logs?.length > 0) {
      const newLogStrings = response.logs.logs.map(
        (logObj) => `- ${logObj.message}`
      );
      const allLogs = dbtSetupLogsRef.current.concat(newLogStrings);
      setDbtSetupLogs(allLogs);
      dbtSetupLogsRef.current = allLogs;
    }
  } catch {
    // Silently fail log fetching - non-critical
  }
};

const fetchMoreLogs = () => {
  const newMax = maxLogs + FLOW_RUN_LOGS_OFFSET_LIMIT;
  setMaxLogs(newMax);
  fetchPrefectLogs(flowRunId, newMax);
};

const handleFetchLogs = (flow_run_id: string) => {
  // Reset logs when starting a new task execution
  setDbtSetupLogs([]);
  dbtSetupLogsRef.current = [];
  setFlowRunId(flow_run_id);
  setExpandLogs(true);
  // Start initial log fetch
  fetchPrefectLogs(flow_run_id, maxLogs);
};
```

**Step 2: Commit**

```bash
git add components/transform/DBTTransformTab.tsx components/transform/LogCard.tsx
git commit -m "feat: add real Prefect flow run log pagination with offset/limit"
```

---

## Phase 4: Repository Card — Smart Update & UX Improvements

---

### Task 8: Implement smart field-change detection in Git Repository dialog

v1 detects what changed and only makes the necessary API calls:
- Schema only → `PUT dbt/v1/schema/`
- Git repo changed → `PUT dbt/connect_git_remote/` + optionally schema update
- Nothing changed → toast "No changes to save"

v2 always sends all fields to `PUT /api/dbt/dbt_workspace`.

**Files:**
- Modify: `hooks/api/useDbtWorkspace.ts`
- Modify: `components/transform/DBTRepositoryCard.tsx`

**Step 1: Add schema-only update and git-remote-connect endpoints**

In `hooks/api/useDbtWorkspace.ts`, add:

```typescript
// Update only the default schema
export async function updateSchema(schema: string) {
  return apiPut('/api/dbt/v1/schema/', {
    target_configs_schema: schema,
  });
}

// Connect/update git remote (v1 endpoint)
export async function connectGitRemote(gitrepoUrl: string, gitrepoAccessToken: string) {
  return apiPut('/api/dbt/connect_git_remote/', {
    gitrepoUrl,
    gitrepoAccessToken,
  });
}
```

**Step 2: Implement smart submit logic in DBTRepositoryCard**

Replace the `handleSubmit` function with smart-diff logic matching v1:

```typescript
const handleSubmit = async (data: DbtWorkspaceFormData) => {
  setLoading(true);
  try {
    if (isConnected) {
      // Smart update: detect what changed
      const schemaChanged = workspace?.default_schema !== data.defaultSchema;
      const gitRepoChanged =
        workspace?.gitrepo_url !== data.gitrepoUrl ||
        (data.gitrepoAccessToken && data.gitrepoAccessToken !== PAT_PLACEHOLDER);

      if (schemaChanged && !gitRepoChanged) {
        await updateSchema(data.defaultSchema);
        toastSuccess.updated('Schema');
      } else if (gitRepoChanged) {
        await connectGitRemote(data.gitrepoUrl, data.gitrepoAccessToken);
        toastSuccess.updated('Git repository');
        if (schemaChanged) {
          await updateSchema(data.defaultSchema);
        }
      } else {
        toastInfo.noChanges();
        setLoading(false);
        return;
      }
    } else {
      await connectGitRepository(data);
      toastSuccess.generic('Git repository connected successfully');
    }

    mutate();
    setShowDialog(false);
    form.reset();
    onConnectGit?.();
  } catch (error: unknown) {
    toastError.save(error, 'Git repository');
  } finally {
    setLoading(false);
  }
};
```

**Step 3: Pre-fill PAT with placeholder on edit (matching v1)**

Add a constant at the top:
```typescript
const PAT_PLACEHOLDER = '*********';
```

Update the form reset in the dialog-open `useEffect`:
```typescript
useEffect(() => {
  if (showDialog && workspace) {
    form.reset({
      gitrepoUrl: workspace.gitrepo_url || '',
      gitrepoAccessToken: isConnected ? PAT_PLACEHOLDER : '',
      defaultSchema: workspace.default_schema || 'intermediate',
    });
  }
}, [showDialog, workspace, form, isConnected]);
```

Make the token not required when editing (user can keep placeholder):
```typescript
{...form.register('gitrepoAccessToken', {
  required: isConnected ? false : 'Access token is required',
})}
```

**Step 4: Add PAT permissions warning**

After the PAT input field, add:

```tsx
<p className="text-sm text-amber-600 mt-1">
  Make sure your Personal Access Token has the following permissions:{' '}
  <strong>repo, workflow</strong>
</p>
```

**Step 5: Make repo URL clickable when connected**

In the `CardDescription`, replace:
```typescript
{isConnected
  ? `Connected: ${workspace.gitrepo_url}`
  : 'Connect your DBT project Git repository'}
```
with:
```tsx
{isConnected ? (
  <>
    Connected:{' '}
    <a
      href={workspace.gitrepo_url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline"
    >
      {workspace.gitrepo_url}
    </a>
  </>
) : (
  'Connect your DBT project Git repository'
)}
```

**Step 6: Show default schema when connected**

Add the schema display after the URL:
```tsx
{isConnected && workspace.default_schema && (
  <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded">
    {workspace.default_schema}
  </span>
)}
```

**Step 7: Commit**

```bash
git add hooks/api/useDbtWorkspace.ts components/transform/DBTRepositoryCard.tsx
git commit -m "feat: smart field-change detection in Git dialog, PAT pre-fill, clickable repo URL"
```

---

## Phase 5: Cleanup — Dead Code and Unused State

---

### Task 9: Remove dead code and unused state

**Files:**
- Modify: `components/transform/DBTTaskList.tsx`
- Modify: `components/transform/DBTTransformTab.tsx`

**Step 1: Remove unused `canEditTask` in DBTTaskList**

Remove line 66: `const canEditTask = hasPermission('can_edit_orgtask');`

**Step 2: Remove unused `formatLastRunTime` in DBTTaskList**

Remove lines 120-124 (the `formatLastRunTime` function) — it's defined but never called.

**Step 3: Remove unused `gitConnected` prop from DBTTransformTab**

The `gitConnected` prop is accepted but never used inside `DBTTransformTab`. Update the interface and destructuring:

```typescript
interface DBTTransformTabProps {
  onConnectGit: () => void;
}

export function DBTTransformTab({ onConnectGit }: DBTTransformTabProps) {
```

Update the parent `Transform.tsx` accordingly — remove passing `gitConnected`:
```tsx
<DBTTransformTab onConnectGit={() => setGitConnected(true)} />
```

**Step 4: Commit**

```bash
git add components/transform/DBTTaskList.tsx components/transform/DBTTransformTab.tsx components/transform/Transform.tsx
git commit -m "chore: remove dead code - unused permissions, functions, and props"
```

---

## Phase Summary

| Phase | Tasks | What it fixes |
|-------|-------|---------------|
| **1: Foundation** | Tasks 1-4 | Constants, permission bug, toast convention, color convention |
| **2: Execution** | Tasks 5-6 | Non-deployment task execution (`dbt-test`, `dbt-deps`, etc.), `dbt-docs-generate` filtering |
| **3: Logs** | Task 7 | Real log pagination via Prefect flow_run/logs endpoint |
| **4: Repo Card** | Task 8 | Smart field-change detection, PAT pre-fill, clickable URL, PAT permissions warning |
| **5: Cleanup** | Task 9 | Dead code removal |

## Dependency Order

```
Phase 1 (Tasks 1-4) — independent of each other, can be done in parallel
    ↓
Phase 2 (Tasks 5-6) — depends on Task 1 (constants) and Task 3 (toast helpers)
    ↓
Phase 3 (Task 7) — depends on Task 5 (API functions)
    ↓
Phase 4 (Task 8) — depends on Task 2 (permission fix) and Task 3 (toast helpers)
    ↓
Phase 5 (Task 9) — depends on all above being complete
```

Tasks within Phase 1 can be parallelized. Phases 2 and 4 could also run in parallel after Phase 1 completes.
