---
description: Pipeline + Orchestrate domain map — Prefect-based pipelines, runs, logs, smart polling. Also the repo's reference-implementation feature for conventions.
paths:
  - "components/pipeline/**"
  - "app/pipeline/**"
  - "app/orchestrate/**"
  - "hooks/api/usePipelines.ts"
  - "hooks/api/usePrefectTasks.ts"
  - "hooks/api/useFlowRunLogs.ts"
  - "hooks/api/useWorkflowExecution.ts"
  - "types/pipeline.ts"
  - "constants/pipeline.ts"
---

# Pipeline + Orchestrate — Domain Map

Prefect-based orchestration: a pipeline chains ingest connections + transform tasks on a cron, runs as a Prefect deployment, and streams run logs. **This is the codebase's reference-implementation feature** — mirror its file organization (see `rules/components.md`).

## Where things live

| Concern | Location |
|---|---|
| Pipeline list / form / task-seq / history | `components/pipeline/orchestrate/{pipeline-list,pipeline-form,task-sequence,pipeline-run-history}.tsx` |
| Overview dashboard | `components/pipeline/overview/{pipeline-overview,pipeline-section,pipeline-card,pipeline-bar-chart}.tsx` |
| Shared logs UI | `components/pipeline/{logs-table,log-card}.tsx` |
| Hooks | `hooks/api/usePipelines.ts` (list w/ smart polling, CRUD, history, logs, log-summary), `usePrefectTasks.ts`, `useFlowRunLogs.ts` (offset pagination) |
| Pages | `app/pipeline/page.tsx` (overview), `app/orchestrate/page.tsx` (list), `app/orchestrate/create/`, `app/orchestrate/[id]/edit/` |
| Types | `types/pipeline.ts` (`Pipeline`, `FlowRun`, `TaskRun`, `LogEntry`) |
| Constants | `constants/pipeline.ts` (`LockStatus`, `FlowRunStatus`, `PipelineRunDisplayStatus`, polling intervals) |
| Backend | `DDP_backend/ddpui/api/pipeline_api.py`, `core/orchestrate/pipeline_service.py`, `ddpprefect/prefect_service.py` |

> Note: `useWorkflowExecution.ts` (2s Celery polling) is used by the **transform** page, not pipelines — don't conflate it with pipeline run polling.

## Data flow

```
Create:  POST /api/prefect/v1/flows/  { name, cron, connections[], transformTasks[] }
Deploy:  PUT  /api/prefect/v1/flows/{deploymentId}
Run:     POST /api/prefect/v1/flows/{deploymentId}/flow_run/  → sets Pipeline.lock
Poll:    usePipelines refreshInterval → GET /api/prefect/v1/flows  (3s while any lock, else 0)
History: GET /api/prefect/v1/flows/{deploymentId}/flow_runs/history?limit&offset
Logs:    GET /api/prefect/flow_runs/{flowRunId}/logs?taskRunId&offset&limit
AI summary: GET /api/prefect/v1/flow_runs/{id}/logsummary → task_id → poll /api/tasks/stp/{taskId}
```

## ⚠️ Gotchas

- **Smart polling via SWR `refreshInterval`** — returns 3000ms while any pipeline has a `.lock`, else 0. Stops automatically when locks clear; no manual cleanup.
- **Lock status enum mapping** — backend sends lowercase (`queued`/`running`/`locked`/`complete`); the list maps `lock.status` → `PipelineRunDisplayStatus` for badges.
- **dbt-test failure is a distinct state** — `state_name === 'DBT_TEST_FAILED'` renders as a yellow warning, not a red `status === 'FAILED'`.
- **Task-sequence ordering constraints** — custom tasks may only sit between dbt-run and dbt-test; system tasks are immovable (enforced in drag-drop validation).
