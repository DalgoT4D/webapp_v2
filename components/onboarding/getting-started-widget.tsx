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
import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronRight, Circle, Minus, Play, Rocket } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

interface GettingStartedWidgetProps {
  /**
   * Whether landing here opens the panel. True on /impact (where the checklist is the point)
   * and false elsewhere, where the pill alone is enough and an auto-opening panel would cover
   * the page's own content.
   */
  defaultOpen: boolean;
  /** A guided walkthrough is mid-flow — keep the panel out of the way until it finishes. */
  walkthroughActive: boolean;
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
  hasBuiltFirstInsight,
  hasAutomatedPipeline,
  onStartTour,
  onBuildInsightClick,
  onAutomatePipelineClick,
}: GettingStartedWidgetProps) {
  // Starts true (collapsed) so the full panel never flashes open before the effect below
  // settles it.
  const [minimized, setMinimized] = useState(true);

  useEffect(() => {
    // Re-derived on arrival (and whenever a walkthrough starts or ends) rather than
    // persisted: returning to /impact re-opens the panel even if it was minimized last
    // visit, and a running flow keeps it minimized wherever the user goes.
    setMinimized(walkthroughActive || !defaultOpen);
  }, [defaultOpen, walkthroughActive]);

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
          className="fixed right-6 bottom-24 z-40 w-[420px] rounded-2xl border bg-card p-6 shadow-xl"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xl font-bold text-foreground">Welcome to Dalgo</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Turn your programme data into insights and reports you can share
              </p>
            </div>
            <button
              type="button"
              aria-label="Minimize"
              data-testid="getting-started-widget-minimize"
              onClick={() => setMinimized(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Minus className="h-5 w-5" />
            </button>
          </div>

          {/* Video placeholder — swap for the real walkthrough video later */}
          <div
            data-testid="getting-started-widget-video-placeholder"
            className="mt-4 flex h-40 items-center justify-center rounded-xl bg-primary/10"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow">
              <Play className="h-5 w-5 text-primary" />
            </span>
          </div>

          <button
            type="button"
            data-testid="getting-started-widget-tour-link"
            onClick={handleStartTour}
            className="mt-4 text-sm text-muted-foreground"
          >
            New to dalgo?{' '}
            <span className="font-medium text-primary hover:underline">Take a 2 min tour</span>
          </button>

          <ul className="mt-4 divide-y">
            {items.map((item) => {
              const testId = `getting-started-widget-item-${item.key}`;
              const rowClass = 'flex w-full items-start gap-3 py-3 text-left';
              const body = (
                <>
                  {item.checked ? (
                    <CheckCircle2 className="text-primary mt-0.5 h-5 w-5 shrink-0" />
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
                        setMinimized(true);
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
        </div>
      )}
    </>
  );
}
