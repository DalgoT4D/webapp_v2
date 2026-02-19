# Data Quality Page Migration - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the SharedIframe placeholder at `/data-quality` with a native implementation that handles Elementary setup, report viewing (backend iframe), and report regeneration.

**Architecture:** State-machine orchestrator (`DataQuality`) renders one of three sub-components based on `GET /api/dbt/elementary-setup-status`. SWR hook for status check, imperative `apiGet`/`apiPost` for the sequential setup flow and report operations, `useRef`-based interval polling for lock/task status with cleanup on unmount.

**Tech Stack:** Next.js 15, React 19, SWR, Tailwind CSS, Radix UI (Card, Button), Lucide icons (Loader2, RefreshCw), date-fns (formatDistanceToNow), Sonner toasts via `lib/toast.ts`.

---

## Task 1: Create Types File

**Files:**
- Create: `components/data-quality/types.ts`

**Step 1: Create the types**

```typescript
export type ElementarySetupStatus = 'set-up' | 'not-set-up';

export interface ElementarySetupStatusResponse {
  status: ElementarySetupStatus;
}

export interface ElementaryReportTokenResponse {
  token: string;
  created_on_utc: string;
}

export interface ElementaryRefreshResponse {
  flow_run_id: string;
}

export interface ElementaryStatus {
  exists: {
    elementary_package?: string | Record<string, unknown>;
    elementary_target_schema?: string | Record<string, unknown>;
  };
  missing: {
    elementary_package?: string | Record<string, unknown>;
    elementary_target_schema?: string | Record<string, unknown>;
  };
}

export interface TaskProgressResponse {
  progress: Array<{
    status: string;
    message: string;
  }>;
}

export interface CreateTrackingTablesResponse {
  task_id: string;
  hashkey: string;
}
```

**Step 2: Commit**

```bash
git add components/data-quality/types.ts
git commit -m "feat(data-quality): add TypeScript types for Elementary API responses"
```

---

## Task 2: Create SWR Hook for Elementary Status

**Files:**
- Create: `hooks/api/useElementaryStatus.ts`

**Reference patterns:**
- `hooks/api/usePipelines.ts` for SWR hook structure
- `hooks/api/useFeatureFlags.ts` for conditional fetching

**Step 1: Create the hook**

```typescript
import useSWR from 'swr';
import { apiGet } from '@/lib/api';
import { ElementarySetupStatusResponse } from '@/components/data-quality/types';

export function useElementaryStatus() {
  const { data, error, mutate, isLoading } = useSWR<ElementarySetupStatusResponse>(
    '/api/dbt/elementary-setup-status',
    apiGet,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  return {
    status: data?.status ?? null,
    isLoading,
    error,
    mutate,
  };
}
```

**Step 2: Commit**

```bash
git add hooks/api/useElementaryStatus.ts
git commit -m "feat(data-quality): add useElementaryStatus SWR hook"
```

---

## Task 3: Create DbtNotConfigured Component

**Files:**
- Create: `components/data-quality/dbt-not-configured.tsx`

**Step 1: Create the component**

The simplest of the three states. Centered error message when dbt itself isn't configured for the org.

```tsx
'use client';

export function DbtNotConfigured({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center min-h-[20vh]" data-testid="dbt-not-configured">
      <div className="bg-white rounded-lg p-8 text-center">
        <p className="text-xl md:text-2xl lg:text-3xl font-normal text-foreground">{message}</p>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/data-quality/dbt-not-configured.tsx
git commit -m "feat(data-quality): add DbtNotConfigured error state component"
```

---

## Task 4: Create ElementarySetup Component

**Files:**
- Create: `components/data-quality/elementary-setup.tsx`

**Key behavior from v1 (`Elementary.tsx:266-289`):**
1. Click "Setup Elementary" -> `POST dbt/git_pull/` -> `GET dbt/check-dbt-files`
2. If missing items found: show MappingComponent (existing/missing dbt config cards)
3. If nothing missing: `POST create-elementary-profile/` -> `POST create-elementary-tracking-tables/` (poll) -> `POST create-edr-deployment/`
4. On completion: call `onSetupComplete()` to trigger status re-check

**Step 1: Create the component**

```tsx
'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { toastSuccess, toastError } from '@/lib/toast';
import { ElementaryStatus, CreateTrackingTablesResponse, TaskProgressResponse } from './types';

const TASK_POLL_INTERVAL = 3000;

const KEY_TO_FILENAME: Record<string, string> = {
  elementary_package: 'packages.yml',
  elementary_target_schema: 'dbt_project.yml',
};

function MappingComponent({ elementaryStatus }: { elementaryStatus: ElementaryStatus }) {
  const hasExists = Object.keys(elementaryStatus.exists).length > 0;
  const hasMissing = Object.keys(elementaryStatus.missing).length > 0;

  if (!hasExists && !hasMissing) return null;

  return (
    <div className="flex flex-col md:flex-row gap-4 w-full" data-testid="mapping-component">
      {hasExists && (
        <Card className="flex-1" data-testid="existing-config">
          <CardHeader>
            <CardTitle>Existing</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {Object.entries(elementaryStatus.exists).map(([key, value]) => (
                <li key={key}>
                  <p className="font-medium">{KEY_TO_FILENAME[key] ?? key}</p>
                  {typeof value === 'object' ? (
                    <pre className="whitespace-pre-wrap bg-gray-100 p-3 rounded font-mono text-sm mt-1">
                      {JSON.stringify(value, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-muted-foreground mt-1">{value}</p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {hasMissing && (
        <Card className="flex-[2]" data-testid="missing-config">
          <CardHeader>
            <CardTitle>Missing: Please add these missing lines to your dbt project</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {Object.entries(elementaryStatus.missing).map(([key, value]) => (
                <li key={key}>
                  <p className="font-medium">{KEY_TO_FILENAME[key] ?? key}</p>
                  <pre className="whitespace-pre-wrap bg-gray-100 p-3 rounded font-mono text-sm mt-1">
                    {typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
                  </pre>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ElementarySetupProps {
  onSetupComplete: () => void;
}

export function ElementarySetup({ onSetupComplete }: ElementarySetupProps) {
  const [loading, setLoading] = useState(false);
  const [elementaryStatus, setElementaryStatus] = useState<ElementaryStatus | null>(null);
  const abortRef = useRef(false);

  const pollForTaskRun = useCallback(async (taskId: string, hashKey: string) => {
    const response: TaskProgressResponse = await apiGet(
      `/api/tasks/${taskId}?hashkey=${hashKey}`
    );
    const lastMessage =
      response.progress?.length > 0
        ? response.progress[response.progress.length - 1]
        : null;

    if (!lastMessage || !['completed', 'failed'].includes(lastMessage.status)) {
      if (abortRef.current) return;
      await new Promise((r) => setTimeout(r, TASK_POLL_INTERVAL));
      if (abortRef.current) return;
      await pollForTaskRun(taskId, hashKey);
    } else if (lastMessage.status === 'failed') {
      throw new Error(lastMessage.message || 'Task failed');
    } else {
      toastSuccess.generic(lastMessage.message || 'Task completed');
    }
  }, []);

  const handleSetup = async () => {
    setLoading(true);
    abortRef.current = false;
    try {
      // Step 1: Git pull
      const gitPullResponse = await apiPost('/api/dbt/git_pull/', {});
      if (!gitPullResponse.success) {
        toastError.api('Something went wrong during git pull');
        return;
      }

      // Step 2: Check dbt files
      const filesStatus: ElementaryStatus = await apiGet('/api/dbt/check-dbt-files');
      setElementaryStatus(filesStatus);

      if (Object.keys(filesStatus.missing).length > 0) {
        // Missing config — show MappingComponent and stop
        return;
      }

      // Step 3: Create elementary profile
      const profileResponse = await apiPost('/api/dbt/create-elementary-profile/', {});
      if (profileResponse.status === 'success') {
        toastSuccess.generic('Elementary profile created successfully');
      } else {
        throw new Error('Failed to create elementary profile');
      }

      // Step 4: Create tracking tables (async, poll)
      const trackingResponse: CreateTrackingTablesResponse = await apiPost(
        '/api/dbt/create-elementary-tracking-tables/',
        {}
      );
      if (trackingResponse.task_id && trackingResponse.hashkey) {
        await new Promise((r) => setTimeout(r, TASK_POLL_INTERVAL));
        await pollForTaskRun(trackingResponse.task_id, trackingResponse.hashkey);
      } else {
        throw new Error('Failed to start tracking tables task');
      }

      // Step 5: Create EDR deployment
      const edrResponse = await apiPost('/api/dbt/create-edr-deployment/', {});
      if (edrResponse.status === 'success') {
        toastSuccess.generic('EDR deployment created successfully');
      } else {
        throw new Error('Failed to create EDR deployment');
      }

      onSetupComplete();
    } catch (err: any) {
      toastError.api(err, 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex flex-col items-center justify-center gap-8 mt-6"
      data-testid="elementary-setup"
    >
      {loading ? (
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="setup-loader" />
      ) : (
        <>
          <p className="text-xl text-center">
            You currently don&apos;t have Elementary setup. Please click the button below to setup
            Elementary.
          </p>
          <Button onClick={handleSetup} data-testid="setup-elementary-btn">
            Setup Elementary
          </Button>
        </>
      )}

      {elementaryStatus && <MappingComponent elementaryStatus={elementaryStatus} />}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/data-quality/elementary-setup.tsx
git commit -m "feat(data-quality): add ElementarySetup component with MappingComponent"
```

---

## Task 5: Create ElementaryReport Component

**Files:**
- Create: `components/data-quality/elementary-report.tsx`

**Key behavior from v1 (`Elementary.tsx:129-431`):**
1. On mount: fetch report token (`POST fetch-elementary-report/`) and check for lock (`GET elementary-lock/`)
2. Render iframe at `{BACKEND_URL}/elementary/{token}` with "Last generated: X ago" header
3. "Regenerate report" button: `POST refresh-elementary-report/` -> poll lock -> re-fetch token on completion
4. Lock polling every 5s via interval with cleanup

**Step 1: Create the component**

```tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { toastSuccess, toastError } from '@/lib/toast';
import { API_BASE_URL } from '@/lib/config';
import { formatDistanceToNow } from 'date-fns';
import { ElementaryReportTokenResponse } from './types';

const LOCK_POLL_INTERVAL = 5000;

export function ElementaryReport() {
  const [loading, setLoading] = useState(true);
  const [elementaryToken, setElementaryToken] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const lockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const clearLockPolling = useCallback(() => {
    if (lockIntervalRef.current) {
      clearInterval(lockIntervalRef.current);
      lockIntervalRef.current = null;
    }
  }, []);

  const fetchReportToken = useCallback(async () => {
    try {
      const response: ElementaryReportTokenResponse = await apiPost(
        '/api/dbt/fetch-elementary-report/',
        {}
      );
      if (response.token) {
        setElementaryToken(response.token);
        setGeneratedAt(
          formatDistanceToNow(new Date(response.created_on_utc), { addSuffix: true })
        );
      }
    } catch (err: any) {
      toastError.api(err, 'Failed to fetch report');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const startLockPolling = useCallback(() => {
    clearLockPolling();
    lockIntervalRef.current = setInterval(async () => {
      try {
        const response = await apiGet('/api/prefect/tasks/elementary-lock/');
        if (!response) {
          // Lock released — report is ready
          clearLockPolling();
          if (mountedRef.current) {
            setIsGenerating(false);
            toastSuccess.generic('Report generated successfully');
            fetchReportToken();
          }
        }
      } catch (err: any) {
        clearLockPolling();
        if (mountedRef.current) {
          setIsGenerating(false);
          toastError.api(err, 'Error checking report status');
        }
      }
    }, LOCK_POLL_INTERVAL);
  }, [clearLockPolling, fetchReportToken]);

  const checkForLock = useCallback(async () => {
    try {
      const response = await apiGet('/api/prefect/tasks/elementary-lock/');
      if (response) {
        setIsGenerating(true);
        startLockPolling();
      }
    } catch (err: any) {
      // Lock check error is non-fatal on initial load
      console.error('Lock check error:', err);
    }
  }, [startLockPolling]);

  const handleRegenerate = async () => {
    try {
      setIsGenerating(true);
      const response = await apiPost('/api/dbt/v1/refresh-elementary-report/', {});
      if (response.flow_run_id) {
        toastSuccess.generic(
          'Your latest report is being generated. This may take a few minutes. Thank you for your patience'
        );
        startLockPolling();
      }
    } catch (err: any) {
      toastError.api(err, 'Failed to regenerate report');
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchReportToken();
    checkForLock();
    return () => {
      mountedRef.current = false;
      clearLockPolling();
    };
  }, [fetchReportToken, checkForLock, clearLockPolling]);

  return (
    <div className="flex flex-col h-full" data-testid="elementary-report">
      {/* Header bar */}
      <div className="flex items-center justify-between px-1 py-2">
        <div>
          {elementaryToken && (
            <p className="text-lg font-semibold" data-testid="last-generated">
              Last generated: <span className="font-normal">{generatedAt}</span>
            </p>
          )}
        </div>
        <Button
          onClick={handleRegenerate}
          disabled={isGenerating}
          data-testid="regenerate-report-btn"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Generating report
            </>
          ) : (
            'Regenerate report'
          )}
        </Button>
      </div>

      {/* Report content */}
      <div className="flex-1 bg-white rounded-lg p-4 flex flex-col items-center justify-center">
        {loading ? (
          <Loader2
            className="h-8 w-8 animate-spin text-primary"
            data-testid="report-loader"
          />
        ) : elementaryToken ? (
          <iframe
            src={`${API_BASE_URL}/elementary/${elementaryToken}`}
            className="w-full border-0"
            style={{ height: 'calc(100vh - 210px)' }}
            title="Elementary Report"
            data-testid="elementary-iframe"
          />
        ) : (
          <p className="text-lg text-muted-foreground" data-testid="no-report-message">
            No report available. Please click on the button above to generate if you believe a
            report should be available.
          </p>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/data-quality/elementary-report.tsx
git commit -m "feat(data-quality): add ElementaryReport component with iframe and regeneration"
```

---

## Task 6: Create Main DataQuality Orchestrator

**Files:**
- Create: `components/data-quality/data-quality.tsx`
- Modify: `app/data-quality/page.tsx`

**Step 1: Create the orchestrator component**

This replaces the old `components/data-quality.tsx` (the SharedIframe wrapper).

```tsx
'use client';

import { Loader2 } from 'lucide-react';
import { useElementaryStatus } from '@/hooks/api/useElementaryStatus';
import { DbtNotConfigured } from './dbt-not-configured';
import { ElementarySetup } from './elementary-setup';
import { ElementaryReport } from './elementary-report';

export function DataQuality() {
  const { status, isLoading, error, mutate } = useElementaryStatus();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="data-quality-loader">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // DBT not configured — API returns an error with this specific message
  if (error) {
    const errorMessage =
      error?.message === 'dbt is not configured for this client'
        ? error.message
        : 'Failed to check Elementary status. Please try again.';
    return (
      <div className="p-6">
        <DbtNotConfigured message={errorMessage} />
      </div>
    );
  }

  if (status === 'not-set-up') {
    return (
      <div className="p-6">
        <ElementarySetup onSetupComplete={() => mutate()} />
      </div>
    );
  }

  if (status === 'set-up') {
    return (
      <div className="p-6 h-full">
        <ElementaryReport />
      </div>
    );
  }

  return null;
}
```

**Step 2: Update the page route**

Update `app/data-quality/page.tsx` to import from the new location:

```tsx
import { DataQuality } from '@/components/data-quality/data-quality';

export default function DataQualityPage() {
  return <DataQuality />;
}
```

**Step 3: Delete old placeholder**

Delete `components/data-quality.tsx` (the SharedIframe wrapper) since it's replaced.

**Step 4: Commit**

```bash
git add components/data-quality/data-quality.tsx app/data-quality/page.tsx
git rm components/data-quality.tsx
git commit -m "feat(data-quality): add DataQuality orchestrator and wire up page route"
```

---

## Task 7: Add Tests

**Files:**
- Create: `components/data-quality/__tests__/data-quality-mock-data.ts`
- Create: `components/data-quality/__tests__/data-quality.test.tsx`

**Reference patterns:**
- `components/pipeline/__tests__/pipeline-mock-data.ts` for mock data factory style
- `test-utils/api.ts` for `mockApiGet` / `mockApiPost`
- `test-utils/render.tsx` for `TestWrapper`

**Step 1: Create mock data factories**

```typescript
import {
  ElementarySetupStatusResponse,
  ElementaryReportTokenResponse,
  ElementaryStatus,
  ElementaryRefreshResponse,
  CreateTrackingTablesResponse,
  TaskProgressResponse,
} from '../types';

export function createMockSetupStatusResponse(
  status: 'set-up' | 'not-set-up' = 'set-up'
): ElementarySetupStatusResponse {
  return { status };
}

export function createMockReportTokenResponse(
  overrides?: Partial<ElementaryReportTokenResponse>
): ElementaryReportTokenResponse {
  return {
    token: 'mock-elementary-token-123',
    created_on_utc: '2026-02-20T10:00:00Z',
    ...overrides,
  };
}

export function createMockElementaryStatus(
  overrides?: Partial<ElementaryStatus>
): ElementaryStatus {
  return {
    exists: {},
    missing: {},
    ...overrides,
  };
}

export function createMockRefreshResponse(): ElementaryRefreshResponse {
  return { flow_run_id: 'mock-flow-run-id' };
}

export function createMockTrackingTablesResponse(): CreateTrackingTablesResponse {
  return { task_id: 'mock-task-id', hashkey: 'mock-hashkey' };
}

export function createMockTaskProgressResponse(
  status: string = 'completed',
  message: string = 'Done'
): TaskProgressResponse {
  return {
    progress: [{ status, message }],
  };
}
```

**Step 2: Create tests for the orchestrator**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet } from '@/test-utils/api';
import { DataQuality } from '../data-quality';
import { createMockSetupStatusResponse } from './data-quality-mock-data';

// Mock child components to isolate orchestrator logic
jest.mock('../elementary-report', () => ({
  ElementaryReport: () => <div data-testid="elementary-report">Report</div>,
}));
jest.mock('../elementary-setup', () => ({
  ElementarySetup: ({ onSetupComplete }: any) => (
    <div data-testid="elementary-setup">
      <button onClick={onSetupComplete}>Complete</button>
    </div>
  ),
}));
jest.mock('../dbt-not-configured', () => ({
  DbtNotConfigured: ({ message }: any) => (
    <div data-testid="dbt-not-configured">{message}</div>
  ),
}));

describe('DataQuality orchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loader while fetching status', () => {
    mockApiGet.mockReturnValue(new Promise(() => {})); // never resolves
    render(<DataQuality />, { wrapper: TestWrapper });
    expect(screen.getByTestId('data-quality-loader')).toBeInTheDocument();
  });

  it('renders ElementaryReport when status is set-up', async () => {
    mockApiGet.mockResolvedValue(createMockSetupStatusResponse('set-up'));
    render(<DataQuality />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getByTestId('elementary-report')).toBeInTheDocument();
    });
  });

  it('renders ElementarySetup when status is not-set-up', async () => {
    mockApiGet.mockResolvedValue(createMockSetupStatusResponse('not-set-up'));
    render(<DataQuality />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getByTestId('elementary-setup')).toBeInTheDocument();
    });
  });

  it('renders DbtNotConfigured when API returns dbt error', async () => {
    mockApiGet.mockRejectedValue(new Error('dbt is not configured for this client'));
    render(<DataQuality />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getByTestId('dbt-not-configured')).toBeInTheDocument();
      expect(screen.getByText('dbt is not configured for this client')).toBeInTheDocument();
    });
  });
});
```

**Step 3: Run tests**

Run: `npm run test -- components/data-quality/__tests__/data-quality.test.tsx`

**Step 4: Commit**

```bash
git add components/data-quality/__tests__/
git commit -m "test(data-quality): add orchestrator tests with mock data factories"
```

---

## Task 8: Verify Build and Lint

**Step 1: Run lint**

```bash
npm run lint
```

Fix any lint errors in the new files.

**Step 2: Run full test suite**

```bash
npm run test
```

Verify no regressions.

**Step 3: Run build**

```bash
npm run build
```

Verify production build succeeds.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(data-quality): address lint and build issues"
```

---

## Summary of All Files

| Action | File |
|--------|------|
| Create | `components/data-quality/types.ts` |
| Create | `hooks/api/useElementaryStatus.ts` |
| Create | `components/data-quality/dbt-not-configured.tsx` |
| Create | `components/data-quality/elementary-setup.tsx` |
| Create | `components/data-quality/elementary-report.tsx` |
| Create | `components/data-quality/data-quality.tsx` |
| Modify | `app/data-quality/page.tsx` (change import) |
| Delete | `components/data-quality.tsx` (old SharedIframe wrapper) |
| Create | `components/data-quality/__tests__/data-quality-mock-data.ts` |
| Create | `components/data-quality/__tests__/data-quality.test.tsx` |

**Existing files that need NO changes:**
- `components/main-layout.tsx` (nav item already configured)
- `hooks/api/useFeatureFlags.ts` (DATA_QUALITY flag already exists)
- `assets/icons/data-quality.tsx` (icon already exists)
- `components/navigation-title-handler.tsx` (title already mapped)
