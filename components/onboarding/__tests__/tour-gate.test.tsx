import React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet } from '@/test-utils/api';
import {
  saveTourProgress,
  getPendingPostTourScreen,
  savePendingPostTourScreen,
  markIntentModalSeen,
  markIntentModalShownThisSession,
  hasSeenIntentModal,
  hasShownIntentModalThisSession,
} from '../tour-constants';
import {
  savePath,
  saveWalkthroughStage,
  saveTrackedConnection,
  saveDismissedSyncRun,
  markConnectedRealData,
  hasConnectedRealData,
} from '../insight-walkthrough-constants';
import { SyncStatus } from '@/constants/connections';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import { TourGate } from '../tour-gate';

// ============ Mocks ============

// tour-gate computes ADVANCE_ON_SYNC_START from NEXT_PUBLIC_WEBAPP_ENVIRONMENT at module load:
// on 'local' the sync checkpoint treats a merely-STARTED sync as a success. These tests cover
// the staging/production path, so pin the constant instead of inheriting whatever the machine's
// .env says — otherwise the suite passes in CI (var unset) and fails on every dev laptop.
jest.mock('@/constants/constants', () => ({
  ...jest.requireActual('@/constants/constants'),
  NEXT_PUBLIC_WEBAPP_ENVIRONMENT: 'staging',
}));

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

const MS_PER_DAY = 86_400_000;

/**
 * A plan end_date leaving exactly `daysLeft` whole days on the clock. Half a day is added so
 * the window lands mid-day rather than on the boundary, where a floor is a tick from flipping.
 */
function planEndDateWithDaysLeft(daysLeft: number): string {
  return new Date(Date.now() + (daysLeft + 0.5) * MS_PER_DAY).toISOString();
}

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
    // Mid-trial by default, so the intent modal isn't standing down for a lifecycle nudge in
    // every unrelated test. Individual tests override it.
    plan_start_date: new Date(Date.now() - 4 * MS_PER_DAY).toISOString(),
    plan_end_date: planEndDateWithDaysLeft(10),
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

/**
 * Backdates the "when was this connection tracked" stamp saveTrackedConnection writes, so a
 * test reads as a connection tracked in an EARLIER session rather than seconds ago. The sync
 * checkpoint treats those two differently on purpose — see NEW_CONNECTION_APPEAR_GRACE_MS.
 */
const ageTrackedConnection = () => {
  const key = Object.keys(localStorage).find((k) =>
    k.startsWith('dalgo_insight_walkthrough_conn_at_')
  );
  if (!key) throw new Error('no tracked-connection timestamp to age — track one first');
  localStorage.setItem(key, String(Date.now() - 60 * 60 * 1000));
};

/** Seeds the backend trial_walkthrough record — the gate every flow decision reads. */
const mockWalkthroughState = (trial_walkthrough: Record<string, unknown>) =>
  mockApiGet.mockImplementation((path: string) =>
    path === '/api/userpreferences/'
      ? Promise.resolve({ success: true, res: { trial_walkthrough } })
      : undefined
  );

/**
 * Keeps the landing-page intent modal out of the way of tests that aren't about it. It now
 * opens once per SESSION for any trial user with a build flow left to finish, and its Radix
 * overlay makes everything behind it unclickable.
 */
const suppressIntentModal = () => markIntentModalShownThisSession('trial-org');

// ============ Tests ============

describe('TourGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // The intent modal is now once-per-SESSION (see tour-constants) — without this, the first
    // test to open it suppresses it for every test after.
    sessionStorage.clear();
    mockPathname = '/impact';
    mockTourProps.current = null;
    // The walkthrough store is module state and outlives a test. A live flow left behind
    // suppresses the intent modal (it owns the screen) for every test after, so reset it here
    // as the checklist block below already does.
    useInsightWalkthroughStore.setState({
      active: false,
      orgSlug: null,
      flow: null,
      stage: null,
      path: null,
      trackedConnectionId: null,
    });
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

  it('greets a returning user with the days left, not the first-visit question', async () => {
    // Seen once before (localStorage), fresh session — the modal comes back, but reworded.
    markIntentModalSeen('trial-org');
    setupAuthStore(buildOrgUser());
    renderGate();

    expect(await screen.findByTestId('tour-intent-modal')).toBeInTheDocument();
    // Dialog content only renders in the DOM when open (Radix unmounts when closed).
    expect(screen.queryByText('What brings you to Dalgo')).not.toBeInTheDocument();
    expect(screen.getByText(/Welcome back — \d+ days? left for your trial/)).toBeInTheDocument();
    expect(screen.getByTestId('tour-intent-subtitle')).toBeInTheDocument();
    // Same three options either way — only the heading block changes.
    expect(screen.getByTestId('tour-intent-option-tour')).toBeInTheDocument();
    expect(screen.getByTestId('tour-intent-option-insight')).toBeInTheDocument();
    expect(screen.getByTestId('tour-intent-option-pipeline')).toBeInTheDocument();
  });

  it('stays shut for the rest of the session once it has opened', async () => {
    // A refresh, or walking back to /impact mid-work, is not a new arrival.
    markIntentModalShownThisSession('trial-org');
    setupAuthStore(buildOrgUser());
    renderGate();

    expect(await screen.findByTestId('getting-started-widget')).toBeInTheDocument();
    expect(screen.queryByTestId('tour-intent-modal')).not.toBeInTheDocument();
  });

  it('stops opening once both build flows are completed', async () => {
    // The bar is completion of the two flows that build something. The tour is a look
    // around, not work done, so it is deliberately not part of it.
    mockWalkthroughState({
      insights: { skipped: false, completed: true },
      automate_pipeline: { skipped: false, completed: true },
    });
    setupAuthStore(buildOrgUser());
    renderGate();

    expect(await screen.findByTestId('getting-started-widget')).toBeInTheDocument();
    expect(screen.queryByTestId('tour-intent-modal')).not.toBeInTheDocument();
  });

  it('keeps opening while only one build flow is completed', async () => {
    mockWalkthroughState({ insights: { skipped: false, completed: true } });
    setupAuthStore(buildOrgUser());
    renderGate();

    expect(await screen.findByTestId('tour-intent-modal')).toBeInTheDocument();
  });

  it('records nothing until the user actually closes it', async () => {
    // A reload before closing must re-offer it, unchanged — so opening writes no flag, and a
    // first-timer who refreshes is still asked what brings them here rather than greeted back.
    setupAuthStore(buildOrgUser());
    renderGate();
    await screen.findByTestId('tour-intent-modal');

    expect(hasShownIntentModalThisSession('trial-org')).toBe(false);
    expect(hasSeenIntentModal('trial-org')).toBe(false);
  });

  it('records both flags once closed', async () => {
    const user = userEvent.setup();
    setupAuthStore(buildOrgUser());
    renderGate();
    await screen.findByTestId('tour-intent-modal');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(hasShownIntentModalThisSession('trial-org')).toBe(true));
    // localStorage: the NEXT session gets the welcome-back copy.
    expect(hasSeenIntentModal('trial-org')).toBe(true);
  });

  it('records both flags when an option is picked, not just on the ✕', async () => {
    const user = userEvent.setup();
    setupAuthStore(buildOrgUser());
    renderGate();

    await user.click(await screen.findByTestId('tour-intent-option-tour'));

    await waitFor(() => expect(hasShownIntentModalThisSession('trial-org')).toBe(true));
    expect(hasSeenIntentModal('trial-org')).toBe(true);
  });

  it('stands down when a trial lifecycle nudge is due the same session', async () => {
    // Both are unrouted auto-opening dialogs, and NudgeCenter mounts app-wide — without the
    // isTrialDayNudgeDue check they stack on /impact on the nudge days (7 / 1 / 0 days left).
    setupAuthStore(buildOrgUser({ plan_end_date: planEndDateWithDaysLeft(1) }));
    renderGate();

    expect(await screen.findByTestId('getting-started-widget')).toBeInTheDocument();
    expect(screen.queryByTestId('tour-intent-modal')).not.toBeInTheDocument();
  });

  it('opens normally on a day with no trial lifecycle nudge', async () => {
    setupAuthStore(buildOrgUser({ plan_end_date: planEndDateWithDaysLeft(11) }));
    renderGate();

    expect(await screen.findByTestId('tour-intent-modal')).toBeInTheDocument();
  });

  it('keeps opening when the flows were skipped rather than completed', async () => {
    // Skipping means "not now" — and next session is a new now.
    mockWalkthroughState({
      insights: { skipped: true, completed: false },
      automate_pipeline: { skipped: true, completed: false },
    });
    setupAuthStore(buildOrgUser());
    renderGate();

    expect(await screen.findByTestId('tour-intent-modal')).toBeInTheDocument();
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

  it('rolls straight into the insight fork when that intent option is picked', async () => {
    // Regression (DALGO trial UAT): both journey options used to just close the modal, dropping
    // the user onto the Get Started checklist they had effectively already chosen from — the
    // modal read as doing nothing.
    const user = userEvent.setup();
    setupAuthStore(buildOrgUser());
    renderGate();

    await user.click(await screen.findByTestId('tour-intent-option-insight'));

    // The fork's own question — sample data or your own — not the two-journey chooser.
    expect(await screen.findByTestId('get-started-option-sample')).toBeInTheDocument();
    expect(screen.getByTestId('get-started-option-own-data')).toBeInTheDocument();
    expect(useInsightWalkthroughStore.getState().stage).toBe('fork2');
  });

  it('starts the pipeline walkthrough when that intent option is picked', async () => {
    const user = userEvent.setup();
    setupAuthStore(buildOrgUser());
    renderGate();

    await user.click(await screen.findByTestId('tour-intent-option-pipeline'));

    // No fork to ask about, and no navigation: it opens on the Ingest sidebar nudge.
    await waitFor(() =>
      expect(useInsightWalkthroughStore.getState().stage).toBe('pipeline_ingest_nudge')
    );
    expect(useInsightWalkthroughStore.getState().path).toBe('automate_pipeline');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('resumes an insight flow in progress from the intent modal instead of re-asking the fork', async () => {
    // "If I exit the build insight flow I should be able to resume it" — from either entry
    // point, the checklist row or this modal.
    const user = userEvent.setup();
    setupAuthStore(buildOrgUser());
    savePath('insights', 'sample');
    saveWalkthroughStage('insights', 'kpi_intro');
    renderGate();

    await user.click(await screen.findByTestId('tour-intent-option-insight'));

    await waitFor(() => expect(useInsightWalkthroughStore.getState().stage).toBe('kpi_intro'));
    expect(screen.queryByTestId('get-started-option-sample')).not.toBeInTheDocument();
  });

  it('hides the getting-started widget while the tour runs, and restores it when it ends', async () => {
    const user = userEvent.setup();
    suppressIntentModal();
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

  it('stops offering the post-tour choice once BOTH insight flows are completed', async () => {
    mockApiGet.mockImplementation((path: string) =>
      path === '/api/userpreferences/'
        ? Promise.resolve({
            success: true,
            res: {
              trial_walkthrough: {
                insights: { skipped: false, completed: true },
                automate_pipeline: { skipped: false, completed: true },
              },
            },
          })
        : undefined
    );
    setupAuthStore(buildOrgUser());
    renderGate();

    // Waited on the prop itself rather than on the intent modal appearing: with both flows
    // completed the modal no longer opens at all, so it is no longer a readiness signal.
    // The prop starts true (nothing completed until the fetch lands) and flips on resolve.
    await waitFor(() => expect(mockTourProps.current?.canOfferPostTourChoice).toBe(false));
  });

  it('still offers the post-tour choice when a flow was skipped rather than completed', async () => {
    mockApiGet.mockImplementation((path: string) =>
      path === '/api/userpreferences/'
        ? Promise.resolve({
            success: true,
            res: {
              trial_walkthrough: {
                insights: { skipped: true, completed: false },
                automate_pipeline: { skipped: true, completed: false },
              },
            },
          })
        : undefined
    );
    setupAuthStore(buildOrgUser());
    renderGate();

    await screen.findByText('What brings you to Dalgo');
    // A skip is "not now", not "never" — finishing the tour again re-offers both.
    expect(mockTourProps.current?.canOfferPostTourChoice).toBe(true);
  });

  it('still offers the post-tour choice while one insight flow is incomplete', async () => {
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
              trial_walkthrough: { automate_pipeline: { skipped: false, completed: true } },
            },
          })
        : undefined
    );
    suppressIntentModal();
    setupAuthStore(buildOrgUser());
    renderGate();

    await screen.findByTestId('getting-started-widget-pill');
    await act(async () => {
      mockTourProps.current?.onOfferPostTourChoice?.();
    });

    expect(await screen.findByTestId('get-started-option-insight')).toBeInTheDocument();
    expect(screen.queryByTestId('get-started-option-pipeline')).not.toBeInTheDocument();
  });

  it('offers pipeline alone once build-insights is completed', async () => {
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
    suppressIntentModal();
    setupAuthStore(buildOrgUser());
    renderGate();

    await screen.findByTestId('getting-started-widget-pill');
    await act(async () => {
      mockTourProps.current?.onOfferPostTourChoice?.();
    });

    expect(await screen.findByTestId('get-started-option-pipeline')).toBeInTheDocument();
    expect(screen.queryByTestId('get-started-option-insight')).not.toBeInTheDocument();
  });

  it('restores the unresolved journey chooser after it is closed and the page reloads', async () => {
    const user = userEvent.setup();
    suppressIntentModal();
    setupAuthStore(buildOrgUser());
    const { unmount } = renderGate();

    await screen.findByTestId('getting-started-widget-pill');
    act(() => mockTourProps.current?.onOfferPostTourChoice?.());
    expect(await screen.findByTestId('get-started-option-insight')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => expect(screen.queryByTestId('get-started-modal')).not.toBeInTheDocument());

    // Closing is a dismissal for this visit. A full remount models refresh: because no journey
    // was selected, the exact post-tour choice must return instead of only showing the widget.
    unmount();
    renderGate();

    expect(await screen.findByTestId('get-started-option-insight')).toBeInTheDocument();
    expect(screen.getByTestId('get-started-option-pipeline')).toBeInTheDocument();
    expect(screen.queryByTestId('tour-intent-modal')).not.toBeInTheDocument();
  });

  it('restores the insight fork screen when refresh happens after choosing that journey', async () => {
    const user = userEvent.setup();
    suppressIntentModal();
    setupAuthStore(buildOrgUser());
    const { unmount } = renderGate();

    await screen.findByTestId('getting-started-widget-pill');
    act(() => mockTourProps.current?.onOfferPostTourChoice?.());
    await user.click(await screen.findByTestId('get-started-option-insight'));
    expect(screen.getByTestId('get-started-option-sample')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /close/i }));
    unmount();
    renderGate();

    expect(await screen.findByTestId('get-started-option-sample')).toBeInTheDocument();
    expect(screen.getByTestId('get-started-option-own-data')).toBeInTheDocument();
    expect(screen.getByTestId('get-started-back-btn')).toBeInTheDocument();
  });

  it('does not expose one user’s pending post-tour choice to another user in the same org', () => {
    setupAuthStore(buildOrgUser({ user_id: 1 }));
    savePendingPostTourScreen('trial-org', 'insight');
    expect(getPendingPostTourScreen('trial-org')).toBe('insight');

    setupAuthStore(buildOrgUser({ user_id: 2 }));
    expect(getPendingPostTourScreen('trial-org')).toBeNull();
  });

  it('keeps nudging an unfinished trial after the product tour was skipped', async () => {
    // A product-tour skip says only that the user stopped the platform overview. It does not
    // complete either build journey, so the next session still offers a useful way forward.
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

    expect(await screen.findByText('What brings you to Dalgo')).toBeInTheDocument();
  });

  it('starts the tour from the getting-started widget link', async () => {
    const user = userEvent.setup();
    // Mark seen so the intent modal doesn't also auto-open and cover the widget —
    // this test is only about the widget's own trigger wiring.
    suppressIntentModal();
    setupAuthStore(buildOrgUser());
    renderGate();

    await user.click(screen.getByTestId('getting-started-widget-tour-link'));

    expect(mockStartTour).toHaveBeenCalledTimes(1);
  });

  /**
   * Waits for a row's icon to settle. Rows render unchecked first — a tick now depends on
   * the backend fetch resolving, not on synchronous localStorage.
   */
  const expectTick = async (key: string, checked: boolean) => {
    await waitFor(async () => {
      const row = await screen.findByTestId(`getting-started-widget-item-${key}`);
      if (checked) {
        expect(within(row).getByTestId('getting-started-widget-complete-icon')).toHaveClass(
          'bg-primary'
        );
      } else {
        expect(
          within(row).queryByTestId('getting-started-widget-complete-icon')
        ).not.toBeInTheDocument();
        expect(row.querySelector('svg')).toHaveClass('text-muted-foreground');
      }
    });
  };

  it('ticks "Build your first insight" once the insights flow is recorded complete', async () => {
    suppressIntentModal();
    mockWalkthroughState({ insights: { skipped: false, completed: true } });
    setupAuthStore(buildOrgUser());
    renderGate();

    await expectTick('build-insight', true);
    await expectTick('automate-pipeline', false);
  });

  it('ticks only the pipeline row when automate-pipeline completes', async () => {
    suppressIntentModal();
    mockWalkthroughState({ automate_pipeline: { skipped: false, completed: true } });
    setupAuthStore(buildOrgUser());
    renderGate();

    await expectTick('automate-pipeline', true);
    // No insight was built — that walkthrough stops at the created pipeline. Ticking this
    // would claim work the user hasn't done and hide the very next step we want them on.
    await expectTick('build-insight', false);
  });

  it('leaves a skipped flow unticked — decided is not the same as achieved', async () => {
    suppressIntentModal();
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
    suppressIntentModal();
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
    // The intent modal is now once-per-SESSION (see tour-constants) — without this, the first
    // test to open it suppresses it for every test after.
    sessionStorage.clear();
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
    suppressIntentModal();
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
    // The intent modal is now once-per-SESSION (see tour-constants) — without this, the first
    // test to open it suppresses it for every test after.
    sessionStorage.clear();
    mockPathname = '/impact';
    // Tour already seen everywhere in this block: these tests are about the checklist, and
    // the intent modal would otherwise cover it.
    suppressIntentModal();
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

  it('opens the checklist panel when a walkthrough finishes away from /impact', async () => {
    // The flow ends on a saved dashboard, where the panel is a collapsed pill — the tick landed
    // behind it and finishing looked like nothing had happened.
    mockPathname = '/dashboards/12';
    setupAuthStore(buildOrgUser());
    renderGate();

    await screen.findByTestId('getting-started-widget-pill');
    expect(screen.queryByTestId('getting-started-widget')).not.toBeInTheDocument();

    // Two acts, not one: batched into a single render the store would go active and back in
    // the same commit, and nothing would ever observe the run as live. A real flow renders many
    // times in between.
    await act(async () => {
      useInsightWalkthroughStore.getState().start('trial-org');
    });
    await act(async () => {
      useInsightWalkthroughStore.getState().finish();
    });

    expect(await screen.findByTestId('getting-started-widget')).toBeInTheDocument();
  });

  it('opens it on a skip too — the run is over either way', async () => {
    mockPathname = '/dashboards/12';
    setupAuthStore(buildOrgUser());
    renderGate();

    await screen.findByTestId('getting-started-widget-pill');

    // Two acts, not one: batched into a single render the store would go active and back in
    // the same commit, and nothing would ever observe the run as live. A real flow renders many
    // times in between.
    await act(async () => {
      useInsightWalkthroughStore.getState().start('trial-org');
    });
    await act(async () => {
      useInsightWalkthroughStore.getState().skip();
    });

    expect(await screen.findByTestId('getting-started-widget')).toBeInTheDocument();
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

  it('holds a running sync on the waiting coachmark instead of moving on', async () => {
    // The walkthrough waits for real data. Every ingest stage goes silent while
    // trackedConnectionId is set, so without this holding stage the user sits on a page with
    // no coachmark for the length of a first sync and reads the walkthrough as dead.
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

    await waitFor(() => expect(useInsightWalkthroughStore.getState().stage).toBe('sync_running'));
    // Nothing has landed in the warehouse yet, so the checklist must not tick either.
    expect(hasConnectedRealData()).toBe(false);
  });

  it('keeps waiting on a run status it does not recognise', async () => {
    // Airbyte's job API reports states SyncStatus does not enumerate ('incomplete',
    // 'pending'). Only failed/cancelled mean "over and unsuccessful" — telling someone their
    // live sync failed is a worse error than making them wait.
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
          { connectionId: 'conn-1', lock: null, lastRun: { job_id: 80, status: 'incomplete' } },
        ]);
      }
      return undefined;
    });

    renderGate();

    await waitFor(() => expect(useInsightWalkthroughStore.getState().stage).toBe('sync_running'));
  });

  it('waits for a just-created connection to appear instead of writing it off', async () => {
    // A connection is NOT in this list the instant it is created — right after the wizard's
    // POST resolves, both the cached list and a forced refetch still come back without it.
    // Reading that as "deleted" untracked the connection seconds after it was made and
    // stranded the user on Ingest, unable to reach charts/transform when the sync landed.
    setupAuthStore(buildOrgUser());
    savePath('insights', 'own_data');
    saveWalkthroughStage('insights', 'own_data_source_next');
    saveTrackedConnection('insights', 'conn-1'); // tracked NOW — inside the grace period
    let connectionsCall = 0;
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/api/userpreferences/') {
        return Promise.resolve({ success: true, res: { trial_walkthrough: {} } });
      }
      if (path === '/api/airbyte/v1/connections') {
        connectionsCall += 1;
        // The first two responses predate the connection, as the real API's did.
        if (connectionsCall <= 2) return Promise.resolve([]);
        return Promise.resolve([
          { connectionId: 'conn-1', lock: {}, lastRun: { status: SyncStatus.RUNNING } },
        ]);
      }
      return undefined;
    });

    renderGate();

    // Polls until it turns up (NEW_CONNECTION_POLL_MS apart), keeping the tracking throughout.
    await waitFor(() => expect(useInsightWalkthroughStore.getState().stage).toBe('sync_running'), {
      timeout: 10000,
    });
    expect(useInsightWalkthroughStore.getState().trackedConnectionId).toBe('conn-1');
  }, 15000);

  it('untracks a deleted connection instead of waiting on it forever', async () => {
    // Deleting the connection and starting over is the natural move after a failed sync.
    // Without this the walkthrough sat on a holding stage watching a connection that was
    // never coming back, with its coachmark pointing at a row that no longer rendered.
    setupAuthStore(buildOrgUser());
    savePath('insights', 'own_data');
    saveWalkthroughStage('insights', 'sync_failed');
    saveTrackedConnection('insights', 'conn-1');
    // Tracked in an earlier session, not seconds ago — past the grace period that protects a
    // brand-new connection from a list that hasn't caught up with it yet.
    ageTrackedConnection();
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/api/userpreferences/') {
        return Promise.resolve({ success: true, res: { trial_walkthrough: {} } });
      }
      if (path === '/api/airbyte/v1/connections') return Promise.resolve([]);
      return undefined;
    });

    renderGate();

    await waitFor(() =>
      expect(useInsightWalkthroughStore.getState().stage).toBe('own_data_ingest')
    );
    // Dropped, not just rewound — the ingest stage is silent while a connection is tracked,
    // so leaving it set would show no coachmark at all.
    expect(useInsightWalkthroughStore.getState().trackedConnectionId).toBeNull();
  });

  it('reports a failed sync, and shows it only once per failed run', async () => {
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
          {
            connectionId: 'conn-1',
            lock: null,
            lastRun: { job_id: 77, status: SyncStatus.FAILED },
          },
        ]);
      }
      return undefined;
    });

    const { unmount } = renderGate();

    await waitFor(() => expect(useInsightWalkthroughStore.getState().stage).toBe('sync_failed'));
    expect(hasConnectedRealData()).toBe(false);

    // "Got it" — acknowledges THIS run and hands the user back to their fork's ingest stage,
    // which is silent while a tracked connection exists.
    act(() => useInsightWalkthroughStore.getState().dismissSyncFailure());
    expect(useInsightWalkthroughStore.getState().stage).toBe('own_data_ingest');

    // A reload with the same failure still on the connection must not nag again.
    unmount();
    saveWalkthroughStage('insights', 'own_data_ingest');
    renderGate();
    await waitFor(() => expect(useInsightWalkthroughStore.getState().active).toBe(true));
    expect(useInsightWalkthroughStore.getState().stage).toBe('own_data_ingest');
  });

  it('speaks up again when a retry fails as a different run', async () => {
    // The dismissal is keyed by Airbyte job id, not a plain "seen it" flag — a second failure
    // is new information and has to be reported.
    setupAuthStore(buildOrgUser());
    savePath('insights', 'own_data');
    saveWalkthroughStage('insights', 'own_data_ingest');
    saveTrackedConnection('insights', 'conn-1');
    saveDismissedSyncRun('insights', '77');
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/api/userpreferences/') {
        return Promise.resolve({ success: true, res: { trial_walkthrough: {} } });
      }
      if (path === '/api/airbyte/v1/connections') {
        return Promise.resolve([
          {
            connectionId: 'conn-1',
            lock: null,
            lastRun: { job_id: 78, status: SyncStatus.FAILED },
          },
        ]);
      }
      return undefined;
    });

    renderGate();

    await waitFor(() => expect(useInsightWalkthroughStore.getState().stage).toBe('sync_failed'));
  });

  it('moves off the failure coachmark once a retry finally succeeds', async () => {
    // sync_failed sits outside every order array precisely so advanceIfBefore can carry the
    // user off it — a guard against the holding stage becoming a dead end.
    setupAuthStore(buildOrgUser());
    savePath('insights', 'own_data');
    saveWalkthroughStage('insights', 'sync_failed');
    saveTrackedConnection('insights', 'conn-1');
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/api/userpreferences/') {
        return Promise.resolve({ success: true, res: { trial_walkthrough: {} } });
      }
      if (path === '/api/airbyte/v1/connections') {
        return Promise.resolve([
          {
            connectionId: 'conn-1',
            lock: null,
            lastRun: { job_id: 79, status: SyncStatus.SUCCESS },
          },
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

  it('reports a first sync that was never triggered instead of waiting on it forever', async () => {
    // Same shape as the test above — no lock, no run — but tracked long ago rather than
    // seconds ago, so the trigger is not merely in flight: it never happened. Nothing re-polls
    // a connection holding no lock, so staying quiet left the walkthrough parked on "connect
    // your data" watching a connection that would never report anything. The coachmark's "run
    // the sync again, or connect a different source" is the way out, and the flow still does
    // not advance until a sync actually succeeds.
    setupAuthStore(buildOrgUser());
    savePath('automate_pipeline', 'automate_pipeline');
    saveWalkthroughStage('automate_pipeline', 'pipeline_source_next');
    saveTrackedConnection('automate_pipeline', 'conn-1');
    ageTrackedConnection();
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

    await waitFor(() => expect(useInsightWalkthroughStore.getState().stage).toBe('sync_failed'));
    expect(hasConnectedRealData()).toBe(false);
  });

  it('stays quiet about a never-triggered sync once that failure has been acknowledged', async () => {
    // Dismissals are keyed by run, and this shape has no run — so it borrows a fixed id.
    // Without one, "Got it" was forgotten on the next poll and the same coachmark came back.
    setupAuthStore(buildOrgUser());
    savePath('automate_pipeline', 'automate_pipeline');
    saveWalkthroughStage('automate_pipeline', 'pipeline_ingest');
    saveTrackedConnection('automate_pipeline', 'conn-1');
    ageTrackedConnection();
    saveDismissedSyncRun('automate_pipeline', 'no-sync-triggered');
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
    expect(useInsightWalkthroughStore.getState().stage).toBe('pipeline_ingest');
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
    // Opens on the Ingest sidebar nudge and stays put: the row starts the flow, the USER
    // clicks Ingest. Pushing them onto /ingest moved them somewhere they hadn't asked to go.
    expect(useInsightWalkthroughStore.getState().stage).toBe('pipeline_ingest_nudge');
    expect(mockPush).not.toHaveBeenCalled();
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
