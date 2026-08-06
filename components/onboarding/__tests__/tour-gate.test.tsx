import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet } from '@/test-utils/api';
import { TOUR_SEEN_STORAGE_PREFIX } from '../tour-constants';
import { TourGate } from '../tour-gate';

// ============ Mocks ============

const mockStartTour = jest.fn();
// Captured so tests can assert what TourGate hands down — the post-tour choice gate lives
// inside ProductTour (driver.js, unmountable in jsdom), so the prop is the testable seam.
const mockTourProps: {
  current: {
    canOfferPostTourChoice?: boolean;
    onTourEnd?: (reason: 'completed' | 'skipped') => void;
  } | null;
} = { current: null };
jest.mock('../product-tour', () => ({
  ProductTour: React.forwardRef(function MockProductTour(
    props: {
      orgSlug: string;
      canOfferPostTourChoice?: boolean;
      onTourEnd?: (reason: 'completed' | 'skipped') => void;
    },
    ref: React.Ref<{ startTour: () => void }>
  ) {
    mockTourProps.current = props;
    React.useImperativeHandle(ref, () => ({ startTour: mockStartTour }));
    return <div data-testid="mock-product-tour" />;
  }),
}));

let mockPathname = '/impact';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: jest.fn(), prefetch: jest.fn() }),
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
    expect(screen.getByTestId('getting-started-widget-item-take-tour')).toBeInTheDocument();
  });

  it('does not auto-open the intent modal when the org already saw the tour', () => {
    localStorage.setItem(`${TOUR_SEEN_STORAGE_PREFIX}trial-org`, '1');
    setupAuthStore(buildOrgUser());
    renderGate();

    // Dialog content only renders in the DOM when open (Radix unmounts when closed).
    expect(screen.queryByText('What brings you to Dalgo')).not.toBeInTheDocument();
    // Post-seen checklist shape: "Connect your own data" replaces "Take a quick tour".
    expect(screen.getByTestId('getting-started-widget-item-connect-data')).toBeInTheDocument();
    expect(screen.queryByTestId('getting-started-widget-item-take-tour')).not.toBeInTheDocument();
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

  it('shows "Automate data pipeline" as checked the moment the pipeline is created, before the walkthrough finishes', () => {
    localStorage.setItem(`${TOUR_SEEN_STORAGE_PREFIX}trial-org`, '1');
    localStorage.setItem('dalgo_insight_walkthrough_pipeline_created_trial-org', '1');
    setupAuthStore(buildOrgUser());
    renderGate();

    // hasAutomatedPipeline is its own milestone flag, independent of hasFinishedWalkthrough —
    // the automate-pipeline fork keeps going into chart/dashboard/share after this point
    // (see AUTOMATE_PIPELINE_STAGE_ORDER), so this must check in without waiting for that.
    const pipelineItem = screen.getByTestId('getting-started-widget-item-automate-pipeline');
    expect(pipelineItem.querySelector('svg')).toHaveClass('text-primary');

    const insightItem = screen.getByTestId('getting-started-widget-item-build-insight');
    expect(insightItem.querySelector('svg')).toHaveClass('text-muted-foreground');
  });

  it('shows "Build your first insight" as checked once the automate-pipeline fork finishes its chart/dashboard/share tail', () => {
    localStorage.setItem(`${TOUR_SEEN_STORAGE_PREFIX}trial-org`, '1');
    localStorage.setItem('dalgo_insight_walkthrough_pipeline_created_trial-org', '1');
    localStorage.setItem('dalgo_insight_walkthrough_path_trial-org', 'automate_pipeline');
    localStorage.setItem('dalgo_insight_walkthrough_done_trial-org', '1');
    setupAuthStore(buildOrgUser());
    renderGate();

    // hasFinishedWalkthrough now only fires once the automate-pipeline fork's continuation
    // (chart → dashboard → share) completes, so it's no longer paired with a path exclusion —
    // it reflects a real built insight for every fork, including this one.
    const item = screen.getByTestId('getting-started-widget-item-build-insight');
    expect(item.querySelector('svg')).toHaveClass('text-primary');
  });

  it('shows "Build your first insight" as checked when the sample path finished', () => {
    localStorage.setItem(`${TOUR_SEEN_STORAGE_PREFIX}trial-org`, '1');
    localStorage.setItem('dalgo_insight_walkthrough_path_trial-org', 'sample');
    localStorage.setItem('dalgo_insight_walkthrough_done_trial-org', '1');
    setupAuthStore(buildOrgUser());
    renderGate();

    const item = screen.getByTestId('getting-started-widget-item-build-insight');
    expect(item).toBeInTheDocument();
    expect(item.querySelector('svg')).toHaveClass('text-primary');
  });
});
