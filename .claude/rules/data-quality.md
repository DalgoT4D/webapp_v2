---
description: Data Quality domain map — Elementary-based dbt test/quality reports, setup flow, and async report generation.
paths:
  - "components/data-quality/**"
  - "app/data-quality/**"
  - "hooks/api/useElementaryStatus.ts"
  - "types/data-quality.ts"
  - "constants/data-quality.ts"
---

# Data Quality — Domain Map

Elementary-based dbt data-quality reporting. A one-time setup (git pull → profile → tracking tables → EDR deployment), then async report generation served as an embedded iframe.

## Where things live

| Concern | Location |
|---|---|
| Page (entry) | `app/data-quality/page.tsx` → `components/data-quality/data-quality.tsx` (state machine: loading → not-set-up / set-up / error) |
| Setup flow | `components/data-quality/elementary-setup.tsx` |
| Report viewer (iframe) | `components/data-quality/elementary-report.tsx` |
| Hook | `hooks/api/useElementaryStatus.ts` (`gitPull`, `checkDbtFiles`, `refreshElementaryReport`, `checkElementaryLock`) |
| Types / constants | `types/data-quality.ts`, `constants/data-quality.ts` (`TASK_POLL_INTERVAL_MS=3000`, `LOCK_POLL_INTERVAL_MS=5000`) |
| Backend | `DDP_backend/ddpui/ddpdbt/elementary_service.py`, `api/dbt_api.py`, `html/elementary.py` (iframe via Redis), `api/orgtask_api.py` (lock) |

## Data flow

```
Setup:
  POST /api/dbt/git_pull/ → GET /api/dbt/check-dbt-files
  → POST /api/dbt/create-elementary-profile/
  → POST /api/dbt/create-elementary-tracking-tables/ → task_id+hashkey → poll /api/tasks/{taskId}?hashkey=
  → POST /api/dbt/create-edr-deployment/
Generate + view report:
  POST /api/dbt/v1/refresh-elementary-report/ → flow_run_id (Prefect)
  poll GET /api/prefect/tasks/elementary-lock/ (5s) until null
  POST /api/dbt/fetch-elementary-report/ → token (S3 → Redis, 600s TTL)
  iframe src=/elementary/{token} → GET /elementary/<token>/
```

## ⚠️ Gotchas

- **Completion detected by lock-absence** — report regen triggers a Prefect flow; "done" = `elementary-lock` polls back to `null`, not an explicit success status.
- **S3 + Redis token, silent expiry** — HTML is stored in S3, cached in Redis with a 600s TTL keyed by token; tokens expire silently (re-fetch on failure).
- **Setup can halt on missing dbt config** — `checkDbtFiles()` returns `{exists, missing}`; if `missing` is non-empty the user must hand-edit `dbt_project.yml`/`packages.yml` before retrying.
