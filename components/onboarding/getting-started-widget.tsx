'use client';

/**
 * "Welcome to Dalgo" getting-started panel — floating card, bottom-right of /impact.
 * The "Get Started" pill is always rendered; the full panel additionally shows above it
 * unless minimized. State is per-org (localStorage) so it stays minimized across reloads
 * until reopened via the pill — there's no separate dismiss.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronRight, Circle, Minus, Play, Rocket } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { getStoredPath } from './insight-walkthrough-constants';
import { getFlowResumeStep, FLOW_RESUME_ROUTES } from './flow-resume';

interface GettingStartedWidgetProps {
  orgSlug: string;
  hasBuiltFirstInsight: boolean;
  hasAutomatedPipeline: boolean;
  onStartTour: () => void;
}

interface ChecklistItem {
  key: string;
  label: string;
  description: string;
  checked: boolean;
  href: string;
}

const MINIMIZED_STORAGE_PREFIX = 'dalgo_getting_started_minimized_';

export function GettingStartedWidget({
  orgSlug,
  hasBuiltFirstInsight,
  hasAutomatedPipeline,
  onStartTour,
}: GettingStartedWidgetProps) {
  // Starts true (collapsed) so the full panel never flashes open before this effect
  // reads localStorage — a browser-only API, unavailable during server render.
  const [minimized, setMinimized] = useState(true);
  // Default hrefs for a flow never started (or already finished) — corrected below to the
  // exact spot a user left off, per Himanshu: clicking a checklist item should resume the
  // matching flow (sample/own_data → build-insight, automate_pipeline → automate-pipeline)
  // rather than always landing on the same generic page.
  const [buildInsightHref, setBuildInsightHref] = useState('/charts');
  const [automatePipelineHref, setAutomatePipelineHref] = useState('/pipeline');

  useEffect(() => {
    setMinimized(localStorage.getItem(`${MINIMIZED_STORAGE_PREFIX}${orgSlug}`) === '1');

    const path = getStoredPath(orgSlug);
    if (path === 'sample' || path === 'own_data') {
      const step = getFlowResumeStep(orgSlug, path);
      if (step) setBuildInsightHref(FLOW_RESUME_ROUTES[step.id]);
    } else if (path === 'automate_pipeline') {
      const step = getFlowResumeStep(orgSlug, path);
      if (step) setAutomatePipelineHref(FLOW_RESUME_ROUTES[step.id]);
    }
  }, [orgSlug]);

  const setMinimizedPersisted = (value: boolean) => {
    localStorage.setItem(`${MINIMIZED_STORAGE_PREFIX}${orgSlug}`, value ? '1' : '0');
    setMinimized(value);
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
      href: buildInsightHref,
    },
    {
      key: 'automate-pipeline',
      label: 'Setup an automated data pipeline',
      description: 'Setup your data to be updated, cleaned and computed regularly',
      checked: hasAutomatedPipeline,
      href: automatePipelineHref,
    },
  ];

  return (
    <>
      {/* Always visible, in both states — opens the panel when minimized, no-op if
          already open. Panel (below) sits just above it with a gap when expanded. */}
      <button
        type="button"
        data-testid="getting-started-widget-pill"
        onClick={() => setMinimizedPersisted(false)}
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
              onClick={() => setMinimizedPersisted(true)}
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
            {items.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  data-testid={`getting-started-widget-item-${item.key}`}
                  className="flex w-full items-start gap-3 py-3 text-left"
                >
                  {item.checked ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  ) : (
                    <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="flex-1">
                    <span className="block text-base font-semibold text-foreground">
                      {item.label}
                    </span>
                    <span className="block text-sm text-muted-foreground">{item.description}</span>
                  </span>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
