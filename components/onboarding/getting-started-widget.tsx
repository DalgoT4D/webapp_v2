'use client';

/**
 * "Welcome to Dalgo" getting-started panel — floating card, bottom-right of every page.
 * The "Get Started" pill is always rendered; the full panel additionally shows above it
 * unless minimized.
 *
 * The panel starts minimized and opens ONLY when its owner says something has earned that
 * (`openSignal` — see the prop). It used to open on every arrival at /impact, which meant
 * leaving anything at all — skipping a walkthrough, closing a dialog, walking back to the
 * landing page — put it on screen unasked (DALGO-1763). Navigating collapses it again, a
 * running walkthrough keeps it collapsed, and the pill is always there to open it by hand.
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, ChevronRight, Circle, Compass, Minus, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import {
  BOOK_A_CALL_URL,
  DALGO_DOCS_URL,
  PRODUCT_VIDEO_POSTER_SRC,
  PRODUCT_VIDEO_SRC,
} from '@/constants/trial';
import { ProductVideoPlayer } from './product-video-player';

/** Kept in sync with .checklist-item-complete's animation duration in globals.css. */
const COMPLETION_ANIMATION_MS = 1400;

interface GettingStartedWidgetProps {
  /** A guided walkthrough is mid-flow — keep the panel out of the way until it finishes. */
  walkthroughActive: boolean;
  /**
   * Bumped by the owner (see tour-gate) whenever something has EARNED an auto-open: the
   * landing-page intent modal was dismissed without picking a journey, a checklist item was
   * ticked off, or the product tour was finished with no journey chooser left to offer. Any
   * change to this value opens the panel once, wherever the user happens to be.
   *
   * The ONLY auto-open input, deliberately — every other rule the panel used to open on was
   * a side effect of where the user was standing rather than of anything they had done.
   */
  openSignal?: number;
  /**
   * The product tour is running: render nothing at all, so neither the panel nor the pill
   * floats over the spotlighted content. Hidden rather than unmounted by the owner so the
   * panel's open/closed state survives the tour.
   */
  suppressed?: boolean;
  hasBuiltFirstInsight: boolean;
  hasAutomatedPipeline: boolean;
  onStartTour: () => void;
  /**
   * What a row does is a decision about walkthrough state (start fresh, resume, or offer the
   * fork), so it lives with the owner of that state — tour-gate.tsx — not here.
   */
  onBuildInsightClick: () => void;
  onAutomatePipelineClick: () => void;
}

interface ChecklistItem {
  key: 'build-insight' | 'automate-pipeline';
  label: string;
  description: string;
  checked: boolean;
  onClick: () => void;
}

export function GettingStartedWidget({
  walkthroughActive,
  openSignal = 0,
  suppressed = false,
  hasBuiltFirstInsight,
  hasAutomatedPipeline,
  onStartTour,
  onBuildInsightClick,
  onAutomatePipelineClick,
}: GettingStartedWidgetProps) {
  // Starts true (collapsed) so the full panel never flashes open before the effect below
  // settles it.
  const [minimized, setMinimized] = useState(true);
  const [videoSession, setVideoSession] = useState(0);

  // Last values acted on. Refs rather than a dep-diff because the effect below has to tell
  // "this render is a fresh auto-open" from "this render is any other change".
  //
  // Seeded with 0 rather than the incoming signal, so an open earned just before a remount
  // still lands. The owner only ever counts up from 0, so a nonzero value on the first render
  // means exactly that.
  const lastOpenRef = useRef(0);

  useEffect(() => {
    // An auto-open earned just now outranks the rule below — showing the panel IS the point of
    // the bump. Checked first, and returns, so a walkthrough ending in the same beat
    // (`walkthroughActive` flipping false, which a completion always does) can't collapse it
    // straight back.
    if (openSignal !== lastOpenRef.current) {
      lastOpenRef.current = openSignal;
      setMinimized(false);
      setVideoSession((session) => session + 1);
      return;
    }
    // A running flow owns the screen; the pill stays available to reopen the panel by hand.
    //
    // Deliberately NOT also collapsing on navigation: the pipeline walkthrough finishes by
    // pushing /orchestrate (pipeline-form.tsx), so a route-derived collapse would swallow the
    // completion reveal a tick after it opened.
    if (walkthroughActive) {
      setMinimized(true);
      setVideoSession((session) => session + 1);
    }
  }, [openSignal, walkthroughActive]);

  /**
   * The task whose tick appeared just now, animated for one beat (see .checklist-item-complete
   * in globals.css). Derived here rather than passed in: the owner already hands down the two
   * booleans, and a flip from false to true while mounted IS the completion — a cold load
   * starts with them settled, so nothing animates on arrival.
   */
  const [justCompletedKey, setJustCompletedKey] = useState<ChecklistItem['key'] | null>(null);
  const previousChecksRef = useRef({ hasBuiltFirstInsight, hasAutomatedPipeline });
  useEffect(() => {
    const previous = previousChecksRef.current;
    previousChecksRef.current = { hasBuiltFirstInsight, hasAutomatedPipeline };
    const flipped: ChecklistItem['key'] | null =
      hasBuiltFirstInsight && !previous.hasBuiltFirstInsight
        ? 'build-insight'
        : hasAutomatedPipeline && !previous.hasAutomatedPipeline
          ? 'automate-pipeline'
          : null;
    if (!flipped) return undefined;
    setJustCompletedKey(flipped);
    const timer = setTimeout(() => setJustCompletedKey(null), COMPLETION_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [hasBuiltFirstInsight, hasAutomatedPipeline]);

  // After every hook, never before: the panel's open/closed state has to survive the tour so
  // it comes back exactly as the user left it.
  if (suppressed) return null;

  const minimizeWidget = () => {
    // An explicit user close wins over an auto-open arriving in the same render. Otherwise
    // the effect above can immediately reopen a panel the user just toggled off.
    lastOpenRef.current = openSignal;
    setMinimized(true);
    setVideoSession((session) => session + 1);
  };

  const toggleWidget = () => {
    if (minimized) {
      setMinimized(false);
      return;
    }
    minimizeWidget();
  };

  const handlePlayVideo = () => {
    trackEvent(ANALYTICS_EVENTS.GETTING_STARTED_VIDEO_PLAYED);
  };

  const handleStartTour = () => {
    trackEvent(ANALYTICS_EVENTS.GETTING_STARTED_TOUR_LINK_CLICKED);
    minimizeWidget();
    onStartTour();
  };

  const items: ChecklistItem[] = [
    {
      key: 'build-insight',
      label: 'Build your first insight',
      description: 'Build out your first dashboard and share it',
      checked: hasBuiltFirstInsight,
      onClick: onBuildInsightClick,
    },
    {
      key: 'automate-pipeline',
      label: 'Setup an automated data pipeline',
      description: 'Setup your data to be updated, cleaned and computed regularly',
      checked: hasAutomatedPipeline,
      onClick: onAutomatePipelineClick,
    },
  ];

  // Three header states, one Figma frame each: nothing started ("Welcome to Dalgo"), part-way
  // through (2952:7297), and both flows done (2736:13796) — which also swaps the tour link
  // below for a documentation one, since a finished user has nothing left to be toured through.
  const allComplete = items.every((item) => item.checked);
  const anyComplete = items.some((item) => item.checked);
  const heading = allComplete
    ? {
        title: 'Congratulations — You’re all set',
        subtitle: 'Discover additional features in Dalgo to enhance your workflow.',
      }
    : {
        title: anyComplete ? 'Welcome back. Pick up where you left off?' : 'Welcome to Dalgo',
        subtitle: 'Turn your programme data into insights and reports you can share',
      };

  return (
    <>
      {/* Always visible, in both states — toggles the panel open and closed. Panel
          (below) sits just above it with a gap when expanded. */}
      <button
        type="button"
        data-testid="getting-started-widget-pill"
        aria-expanded={!minimized}
        aria-controls="getting-started-widget-panel"
        onClick={toggleWidget}
        className="fixed right-6 bottom-6 z-40 flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-white shadow-xl hover:opacity-90"
      >
        <Rocket className="h-4 w-4" />
        <span className="text-sm font-semibold">Get Started</span>
      </button>

      {!minimized && (
        <div
          id="getting-started-widget-panel"
          data-testid="getting-started-widget"
          className={cn(
            'fixed right-6 bottom-24 z-40 rounded-2xl border bg-card p-6 shadow-xl',
            // 499x629 per the Figma frame. `h`, rather than `min-h`, lets the dynamic viewport
            // cap win on short screens; min-height used to override max-height and push the
            // header/minimize control above the viewport. The whole card then scrolls internally.
            'h-[629px] w-[499px] max-h-[calc(100dvh-8rem)] max-w-[calc(100vw-3rem)] overflow-y-auto overscroll-contain'
          )}
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p
                className="text-xl font-bold text-foreground sm:whitespace-nowrap"
                data-testid="getting-started-widget-title"
              >
                {heading.title}
              </p>
              <p
                className="mt-1 text-sm text-muted-foreground sm:whitespace-nowrap"
                data-testid="getting-started-widget-subtitle"
              >
                {heading.subtitle}
              </p>
            </div>
            <button
              type="button"
              aria-label="Minimize"
              data-testid="getting-started-widget-minimize"
              onClick={minimizeWidget}
              className="ml-4 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Minus className="h-5 w-5" />
            </button>
          </div>

          <div
            data-testid="getting-started-widget-video"
            className="mt-4 aspect-video overflow-hidden rounded-xl bg-primary/10"
          >
            {/* Remounted on `videoSession` so minimizing (or a checklist reveal) drops the
                player and returns to the poster, rather than leaving audio playing
                behind a collapsed pill. */}
            <ProductVideoPlayer
              key={videoSession}
              videoSrc={PRODUCT_VIDEO_SRC}
              posterSrc={PRODUCT_VIDEO_POSTER_SRC}
              title="Dalgo product overview video"
              testIdPrefix="getting-started-widget-video"
              onFirstPlay={handlePlayVideo}
              playButtonSize="compact"
            />
          </div>

          {/* Figma 2863:2415 adds the docs link once both flows are done. It ADDS to the tour
              link rather than replacing it: the tour is the one way back to a guided run of the
              product, and a user who finished both flows is still allowed to take it. */}
          {allComplete && (
            <p className="mt-4 text-sm text-muted-foreground">
              Need help &amp; guides?{' '}
              <a
                href={DALGO_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="getting-started-widget-docs-link"
                onClick={() => trackEvent(ANALYTICS_EVENTS.GETTING_STARTED_DOCS_LINK_CLICKED)}
                className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
              >
                Read documentation
                <ArrowUpRight className="h-4 w-4 shrink-0" />
              </a>
            </p>
          )}

          <ul className="mt-4 divide-y">
            <li>
              <button
                type="button"
                data-testid="getting-started-widget-tour-link"
                onClick={handleStartTour}
                className="-mx-2 flex w-full items-start gap-3 rounded-md px-2 py-3 text-left hover:bg-muted/50"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                >
                  <Compass className="h-4 w-4" />
                </span>
                <span className="flex-1">
                  <span className="block text-base font-semibold text-foreground">
                    Take a 2 min product tour
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    Explore Dalgo’s key features and navigation
                  </span>
                </span>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
            {items.map((item) => {
              const testId = `getting-started-widget-item-${item.key}`;
              const justCompleted = justCompletedKey === item.key;
              const rowClass = cn(
                'flex w-full items-start gap-3 py-3 text-left rounded-md px-2 -mx-2',
                justCompleted && 'checklist-item-complete'
              );
              const body = (
                <>
                  {item.checked ? (
                    <span
                      aria-hidden="true"
                      data-testid="getting-started-widget-complete-icon"
                      className={cn(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground',
                        // Pops in only on the transition, so a tick that was already there when
                        // the panel opened doesn't re-animate on every render.
                        justCompleted && 'animate-in zoom-in-50 duration-500'
                      )}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </span>
                  ) : (
                    <Circle className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <span className="flex-1">
                    <span className="text-foreground block text-base font-semibold">
                      {item.label}
                    </span>
                    <span className="text-muted-foreground block text-sm">{item.description}</span>
                  </span>
                  {/* Done items are a status row, not a link — no affordance to click. */}
                  {!item.checked && (
                    <ChevronRight className="text-muted-foreground mt-1 h-4 w-4 shrink-0" />
                  )}
                </>
              );

              return (
                <li key={item.key}>
                  {item.checked ? (
                    <div data-testid={testId} className={rowClass}>
                      {body}
                    </div>
                  ) : (
                    <button
                      type="button"
                      data-testid={testId}
                      className={rowClass}
                      onClick={() => {
                        trackEvent(ANALYTICS_EVENTS.GETTING_STARTED_ITEM_CLICKED, {
                          item: item.key,
                        });
                        // Get out of the way of whatever this starts (a dialog, a coachmark on
                        // the page behind). Can't be left to the walkthroughActive effect: when
                        // a flow is already running, that value never changes on this click.
                        minimizeWidget();
                        item.onClick();
                      }}
                    >
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Figma 3053:7971 — sits below the task cards. */}
          <a
            href={BOOK_A_CALL_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="getting-started-widget-schedule-call"
            onClick={() => trackEvent(ANALYTICS_EVENTS.BOOK_A_CALL_CLICKED, { source: 'widget' })}
            className="text-primary mt-4 flex items-center gap-1 opacity-80 hover:underline hover:opacity-100"
          >
            <span className="text-xs font-semibold">Schedule a call with us</span>
            <ArrowUpRight className="h-3 w-3 shrink-0" />
          </a>
        </div>
      )}
    </>
  );
}
