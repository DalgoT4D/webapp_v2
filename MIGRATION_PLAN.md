# Pipeline Overview Page Migration Plan

## Executive Summary

The **Pipeline Overview page** (`/pipeline`) in webapp is a **visual dashboard** showing pipeline run history with D3 bar charts. It is **different from the Orchestrate page** (`/orchestrate`) which lists pipelines in a table format for CRUD operations.

**Current State in webapp_v2_orchestrate_mig:**
- `/pipeline` page exists but is an **iframe wrapper** pointing to the old webapp
- `/orchestrate` page is fully migrated with native components

**Goal:** Replace the iframe wrapper with a native implementation.

---

## Key Differences: Pipeline Overview vs Orchestrate

| Aspect | Pipeline Overview (`/pipeline`) | Orchestrate (`/orchestrate`) |
|--------|--------------------------------|------------------------------|
| **Purpose** | Visual run history dashboard | Pipeline CRUD management |
| **API Endpoint** | `GET /api/dashboard/v1` | `GET /api/prefect/v1/flows/` |
| **Visualization** | D3 bar charts per pipeline | Table with rows |
| **Key Feature** | Visual run history bars | Create/Edit/Delete/Run |
| **Run Details** | Click bar → logs modal | Click History → logs modal |

---

## Data Flow Analysis

### API: `GET /api/dashboard/v1`

Returns array of pipeline data with historical runs:

```typescript
interface DashboardPipeline {
  id: string;
  deploymentName: string;
  name: string;
  status: string;
  lock: boolean;  // Is pipeline currently running?
  runs: Array<{
    id: string;
    name: string;
    status: string;           // "COMPLETED", "FAILED", etc.
    state_name: string;       // "DBT_TEST_FAILED" for warning
    startTime: string;
    totalRunTime: number;     // seconds
  }>;
  lastRun?: { startTime: string };
}
```

### Auto-Refresh Logic
- If any `pipeline.lock === true`: poll every 3 seconds
- If all unlocked: stop polling

---

## Component Architecture

### Source Files (webapp)

| File | Lines | Purpose |
|------|-------|---------|
| `pages/pipeline/index.tsx` | 432 | Main page + inline BarChart |
| `components/Flows/SingleFlowRunHistory.tsx` | 143 | Run logs modal |
| `components/Logs/LogCard.tsx` | 70 | Collapsible logs display |
| `components/Logs/LogSummaryCard.tsx` | 30 | Log summary wrapper |
| `components/Logs/LogSummaryBlock.tsx` | 159 | Task-specific log blocks |
| `utils/common.tsx` | 183 | Utilities (lastRunTime, delay, etc.) |
| `styles/Home.module.css` | 48 | Page styling |

### Target Structure (webapp_v2_orchestrate_mig)

```
webapp_v2_orchestrate_mig/
├── app/
│   └── pipeline/
│       └── page.tsx                    # UPDATE: Remove iframe, use native component
├── components/
│   └── pipeline/
│       ├── pipeline-overview.tsx       # NEW: Main overview component
│       ├── pipeline-bar-chart.tsx      # NEW: D3 bar chart
│       ├── single-flow-run-modal.tsx   # NEW: Logs modal (click on bar)
│       ├── log-card.tsx                # NEW: Expandable logs display
│       ├── log-summary-card.tsx        # NEW: AI summary display
│       └── log-summary-block.tsx       # NEW: Task-specific summary
├── hooks/api/
│   └── usePipelines.ts                 # UPDATE: Add usePipelineOverview hook
├── types/
│   └── pipeline.ts                     # UPDATE: Add DashboardPipeline types
└── constants/
    └── pipeline.ts                     # Already exists (mostly complete)
```

---

## Migration Tasks

### Phase 1: API & Types

#### Task 1.1: Add Types for Dashboard API
**File:** `types/pipeline.ts`

Add:
```typescript
// Dashboard API types (for /pipeline overview)
export interface DashboardRun {
  id: string;
  name: string;
  status: string;
  state_name: string;
  startTime: string;
  totalRunTime: number;
}

export interface DashboardPipeline {
  id: string;
  deploymentName: string;
  name: string;
  status: string;
  lock: boolean;
  runs: DashboardRun[];
  lastRun?: { startTime: string };
}
```

#### Task 1.2: Add usePipelineOverview Hook
**File:** `hooks/api/usePipelines.ts`

Add new hook:
```typescript
export function usePipelineOverview() {
  const { data, error, mutate, isLoading } = useSWR<DashboardPipeline[]>(
    '/api/dashboard/v1',
    apiGet,
    {
      refreshInterval: (latestData) => {
        const hasLockedPipeline = latestData?.some((p) => p.lock);
        return hasLockedPipeline ? POLLING_INTERVAL_WHEN_LOCKED : POLLING_INTERVAL_IDLE;
      },
      revalidateOnFocus: false,
    }
  );

  return {
    pipelines: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}
```

---

### Phase 2: Core Components

#### Task 2.1: Create BarChart Component
**File:** `components/pipeline/pipeline-bar-chart.tsx`

**Key Implementation Details:**
- Use D3.js for rendering (already in project dependencies)
- Bar dimensions: 8px width, 48px max height
- Colors:
  - Success (#00897B - teal)
  - Failed (#C15E5E - red)
  - DBT Test Failed (#df8e14 - orange)
- Tooltip on hover showing:
  - Start time (YYYY-MM-DD HH:mm:ss)
  - Runtime (formatted as hours/min/sec)
  - Status
  - "Check logs" clickable link
- Animated transition (1000ms)
- Horizontal baseline

**Props:**
```typescript
interface BarChartProps {
  runs: DashboardRun[];
  onSelectRun: (run: DashboardRun) => void;
  scaleToRuntime?: boolean;
}
```

#### Task 2.2: Create SingleFlowRunModal Component
**File:** `components/pipeline/single-flow-run-modal.tsx`

Replace the old SingleFlowRunHistory. Use existing:
- `Dialog` from `@/components/ui/dialog`
- Log fetching from `fetchFlowRunLogs` in usePipelines.ts

**Key Features:**
- Fetch logs on open: `GET /api/prefect/flow_runs/{flowRunId}/logs`
- Pagination: offset + limit (200)
- Optional AI summaries if `ENABLE_LOG_SUMMARIES` is true
- Show LogCard or LogSummaryCard based on data

#### Task 2.3: Create Log Components
**Files:**
- `components/pipeline/log-card.tsx`
- `components/pipeline/log-summary-card.tsx`
- `components/pipeline/log-summary-block.tsx`

Convert MUI components to Tailwind/Radix:
- `Card` → `div` with Tailwind classes
- `Collapse` → Custom expand/collapse or Radix Collapsible
- `Button` → `@/components/ui/button`
- `Typography` → semantic HTML with Tailwind

---

### Phase 3: Main Page Component

#### Task 3.1: Create Pipeline Overview Component
**File:** `components/pipeline/pipeline-overview.tsx`

**Structure:**
```tsx
export function PipelineOverview() {
  const { pipelines, isLoading } = usePipelineOverview();
  const [selectedRun, setSelectedRun] = useState<DashboardRun | null>(null);
  const [scaleByRuntime, setScaleByRuntime] = useState<Record<string, boolean>>({});

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="w-full p-12">
      {/* Header with pattern background */}
      <Header />

      {/* Pipeline list */}
      <div className="mt-6 mx-12">
        {pipelines.length === 0 ? (
          <EmptyState />
        ) : (
          pipelines.map((pipeline) => (
            <PipelineCard
              key={pipeline.deploymentName}
              pipeline={pipeline}
              scaleToRuntime={scaleByRuntime[pipeline.deploymentName] ?? true}
              onScaleChange={(val) => setScaleByRuntime(prev => ({...prev, [pipeline.deploymentName]: val}))}
              onSelectRun={setSelectedRun}
            />
          ))
        )}
      </div>

      {/* Logs Modal */}
      <SingleFlowRunModal
        run={selectedRun}
        open={!!selectedRun}
        onOpenChange={(open) => !open && setSelectedRun(null)}
      />
    </div>
  );
}
```

**Sub-components:**
1. **Header**: Pattern background with title "Pipeline Overview"
2. **PipelineCard**: Name, running status, bar chart, scale checkbox
3. **EmptyState**: "No pipelines available" message

#### Task 3.2: Update Pipeline Page
**File:** `app/pipeline/page.tsx`

Replace iframe wrapper:
```tsx
// BEFORE
import SharedIframe from './shared-iframe';
export default function PipelineOverview() {
  return <SharedIframe src={`${embeddedAppUrl}/pipeline`} title="Data Orchestration" />;
}

// AFTER
import { PipelineOverview } from '@/components/pipeline/pipeline-overview';
export default function PipelineOverviewPage() {
  return <PipelineOverview />;
}
```

---

### Phase 4: Styling Migration

#### MUI to Tailwind Conversion Reference

| MUI | Tailwind Equivalent |
|-----|---------------------|
| `sx={{ mt: 3 }}` | `className="mt-6"` (MUI uses 8px units) |
| `sx={{ mx: 12 }}` | `className="mx-24"` |
| `sx={{ p: 2 }}` | `className="p-4"` |
| `<Typography variant="h4">` | `<h1 className="text-2xl font-bold">` |
| `<Typography variant="body1">` | `<p className="text-base">` |
| `<Typography variant="subtitle2">` | `<span className="text-sm font-semibold">` |
| `<Paper elevation={0}>` | `<div className="bg-white rounded-xl shadow-sm">` |
| `<CircularProgress>` | `<Loader2 className="animate-spin">` (lucide-react) |
| `<Box display="flex">` | `<div className="flex">` |
| `<Checkbox>` | `<Checkbox>` from `@/components/ui/checkbox` |

#### Header Background Pattern
```tsx
<div
  className="relative min-h-[95px] rounded-2xl p-4 bg-repeat"
  style={{
    backgroundImage: `url('/images/pattern.png')`,
  }}
>
  <div className="absolute inset-0 bg-[#003d37] opacity-[0.87] rounded-2xl" />
  <h1 className="relative z-10 text-white text-2xl font-bold mt-2 ml-2">
    Pipeline Overview
  </h1>
</div>
```

---

## Dependencies Check

### Already Available in webapp_v2:
- [x] `d3` (for bar chart) - Check package.json
- [x] `date-fns` / `moment` (date formatting)
- [x] Radix UI components (Dialog, Checkbox, etc.)
- [x] lucide-react icons
- [x] SWR for data fetching
- [x] Tailwind CSS

### May Need to Add:
- [ ] Pattern image asset (`/public/images/pattern.png`)

---

## File-by-File Checklist

### New Files to Create:
- [ ] `components/pipeline/pipeline-overview.tsx`
- [ ] `components/pipeline/pipeline-bar-chart.tsx`
- [ ] `components/pipeline/single-flow-run-modal.tsx`
- [ ] `components/pipeline/log-card.tsx`
- [ ] `components/pipeline/log-summary-card.tsx`
- [ ] `components/pipeline/log-summary-block.tsx`

### Files to Update:
- [ ] `app/pipeline/page.tsx` - Replace iframe with native component
- [ ] `hooks/api/usePipelines.ts` - Add `usePipelineOverview` hook
- [ ] `types/pipeline.ts` - Add Dashboard types
- [ ] `components/pipeline-overview.tsx` - DELETE (old iframe wrapper)

### Assets to Copy:
- [ ] Pattern image for header background

---

## Testing Strategy

### Unit Tests:
1. `usePipelineOverview` hook - mock API response
2. `PipelineBarChart` - render with sample data
3. `SingleFlowRunModal` - logs fetching and display
4. Log components - expand/collapse, fetch more

### Integration Tests:
1. Pipeline overview page load
2. Auto-refresh when pipeline is running
3. Click bar → open logs modal
4. Scale to runtime toggle
5. Empty state display

---

## Estimated Complexity

| Component | Complexity | Notes |
|-----------|------------|-------|
| Types/API | Low | Straightforward additions |
| BarChart | High | D3 integration requires careful port |
| Log Components | Medium | Style conversion needed |
| Main Overview | Medium | State management for scale toggles |
| Modal | Low | Reuse existing patterns |

---

## Migration Order

1. **Day 1**: Types + API hook + basic page structure
2. **Day 2**: BarChart component (D3 integration)
3. **Day 3**: Log components + Modal
4. **Day 4**: Main overview component integration
5. **Day 5**: Styling polish + testing

---

## Questions to Resolve

1. **Pattern image**: Do we have this asset, or need to recreate?
2. **Log summaries**: Is `ENABLE_LOG_SUMMARIES` feature still needed?
3. **Mobile responsiveness**: The original doesn't seem mobile-friendly - should we improve?

---

## Summary

The migration requires:
- **6 new component files**
- **3 file updates**
- **~800-1000 lines of new code**

The most complex part is the D3 BarChart component, which needs careful porting to work with React 19 and maintain all the interactive features (tooltips, click handlers, animations).
