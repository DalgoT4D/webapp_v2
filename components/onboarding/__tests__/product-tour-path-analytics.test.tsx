/**
 * The product tour's half of the unified onboarding-path events (path 'walkthrough').
 *
 * Drives the real driver.js engine the way a user does — Next through every step, or ✕ out of
 * one — because the analytics calls hang off driver's own popover hooks and a mocked engine
 * would only prove the mock was wired.
 */
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getTourProgress, TOUR_STEPS } from '../tour-constants';
import { ProductTour, type ProductTourHandle } from '../product-tour';

const mockStartPath = jest.fn();
const mockResumePath = jest.fn();
const mockStagePath = jest.fn();
const mockCompletePath = jest.fn();
const mockExitPath = jest.fn();

jest.mock('@/lib/onboarding-analytics', () => ({
  startOnboardingPath: (...args: unknown[]) => mockStartPath(...args),
  resumeOnboardingPath: (...args: unknown[]) => mockResumePath(...args),
  trackOnboardingPathStage: (...args: unknown[]) => mockStagePath(...args),
  completeOnboardingPath: (...args: unknown[]) => mockCompletePath(...args),
  exitOnboardingPath: (...args: unknown[]) => mockExitPath(...args),
}));

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));

// The tour navigates itself: each step pushes its route and then waits for the browser's real
// pathname to catch up (waitForPathname). Pushing into jsdom's history is what lets that
// resolve, so the run walks the steps instead of stalling 4s per step.
jest.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => ({
    push: (url: string) => window.history.pushState({}, '', url),
    prefetch: jest.fn(),
  }),
}));

/**
 * The chrome the tour anchors to: the content wrapper it spotlights, and a sidebar link per
 * step (a step whose link is missing is deliberately skipped by the tour).
 */
function mountAppChrome(): void {
  const content = document.createElement('div');
  content.id = 'main-layout-main-content';
  // Every step is spotlightRowOnly, and those wait up to 3s for the page's rows to appear
  // before rendering. Give each row shape the tour looks for so the steps render at once.
  content.innerHTML = `
    <table><tbody><tr><td>row</td></tr></tbody></table>
    <div data-testid="source-row-1">source</div>
    <div data-testid="dbt-repository-card">repo</div>
  `;
  document.body.appendChild(content);

  const sidebar = document.createElement('div');
  sidebar.id = 'main-layout-sidebar';
  TOUR_STEPS.forEach((step) => {
    const link = document.createElement('a');
    link.setAttribute('href', step.route);
    sidebar.appendChild(link);
  });
  document.body.appendChild(sidebar);
}

function renderTour(): React.RefObject<ProductTourHandle | null> {
  const ref = React.createRef<ProductTourHandle>();
  render(<ProductTour ref={ref} orgSlug="org-a" onOfferPostTourChoice={jest.fn()} />);
  return ref;
}

function nextButton(): HTMLElement | null {
  return document.querySelector('.driver-popover-next-btn');
}

function closeButton(): HTMLElement | null {
  return document.querySelector('.driver-popover-close-btn');
}

/** The "Leave the walkthrough?" prompt every exit now goes through. */
function leavePrompt(): HTMLElement | null {
  return document.querySelector('[data-testid="leave-walkthrough-dialog"]');
}

function promptButton(action: 'skip' | 'continue'): HTMLElement {
  return document.querySelector(`[data-testid="leave-walkthrough-${action}-btn"]`) as HTMLElement;
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  document.body.innerHTML = '';
  window.history.pushState({}, '', TOUR_STEPS[0].route);
  mountAppChrome();
});

it('starts the walkthrough path on a fresh run', async () => {
  const ref = renderTour();

  await act(async () => ref.current?.startTour());

  expect(mockStartPath).toHaveBeenCalledWith('walkthrough');
  expect(mockResumePath).not.toHaveBeenCalled();
});

it('resumes rather than restarts when picked up mid-run', async () => {
  const ref = renderTour();

  await act(async () => ref.current?.startTour(2));

  expect(mockResumePath).toHaveBeenCalledWith('walkthrough', TOUR_STEPS[2].route);
  expect(mockStartPath).not.toHaveBeenCalled();
});

it('reports each step as a stage of the walkthrough path, indexed in tour order', async () => {
  const ref = renderTour();
  await act(async () => ref.current?.startTour());

  await waitFor(() => expect(nextButton()).not.toBeNull());
  expect(mockStagePath).toHaveBeenCalledWith('walkthrough', TOUR_STEPS[0].route, {
    stageIndex: 0,
  });

  await userEvent.click(nextButton() as HTMLElement);

  await waitFor(() =>
    expect(mockStagePath).toHaveBeenCalledWith('walkthrough', TOUR_STEPS[1].route, {
      stageIndex: 1,
    })
  );
});

it('goes back to the previous page and saves that step for resuming', async () => {
  const ref = renderTour();
  await act(async () => ref.current?.startTour());
  await waitFor(() => expect(nextButton()).not.toBeNull());
  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();

  await userEvent.click(nextButton() as HTMLElement);
  const back = await screen.findByRole('button', { name: 'Back' });
  expect(window.location.pathname).toBe(TOUR_STEPS[1].route);
  await userEvent.click(back);

  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  );
  expect(window.location.pathname).toBe(TOUR_STEPS[0].route);
  expect(getTourProgress('org-a')).toBe(0);
  expect(mockStagePath).toHaveBeenLastCalledWith('walkthrough', TOUR_STEPS[0].route, {
    stageIndex: 0,
  });
  expect(mockCompletePath).not.toHaveBeenCalled();
  expect(mockExitPath).not.toHaveBeenCalled();
});

it('walks every product-tour page backwards and forwards without completing early', async () => {
  const ref = renderTour();
  await act(async () => ref.current?.startTour(TOUR_STEPS.length - 1));
  for (let index = TOUR_STEPS.length - 2; index >= 0; index--) {
    await userEvent.click(await screen.findByRole('button', { name: 'Back' }));
    await waitFor(() => expect(getTourProgress('org-a')).toBe(index));
    expect(window.location.pathname).toBe(TOUR_STEPS[index].route);
    expect(mockStagePath).toHaveBeenLastCalledWith('walkthrough', TOUR_STEPS[index].route, {
      stageIndex: index,
    });
  }
  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  for (let index = 1; index < TOUR_STEPS.length; index++) {
    await userEvent.click(nextButton() as HTMLElement);
    await waitFor(() => expect(getTourProgress('org-a')).toBe(index));
    expect(window.location.pathname).toBe(TOUR_STEPS[index].route);
  }
  expect(mockCompletePath).not.toHaveBeenCalled();
  expect(mockExitPath).not.toHaveBeenCalled();
});

it('can go back from a resumed final step without finishing the tour', async () => {
  const ref = renderTour();
  await act(async () => ref.current?.startTour(TOUR_STEPS.length - 1));
  const back = await screen.findByRole('button', { name: 'Back' });

  await userEvent.click(back);

  await waitFor(() =>
    expect(mockStagePath).toHaveBeenLastCalledWith(
      'walkthrough',
      TOUR_STEPS[TOUR_STEPS.length - 2].route,
      { stageIndex: TOUR_STEPS.length - 2 }
    )
  );
  expect(getTourProgress('org-a')).toBe(TOUR_STEPS.length - 2);
  expect(mockCompletePath).not.toHaveBeenCalled();
  expect(mockExitPath).not.toHaveBeenCalled();
});

it('skips an unavailable section backwards while Back and Next remain disabled in transit', async () => {
  const ref = renderTour();
  await act(async () => ref.current?.startTour(2));
  const back = await screen.findByRole('button', { name: 'Back' });
  document.querySelector(`#main-layout-sidebar a[href="${TOUR_STEPS[1].route}"]`)?.remove();
  jest.useFakeTimers();
  try {
    act(() => back.click());
    expect(back).toBeDisabled();
    expect(nextButton()).toBeDisabled();
    await act(async () => jest.advanceTimersByTimeAsync(6500));

    expect(window.location.pathname).toBe(TOUR_STEPS[0].route);
    expect(getTourProgress('org-a')).toBe(0);
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    expect(mockCompletePath).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

it('exits the walkthrough path with the step quit on once the user confirms the close', async () => {
  const ref = renderTour();
  await act(async () => ref.current?.startTour());
  await waitFor(() => expect(closeButton()).not.toBeNull());

  await userEvent.click(closeButton() as HTMLElement);
  await waitFor(() => expect(leavePrompt()).not.toBeNull());
  await userEvent.click(promptButton('skip'));

  expect(mockExitPath).toHaveBeenCalledWith('walkthrough', TOUR_STEPS[0].route, {
    stageIndex: 0,
  });
  expect(mockCompletePath).not.toHaveBeenCalled();
});

it('stays on the same step when the close is not confirmed', async () => {
  const ref = renderTour();
  await act(async () => ref.current?.startTour());
  await waitFor(() => expect(closeButton()).not.toBeNull());

  await userEvent.click(closeButton() as HTMLElement);
  await waitFor(() => expect(leavePrompt()).not.toBeNull());
  await userEvent.click(promptButton('continue'));

  await waitFor(() => expect(leavePrompt()).toBeNull());
  expect(mockExitPath).not.toHaveBeenCalled();
  // Still driving: the popover the user was on is untouched.
  expect(nextButton()).not.toBeNull();
});

it('asks instead of ignoring a click on the dimmed page', async () => {
  const ref = renderTour();
  await act(async () => ref.current?.startTour());
  await waitFor(() => expect(nextButton()).not.toBeNull());

  await userEvent.click(document.getElementById('main-layout-main-content') as HTMLElement);

  await waitFor(() => expect(leavePrompt()).not.toBeNull());
  expect(mockExitPath).not.toHaveBeenCalled();
});

it('completes the walkthrough path when the last step is finished', async () => {
  const ref = renderTour();
  await act(async () => ref.current?.startTour(TOUR_STEPS.length - 1));
  await waitFor(() => expect(nextButton()).not.toBeNull());

  await userEvent.click(nextButton() as HTMLElement);

  await waitFor(() => expect(mockCompletePath).toHaveBeenCalledWith('walkthrough'));
  expect(mockExitPath).not.toHaveBeenCalled();
});
