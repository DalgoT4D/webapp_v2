import React from 'react';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockApiPut } from '@/test-utils/api';
import type { TrialWalkthroughState } from '@/hooks/api/useTrialWalkthrough';
import { FeatureNudgeCoachmark } from '../feature-nudge-coachmark';

let mockPathname = '/reports';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

const mockTrackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

/** The page CTA each nudge waits for before rendering anything. */
function mountCta(testId: string): HTMLElement {
  const button = document.createElement('button');
  button.setAttribute('data-testid', testId);
  document.body.appendChild(button);
  return button;
}

function dismissButton(): HTMLElement | null {
  return document.querySelector('[data-testid="feature-nudge-dismiss-btn"]');
}

function popoverTitle(): string {
  return document.querySelector('.driver-popover-title')?.textContent ?? '';
}

/** No nudge is expected — give the effect a few frames to prove it stays away. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 50));
}

const NOT_DISMISSED: TrialWalkthroughState = {};
const DISMISSED: TrialWalkthroughState = {
  reports_nudge: { skipped: false, completed: true },
};

describe('FeatureNudgeCoachmark', () => {
  beforeEach(() => {
    mockPathname = '/reports';
    document.body.innerHTML = '';
    document.body.className = '';
    jest.clearAllMocks();
    mockApiPut.mockResolvedValue({ success: true });
  });

  it('shows the nudge on a matching route when the key is absent from the backend record', async () => {
    mountCta('create-report-btn');

    render(<FeatureNudgeCoachmark suppressed={false} walkthroughState={NOT_DISMISSED} />);

    await waitFor(() => expect(dismissButton()).not.toBeNull());
    expect(popoverTitle()).toBe('Report');
  });

  it('renders each route its own nudge', async () => {
    mockPathname = '/metrics';
    mountCta('create-metric-btn');

    render(<FeatureNudgeCoachmark suppressed={false} walkthroughState={NOT_DISMISSED} />);

    await waitFor(() => expect(popoverTitle()).toBe('Metric'));
  });

  it('shows nothing on a route with no nudge', async () => {
    mockPathname = '/dashboards';
    mountCta('create-report-btn');

    render(<FeatureNudgeCoachmark suppressed={false} walkthroughState={NOT_DISMISSED} />);

    await settle();
    expect(dismissButton()).toBeNull();
  });

  it('stays away once the nudge has been dismissed', async () => {
    mountCta('create-report-btn');

    render(<FeatureNudgeCoachmark suppressed={false} walkthroughState={DISMISSED} />);

    await settle();
    expect(dismissButton()).toBeNull();
  });

  it('yields to a live walkthrough coachmark', async () => {
    mountCta('create-report-btn');

    render(<FeatureNudgeCoachmark suppressed walkthroughState={NOT_DISMISSED} />);

    await settle();
    expect(dismissButton()).toBeNull();
  });

  it('waits while the preferences request is still in flight', async () => {
    // Rendering here would flash a nudge the user may have already dismissed.
    mountCta('create-report-btn');

    render(<FeatureNudgeCoachmark suppressed={false} walkthroughState={undefined} />);

    await settle();
    expect(dismissButton()).toBeNull();
  });

  it('shows nothing, and records nothing, when the CTA is permission-gated away', async () => {
    // No mountCta — the page rendered without its create button.
    render(<FeatureNudgeCoachmark suppressed={false} walkthroughState={NOT_DISMISSED} />);

    await settle();
    expect(dismissButton()).toBeNull();
    expect(mockApiPut).not.toHaveBeenCalled();
  });

  it('records the nudge as completed under its own key when the ✕ is clicked', async () => {
    mountCta('create-report-btn');
    render(<FeatureNudgeCoachmark suppressed={false} walkthroughState={NOT_DISMISSED} />);
    await waitFor(() => expect(dismissButton()).not.toBeNull());

    await userEvent.click(dismissButton()!);

    expect(mockApiPut).toHaveBeenCalledWith('/api/userpreferences/trial-walkthrough', {
      flow: 'reports_nudge',
      completed: true,
    });
    expect(dismissButton()).toBeNull();
  });

  it('renders a visible ✕ — the only way out', async () => {
    // Regression guard: driver.highlight() injects its own `showButtons: []`, which leaves the
    // close button with an inline `display: none` unless showButtons is set per-popover.
    mountCta('create-report-btn');

    render(<FeatureNudgeCoachmark suppressed={false} walkthroughState={NOT_DISMISSED} />);

    await waitFor(() => expect(dismissButton()).not.toBeNull());
    expect(dismissButton()!.textContent).toBe('✕');
    expect(dismissButton()!.style.display).toBe('block');
    expect(dismissButton()!.parentElement).toBe(
      document.querySelector('.driver-popover-title')?.parentElement
    );
    expect(dismissButton()!.parentElement).toHaveClass(
      'dalgo-tour-heading-row',
      'dalgo-tour-heading-row--coachmark'
    );
  });

  it('keeps the page clickable while the nudge is up, and cleans up on unmount', async () => {
    mountCta('create-report-btn');
    const { unmount } = render(
      <FeatureNudgeCoachmark suppressed={false} walkthroughState={NOT_DISMISSED} />
    );
    await waitFor(() => expect(dismissButton()).not.toBeNull());
    expect(document.body.classList.contains('dalgo-tour-passthrough')).toBe(true);

    unmount();

    expect(document.body.classList.contains('dalgo-tour-passthrough')).toBe(false);
    expect(dismissButton()).toBeNull();
  });

  it('tears down without recording when a dialog opens over the page', async () => {
    // Clicking the CTA opens a create dialog; the popover would otherwise float on top of it.
    // Unrecorded, so the nudge comes back on the next visit.
    mountCta('create-report-btn');
    render(<FeatureNudgeCoachmark suppressed={false} walkthroughState={NOT_DISMISSED} />);
    await waitFor(() => expect(dismissButton()).not.toBeNull());

    const dialog = document.createElement('div');
    dialog.setAttribute('data-slot', 'dialog-content');
    dialog.setAttribute('data-state', 'open');
    document.body.appendChild(dialog);

    await waitFor(() => expect(dismissButton()).toBeNull());
    expect(mockApiPut).not.toHaveBeenCalled();
  });

  it('fires view and dismiss analytics carrying the nudge key', async () => {
    mountCta('create-report-btn');
    render(<FeatureNudgeCoachmark suppressed={false} walkthroughState={NOT_DISMISSED} />);
    await waitFor(() => expect(dismissButton()).not.toBeNull());

    expect(mockTrackEvent).toHaveBeenCalledWith('trial_onboarding:feature_nudge_viewed', {
      nudge: 'reports_nudge',
    });

    await userEvent.click(dismissButton()!);

    expect(mockTrackEvent).toHaveBeenCalledWith('trial_onboarding:feature_nudge_dismissed', {
      nudge: 'reports_nudge',
    });
  });
});
