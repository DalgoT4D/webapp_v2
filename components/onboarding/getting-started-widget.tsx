'use client';

/**
 * "Welcome to Dalgo" getting-started checklist — floating card, bottom-right of /impact.
 * Figma: "take tour" frames showing the widget before/after the tour is seen.
 *
 * "Sample data ready" is always true post-clone. "Take a quick tour" is tied to the
 * tour-seen flag. "Build your first insight" and "Connect your own data" are both tied
 * to the insight walkthrough's completion flag, disambiguated by which fork the user
 * took (components/onboarding/insight-walkthrough-constants.ts's `path`).
 */
import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronRight, Circle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

interface GettingStartedWidgetProps {
  hasSeenTour: boolean;
  hasBuiltFirstInsight: boolean;
  hasConnectedOwnData: boolean;
  onStartTour: () => void;
}

interface ChecklistItem {
  key: string;
  label: string;
  description: string;
  checked: boolean;
  href?: string;
  onClick?: () => void;
}

export function GettingStartedWidget({
  hasSeenTour,
  hasBuiltFirstInsight,
  hasConnectedOwnData,
  onStartTour,
}: GettingStartedWidgetProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleStartTour = () => {
    trackEvent(ANALYTICS_EVENTS.GETTING_STARTED_TOUR_LINK_CLICKED);
    onStartTour();
  };

  const items: ChecklistItem[] = hasSeenTour
    ? [
        {
          key: 'sample-data',
          label: 'Sample data ready',
          description: 'We’ve pre-loaded a standard NGO dataset.',
          checked: true,
        },
        {
          key: 'build-insight',
          label: 'Build your first insight',
          description: 'Turn the sample data into a chart and dashboard you can share.',
          checked: hasBuiltFirstInsight,
          href: '/charts',
        },
        {
          key: 'connect-data',
          label: 'Connect your own data',
          description: 'Bring in your sources and keep them updating automatically.',
          checked: hasConnectedOwnData,
          href: '/ingest',
        },
      ]
    : [
        {
          key: 'sample-data',
          label: 'Sample data ready',
          description: 'We’ve pre-loaded a standard NGO dataset.',
          checked: true,
        },
        {
          key: 'take-tour',
          label: 'Take a quick tour',
          description: 'See what Dalgo can do in about 2 minutes',
          checked: false,
          onClick: handleStartTour,
        },
        {
          key: 'build-insight',
          label: 'Build your first insight',
          description: 'Turn the sample data into a chart and dashboard you can share.',
          checked: hasBuiltFirstInsight,
          href: '/charts',
        },
      ];

  return (
    <div
      data-testid="getting-started-widget"
      className="fixed bottom-6 right-6 z-40 w-[340px] rounded-xl border bg-card p-4 shadow-xl"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Welcome to Dalgo</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Turn your programme data into insights and reports you can share
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          data-testid="getting-started-widget-dismiss"
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        data-testid="getting-started-widget-tour-link"
        onClick={handleStartTour}
        className="mt-3 text-xs font-medium text-primary hover:underline"
      >
        New to Dalgo? Take a 2 min tour
      </button>

      <ul className="mt-3 space-y-3">
        {items.map((item) => {
          const content = (
            <>
              {item.checked ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="flex-1">
                <span
                  className={cn(
                    'block text-sm font-medium',
                    item.checked ? 'text-foreground' : 'text-foreground'
                  )}
                >
                  {item.label}
                </span>
                <span className="block text-xs text-muted-foreground">{item.description}</span>
              </span>
              {(item.href || item.onClick) && (
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </>
          );

          const rowClassName = 'flex w-full items-start gap-2 text-left';

          if (item.href) {
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  data-testid={`getting-started-widget-item-${item.key}`}
                  className={rowClassName}
                >
                  {content}
                </Link>
              </li>
            );
          }
          if (item.onClick) {
            return (
              <li key={item.key}>
                <button
                  type="button"
                  data-testid={`getting-started-widget-item-${item.key}`}
                  onClick={item.onClick}
                  className={rowClassName}
                >
                  {content}
                </button>
              </li>
            );
          }
          return (
            <li
              key={item.key}
              data-testid={`getting-started-widget-item-${item.key}`}
              className={rowClassName}
            >
              {content}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
