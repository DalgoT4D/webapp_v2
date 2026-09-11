import { fireEvent, render, screen, within } from '@testing-library/react';
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

  it('opens the panel for an openSignal the owner has already raised, pill always present too', () => {
    render(
      <GettingStartedWidget
        openSignal={1}
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
      'h-[629px]',
      'max-w-[calc(100vw-3rem)]',
      'max-h-[calc(100dvh-8rem)]',
      'overflow-y-auto',
      'overscroll-contain'
    );
    expect(screen.getByTestId('getting-started-widget-title')).toHaveClass('sm:whitespace-nowrap');
    expect(screen.getByTestId('getting-started-widget-subtitle')).toHaveClass(
      'sm:whitespace-nowrap'
    );
    expect(screen.getByTestId('getting-started-widget-pill')).toBeInTheDocument();
  });

  it('stays collapsed to just the pill until something earns an open', () => {
    render(
      <GettingStartedWidget
        openSignal={0}
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

  it('stays minimized for the duration of a walkthrough', () => {
    render(
      <GettingStartedWidget
        openSignal={0}
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

  it('collapses an open panel the moment a walkthrough starts, and leaves it collapsed when it ends', () => {
    // A flow ENDING is not itself a reason to reopen: a skip says "not now", and answering it
    // by popping the panel back up is the churn this whole signal replaced (DALGO-1763). Only
    // an explicit bump from the owner — which a COMPLETION sends — reopens it.
    const props = {
      openSignal: 1,
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
    expect(screen.queryByTestId('getting-started-widget')).not.toBeInTheDocument();
  });

  it('opens on a completion bump wherever the user is, so they see the tick happen', () => {
    // Both flows END somewhere the panel is collapsed — a saved dashboard, the pipeline list.
    // Without this the item ticked behind the pill and the completion looked like nothing
    // happened. The bump also has to beat the walkthrough going inactive in the same beat.
    const props = {
      openSignal: 0,
      hasBuiltFirstInsight: false,
      hasAutomatedPipeline: false,
      onStartTour: jest.fn(),
      onBuildInsightClick: jest.fn(),
      onAutomatePipelineClick: jest.fn(),
    };
    const { rerender } = render(<GettingStartedWidget {...props} walkthroughActive />);
    expect(screen.queryByTestId('getting-started-widget')).not.toBeInTheDocument();

    // The flow ends: it goes inactive and the backend records the completion in the same beat.
    rerender(
      <GettingStartedWidget
        {...props}
        hasBuiltFirstInsight
        walkthroughActive={false}
        openSignal={1}
      />
    );

    const panel = screen.getByTestId('getting-started-widget');
    expect(within(panel).getAllByTestId('getting-started-widget-complete-icon')).toHaveLength(1);
  });

  it('animates the row whose tick just appeared, and only that one', () => {
    const props = {
      openSignal: 1,
      hasAutomatedPipeline: false,
      onStartTour: jest.fn(),
      onBuildInsightClick: jest.fn(),
      onAutomatePipelineClick: jest.fn(),
      walkthroughActive: false,
    };
    const { rerender } = render(<GettingStartedWidget {...props} hasBuiltFirstInsight={false} />);
    rerender(<GettingStartedWidget {...props} hasBuiltFirstInsight openSignal={2} />);

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
        openSignal={1}
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

  it('an auto-open survives the re-renders around it, and only a walkthrough collapses it', () => {
    // The pipeline flow finishes by pushing /orchestrate (pipeline-form.tsx), so the panel has
    // to stay open across whatever re-renders that navigation causes — otherwise the
    // completion reveal is swallowed a tick after it opened.
    const props = {
      openSignal: 0,
      hasBuiltFirstInsight: true,
      hasAutomatedPipeline: false,
      onStartTour: jest.fn(),
      onBuildInsightClick: jest.fn(),
      onAutomatePipelineClick: jest.fn(),
      walkthroughActive: false,
    };
    const { rerender } = render(<GettingStartedWidget {...props} />);
    rerender(<GettingStartedWidget {...props} openSignal={1} />);
    expect(screen.getByTestId('getting-started-widget')).toBeInTheDocument();

    rerender(<GettingStartedWidget {...props} openSignal={1} hasAutomatedPipeline />);
    expect(screen.getByTestId('getting-started-widget')).toBeInTheDocument();

    rerender(<GettingStartedWidget {...props} openSignal={1} walkthroughActive />);
    expect(screen.queryByTestId('getting-started-widget')).not.toBeInTheDocument();
  });

  it('renders nothing at all while suppressed, then comes back as the user left it', () => {
    // The product tour spotlights one region at a time; a floating pill or panel would sit on
    // top of the very thing each step points at.
    const props = {
      openSignal: 1,
      hasBuiltFirstInsight: false,
      hasAutomatedPipeline: false,
      onStartTour: jest.fn(),
      onBuildInsightClick: jest.fn(),
      onAutomatePipelineClick: jest.fn(),
      walkthroughActive: false,
    };
    const { rerender } = render(<GettingStartedWidget {...props} />);
    expect(screen.getByTestId('getting-started-widget')).toBeInTheDocument();

    rerender(<GettingStartedWidget {...props} suppressed />);
    expect(screen.queryByTestId('getting-started-widget')).not.toBeInTheDocument();
    expect(screen.queryByTestId('getting-started-widget-pill')).not.toBeInTheDocument();

    // Hidden, not unmounted — the panel was open before the tour, so it is open after.
    rerender(<GettingStartedWidget {...props} suppressed={false} />);
    expect(screen.getByTestId('getting-started-widget')).toBeInTheDocument();
  });

  it('lets an auto-open through even while a walkthrough is running', () => {
    // The completion bump arrives in the same beat as the flow going inactive; whichever order
    // React settles them in, the panel has to end up open.
    const props = {
      openSignal: 0,
      hasBuiltFirstInsight: false,
      hasAutomatedPipeline: false,
      onStartTour: jest.fn(),
      onBuildInsightClick: jest.fn(),
      onAutomatePipelineClick: jest.fn(),
      walkthroughActive: true,
    };
    const { rerender } = render(<GettingStartedWidget {...props} />);
    rerender(<GettingStartedWidget {...props} openSignal={1} />);

    expect(screen.getByTestId('getting-started-widget')).toBeInTheDocument();
  });

  it('minimizing hides the panel but keeps the pill visible', async () => {
    const user = userEvent.setup();
    render(
      <GettingStartedWidget
        openSignal={1}
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
        openSignal={1}
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

  it('clicking the pill while the panel is open minimizes it', async () => {
    const user = userEvent.setup();
    render(
      <GettingStartedWidget
        openSignal={1}
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
        onBuildInsightClick={jest.fn()}
        onAutomatePipelineClick={jest.fn()}
      />
    );

    const pill = screen.getByTestId('getting-started-widget-pill');
    expect(pill).toHaveAttribute('aria-expanded', 'true');

    await user.click(pill);

    expect(screen.queryByTestId('getting-started-widget')).not.toBeInTheDocument();
    expect(pill).toHaveAttribute('aria-expanded', 'false');
  });

  it('re-opens on a remount while the owner’s open still stands, discarding the last minimize', async () => {
    const user = userEvent.setup();
    const props = {
      openSignal: 1,
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

    // A remount re-reads the owner's signal rather than restoring the previous mount's
    // minimize — minimizing is a within-visit action, not a persisted preference.
    render(<GettingStartedWidget {...props} />);

    expect(screen.getByTestId('getting-started-widget')).toBeInTheDocument();
  });
});

describe('GettingStartedWidget checklist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows exactly the two checklist items in order, plus a click-to-play video', () => {
    render(
      <GettingStartedWidget
        openSignal={1}
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
    expect(screen.getByTestId('getting-started-widget-video-video')).toHaveAttribute(
      'poster',
      '/branding/dalgo-product-overview-poster.jpg'
    );
    expect(screen.getByTestId('getting-started-widget-video-video')).toHaveAttribute('controls');
    expect(screen.getByTestId('getting-started-widget-video-video')).not.toHaveAttribute(
      'autoplay'
    );
    expect(screen.getByTestId('getting-started-widget-video-video')).toHaveProperty('muted', false);
    expect(screen.getByText('Watch video')).toBeInTheDocument();
    const items = screen.getAllByTestId(/getting-started-widget-item-/);
    expect(items.map((el) => el.getAttribute('data-testid'))).toEqual([
      'getting-started-widget-item-build-insight',
      'getting-started-widget-item-automate-pipeline',
    ]);
  });

  it('starts the self-hosted video in one click and reports it once', async () => {
    const user = userEvent.setup();
    render(
      <GettingStartedWidget
        openSignal={1}
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
        onBuildInsightClick={jest.fn()}
        onAutomatePipelineClick={jest.fn()}
      />
    );

    await user.click(screen.getByTestId('getting-started-widget-video-play'));

    expect(screen.getByTestId('getting-started-widget-video-video')).toHaveAttribute(
      'src',
      '/branding/dalgo-product-overview.mp4'
    );
    expect(screen.getByTestId('getting-started-widget-video-video')).toHaveAttribute('controls');
    expect(screen.queryByTestId('getting-started-widget-video-play')).not.toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith('trial_onboarding:getting_started_video_played');
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('shows the explicit play treatment again when the video is paused', async () => {
    const user = userEvent.setup();
    render(
      <GettingStartedWidget
        openSignal={1}
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
        onBuildInsightClick={jest.fn()}
        onAutomatePipelineClick={jest.fn()}
      />
    );

    await user.click(screen.getByTestId('getting-started-widget-video-play'));
    fireEvent.pause(screen.getByTestId('getting-started-widget-video-video'));

    expect(screen.getByTestId('getting-started-widget-video-play')).toBeInTheDocument();
    expect(screen.getByText('Watch video')).toBeInTheDocument();
  });

  it('stops the video when the widget is minimized and requires another click after reopening', async () => {
    const user = userEvent.setup();
    render(
      <GettingStartedWidget
        openSignal={1}
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={jest.fn()}
        onBuildInsightClick={jest.fn()}
        onAutomatePipelineClick={jest.fn()}
      />
    );

    await user.click(screen.getByTestId('getting-started-widget-video-play'));
    expect(screen.getByTestId('getting-started-widget-video-video')).toHaveAttribute('controls');

    await user.click(screen.getByTestId('getting-started-widget-minimize'));
    await user.click(screen.getByTestId('getting-started-widget-pill'));

    // The player is remounted rather than hidden — otherwise its audio would keep playing
    // behind the collapsed pill.
    expect(screen.getByTestId('getting-started-widget-video-video')).toHaveAttribute('controls');
    expect(screen.getByTestId('getting-started-widget-video-play')).toBeInTheDocument();
  });

  it('each unchecked row is a button that reports the click to its owner', async () => {
    const user = userEvent.setup();
    const onBuildInsightClick = jest.fn();
    const onAutomatePipelineClick = jest.fn();
    render(
      <GettingStartedWidget
        openSignal={1}
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
    expect(trackEvent).toHaveBeenCalledWith('trial_onboarding:getting_started_item_clicked', {
      item: 'build-insight',
    });
    expect(trackEvent).toHaveBeenCalledWith('trial_onboarding:getting_started_item_clicked', {
      item: 'automate-pipeline',
    });
  });

  it('closes the panel when a row is clicked, so it does not sit over the flow it starts', async () => {
    const user = userEvent.setup();
    render(
      <GettingStartedWidget
        openSignal={1}
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

  it('presents the product tour as a full checklist row and starts it when clicked', async () => {
    const user = userEvent.setup();
    const onStartTour = jest.fn();
    render(
      <GettingStartedWidget
        openSignal={1}
        walkthroughActive={false}
        hasBuiltFirstInsight={false}
        hasAutomatedPipeline={false}
        onStartTour={onStartTour}
        onBuildInsightClick={jest.fn()}
        onAutomatePipelineClick={jest.fn()}
      />
    );

    const tourRow = screen.getByTestId('getting-started-widget-tour-link');
    expect(tourRow.tagName).toBe('BUTTON');
    expect(within(tourRow).getByText('Take a 2 min product tour')).toBeInTheDocument();
    expect(
      within(tourRow).getByText('Explore Dalgo’s key features and navigation')
    ).toBeInTheDocument();

    await user.click(tourRow);

    expect(onStartTour).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('trial_onboarding:getting_started_tour_link_clicked');
    expect(screen.queryByTestId('getting-started-widget')).not.toBeInTheDocument();
  });

  it('keeps the tour link available once both flows are complete, alongside the docs link', () => {
    render(
      <GettingStartedWidget
        openSignal={1}
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
        openSignal={1}
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
        openSignal={1}
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
