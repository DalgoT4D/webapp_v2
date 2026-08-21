import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TourIntentModal, type TourIntentVariant } from '../tour-intent-modal';

const trackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

function renderModal(overrides?: { open?: boolean; variant?: TourIntentVariant }) {
  const handlers = {
    onOpenChange: jest.fn(),
    onStartTour: jest.fn(),
    onSelectInsight: jest.fn(),
    onSelectPipeline: jest.fn(),
  };
  const view = render(
    <TourIntentModal
      open={overrides?.open ?? true}
      variant={overrides?.variant ?? 'first_time'}
      trialDaysLeft={7}
      {...handlers}
    />
  );
  return { ...handlers, view };
}

describe('TourIntentModal analytics', () => {
  beforeEach(() => jest.clearAllMocks());

  // tour-gate opens this modal by flipping the `open` prop. Radix never calls onOpenChange for
  // a controlled open, so the view event must come from an effect — this is the regression that
  // left the modal with dismissals and no view count at all.
  it('fires the view event when the owner opens it via the prop', () => {
    renderModal({ open: true });

    expect(trackEvent).toHaveBeenCalledWith('trial_onboarding:tour_intent_modal_viewed', {
      variant: 'first_time',
    });
  });

  it('does not fire the view event while closed', () => {
    renderModal({ open: false });

    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('fires the view event once per open, not per re-render', () => {
    const { view } = renderModal({ open: true });

    view.rerender(
      <TourIntentModal
        open
        variant="first_time"
        trialDaysLeft={6}
        onOpenChange={jest.fn()}
        onStartTour={jest.fn()}
        onSelectInsight={jest.fn()}
        onSelectPipeline={jest.fn()}
      />
    );

    expect(
      trackEvent.mock.calls.filter(
        ([event]) => event === 'trial_onboarding:tour_intent_modal_viewed'
      )
    ).toHaveLength(1);
  });

  it('counts a second view when the modal is reopened with the returning copy', () => {
    const { view } = renderModal({ open: true, variant: 'first_time' });

    view.rerender(
      <TourIntentModal
        open
        variant="returning"
        trialDaysLeft={2}
        onOpenChange={jest.fn()}
        onStartTour={jest.fn()}
        onSelectInsight={jest.fn()}
        onSelectPipeline={jest.fn()}
      />
    );

    expect(trackEvent).toHaveBeenCalledWith('trial_onboarding:tour_intent_modal_viewed', {
      variant: 'returning',
    });
    expect(
      trackEvent.mock.calls.filter(
        ([event]) => event === 'trial_onboarding:tour_intent_modal_viewed'
      )
    ).toHaveLength(2);
  });

  it('still fires the dismissal with the chosen option', async () => {
    const user = userEvent.setup();
    const handlers = renderModal({ open: true });

    await user.click(screen.getByText('Build your first insight'));

    expect(trackEvent).toHaveBeenCalledWith('trial_onboarding:tour_intent_modal_dismissed', {
      choice: 'insight',
      variant: 'first_time',
    });
    expect(handlers.onOpenChange).toHaveBeenCalledWith(false);
  });
});
