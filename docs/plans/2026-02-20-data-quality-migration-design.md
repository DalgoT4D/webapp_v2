# Data Quality Page Migration Design

## Overview

Migrate the Data Quality page from webapp v1 (`Elementary.tsx`) to webapp_v2 as a native implementation, replacing the current `SharedIframe` placeholder.

## Architecture

### State Machine

The page has 3 mutually exclusive states determined by `GET /api/dbt/elementary-setup-status`:

```
┌─────────────────────┐
│   Page Load          │
│   checkSetupStatus() │
└────────┬────────────┘
         │
    ┌────┴────────────────────────────┐
    │              │                   │
    ▼              ▼                   ▼
 error:         status:             status:
 "dbt not       "not-set-up"        "set-up"
 configured"        │                   │
    │               ▼                   ▼
    ▼          ElementarySetup     ElementaryReport
 DbtNotConfigured   │              (iframe + regenerate)
                    │
              Setup Flow:
              1. POST dbt/git_pull/
              2. GET dbt/check-dbt-files
              3. POST dbt/create-elementary-profile/
              4. POST dbt/create-elementary-tracking-tables/
                 └─> poll GET tasks/{id}?hashkey={key}
              5. POST dbt/create-edr-deployment/
```

### File Structure

```
components/data-quality/
├── data-quality.tsx              # Main orchestrator (state machine)
├── elementary-setup.tsx          # Setup flow UI + MappingComponent
├── elementary-report.tsx         # iframe + regenerate button
└── dbt-not-configured.tsx        # Error state

hooks/api/
└── useElementaryStatus.ts        # SWR hook for setup status check
```

### API Endpoints (all from v1, unchanged)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/dbt/elementary-setup-status` | GET | Check if Elementary is configured |
| `/api/dbt/fetch-elementary-report/` | POST | Get token + timestamp for iframe |
| `/api/prefect/tasks/elementary-lock/` | GET | Check if report generation is in progress |
| `/api/dbt/v1/refresh-elementary-report/` | POST | Trigger report regeneration |
| `/api/dbt/git_pull/` | POST | Pull latest git changes (setup step 1) |
| `/api/dbt/check-dbt-files` | GET | Check packages.yml + dbt_project.yml |
| `/api/dbt/create-elementary-profile/` | POST | Create Elementary profile (setup step 3) |
| `/api/dbt/create-elementary-tracking-tables/` | POST | Create tracking tables (async task) |
| `/api/tasks/{taskId}?hashkey={hashKey}` | GET | Poll async task status |
| `/api/dbt/create-edr-deployment/` | POST | Create EDR deployment (setup step 5) |

### Component Details

**`data-quality.tsx`** (orchestrator)
- Calls `useElementaryStatus()` SWR hook on mount
- Renders one of 3 sub-components based on status
- On successful setup completion, mutates the SWR cache to re-check status

**`elementary-report.tsx`**
- Fetches report token via `apiPost('/api/dbt/fetch-elementary-report/', {})`
- Renders iframe: `{BACKEND_URL}/elementary/{token}`
- Shows "Last generated: X ago" using `date-fns` `formatDistanceToNow` (replacing moment.js)
- "Regenerate report" button triggers `apiPost('/api/dbt/v1/refresh-elementary-report/', {})`
- Lock polling via `useRef` interval (5s) with proper cleanup on unmount
- Button disabled + spinner animation while locked

**`elementary-setup.tsx`**
- "Setup Elementary" button triggers sequential setup flow
- On missing dbt files: renders `MappingComponent` inline (existing/missing cards)
- Loading spinner during setup steps
- All errors shown via Sonner toasts

**`dbt-not-configured.tsx`**
- Simple centered message: "dbt is not configured for this client"

### Key Improvements Over v1

1. **Proper cleanup**: AbortController for API calls, clearInterval for polling
2. **SWR for status check**: Caching, dedup, revalidation built-in
3. **No moment.js**: Use `date-fns` `formatDistanceToNow` instead
4. **Tailwind + Radix UI**: Replace MUI components
5. **Sonner toasts**: Replace GlobalContext-based toasts
6. **Type safety**: Proper TypeScript interfaces for all API responses

### Existing Infrastructure (no changes needed)

- Side nav: Already has "Quality" item under Data with feature flag control
- Route: `app/data-quality/page.tsx` already exists
- Feature flag: `useFeatureFlags` + `FeatureFlagKeys.DATA_QUALITY` already wired
- Icon: `assets/icons/data-quality.tsx` already exists
- Navigation title: Already mapped in `navigation-title-handler.tsx`
