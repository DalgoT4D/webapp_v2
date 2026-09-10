/**
 * The local-dev sync shortcut (see ADVANCE_ON_SYNC_START in tour-gate.tsx).
 *
 * Its own file because the constant is computed at module load from
 * NEXT_PUBLIC_WEBAPP_ENVIRONMENT, and tour-gate.test.tsx pins that to 'staging' for the whole
 * suite — the two values can't coexist in one module registry.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet } from '@/test-utils/api';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import { SyncStatus } from '@/constants/connections';
import {
  savePath,
  saveTrackedConnection,
  saveWalkthroughStage,
} from '../insight-walkthrough-constants';
import { TourGate } from '../tour-gate';

jest.mock('@/constants/constants', () => ({
  ...jest.requireActual('@/constants/constants'),
  NEXT_PUBLIC_WEBAPP_ENVIRONMENT: 'local',
}));

jest.mock('../product-tour', () => ({
  ProductTour: React.forwardRef(function MockProductTour(
    _props: Record<string, unknown>,
    ref: React.Ref<{ startTour: (startIndex?: number) => void }>
  ) {
    React.useImperativeHandle(ref, () => ({ startTour: jest.fn() }));
    return <div data-testid="mock-product-tour" />;
  }),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/ingest',
  useRouter: () => ({ push: jest.fn(), prefetch: jest.fn() }),
}));

jest.mock('@/stores/authStore', () => ({ useAuthStore: jest.fn() }));
import { useAuthStore, type OrgUser } from '@/stores/authStore';

const MS_PER_DAY = 86_400_000;

const ORG_USER: OrgUser = {
  user_id: 1,
  email: 'priya@ngo.org',
  org: { slug: 'trial-org', name: 'Trial Org', viz_url: '' },
  active: true,
  new_role_slug: 'analyst',
  permissions: [],
  has_seen_rbac_notice: true,
  subscription_plan: 'Free Trial',
  plan_start_date: new Date(Date.now() - 4 * MS_PER_DAY).toISOString(),
  plan_end_date: new Date(Date.now() + 10.5 * MS_PER_DAY).toISOString(),
};

function setupAuthStore() {
  const state = { orgUsers: [ORG_USER], selectedOrgSlug: ORG_USER.org.slug };
  (useAuthStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: typeof state) => unknown) => selector(state)
  );
  (useAuthStore as unknown as { getState: () => typeof state }).getState = () => state;
}

/** One connection, with whatever sync state the test wants it in. */
function mockConnection(connection: Record<string, unknown>) {
  mockApiGet.mockImplementation((path: string) => {
    if (path === '/api/userpreferences/') {
      return Promise.resolve({ success: true, res: { trial_walkthrough: {} } });
    }
    if (path === '/api/airbyte/v1/connections') return Promise.resolve([connection]);
    return undefined;
  });
}

const renderGate = () =>
  render(
    <TestWrapper>
      <TourGate />
    </TestWrapper>
  );

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  useInsightWalkthroughStore.setState({
    active: false,
    orgSlug: null,
    flow: null,
    stage: null,
    path: null,
    trackedConnectionId: null,
    suppressCoachmark: false,
  });
  setupAuthStore();
});

it('hands the automate-pipeline fork to Transform without waiting for a sync', async () => {
  // The point of the shortcut: on a laptop the connection often never reports anything at all,
  // and the walkthrough's transform/orchestrate half was unreachable because of it.
  savePath('automate_pipeline', 'automate_pipeline');
  saveWalkthroughStage('automate_pipeline', 'pipeline_source_next');
  saveTrackedConnection('automate_pipeline', 'conn-1');
  mockConnection({ connectionId: 'conn-1', lock: null, lastRun: null });

  renderGate();

  await waitFor(() =>
    expect(useInsightWalkthroughStore.getState().stage).toBe('pipeline_transform_intro')
  );
});

it('hands the own-data fork to the chart flow the same way', async () => {
  savePath('insights', 'own_data');
  saveWalkthroughStage('insights', 'own_data_source_next');
  saveTrackedConnection('insights', 'conn-1');
  mockConnection({ connectionId: 'conn-1', lock: null, lastRun: null });

  renderGate();

  await waitFor(() => expect(useInsightWalkthroughStore.getState().stage).toBe('chart_intro'));
});

it('moves on even when the local sync failed, since the wait is what is being skipped', async () => {
  savePath('automate_pipeline', 'automate_pipeline');
  saveWalkthroughStage('automate_pipeline', 'pipeline_source_next');
  saveTrackedConnection('automate_pipeline', 'conn-1');
  mockConnection({
    connectionId: 'conn-1',
    lock: null,
    lastRun: { job_id: 77, status: SyncStatus.FAILED },
  });

  renderGate();

  await waitFor(() =>
    expect(useInsightWalkthroughStore.getState().stage).toBe('pipeline_transform_intro')
  );
  // No failure coachmark either — that stage exists to ask for a retry the shortcut doesn't need.
  expect(screen.queryByText(/didn’t finish/)).not.toBeInTheDocument();
});
