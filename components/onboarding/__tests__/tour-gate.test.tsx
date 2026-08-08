import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet } from '@/test-utils/api';
import { TOUR_SEEN_STORAGE_PREFIX, saveTourProgress } from '../tour-constants';
import {
  savePath,
  saveWalkthroughStage,
  saveTrackedConnection,
  markConnectedRealData,
  hasConnectedRealData,
} from '../insight-walkthrough-constants';
import { SyncStatus } from '@/constants/connections';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import { TourGate } from '../tour-gate';

// ============ Mocks ============

const mockStartTour = jest.fn();
// Captured so tests can assert what TourGate hands down — the post-tour choice gate lives
// inside ProductTour (driver.js, unmountable in jsdom), so the prop is the testable seam.
const mockTourProps: {
  current: {
    canOfferPostTourChoice?: boolean;
    onTourEnd?: (reason: 'completed' | 'skipped') => void;
    onOfferPostTourChoice?: () => void;
  } | null;
} = { current: null };
jest.mock('../product-tour', () => ({
  ProductTour: React.forwardRef(function MockProductTour(
    props: {
      orgSlug: string;
      canOfferPostTourChoice?: boolean;
      onTourEnd?: (reason: 'completed' | 'skipped') => void;
      onOfferPostTourChoice?: () => void;
    },
    ref: React.Ref<{ startTour: (startIndex?: number) => void }>
  ) {
    mockTourProps.current = props;
    React.useImperativeHandle(ref, () => ({ startTour: mockStartTour }));
    return <div data-testid="mock-product-tour" />;
  }),
}));

let mockPathname = '/impact';
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush, prefetch: jest.fn() }),
}));

jest.mock('@/stores/authStore', () => ({ useAuthStore: jest.fn() }));
import { useAuthStore, type OrgUser } from '@/stores/authStore';

// ============ Helpers ============

function buildOrgUser(overrides: Partial<OrgUser> = {}): OrgUser {
  return {
    user_id: 1,
    email: 'priya@ngo.org',
    org: { slug: 'trial-org', name: 'Trial Org', viz_url: '' },
    active: true,
    new_role_slug: 'analyst',
    permissions: [],
    has_seen_rbac_notice: true,
    subscription_plan: 'Free Trial',
    ...overrides,
  };
}

function setupAuthStore(orgUser: OrgUser | null) {
  const state = {
    orgUsers: orgUser ? [orgUser] : [],
    selectedOrgSlug: orgUser ? orgUser.org.slug : null,
  };
  (useAuthStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: typeof state) => unknown) => selector(state)
  );
  // walkthrough-scope.ts reads the store outside React (useAuthStore.getState()), which the
  // bare jest.fn() mock doesn't provide — without this every storage helper sees no scope and
  // silently writes nothing.
  (useAuthStore as unknown as { getState: () => typeof state }).getState = () => state;
}

const renderGate = () =>
  render(
    <TestWrapper>
      <TourGate />
    </TestWrapper>
  );

// ============ Tests ============

describe('TourGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockPathname = '/impact';
    mockTourProps.current = null;
    // Default: no flow decided on the backend, so gating falls to localStorage as before.
    // Individual tests override this to exercise the backend gate.
    mockApiGet.mockImplementation((path: string) =>
      path === '/api/userpreferences/'
        ? Promise.resolve({ success: true, res: { trial_walkthrough: {} } })
        : undefined
    );
  });

  it('renders nothing for a non-trial org', () => {
    setupAuthStore(buildOrgUser({ subscription_plan: 'Paid' }));
    renderGate();

    expect(screen.queryByTestId('mock-product-tour')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tour-intent-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('getting-started-widget')).not.toBeInTheDocument();
  });

  it('renders nothing when there is no org user', () => {
    setupAuthStore(null);
    renderGate();

    expect(screen.queryByTestId('mock-product-tour')).not.toBeInTheDocument();
  });

  it('off /impact: tour engine and Get Started pill mount, but the panel stays collapsed', async () => {
    mockPathname = '/charts';
    setupAuthStore(buildOrgUser());
    renderGate();

    expect(screen.getByTestId('mock-product-tour')).toBeInTheDocument();
    // The pill is available app-wide...
    expect(await screen.findByTestId('getting-started-widget-pill')).toBeInTheDocument();
    // ...but the panel only auto-opens on /impact.
    expect(screen.queryByTestId('getting-started-widget')).not.toBeInTheDocument();
  });

  it('auto-opens the intent modal on /impact when the tour has not been seen', async () => {
    setupAuthStore(buildOrgUser());
    renderGate();

    // findBy: the modal now waits on the backend trial_walkthrough gate before opening.
    expect(await screen.findByTestId('tour-intent-modal')).toBeInTheDocument();
    expect(screen.getByText('What brings you to Dalgo')).toBeInTheDocument();
    expect(screen.getByTestId('getting-started-widget')).toBeInTheDocument();
    // The tour is offered as the panel's "Take a 2 min tour" link, not a checklist item.
    expect(screen.getByTestId('getting-started-widget-tour-link')).toBeInTheDocument();
  });

  it('does not auto-open the intent modal when the org already saw the tour', () => {
    localStorage.setItem(`${TOUR_SEEN_STORAGE_PREFIX}trial-org`, '1');
    setupAuthStore(buildOrgUser());
    renderGate();

    // Dialog content only renders in the DOM when open (Radix unmounts when closed).
    expect(screen.queryByText('What brings you to Dalgo')).not.toBeInTheDocument();
    // Checklist shape is the same either way — the two build flows.
    expect(screen.getByTestId('getting-started-widget-item-build-insight')).toBeInTheDocument();
    expect(screen.getByTestId('getting-started-widget-item-automate-pipeline')).toBeInTheDocument();
  });

  it('starts the driver.js tour when the intent modal\'s "Explore the platform" option is picked', async () => {
    const user = userEvent.setup();
    setupAuthStore(buildOrgUser());
    renderGate();

    // findBy, not getBy: the modal only opens once the backend trial_walkthrough gate has
    // loaded (see useTrialWalkthrough) — it is no longer open on the first render.
    await user.click(await screen.findByTestId('tour-intent-option-tour'));

    expect(mockStartTour).toHaveBeenCalledTimes(1);
  });

  it('hides the getting-started widget while the tour runs, and restores it when it ends', async () => {
    const user = userEvent.setup();
    localStorage.setItem(`${TOUR_SEEN_STORAGE_PREFIX}trial-org`, '1');
    setupAuthStore(buildOrgUser());
    renderGate();

    const pill = await screen.findByTestId('getting-started-widget-pill');
    expect(pill).toBeInTheDocument();

    await user.click(screen.getByTestId('getting-started-widget-tour-link'));

    // Whole widget goes — panel AND pill — so nothing floats over the spotlighted content.
    expect(screen.queryByTestId('getting-started-widget')).not.toBeInTheDocument();
    expect(screen.queryByTestId('getting-started-widget-pill')).not.toBeInTheDocument();

    await act(async () => {
      mockTourProps.current?.onTourEnd?.('completed');
    });

    expect(await screen.findByTestId('getting-started-widget-pill')).toBeInTheDocument();
  });

  it('stops offering the post-tour choice once BOTH insight flows are decided', async () => {
    mockApiGet.mockImplementation((path: string) =>
      path === '/api/userpreferences/'
        ? Promise.resolve({
            success: true,
            res: {
              trial_walkthrough: {
                insights: { skipped: false, completed: true },
                automate_pipeline: { skipped: true, completed: false },
              },
            },
          })
        : undefined
    );
    setupAuthStore(buildOrgUser());
    renderGate();

    // product_tour is deliberately left undecided, so the intent modal opening is a
    // reliable signal that the backend gate has resolved before we assert on the prop.
    await screen.findByText('What brings you to Dalgo');
    expect(mockTourProps.current?.canOfferPostTourChoice).toBe(false);
  });

  it('still offers the post-tour choice while one insight flow is undecided', async () => {
    mockApiGet.mockImplementation((path: string) =>
      path === '/api/userpreferences/'
        ? Promise.resolve({
            success: true,
            res: {
              trial_walkthrough: { insights: { skipped: false, completed: true } },
            },
          })
        : undefined
    );
    setupAuthStore(buildOrgUser());
    renderGate();

    await screen.findByText('What brings you to Dalgo');
    expect(mockTourProps.current?.canOfferPostTourChoice).toBe(true);
  });

  it('keeps offering build-insights after automate-pipeline completes — they are separate flows', async () => {
    mockApiGet.mockImplementation((path: string) =>
      path === '/api/userpreferences/'
        ? Promise.resolve({
            success: true,
            res: {
              trial_walkthrough: { automate_pipeline: { skipped: false, completed: true } },
            },
          })
        : undefined
    );
    setupAuthStore(buildOrgUser());
    renderGate();

    await screen.findByText('What brings you to Dalgo');
    // The pipeline walkthrough now ends at the created pipeline rather than running on into
    // the chart -> dashboard -> share tail, so finishing it says nothing about insights —
    // and building one is exactly the intended follow-up.
    expect(mockTourProps.current?.canOfferPostTourChoice).toBe(true);
  });

  it('offers only the flow that is still open when the tour is re-run', async () => {
    mockApiGet.mockImplementation((path: string) =>
      path === '/api/userpreferences/'
        ? Promise.resolve({
            success: true,
            res: {
              trial_walkthrough: { automate_pipeline: { skipped: true, completed: false } },
            },
          })
        : undefined
    );
    localStorage.setItem(`${TOUR_SEEN_STORAGE_PREFIX}trial-org`, '1');
    setupAuthStore(buildOrgUser());
    renderGate();

    await screen.findByTestId('getting-started-widget-pill');
    await act(async () => {
      mockTourProps.current?.onOfferPostTourChoice?.();
    });

    expect(await screen.findByTestId('get-started-option-insight')).toBeInTheDocument();
    expect(screen.queryByTestId('get-started-option-pipeline')).not.toBeInTheDocument();
  });

  it('does not auto-open the intent modal when the backend says the tour was already decided', async () => {
    // localStorage is deliberately left clean — this asserts the backend gate alone
    // suppresses the modal, which is what covers a user on a fresh/cleared browser.
    mockApiGet.mockImplementation((path: string) =>
      path === '/api/userpreferences/'
        ? Promise.resolve({
            success: true,
            res: { trial_walkthrough: { product_tour: { skipped: true, completed: false } } },
          })
        : undefined
    );
    setupAuthStore(buildOrgUser());
    renderGate();

    // The widget mounts on the same gated render pass, so its presence means the gate has
    // resolved — without this the assertion below could pass simply by running too early.
    await screen.findByTestId('getting-started-widget-pill');
    expect(screen.queryByText('What brings you to Dalgo')).not.toBeInTheDocument();
  });

  it('starts the tour from the getting-started widget link', async () => {
    const user = userEvent.setup();
    // Mark seen so the intent modal doesn't also auto-open and cover the widget —
    // this test is only about the widget's own trigger wiring.
    localStorage.setItem(`${TOUR_SEEN_STORAGE_PREFIX}trial-org`, '1');
    setupAuthStore(buildOrgUser());
    renderGate();

    await user.click(screen.getByTestId('getting-started-widget-tour-link'));

    expect(mockStartTour).toHaveBeenCalledTimes(1);
  });

  /** Seeds the backend record — the only source the checklist ticks read. */
  const mockWalkthroughState = (trial_walkthrough: Record<string, unknown>) =>
    mockApiGet.mockImplementation((path: string) =>
      path === '/api/userpreferences/'
        ? Promise.resolve({ success: true, res: { trial_walkthrough } })
        : undefined
    );

  /**
   * Waits for a row's icon to settle. Rows render unchecked first — a tick now depends on
   * the backend fetch resolving, not on synchronous localStorage.
   */
  const expectTick = async (key: string, checked: boolean) => {
    const expected = checked ? 'text-primary' : 'text-muted-foreground';
    await waitFor(async () => {
      const row = await screen.findByTestId(`getting-started-widget-item-${key}`);
      expect(row.querySelector('svg')).toHaveClass(expected);
    });
  };

  it('ticks "Build your first insight" once the insights flow is recorded complete', async () => {
    localStorage.setItem(`${TOUR_SEEN_STORAGE_PREFIX}trial-org`, '1');
    mockWalkthroughState({ insights: { skipped: false, completed: true } });
    setupAuthStore(buildOrgUser());
    renderGate();

    await expectTick('build-insight', true);
    await expectTick('automate-pipeline', false);
  });

  it('ticks only the pipeline row when automate-pipeline completes', async () => {
    localStorage.setItem(`${TOUR_SEEN_STORAGE_PREFIX}trial-org`, '1');
    mockWalkthroughState({ automate_pipeline: { skipped: false, completed: true } });
    setupAuthStore(buildOrgUser());
    renderGate();

    await expectTick('automate-pipeline', true);
    // No insight was built — that walkthrough stops at the created pipeline. Ticking this
    // would claim work the user hasn't done and hide the very next step we want them on.
    await expectTick('build-insight', false);
  });

  it('leaves a skipped flow unticked — decided is not the same as achieved', async () => {
    localStorage.setItem(`${TOUR_SEEN_STORAGE_PREFIX}trial-org`, '1');
    mockWalkthroughState({
      insights: { skipped: true, completed: false },
      automate_pipeline: { skipped: true, completed: false },
    });
    setupAuthStore(buildOrgUser());
    renderGate();

    await expectTick('build-insight', false);
    await expectTick('automate-pipeline', false);
  });

  it('ignores stale local flags — the backend is the only source for a tick', async () => {
    localStorage.setItem(`${TOUR_SEEN_STORAGE_PREFIX}trial-org`, '1');
    // Left behind by a flow whose backend write never landed, so nothing is recorded.
    localStorage.setItem('dalgo_insight_walkthrough_done_trial-org', '1');
    localStorage.setItem('dalgo_insight_walkthrough_pipeline_created_trial-org', '1');
    mockWalkthroughState({});
    setupAuthStore(buildOrgUser());
    renderGate();

    await expectTick('build-insight', false);
    await expectTick('automate-pipeline', false);
  });
});

/**
 * The ✕ is meant to be the only way out of the product tour — a refresh must put it back.
 * The tour keeps its position in refs, so localStorage is the only thing that survives.
 */
describe('TourGate — resuming an interrupted product tour', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockPathname = '/impact';
    mockApiGet.mockImplementation((path: string) =>
      path === '/api/userpreferences/'
        ? Promise.resolve({ success: true, res: { trial_walkthrough: {} } })
        : undefined
    );
  });

  it('resumes at the stored step after a page reload', async () => {
    // Left mid-tour on step 4 (index 3) — a reload wipes the in-memory step state, so the
    // stored index is the only thing that can put the user back where they were.
    mockPathname = '/reports';
    saveTourProgress('trial-org', 3);
    setupAuthStore(buildOrgUser());
    renderGate();

    await waitFor(() => expect(mockStartTour).toHaveBeenCalledWith(3));
    // Resuming counts as running, so the widget stays out of the spotlight's way.
    expect(screen.queryByTestId('getting-started-widget-pill')).not.toBeInTheDocument();
  });

  it('does not re-offer the intent modal while a tour is being resumed', async () => {
    saveTourProgress('trial-org', 2);
    setupAuthStore(buildOrgUser());
    renderGate();

    await waitFor(() => expect(mockStartTour).toHaveBeenCalledWith(2));
    expect(screen.queryByText('What brings you to Dalgo')).not.toBeInTheDocument();
  });

  it('does not resume a tour that was never interrupted', async () => {
    localStorage.setItem(`${TOUR_SEEN_STORAGE_PREFIX}trial-org`, '1');
    setupAuthStore(buildOrgUser());
    renderGate();

    await screen.findByTestId('getting-started-widget-pill');
    expect(mockStartTour).not.toHaveBeenCalled();
  });

  it('resumes even when the backend records an earlier skip — the tour is re-runnable', async () => {
    // The record says this user exited the tour at some point in the past, which is why it is
    // no longer auto-OFFERED. It says nothing about the run they started again from the widget
    // and are in the middle of right now — and that run is what the stored index belongs to.
    // Gating resume on this record was the original bug: one ✕ ever, and refreshing mid-tour
    // killed it for good.
    saveTourProgress('trial-org', 3);
    mockApiGet.mockImplementation((path: string) =>
      path === '/api/userpreferences/'
        ? Promise.resolve({
            success: true,
            res: { trial_walkthrough: { product_tour: { skipped: true, completed: false } } },
          })
        : undefined
    );
    setupAuthStore(buildOrgUser());
    renderGate();

    await waitFor(() => expect(mockStartTour).toHaveBeenCalledWith(3));
    // The intent modal stays suppressed though — that one IS the record's call.
    expect(screen.queryByText('What brings you to Dalgo')).not.toBeInTheDocument();
  });
});

describe('TourGate — Get Started checklist actions', () => {
  /**
   * Opens the panel before clicking a row: an in-progress walkthrough auto-minimizes it, so
   * the row can be mid-unmount if clicked straight after render.
   */
  const clickChecklistRow = async (user: ReturnType<typeof userEvent.setup>, key: string) => {
    await user.click(await screen.findByTestId('getting-started-widget-pill'));
    await user.click(await screen.findByTestId(`getting-started-widget-item-${key}`));
  };
  const clickBuildInsight = (user: ReturnType<typeof userEvent.setup>) =>
    clickChecklistRow(user, 'build-insight');

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockPathname = '/impact';
    // Tour already seen everywhere in this block: these tests are about the checklist, and
    // the intent modal would otherwise cover it.
    localStorage.setItem(`${TOUR_SEEN_STORAGE_PREFIX}trial-org`, '1');
    useInsightWalkthroughStore.setState({
      active: false,
      orgSlug: null,
      stage: null,
      path: null,
      trackedConnectionId: null,
    });
    mockApiGet.mockImplementation((path: string) =>
      path === '/api/userpreferences/'
        ? Promise.resolve({ success: true, res: { trial_walkthrough: {} } })
        : undefined
    );
  });

  it('"Build your first insight" opens the fork dialog when no fork has been picked', async () => {
    const user = userEvent.setup();
    setupAuthStore(buildOrgUser());
    renderGate();

    await clickBuildInsight(user);

    expect(await screen.findByTestId('get-started-option-sample')).toBeInTheDocument();
    // Straight to the fork, so no back arrow and no post-tour choice screen.
    expect(screen.queryByTestId('get-started-back-btn')).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('picking "Use sample data" starts the sample fork and goes to /kpis', async () => {
    const user = userEvent.setup();
    setupAuthStore(buildOrgUser());
    renderGate();
    await clickBuildInsight(user);

    await user.click(await screen.findByTestId('get-started-option-sample'));

    expect(useInsightWalkthroughStore.getState().path).toBe('sample');
    expect(useInsightWalkthroughStore.getState().stage).toBe('kpi_intro');
    expect(mockPush).toHaveBeenCalledWith('/kpis');
  });

  it('resumes an interrupted flow at the last stage reachable from a cold page load', async () => {
    const user = userEvent.setup();
    // Storage is scoped to the selected org's user, so the auth store has to be set up first
    // — before that there's no scope to write into.
    setupAuthStore(buildOrgUser());
    savePath('insights', 'sample');
    // Left off inside the KPI form dialog — that field only exists while the dialog is open,
    // so resuming there literally shows nothing; kpi_intro is the re-entry point.
    saveWalkthroughStage('insights', 'kpi_metric');
    renderGate();

    await clickBuildInsight(user);

    expect(useInsightWalkthroughStore.getState().stage).toBe('kpi_intro');
    expect(mockPush).toHaveBeenCalledWith('/kpis');
    expect(screen.queryByTestId('get-started-option-sample')).not.toBeInTheDocument();
  });

  it('moves a returning user onto the chart flow once their tracked connection has synced', async () => {
    // The one handoff with no click behind it. The user created a connection, closed the tab
    // while the first sync ran, and came back — nothing in memory survives, so the checkpoint
    // has to recognise THIS connection's success from storage plus a fresh connections fetch.
    //
    // Also the regression guard for an ordering bug: the resume effect waits on the backend's
    // userpreferences fetch, so the connections response routinely lands while the store is
    // still inactive. Read non-reactively, the checkpoint bailed on that pass and never ran
    // again (a finished sync holds no lock, so SWR stops polling and `connections` keeps its
    // identity), leaving the user on a page with no coachmark at all.
    setupAuthStore(buildOrgUser());
    savePath('insights', 'own_data');
    saveWalkthroughStage('insights', 'own_data_source_next');
    saveTrackedConnection('insights', 'conn-1');
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/api/userpreferences/') {
        return Promise.resolve({ success: true, res: { trial_walkthrough: {} } });
      }
      if (path === '/api/airbyte/v1/connections') {
        return Promise.resolve([
          { connectionId: 'conn-1', lock: null, lastRun: { status: SyncStatus.SUCCESS } },
        ]);
      }
      return undefined;
    });

    renderGate();

    await waitFor(() => expect(useInsightWalkthroughStore.getState().stage).toBe('chart_intro'));
    // Set independently of the coachmark, so the Get Started checklist is accurate too.
    expect(hasConnectedRealData()).toBe(true);
  });

  it('moves on as soon as the tracked connection STARTS syncing', async () => {
    // TEMPORARY (trial only). This used to require SyncStatus.SUCCESS and assert the user
    // stayed parked on 'own_data_ingest' through a running sync. A real first sync takes
    // minutes, and every ingest stage goes silent while trackedConnectionId is set — so the
    // user sat with no coachmark at all and read the walkthrough as dead. See hasSyncStarted
    // in tour-gate.tsx; revert both together.
    setupAuthStore(buildOrgUser());
    savePath('insights', 'own_data');
    saveWalkthroughStage('insights', 'own_data_source_next');
    saveTrackedConnection('insights', 'conn-1');
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/api/userpreferences/') {
        return Promise.resolve({ success: true, res: { trial_walkthrough: {} } });
      }
      if (path === '/api/airbyte/v1/connections') {
        return Promise.resolve([
          { connectionId: 'conn-1', lock: {}, lastRun: { status: SyncStatus.RUNNING } },
        ]);
      }
      return undefined;
    });

    renderGate();

    await waitFor(() => expect(useInsightWalkthroughStore.getState().stage).toBe('chart_intro'));
    expect(hasConnectedRealData()).toBe(true);
  });

  it('waits while the connection exists but no sync has been triggered yet', async () => {
    // The wizard creates the connection BEFORE kicking off its sync. Advancing on the
    // connection's mere existence would jump the user past a coachmark still pointing into
    // the wizard they have not finished.
    setupAuthStore(buildOrgUser());
    savePath('insights', 'own_data');
    saveWalkthroughStage('insights', 'own_data_source_next');
    saveTrackedConnection('insights', 'conn-1');
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/api/userpreferences/') {
        return Promise.resolve({ success: true, res: { trial_walkthrough: {} } });
      }
      if (path === '/api/airbyte/v1/connections') {
        return Promise.resolve([{ connectionId: 'conn-1', lock: null, lastRun: null }]);
      }
      return undefined;
    });

    renderGate();

    await waitFor(() => expect(useInsightWalkthroughStore.getState().active).toBe(true));
    expect(useInsightWalkthroughStore.getState().stage).toBe('own_data_ingest');
    expect(hasConnectedRealData()).toBe(false);
  });

  it('resumes a sidebar-anchored stage in place, without rewinding the chart flow', async () => {
    const user = userEvent.setup();
    setupAuthStore(buildOrgUser());
    // Chart already built — the nudge points at the Dashboards link, which needs no
    // navigation. This used to count as "unresumable" and drop through to the fresh-start
    // branch, which sent a user who had finished their chart back to the start of it.
    savePath('insights', 'own_data');
    saveWalkthroughStage('insights', 'chart_dashboard_nudge');
    markConnectedRealData();
    renderGate();

    await clickBuildInsight(user);

    expect(useInsightWalkthroughStore.getState().stage).toBe('chart_dashboard_nudge');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('skips the sample/own-data question once the user already has real data', async () => {
    const user = userEvent.setup();
    setupAuthStore(buildOrgUser());
    // They automated a pipeline (or connected a source some other way), so asking "sample or
    // your own data?" has no useful branch left — open straight on the chart builder.
    markConnectedRealData();
    renderGate();

    await clickBuildInsight(user);

    expect(screen.queryByTestId('get-started-option-sample')).not.toBeInTheDocument();
    expect(useInsightWalkthroughStore.getState().stage).toBe('chart_intro');
    expect(useInsightWalkthroughStore.getState().path).toBe('own_data');
    // No navigation: chart_intro spotlights the sidebar's Charts link, and pushing /charts
    // would satisfy that stage's own route-advance instantly and skip the beat.
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('re-offers the fork when a path was picked but the flow was skipped (no stage left)', async () => {
    const user = userEvent.setup();
    setupAuthStore(buildOrgUser());
    savePath('insights', 'own_data');
    renderGate();

    await clickBuildInsight(user);

    expect(await screen.findByTestId('get-started-option-sample')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('"Setup an automated data pipeline" starts that flow outright — it has no fork', async () => {
    const user = userEvent.setup();
    setupAuthStore(buildOrgUser());
    renderGate();

    await clickChecklistRow(user, 'automate-pipeline');

    expect(useInsightWalkthroughStore.getState().path).toBe('automate_pipeline');
    expect(useInsightWalkthroughStore.getState().stage).toBe('pipeline_ingest');
    expect(mockPush).toHaveBeenCalledWith('/ingest');
  });

  it('resumes an interrupted pipeline flow out of the canvas at its table-picking step', async () => {
    const user = userEvent.setup();
    setupAuthStore(buildOrgUser());
    savePath('automate_pipeline', 'automate_pipeline');
    // Depends on an open operation panel — pipeline_pick_table is the cold-load entry.
    saveWalkthroughStage('automate_pipeline', 'pipeline_drop_columns');
    renderGate();

    await clickChecklistRow(user, 'automate-pipeline');

    expect(useInsightWalkthroughStore.getState().stage).toBe('pipeline_pick_table');
    expect(mockPush).toHaveBeenCalledWith('/transform/canvas');
  });
});
