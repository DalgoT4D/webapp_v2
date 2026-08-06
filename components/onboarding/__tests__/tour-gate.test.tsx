import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet } from '@/test-utils/api';
import { TOUR_SEEN_STORAGE_PREFIX, saveTourProgress } from '../tour-constants';
import { savePath, saveWalkthroughStage } from '../insight-walkthrough-constants';
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

  it('stops offering the post-tour choice once automate-pipeline is complete — it settles both', async () => {
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
    expect(mockTourProps.current?.canOfferPostTourChoice).toBe(false);
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

  it('completing automate-pipeline ticks both rows — that fork ends in the same insight tail', async () => {
    localStorage.setItem(`${TOUR_SEEN_STORAGE_PREFIX}trial-org`, '1');
    mockWalkthroughState({ automate_pipeline: { skipped: false, completed: true } });
    setupAuthStore(buildOrgUser());
    renderGate();

    await expectTick('automate-pipeline', true);
    await expectTick('build-insight', true);
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
    savePath('trial-org', 'sample');
    // Left off inside the KPI form dialog — that field only exists while the dialog is open,
    // so resuming there literally shows nothing; kpi_intro is the re-entry point.
    saveWalkthroughStage('trial-org', 'kpi_metric');
    setupAuthStore(buildOrgUser());
    renderGate();

    await clickBuildInsight(user);

    expect(useInsightWalkthroughStore.getState().stage).toBe('kpi_intro');
    expect(mockPush).toHaveBeenCalledWith('/kpis');
    expect(screen.queryByTestId('get-started-option-sample')).not.toBeInTheDocument();
  });

  it('re-offers the fork when a path was picked but the flow was skipped (no stage left)', async () => {
    const user = userEvent.setup();
    savePath('trial-org', 'own_data');
    setupAuthStore(buildOrgUser());
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
    savePath('trial-org', 'automate_pipeline');
    // Depends on an open operation panel — pipeline_pick_table is the cold-load entry.
    saveWalkthroughStage('trial-org', 'pipeline_drop_columns');
    setupAuthStore(buildOrgUser());
    renderGate();

    await clickChecklistRow(user, 'automate-pipeline');

    expect(useInsightWalkthroughStore.getState().stage).toBe('pipeline_pick_table');
    expect(mockPush).toHaveBeenCalledWith('/transform/canvas');
  });
});
