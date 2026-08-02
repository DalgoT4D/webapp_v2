import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GettingStartedWidget } from '../getting-started-widget';

const trackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

describe('GettingStartedWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the pre-tour checklist: sample data checked, tour item present, no "connect your own data"', () => {
    render(
      <GettingStartedWidget
        hasSeenTour={false}
        hasBuiltFirstInsight={false}
        hasConnectedOwnData={false}
        onStartTour={jest.fn()}
      />
    );

    expect(screen.getByTestId('getting-started-widget-item-sample-data')).toBeInTheDocument();
    expect(screen.getByTestId('getting-started-widget-item-take-tour')).toBeInTheDocument();
    expect(screen.getByTestId('getting-started-widget-item-build-insight')).toBeInTheDocument();
    expect(
      screen.queryByTestId('getting-started-widget-item-connect-data')
    ).not.toBeInTheDocument();
  });

  it('shows the post-tour checklist: "take a quick tour" replaced by "connect your own data"', () => {
    render(
      <GettingStartedWidget
        hasSeenTour={true}
        hasBuiltFirstInsight={false}
        hasConnectedOwnData={false}
        onStartTour={jest.fn()}
      />
    );

    expect(screen.getByTestId('getting-started-widget-item-sample-data')).toBeInTheDocument();
    expect(screen.getByTestId('getting-started-widget-item-build-insight')).toBeInTheDocument();
    expect(screen.getByTestId('getting-started-widget-item-connect-data')).toBeInTheDocument();
    expect(screen.queryByTestId('getting-started-widget-item-take-tour')).not.toBeInTheDocument();
  });

  it('the "connect your own data" item links to /ingest, "build your first insight" links to /charts', () => {
    render(
      <GettingStartedWidget
        hasSeenTour={true}
        hasBuiltFirstInsight={false}
        hasConnectedOwnData={false}
        onStartTour={jest.fn()}
      />
    );

    expect(screen.getByTestId('getting-started-widget-item-connect-data')).toHaveAttribute(
      'href',
      '/ingest'
    );
    expect(screen.getByTestId('getting-started-widget-item-build-insight')).toHaveAttribute(
      'href',
      '/charts'
    );
  });

  it('calls onStartTour and tracks analytics when the top "take a 2 min tour" link is clicked', async () => {
    const user = userEvent.setup();
    const onStartTour = jest.fn();
    render(
      <GettingStartedWidget
        hasSeenTour={false}
        hasBuiltFirstInsight={false}
        hasConnectedOwnData={false}
        onStartTour={onStartTour}
      />
    );

    await user.click(screen.getByTestId('getting-started-widget-tour-link'));

    expect(onStartTour).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('onboarding:getting_started_tour_link_clicked');
  });

  it('calls onStartTour when the "Take a quick tour" checklist item is clicked', async () => {
    const user = userEvent.setup();
    const onStartTour = jest.fn();
    render(
      <GettingStartedWidget
        hasSeenTour={false}
        hasBuiltFirstInsight={false}
        hasConnectedOwnData={false}
        onStartTour={onStartTour}
      />
    );

    await user.click(screen.getByTestId('getting-started-widget-item-take-tour'));

    expect(onStartTour).toHaveBeenCalledTimes(1);
  });

  it('shows "Build your first insight" as checked when hasBuiltFirstInsight is true', () => {
    render(
      <GettingStartedWidget
        hasSeenTour={true}
        hasBuiltFirstInsight={true}
        hasConnectedOwnData={false}
        onStartTour={jest.fn()}
      />
    );
    const item = screen.getByTestId('getting-started-widget-item-build-insight');
    expect(item.querySelector('svg')).toHaveClass('text-primary'); // CheckCircle2, not the muted Circle
  });

  it('shows "Connect your own data" as checked when hasConnectedOwnData is true', () => {
    render(
      <GettingStartedWidget
        hasSeenTour={true}
        hasBuiltFirstInsight={false}
        hasConnectedOwnData={true}
        onStartTour={jest.fn()}
      />
    );
    const item = screen.getByTestId('getting-started-widget-item-connect-data');
    expect(item.querySelector('svg')).toHaveClass('text-primary'); // CheckCircle2, not the muted Circle
  });

  it('hides the widget entirely when dismissed', async () => {
    const user = userEvent.setup();
    render(
      <GettingStartedWidget
        hasSeenTour={false}
        hasBuiltFirstInsight={false}
        hasConnectedOwnData={false}
        onStartTour={jest.fn()}
      />
    );

    await user.click(screen.getByTestId('getting-started-widget-dismiss'));

    expect(screen.queryByTestId('getting-started-widget')).not.toBeInTheDocument();
  });
});
