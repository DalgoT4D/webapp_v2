import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GettingStartedWidget } from '../getting-started-widget';
import {
  savePath,
  markConnectedRealData,
  markChartCreated,
  markTransformPublished,
  markPipelineCreated,
} from '../insight-walkthrough-constants';

const trackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

const ORG_SLUG = 'test-org';

describe('GettingStartedWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('opens the panel when defaultOpen is set (the /impact case), pill always present too', () => {
    render(
      <GettingStartedWidget
        orgSlug={ORG_SLUG}
        defaultOpen
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
      />
    );

    expect(screen.getByTestId('getting-started-widget')).toBeInTheDocument();
    expect(screen.getByTestId('getting-started-widget-pill')).toBeInTheDocument();
  });

  it('stays collapsed to just the pill when defaultOpen is false (any page but /impact)', () => {
    render(
      <GettingStartedWidget
        orgSlug={ORG_SLUG}
        defaultOpen={false}
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
      />
    );

    expect(screen.getByTestId('getting-started-widget-pill')).toBeInTheDocument();
    expect(screen.queryByTestId('getting-started-widget')).not.toBeInTheDocument();
  });

  it('stays minimized for the duration of a walkthrough, even on the auto-open page', () => {
    render(
      <GettingStartedWidget
        orgSlug={ORG_SLUG}
        defaultOpen
        walkthroughActive
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
      />
    );

    expect(screen.getByTestId('getting-started-widget-pill')).toBeInTheDocument();
    expect(screen.queryByTestId('getting-started-widget')).not.toBeInTheDocument();
  });

  it('collapses an open panel the moment a walkthrough starts, and restores it when it ends', () => {
    const props = {
      orgSlug: ORG_SLUG,
      defaultOpen: true,
      hasBuiltFirstInsight: false,
      hasAutomatedPipeline: false,
      onStartTour: jest.fn(),
    };
    const { rerender } = render(<GettingStartedWidget {...props} walkthroughActive={false} />);
    expect(screen.getByTestId('getting-started-widget')).toBeInTheDocument();

    rerender(<GettingStartedWidget {...props} walkthroughActive />);
    expect(screen.queryByTestId('getting-started-widget')).not.toBeInTheDocument();

    rerender(<GettingStartedWidget {...props} walkthroughActive={false} />);
    expect(screen.getByTestId('getting-started-widget')).toBeInTheDocument();
  });

  it('minimizing hides the panel but keeps the pill visible', async () => {
    const user = userEvent.setup();
    render(
      <GettingStartedWidget
        orgSlug={ORG_SLUG}
        defaultOpen
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
      />
    );

    await user.click(screen.getByTestId('getting-started-widget-minimize'));

    expect(screen.getByTestId('getting-started-widget-pill')).toBeInTheDocument();
    expect(screen.queryByTestId('getting-started-widget')).not.toBeInTheDocument();
  });

  it('clicking the pill re-expands the panel', async () => {
    const user = userEvent.setup();
    render(
      <GettingStartedWidget
        orgSlug={ORG_SLUG}
        defaultOpen
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
      />
    );
    await user.click(screen.getByTestId('getting-started-widget-minimize'));

    await user.click(screen.getByTestId('getting-started-widget-pill'));

    expect(screen.getByTestId('getting-started-widget')).toBeInTheDocument();
  });

  it('re-opens on returning to the auto-open page, discarding the last visit’s minimize', async () => {
    const user = userEvent.setup();
    const props = {
      orgSlug: ORG_SLUG,
      defaultOpen: true,
      walkthroughActive: false,
      hasBuiltFirstInsight: false,
      hasAutomatedPipeline: false,
      onStartTour: jest.fn(),
    };
    const { unmount } = render(<GettingStartedWidget {...props} />);
    await user.click(screen.getByTestId('getting-started-widget-minimize'));
    expect(screen.queryByTestId('getting-started-widget')).not.toBeInTheDocument();
    unmount();

    // Arriving again (remount) re-derives from defaultOpen rather than restoring the
    // previous visit's minimize — minimizing is a within-visit action, not a preference.
    render(<GettingStartedWidget {...props} />);

    expect(screen.getByTestId('getting-started-widget')).toBeInTheDocument();
  });

  it('shows exactly the two checklist items, in order, plus the video placeholder', () => {
    render(
      <GettingStartedWidget
        orgSlug={ORG_SLUG}
        defaultOpen
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
      />
    );

    expect(screen.getByTestId('getting-started-widget-video-placeholder')).toBeInTheDocument();
    const items = screen.getAllByTestId(/getting-started-widget-item-/);
    expect(items.map((el) => el.getAttribute('data-testid'))).toEqual([
      'getting-started-widget-item-build-insight',
      'getting-started-widget-item-automate-pipeline',
    ]);
  });

  it('"Build your first insight" links to /charts, "Setup an automated data pipeline" links to /pipeline', () => {
    render(
      <GettingStartedWidget
        orgSlug={ORG_SLUG}
        defaultOpen
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
      />
    );

    expect(screen.getByTestId('getting-started-widget-item-build-insight')).toHaveAttribute(
      'href',
      '/charts'
    );
    expect(screen.getByTestId('getting-started-widget-item-automate-pipeline')).toHaveAttribute(
      'href',
      '/pipeline'
    );
  });

  it('"Build your first insight" resumes an in-progress own-data flow at its exact next step', async () => {
    savePath(ORG_SLUG, 'own_data');
    markConnectedRealData(ORG_SLUG);
    // Connected but chart not yet created — next step is create_chart (/charts/new).
    render(
      <GettingStartedWidget
        orgSlug={ORG_SLUG}
        defaultOpen
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
      />
    );

    expect(await screen.findByTestId('getting-started-widget-item-build-insight')).toHaveAttribute(
      'href',
      '/charts/new'
    );
  });

  it('"Setup an automated data pipeline" resumes an in-progress pipeline flow, converging into the chart step', async () => {
    savePath(ORG_SLUG, 'automate_pipeline');
    markConnectedRealData(ORG_SLUG);
    markTransformPublished(ORG_SLUG);
    markPipelineCreated(ORG_SLUG);
    markChartCreated(ORG_SLUG);
    // ingest/transform/orchestrate/chart all done, no dashboard checkpoints yet — next is
    // create_dashboard.
    render(
      <GettingStartedWidget
        orgSlug={ORG_SLUG}
        defaultOpen
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
      />
    );

    expect(
      await screen.findByTestId('getting-started-widget-item-automate-pipeline')
    ).toHaveAttribute('href', '/dashboards');
  });

  it('calls onStartTour and tracks analytics when the "take a 2 min tour" link is clicked', async () => {
    const user = userEvent.setup();
    const onStartTour = jest.fn();
    render(
      <GettingStartedWidget
        orgSlug={ORG_SLUG}
        defaultOpen
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={onStartTour}
      />
    );

    await user.click(screen.getByTestId('getting-started-widget-tour-link'));

    expect(onStartTour).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('onboarding:getting_started_tour_link_clicked');
  });

  it('shows "Build your first insight" as checked when hasBuiltFirstInsight is true', () => {
    render(
      <GettingStartedWidget
        orgSlug={ORG_SLUG}
        defaultOpen
        walkthroughActive={false}
        hasBuiltFirstInsight={true}
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
      />
    );

    const item = screen.getByTestId('getting-started-widget-item-build-insight');
    expect(item.querySelector('svg')).toHaveClass('text-primary'); // CheckCircle2, not the muted Circle
  });

  it('shows "Setup an automated data pipeline" as checked when hasAutomatedPipeline is true', () => {
    render(
      <GettingStartedWidget
        orgSlug={ORG_SLUG}
        defaultOpen
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={true}
        onStartTour={jest.fn()}
      />
    );

    const item = screen.getByTestId('getting-started-widget-item-automate-pipeline');
    expect(item.querySelector('svg')).toHaveClass('text-primary');
  });
});
