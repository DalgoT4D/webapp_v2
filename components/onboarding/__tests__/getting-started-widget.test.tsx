import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GettingStartedWidget } from '../getting-started-widget';

const trackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

describe('GettingStartedWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

    // The Figma panel size, with the small-viewport caps that keep it on screen.
    expect(screen.getByTestId('getting-started-widget')).toHaveClass(
      'w-[499px]',
      'min-h-[629px]',
      'max-w-[calc(100vw-3rem)]',
      'max-h-[calc(100vh-8rem)]'
    );
    expect(screen.getByTestId('getting-started-widget-title')).toHaveClass('sm:whitespace-nowrap');
    expect(screen.getByTestId('getting-started-widget-subtitle')).toHaveClass(
      'sm:whitespace-nowrap'
    );
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

  it('opens off the auto-open page when an item is ticked off, so the user sees it happen', () => {
    // Both flows END somewhere that isn't /impact — a saved dashboard, the pipeline list — so
    // defaultOpen is false there. Without this the item ticked behind a collapsed pill and the
    // completion looked like nothing had happened.
    const props = {
      defaultOpen: false,
      hasBuiltFirstInsight: false,
      hasAutomatedPipeline: false,
      onStartTour: jest.fn(),
      onBuildInsightClick: jest.fn(),
      onAutomatePipelineClick: jest.fn(),
    };
    const { rerender } = render(
      <GettingStartedWidget {...props} walkthroughActive revealSignal={0} />
    );
    expect(screen.queryByTestId('getting-started-widget')).not.toBeInTheDocument();

    // The flow ends: it goes inactive and the backend records the completion in the same beat.
    rerender(
      <GettingStartedWidget
        {...props}
        hasBuiltFirstInsight
        walkthroughActive={false}
        revealSignal={1}
      />
    );

    const panel = screen.getByTestId('getting-started-widget');
    expect(within(panel).getAllByTestId('getting-started-widget-complete-icon')).toHaveLength(1);
  });

  it('animates the row whose tick just appeared, and only that one', () => {
    const props = {
      defaultOpen: true,
      hasAutomatedPipeline: false,
      onStartTour: jest.fn(),
      onBuildInsightClick: jest.fn(),
      onAutomatePipelineClick: jest.fn(),
      walkthroughActive: false,
    };
    const { rerender } = render(
      <GettingStartedWidget {...props} hasBuiltFirstInsight={false} revealSignal={0} />
    );
    rerender(<GettingStartedWidget {...props} hasBuiltFirstInsight revealSignal={1} />);

    expect(screen.getByTestId('getting-started-widget-item-build-insight')).toHaveClass(
      'checklist-item-complete'
    );
    expect(screen.getByTestId('getting-started-widget-item-automate-pipeline')).not.toHaveClass(
      'checklist-item-complete'
    );
  });

  it('does not animate a tick that was already there when the panel mounted', () => {
    // A cold load starts with the flags settled — replaying the celebration on every arrival
    // would read as the task completing again.
    render(
      <GettingStartedWidget
        defaultOpen
        walkthroughActive={false}
        hasBuiltFirstInsight
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
        onBuildInsightClick={jest.fn()}
        onAutomatePipelineClick={jest.fn()}
      />
    );

    expect(screen.getByTestId('getting-started-widget-item-build-insight')).not.toHaveClass(
      'checklist-item-complete'
    );
  });

  it('a reveal does not pin the panel open — the next page still collapses it', () => {
    const props = {
      defaultOpen: false,
      hasBuiltFirstInsight: true,
      hasAutomatedPipeline: false,
      onStartTour: jest.fn(),
      onBuildInsightClick: jest.fn(),
      onAutomatePipelineClick: jest.fn(),
      walkthroughActive: false,
    };
    const { rerender } = render(<GettingStartedWidget {...props} revealSignal={0} />);
    rerender(<GettingStartedWidget {...props} revealSignal={1} />);
    expect(screen.getByTestId('getting-started-widget')).toBeInTheDocument();

    // Same signal from here on — the route-derived rule is back in charge.
    rerender(<GettingStartedWidget {...props} revealSignal={1} walkthroughActive />);
    expect(screen.queryByTestId('getting-started-widget')).not.toBeInTheDocument();
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

  it('shows exactly the two checklist items in order, plus a click-to-play video', () => {
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

    expect(screen.getByTestId('getting-started-widget-video')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Play Dalgo product overview video' })
    ).toBeInTheDocument();
    // Nothing from YouTube is loaded until the user asks for it.
    expect(screen.queryByTestId('getting-started-widget-video-iframe')).not.toBeInTheDocument();
    const items = screen.getAllByTestId(/getting-started-widget-item-/);
    expect(items.map((el) => el.getAttribute('data-testid'))).toEqual([
      'getting-started-widget-item-build-insight',
      'getting-started-widget-item-automate-pipeline',
    ]);
  });

  it('mounts the YouTube embed only once the user clicks play, and reports it once', async () => {
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

    await user.click(screen.getByTestId('getting-started-widget-video-play'));

    // The privacy-preserving host and autoplay-on-click are the behaviour, not incidental:
    // the embed is what the user asked for, so it should start without a second click.
    expect(screen.getByTestId('getting-started-widget-video-iframe')).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/R-JJNgp8xYM?autoplay=1&rel=0'
    );
    expect(trackEvent).toHaveBeenCalledWith('onboarding:getting_started_video_played');
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('stops the video when the widget is minimized and requires another click after reopening', async () => {
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

    await user.click(screen.getByTestId('getting-started-widget-video-play'));
    expect(screen.getByTestId('getting-started-widget-video-iframe')).toBeInTheDocument();

    await user.click(screen.getByTestId('getting-started-widget-minimize'));
    await user.click(screen.getByTestId('getting-started-widget-pill'));

    // The iframe is torn down rather than hidden — otherwise its audio would keep playing
    // behind the collapsed pill.
    expect(screen.queryByTestId('getting-started-widget-video-iframe')).not.toBeInTheDocument();
    expect(screen.getByTestId('getting-started-widget-video-play')).toBeInTheDocument();
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

  it('keeps the tour link available once both flows are complete, alongside the docs link', () => {
    render(
      <GettingStartedWidget
        defaultOpen
        walkthroughActive={false}
        hasBuiltFirstInsight
        hasAutomatedPipeline
        onStartTour={jest.fn()}
        onBuildInsightClick={jest.fn()}
        onAutomatePipelineClick={jest.fn()}
      />
    );

    expect(screen.getByTestId('getting-started-widget-docs-link')).toBeInTheDocument();
    expect(screen.getByTestId('getting-started-widget-tour-link')).toBeInTheDocument();
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
    const completedIcon = within(item).getByTestId('getting-started-widget-complete-icon');
    expect(completedIcon).toHaveClass('bg-primary', 'text-primary-foreground');
    expect(completedIcon.querySelector('svg')).toBeInTheDocument();
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
    expect(within(item).getByTestId('getting-started-widget-complete-icon')).toHaveClass(
      'bg-primary',
      'text-primary-foreground'
    );
  });
});
