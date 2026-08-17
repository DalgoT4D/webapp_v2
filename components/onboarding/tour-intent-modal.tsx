'use client';

/**
 * The trial user's landing-page intent modal, shown on /impact. Figma frame: "take tour"
 * intro (tour flow section, 2452:663-equivalent).
 *
 * Two copies of the same modal, chosen by `variant` — the options, illustration and layout
 * are identical, only the heading block differs:
 *  - 'first_time' asks "What brings you to Dalgo".
 *  - 'returning' greets them back with the days left on their trial and points at the
 *    fastest route to value. It reappears once per session until they have completed both
 *    the build-insight and automate-pipeline walkthroughs (see tour-gate.tsx).
 *
 * All three options start the thing they name — the owner (tour-gate.tsx) supplies the same
 * handlers the Get Started checklist rows use, so picking a journey here behaves exactly like
 * picking it there (including resuming one already in progress rather than restarting it).
 * The tour is not a journey and stays a re-runnable helper link in that widget.
 */
import Image from 'next/image';
import { BarChart3, Map, Workflow } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

export type TourIntentVariant = 'first_time' | 'returning';

interface TourIntentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartTour: () => void;
  /**
   * "Build your first insight" — rolls straight into that walkthrough (its sample-vs-own-data
   * question, or a resume if one is already part-way through). Same handler as the checklist
   * row, so the two entry points can't diverge.
   */
  onSelectInsight: () => void;
  /** "Setup an automated data pipeline" — same deal, for that flow. */
  onSelectPipeline: () => void;
  /** Which heading block to render. Defaults to the original first-visit copy. */
  variant?: TourIntentVariant;
  /** Whole days left in the trial — only read by the 'returning' variant's heading. */
  trialDaysLeft?: number;
}

interface IntentOption {
  id: 'tour' | 'insight' | 'pipeline';
  icon: typeof Map;
  label: string;
  description: string;
}

const INTENT_OPTIONS: IntentOption[] = [
  {
    id: 'tour',
    icon: Map,
    label: 'Explore the platform',
    description: "Take a quick tour of Dalgo's capabilities",
  },
  {
    id: 'insight',
    icon: BarChart3,
    label: 'Build your first insight',
    description: 'Build out your first dashboard and share it',
  },
  {
    id: 'pipeline',
    icon: Workflow,
    label: 'Setup an automated data pipeline',
    description: 'Setup your data to be updated, cleaned and computed regularly',
  },
];

export function TourIntentModal({
  open,
  onOpenChange,
  onStartTour,
  onSelectInsight,
  onSelectPipeline,
  variant = 'first_time',
  trialDaysLeft = 0,
}: TourIntentModalProps) {
  const handleSelect = (option: IntentOption) => {
    trackEvent(ANALYTICS_EVENTS.TOUR_INTENT_MODAL_DISMISSED, { choice: option.id, variant });
    onOpenChange(false);
    if (option.id === 'tour') {
      onStartTour();
      return;
    }
    // Deferred a tick. Both journeys can open a Dialog of their own (the insight fork), and
    // mounting one while THIS click is still bubbling to `document` makes Radix's outside-click
    // listener treat that same click as a dismissal — the new dialog closes before it is ever
    // seen. Letting the current event finish first avoids that.
    const start = option.id === 'insight' ? onSelectInsight : onSelectPipeline;
    setTimeout(start, 0);
  };

  const isReturning = variant === 'returning';
  const dayLabel = trialDaysLeft === 1 ? '1 day' : `${trialDaysLeft} days`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          trackEvent(ANALYTICS_EVENTS.TOUR_INTENT_MODAL_DISMISSED, { choice: 'close', variant });
        } else {
          trackEvent(ANALYTICS_EVENTS.TOUR_INTENT_MODAL_VIEWED, { variant });
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        data-testid="tour-intent-modal"
        className="gap-0 overflow-hidden p-0 sm:max-w-[1179px] sm:h-[463px]"
      >
        <div className="grid h-full grid-cols-1 md:grid-cols-[5fr_6fr]">
          <div className="px-8 py-14">
            <DialogTitle className="text-2xl font-bold text-foreground">
              {isReturning
                ? `Welcome back — ${dayLabel} left for your trial`
                : 'What brings you to Dalgo'}
            </DialogTitle>
            {isReturning && (
              <p
                className="mt-4 text-base text-muted-foreground"
                data-testid="tour-intent-subtitle"
              >
                You haven&apos;t started yet. The fastest way to see what Dalgo does is to turn the
                sample data into a dashboard, about 5 minutes.
              </p>
            )}
            <div className={cn('space-y-5', isReturning ? 'mt-6' : 'mt-8')}>
              {INTENT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  data-testid={`tour-intent-option-${option.id}`}
                  onClick={() => handleSelect(option)}
                  className="flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <option.icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-foreground">
                      {option.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="relative hidden flex-col items-center justify-between overflow-hidden bg-gradient-to-br from-[#e8f7f2] via-[#d5f0e6] to-[#b8e6d4] px-8 py-14 md:flex">
            {/* Figma frame 2452:663's preview graphic: a bar-chart card (with a KPI stat
                card bleeding past its left edge) plus a "Real-time Alert Monitor" card
                overlapping its bottom-right corner. Exported as two separate SVGs (rather
                than one flattened image) so both overlapping cards bleed past the base
                card's edges exactly as designed. */}
            <div className="relative h-[218px] w-[469px]">
              <Image
                src="/branding/tour-intent-chart.svg"
                alt="A dashboard KPI card and bar chart preview"
                width={469}
                height={218}
              />
              <Image
                src="/branding/tour-intent-alert-card.svg"
                alt="A real-time alert monitor card"
                width={199}
                height={156}
                className="absolute top-[107px] left-[310px]"
              />
            </div>
            <div className="w-[515px] text-center">
              {/* Verbatim from Figma's 'intro' pane (2546:2179 / 2546:2180) — design-owned copy. */}
              <p className="text-lg font-bold text-[#0f2b45]">
                Turn your programme data into proof of impact.
              </p>
              <p className="mt-2 text-sm font-medium text-[#036057]">
                Bring your scattered sources together to build automated dashboards, track key
                metrics, and share results with your team.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
