import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestWrapper } from '@/test-utils/render';
import { TOUR_SEEN_STORAGE_PREFIX } from '../tour-constants';
import { TourGate } from '../tour-gate';

// ============ Mocks ============

const mockStartTour = jest.fn();
jest.mock('../product-tour', () => ({
  ProductTour: React.forwardRef(function MockProductTour(
    _props: { orgSlug: string },
    ref: React.Ref<{ startTour: () => void }>
  ) {
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

  it('mounts the tour engine on any route for a trial org, but only shows the modal/widget on /impact', () => {
    mockPathname = '/charts';
    setupAuthStore(buildOrgUser());
    renderGate();

    expect(screen.getByTestId('mock-product-tour')).toBeInTheDocument();
    expect(screen.queryByTestId('getting-started-widget')).not.toBeInTheDocument();
  });

  it('auto-opens the intent modal on /impact when the tour has not been seen', () => {
    setupAuthStore(buildOrgUser());
    renderGate();

    expect(screen.getByTestId('tour-intent-modal')).toBeInTheDocument();
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

  it('starts the driver.js tour when the intent modal\'s "Take a Product tour" option is picked', async () => {
    const user = userEvent.setup();
    setupAuthStore(buildOrgUser());
    renderGate();

    await user.click(screen.getByTestId('tour-intent-option-tour'));

    expect(mockStartTour).toHaveBeenCalledTimes(1);
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

  it('shows "Automate data pipeline" as checked when that path finished', () => {
    localStorage.setItem(`${TOUR_SEEN_STORAGE_PREFIX}trial-org`, '1');
    localStorage.setItem('dalgo_insight_walkthrough_path_trial-org', 'automate_pipeline');
    localStorage.setItem('dalgo_insight_walkthrough_done_trial-org', '1');
    setupAuthStore(buildOrgUser());
    renderGate();

    const item = screen.getByTestId('getting-started-widget-item-automate-pipeline');
    expect(item).toBeInTheDocument();
    expect(item.querySelector('svg')).toHaveClass('text-primary');
  });

  it('does NOT show "Build your first insight" as checked when only the automate-pipeline path finished', () => {
    localStorage.setItem(`${TOUR_SEEN_STORAGE_PREFIX}trial-org`, '1');
    localStorage.setItem('dalgo_insight_walkthrough_path_trial-org', 'automate_pipeline');
    localStorage.setItem('dalgo_insight_walkthrough_done_trial-org', '1');
    setupAuthStore(buildOrgUser());
    renderGate();

    // Automating a pipeline finished the walkthrough, but built no chart/dashboard —
    // "Build your first insight" must stay unchecked (regression guard for the
    // cross-fork false positive: hasFinishedWalkthrough is a single global flag
    // shared by all 3 forks, so it must be paired with a path check).
    const item = screen.getByTestId('getting-started-widget-item-build-insight');
    expect(item).toBeInTheDocument();
    expect(item.querySelector('svg')).toHaveClass('text-muted-foreground');
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
