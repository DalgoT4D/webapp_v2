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
    localStorage.clear();
  });

  it('opens the panel when defaultOpen is set (the /impact case), pill always present too', () => {
    render(
      <GettingStartedWidget
        defaultOpen
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
        onBuildInsightClick={jest.fn()}
        onAutomatePipelineClick={jest.fn()}
      />
    );

    expect(screen.getByTestId('getting-started-widget')).toBeInTheDocument();
    expect(screen.getByTestId('getting-started-widget-pill')).toBeInTheDocument();
  });

  it('stays collapsed to just the pill when defaultOpen is false (any page but /impact)', () => {
    render(
      <GettingStartedWidget
        defaultOpen={false}
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
        onBuildInsightClick={jest.fn()}
        onAutomatePipelineClick={jest.fn()}
      />
    );

    expect(screen.getByTestId('getting-started-widget-pill')).toBeInTheDocument();
    expect(screen.queryByTestId('getting-started-widget')).not.toBeInTheDocument();
  });

  it('stays minimized for the duration of a walkthrough, even on the auto-open page', () => {
    render(
      <GettingStartedWidget
        defaultOpen
        walkthroughActive
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
        onBuildInsightClick={jest.fn()}
        onAutomatePipelineClick={jest.fn()}
      />
    );

    expect(screen.getByTestId('getting-started-widget-pill')).toBeInTheDocument();
    expect(screen.queryByTestId('getting-started-widget')).not.toBeInTheDocument();
  });

  it('collapses an open panel the moment a walkthrough starts, and restores it when it ends', () => {
    const props = {
      defaultOpen: true,
      hasBuiltFirstInsight: false,
      hasAutomatedPipeline: false,
      onStartTour: jest.fn(),
      onBuildInsightClick: jest.fn(),
      onAutomatePipelineClick: jest.fn(),
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
        defaultOpen
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
        onBuildInsightClick={jest.fn()}
        onAutomatePipelineClick={jest.fn()}
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
        defaultOpen
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
        onBuildInsightClick={jest.fn()}
        onAutomatePipelineClick={jest.fn()}
      />
    );
    await user.click(screen.getByTestId('getting-started-widget-minimize'));

    await user.click(screen.getByTestId('getting-started-widget-pill'));

    expect(screen.getByTestId('getting-started-widget')).toBeInTheDocument();
  });

  it('re-opens on returning to the auto-open page, discarding the last visit’s minimize', async () => {
    const user = userEvent.setup();
    const props = {
      defaultOpen: true,
      walkthroughActive: false,
      hasBuiltFirstInsight: false,
      hasAutomatedPipeline: false,
      onStartTour: jest.fn(),
      onBuildInsightClick: jest.fn(),
      onAutomatePipelineClick: jest.fn(),
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
});

describe('GettingStartedWidget checklist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('shows exactly the two checklist items, in order, plus the video placeholder', () => {
    render(
      <GettingStartedWidget
        defaultOpen
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
        onBuildInsightClick={jest.fn()}
        onAutomatePipelineClick={jest.fn()}
      />
    );

    expect(screen.getByTestId('getting-started-widget-video-placeholder')).toBeInTheDocument();
    const items = screen.getAllByTestId(/getting-started-widget-item-/);
    expect(items.map((el) => el.getAttribute('data-testid'))).toEqual([
      'getting-started-widget-item-build-insight',
      'getting-started-widget-item-automate-pipeline',
    ]);
  });

  it('each unchecked row is a button that reports the click to its owner', async () => {
    const user = userEvent.setup();
    const onBuildInsightClick = jest.fn();
    const onAutomatePipelineClick = jest.fn();
    render(
      <GettingStartedWidget
        defaultOpen
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
        onBuildInsightClick={onBuildInsightClick}
        onAutomatePipelineClick={onAutomatePipelineClick}
      />
    );

    // Not links: what a row does depends on walkthrough state, which TourGate owns.
    const buildInsight = screen.getByTestId('getting-started-widget-item-build-insight');
    expect(buildInsight).not.toHaveAttribute('href');
    await user.click(buildInsight);
    // Each click closes the panel (see the test below), so reopen before the second row.
    await user.click(screen.getByTestId('getting-started-widget-pill'));
    await user.click(screen.getByTestId('getting-started-widget-item-automate-pipeline'));

    expect(onBuildInsightClick).toHaveBeenCalledTimes(1);
    expect(onAutomatePipelineClick).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('onboarding:getting_started_item_clicked', {
      item: 'build-insight',
    });
    expect(trackEvent).toHaveBeenCalledWith('onboarding:getting_started_item_clicked', {
      item: 'automate-pipeline',
    });
  });

  it('closes the panel when a row is clicked, so it does not sit over the flow it starts', async () => {
    const user = userEvent.setup();
    render(
      <GettingStartedWidget
        defaultOpen
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
        onBuildInsightClick={jest.fn()}
        onAutomatePipelineClick={jest.fn()}
      />
    );

    await user.click(screen.getByTestId('getting-started-widget-item-build-insight'));

    expect(screen.queryByTestId('getting-started-widget')).not.toBeInTheDocument();
    expect(screen.getByTestId('getting-started-widget-pill')).toBeInTheDocument();
  });

  it('calls onStartTour and tracks analytics when the "take a 2 min tour" link is clicked', async () => {
    const user = userEvent.setup();
    const onStartTour = jest.fn();
    render(
      <GettingStartedWidget
        defaultOpen
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={onStartTour}
        onBuildInsightClick={jest.fn()}
        onAutomatePipelineClick={jest.fn()}
      />
    );

    await user.click(screen.getByTestId('getting-started-widget-tour-link'));

    expect(onStartTour).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('onboarding:getting_started_tour_link_clicked');
  });

  it('shows "Build your first insight" as checked when hasBuiltFirstInsight is true', () => {
    render(
      <GettingStartedWidget
        defaultOpen
        walkthroughActive={false}
        hasBuiltFirstInsight={true}
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
        onBuildInsightClick={jest.fn()}
        onAutomatePipelineClick={jest.fn()}
      />
    );

    const item = screen.getByTestId('getting-started-widget-item-build-insight');
    expect(item.querySelector('svg')).toHaveClass('text-primary'); // CheckCircle2, not the muted Circle
    // Done rows are status, not affordances — neither a link nor a button.
    expect(item.tagName).toBe('DIV');
    expect(item).not.toHaveAttribute('href');
  });

  it('shows "Setup an automated data pipeline" as checked when hasAutomatedPipeline is true', () => {
    render(
      <GettingStartedWidget
        defaultOpen
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={true}
        onStartTour={jest.fn()}
        onBuildInsightClick={jest.fn()}
        onAutomatePipelineClick={jest.fn()}
      />
    );

    const item = screen.getByTestId('getting-started-widget-item-automate-pipeline');
    expect(item.querySelector('svg')).toHaveClass('text-primary');
  });
});
