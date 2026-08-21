import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GetStartedModal } from '../get-started-modal';

const trackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

function renderModal(props: Partial<React.ComponentProps<typeof GetStartedModal>> = {}) {
  const handlers = {
    onOpenChange: jest.fn(),
    onScreenChange: jest.fn(),
    onSelectPipeline: jest.fn(),
    onSelectSample: jest.fn(),
    onSelectOwnData: jest.fn(),
  };
  render(
    <GetStartedModal open initialScreen="choice" entry="post_tour" {...handlers} {...props} />
  );
  return handlers;
}

describe('GetStartedModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens on the post-tour choice screen and tracks the view', () => {
    renderModal();

    const finalHeadingLine = screen.getByText('Let’s get to building!');
    expect(finalHeadingLine.tagName).toBe('SPAN');
    expect(finalHeadingLine).toHaveClass('block');
    expect(screen.getByTestId('get-started-option-insight')).toBeInTheDocument();
    expect(screen.getByTestId('get-started-option-pipeline')).toBeInTheDocument();
    expect(screen.queryByTestId('get-started-option-sample')).not.toBeInTheDocument();
    expect(screen.getByTestId('get-started-modal-illustration-pane')).toHaveClass('p-4');
    expect(trackEvent).toHaveBeenCalledWith('trial_onboarding:post_tour_modal_viewed', {
      entry: 'post_tour',
    });
  });

  it('drops the insight row when that flow is already resolved', () => {
    renderModal({ showInsightOption: false });

    expect(screen.queryByTestId('get-started-option-insight')).not.toBeInTheDocument();
    expect(screen.getByTestId('get-started-option-pipeline')).toBeInTheDocument();
  });

  it('drops the pipeline row when that flow is already resolved', () => {
    renderModal({ showPipelineOption: false });

    expect(screen.getByTestId('get-started-option-insight')).toBeInTheDocument();
    expect(screen.queryByTestId('get-started-option-pipeline')).not.toBeInTheDocument();
  });

  it('"Build your first insight" swaps to the fork screen in place, keeping the dialog mounted', async () => {
    const user = userEvent.setup();
    const handlers = renderModal();

    await user.click(screen.getByTestId('get-started-option-insight'));

    expect(screen.getByTestId('get-started-modal')).toBeInTheDocument();
    expect(handlers.onOpenChange).not.toHaveBeenCalled();
    expect(handlers.onScreenChange).toHaveBeenCalledWith('insight');
    expect(screen.getByTestId('get-started-option-sample')).toBeInTheDocument();
    expect(screen.getByTestId('get-started-option-own-data')).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith('trial_onboarding:insight_fork_modal_viewed', {
      entry: 'post_tour',
    });
  });

  it('the back arrow returns to the choice screen when the fork was reached from it', async () => {
    const user = userEvent.setup();
    const handlers = renderModal();
    await user.click(screen.getByTestId('get-started-option-insight'));

    await user.click(screen.getByTestId('get-started-back-btn'));

    expect(screen.getByTestId('get-started-option-insight')).toBeInTheDocument();
    expect(handlers.onScreenChange).toHaveBeenLastCalledWith('choice');
  });

  it('restores the back arrow when a post-tour insight screen survives a refresh', () => {
    renderModal({ initialScreen: 'insight', entry: 'post_tour' });

    expect(screen.getByTestId('get-started-back-btn')).toBeInTheDocument();
    expect(screen.getByTestId('get-started-option-sample')).toBeInTheDocument();
  });

  it('has no back arrow when opened straight onto the fork screen', () => {
    renderModal({ initialScreen: 'insight', entry: 'widget' });

    expect(screen.getByTestId('get-started-option-sample')).toBeInTheDocument();
    expect(screen.queryByTestId('get-started-back-btn')).not.toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith('trial_onboarding:insight_fork_modal_viewed', {
      entry: 'widget',
    });
  });

  it('"Use sample data" closes the dialog, fires the choice, and tracks the fork', async () => {
    const user = userEvent.setup();
    const handlers = renderModal({ initialScreen: 'insight', entry: 'widget' });

    await user.click(screen.getByTestId('get-started-option-sample'));

    expect(handlers.onSelectSample).toHaveBeenCalledTimes(1);
    expect(handlers.onSelectOwnData).not.toHaveBeenCalled();
    expect(handlers.onOpenChange).toHaveBeenCalledWith(false);
    expect(trackEvent).toHaveBeenCalledWith('trial_onboarding:insight_fork_chosen', {
      choice: 'sample',
    });
    expect(trackEvent).toHaveBeenCalledWith('trial_onboarding:insight_fork_modal_dismissed', {
      choice: 'sample',
      entry: 'widget',
    });
  });

  it('"Connect my own data" fires the own-data choice', async () => {
    const user = userEvent.setup();
    const handlers = renderModal({ initialScreen: 'insight', entry: 'widget' });

    await user.click(screen.getByTestId('get-started-option-own-data'));

    expect(handlers.onSelectOwnData).toHaveBeenCalledTimes(1);
    expect(handlers.onSelectSample).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith('trial_onboarding:insight_fork_chosen', {
      choice: 'own_data',
    });
    expect(trackEvent).toHaveBeenCalledWith('trial_onboarding:insight_fork_modal_dismissed', {
      choice: 'own_data',
      entry: 'widget',
    });
  });

  it('the pipeline option closes the dialog and starts that flow', async () => {
    const user = userEvent.setup();
    const handlers = renderModal();

    await user.click(screen.getByTestId('get-started-option-pipeline'));

    expect(handlers.onSelectPipeline).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenChange).toHaveBeenCalledWith(false);
    expect(trackEvent).toHaveBeenCalledWith('trial_onboarding:post_tour_modal_dismissed', {
      choice: 'pipeline',
      entry: 'post_tour',
    });
  });

  it('closing is a plain dismiss — no fork is chosen', async () => {
    const user = userEvent.setup();
    const handlers = renderModal({ initialScreen: 'insight', entry: 'widget' });

    await user.click(screen.getByRole('button', { name: /close/i }));

    expect(handlers.onOpenChange).toHaveBeenCalledWith(false);
    expect(handlers.onSelectSample).not.toHaveBeenCalled();
    expect(handlers.onSelectOwnData).not.toHaveBeenCalled();
    // The FORK screen was the one on show, so its own dismissal is what fires — not the
    // choice screen's, which this entry point never rendered.
    expect(trackEvent).toHaveBeenCalledWith('trial_onboarding:insight_fork_modal_dismissed', {
      choice: 'close',
      entry: 'widget',
    });
    expect(trackEvent).not.toHaveBeenCalledWith(
      'trial_onboarding:post_tour_modal_dismissed',
      expect.anything()
    );
  });

  it('reports one dismissal per screen visit when the user moves choice -> fork -> close', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId('get-started-option-insight'));
    await user.click(screen.getByRole('button', { name: /close/i }));

    const dismissals = trackEvent.mock.calls.filter(([event]) =>
      String(event).endsWith('_modal_dismissed')
    );
    expect(dismissals).toEqual([
      ['trial_onboarding:post_tour_modal_dismissed', { choice: 'insight', entry: 'post_tour' }],
      ['trial_onboarding:insight_fork_modal_dismissed', { choice: 'close', entry: 'post_tour' }],
    ]);
  });

  it('pairs a viewed with a dismissed on each screen when the back arrow is used', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId('get-started-option-insight'));
    await user.click(screen.getByTestId('get-started-back-btn'));

    const lifecycle = trackEvent.mock.calls.filter(([event]) =>
      /_modal_(viewed|dismissed)$/.test(String(event))
    );
    expect(lifecycle).toEqual([
      ['trial_onboarding:post_tour_modal_viewed', { entry: 'post_tour' }],
      ['trial_onboarding:post_tour_modal_dismissed', { choice: 'insight', entry: 'post_tour' }],
      ['trial_onboarding:insight_fork_modal_viewed', { entry: 'post_tour' }],
      ['trial_onboarding:insight_fork_modal_dismissed', { choice: 'back', entry: 'post_tour' }],
      ['trial_onboarding:post_tour_modal_viewed', { entry: 'post_tour' }],
    ]);
  });
});
