'use client';

/**
 * "Welcome to Dalgo" getting-started panel — floating card, bottom-right of every page.
 * The "Get Started" pill is always rendered; the full panel additionally shows above it
 * unless minimized.
 *
 * Open/closed is derived from where you are, not persisted: arriving on the landing page
 * (`defaultOpen`) always opens it — minimizing is a within-visit action, so coming back
 * re-opens it — and every other page starts minimized. A running walkthrough
 * (`walkthroughActive`) overrides both and keeps it out of the way until the flow ends,
 * though the pill stays available to reopen it manually.
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, ChevronRight, Circle, Minus, Play, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { BOOK_A_CALL_URL, DALGO_DOCS_URL } from '@/constants/trial';

/** Kept in sync with .checklist-item-complete's animation duration in globals.css. */
const COMPLETION_ANIMATION_MS = 1400;

const PRODUCT_VIDEO_ID = 'R-JJNgp8xYM';
const PRODUCT_VIDEO_EMBED_URL = `https://www.youtube-nocookie.com/embed/${PRODUCT_VIDEO_ID}?autoplay=1&rel=0`;
const PRODUCT_VIDEO_THUMBNAIL_URL = `https://i.ytimg.com/vi/${PRODUCT_VIDEO_ID}/hqdefault.jpg`;

interface GettingStartedWidgetProps {
  /**
   * Whether landing here opens the panel. True on /impact (where the checklist is the point)
   * and false elsewhere, where the pill alone is enough and an auto-opening panel would cover
   * the page's own content.
   */
  defaultOpen: boolean;
  /** A guided walkthrough is mid-flow — keep the panel out of the way until it finishes. */
  walkthroughActive: boolean;
  /**
   * Bumped by the owner (see tour-gate) the moment a checklist item is ticked off in this
   * session. Both flows END somewhere that isn't /impact — a saved dashboard, the pipeline
   * list — so `defaultOpen` is false there and the item the user just finished would tick
   * behind a collapsed pill, where nobody sees it. Any change to this value opens the panel
   * once, wherever the user happens to be.
   */
  revealSignal?: number;
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
  defaultOpen,
  walkthroughActive,
  revealSignal = 0,
  hasBuiltFirstInsight,
  hasAutomatedPipeline,
  onStartTour,
  onBuildInsightClick,
  onAutomatePipelineClick,
}: GettingStartedWidgetProps) {
  // Starts true (collapsed) so the full panel never flashes open before the effect below
  // settles it.
  const [minimized, setMinimized] = useState(true);
  const [videoStarted, setVideoStarted] = useState(false);

  // Last `revealSignal` acted on. A ref rather than a dep-diff because the effect below has
  // to tell "this render is a fresh completion" from "this render is any other change".
  const lastRevealRef = useRef(revealSignal);

  useEffect(() => {
    // An item ticked off just now outranks the route-derived rule below — the whole point of
    // the panel opening here is to show that tick. Checked first, and returns, so the
    // walkthrough-just-ended pass (`walkthroughActive` flipping false in the same beat) can't
    // minimize it straight back.
    if (revealSignal !== lastRevealRef.current) {
      lastRevealRef.current = revealSignal;
      setMinimized(false);
      setVideoStarted(false);
      return;
    }
    // Re-derived on arrival (and whenever a walkthrough starts or ends) rather than
    // persisted: returning to /impact re-opens the panel even if it was minimized last
    // visit, and a running flow keeps it minimized wherever the user goes.
    const shouldMinimize = walkthroughActive || !defaultOpen;
    setMinimized(shouldMinimize);
    if (shouldMinimize) setVideoStarted(false);
  }, [defaultOpen, walkthroughActive, revealSignal]);

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

  const minimizeWidget = () => {
    setMinimized(true);
    setVideoStarted(false);
  };

  const handlePlayVideo = () => {
    trackEvent(ANALYTICS_EVENTS.GETTING_STARTED_VIDEO_PLAYED);
    setVideoStarted(true);
  };

  const handleStartTour = () => {
    trackEvent(ANALYTICS_EVENTS.GETTING_STARTED_TOUR_LINK_CLICKED);
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
      {/* Always visible, in both states — opens the panel when minimized, no-op if
          already open. Panel (below) sits just above it with a gap when expanded. */}
      <button
        type="button"
        data-testid="getting-started-widget-pill"
        onClick={() => setMinimized(false)}
        className="fixed right-6 bottom-6 z-40 flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-white shadow-xl hover:opacity-90"
      >
        <Rocket className="h-4 w-4" />
        <span className="text-sm font-semibold">Get Started</span>
      </button>

      {!minimized && (
        <div
          data-testid="getting-started-widget"
          className="fixed right-6 bottom-24 z-40 w-[calc(100vw-3rem)] max-w-[520px] rounded-2xl border bg-card p-6 shadow-xl"
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
            {videoStarted ? (
              <iframe
                data-testid="getting-started-widget-video-iframe"
                src={PRODUCT_VIDEO_EMBED_URL}
                title="Dalgo product overview"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="h-full w-full border-0"
              />
            ) : (
              <button
                type="button"
                aria-label="Play Dalgo product overview video"
                data-testid="getting-started-widget-video-play"
                onClick={handlePlayVideo}
                className="flex h-full w-full items-center justify-center bg-cover bg-center"
                style={{ backgroundImage: `url(${PRODUCT_VIDEO_THUMBNAIL_URL})` }}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-background shadow">
                  <Play className="h-5 w-5 text-primary" fill="currentColor" />
                </span>
              </button>
            )}
          </div>

          {allComplete ? (
            /* Figma 2863:2415 — replaces the tour link once both flows are done. */
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
          ) : (
            <button
              type="button"
              data-testid="getting-started-widget-tour-link"
              onClick={handleStartTour}
              className="mt-4 text-sm text-muted-foreground"
            >
              New to dalgo?{' '}
              <span className="font-medium text-primary hover:underline">Take a 2 min tour</span>
            </button>
          )}

          <ul className="mt-4 divide-y">
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
