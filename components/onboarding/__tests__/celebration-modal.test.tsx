import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CelebrationModal } from '../celebration-modal';

const trackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

function renderModal(onCta?: jest.Mock) {
  const handlers = { onOpenChange: jest.fn() };
  render(
    <CelebrationModal
      open
      {...handlers}
      onCta={onCta}
      title="Congratulation, your KPI is live!"
      description="Your insights are built and now you can add it to a dashboard"
      ctaLabel="Add to Dashboard"
      dismissEvent={'onboarding:kpi_live_modal_dismissed' as never}
      testId="kpi-live-modal"
    />
  );
  return handlers;
}

describe('CelebrationModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('celebrates the new KPI and offers the dashboard hand-off', () => {
    renderModal();

    expect(screen.getByText('Congratulation, your KPI is live!')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-live-modal-cta')).toBeInTheDocument();
  });

  it("the CTA closes it and runs the caller's action", async () => {
    const user = userEvent.setup();
    const onCta = jest.fn();
    const handlers = renderModal(onCta);

    await user.click(screen.getByTestId('kpi-live-modal-cta'));

    expect(handlers.onOpenChange).toHaveBeenCalledWith(false);
    expect(onCta).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('onboarding:kpi_live_modal_dismissed', {
      choice: 'cta',
    });
  });

  it('closing with no onCta is a valid, complete action on its own', async () => {
    const user = userEvent.setup();
    const handlers = renderModal();

    await user.click(screen.getByTestId('kpi-live-modal-cta'));

    expect(handlers.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('the X closes it the same way, and is tracked separately', async () => {
    const user = userEvent.setup();
    const handlers = renderModal();

    await user.click(screen.getByTestId('kpi-live-modal-close'));

    expect(handlers.onOpenChange).toHaveBeenCalledWith(false);
    expect(trackEvent).toHaveBeenCalledWith('onboarding:kpi_live_modal_dismissed', {
      choice: 'close',
    });
  });
});
