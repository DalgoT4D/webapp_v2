/**
 * The product tour's half of the unified onboarding-path events (path 'walkthrough').
 *
 * Drives the real driver.js engine the way a user does — Next through every step, or ✕ out of
 * one — because the analytics calls hang off driver's own popover hooks and a mocked engine
 * would only prove the mock was wired.
 */
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TOUR_STEPS } from '../tour-constants';
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

it('exits the walkthrough path with the step quit on when the user closes the tour', async () => {
  const ref = renderTour();
  await act(async () => ref.current?.startTour());
  await waitFor(() => expect(closeButton()).not.toBeNull());

  await userEvent.click(closeButton() as HTMLElement);

  expect(mockExitPath).toHaveBeenCalledWith('walkthrough', TOUR_STEPS[0].route, {
    stageIndex: 0,
  });
  expect(mockCompletePath).not.toHaveBeenCalled();
});

it('completes the walkthrough path when the last step is finished', async () => {
  const ref = renderTour();
  await act(async () => ref.current?.startTour(TOUR_STEPS.length - 1));
  await waitFor(() => expect(nextButton()).not.toBeNull());

  await userEvent.click(nextButton() as HTMLElement);

  await waitFor(() => expect(mockCompletePath).toHaveBeenCalledWith('walkthrough'));
  expect(mockExitPath).not.toHaveBeenCalled();
});
