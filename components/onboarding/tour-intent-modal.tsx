'use client';

/**
 * "What brings you to Dalgo" — one-time intent modal shown on a trial user's first visit
 * to /impact. Figma frame: "take tour" intro (tour flow section, 2452:663-equivalent).
 *
 * Only the "Explore the platform" option is wired to real behavior (starts the driver.js
 * tour via `onStartTour`); the other two just close the modal for now — decided with
 * Himanshu as out of scope for this pass.
 */
import Image from 'next/image';
import { BarChart3, Map, Workflow } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

interface TourIntentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartTour: () => void;
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

const DOT_COUNT = 3;
const ACTIVE_DOT = 1;

export function TourIntentModal({ open, onOpenChange, onStartTour }: TourIntentModalProps) {
  const handleSelect = (option: IntentOption) => {
    trackEvent(ANALYTICS_EVENTS.TOUR_INTENT_MODAL_DISMISSED, { choice: option.id });
    onOpenChange(false);
    if (option.id === 'tour') {
      onStartTour();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          trackEvent(ANALYTICS_EVENTS.TOUR_INTENT_MODAL_DISMISSED, { choice: 'close' });
        } else {
          trackEvent(ANALYTICS_EVENTS.TOUR_INTENT_MODAL_VIEWED);
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
              What brings you to Dalgo
            </DialogTitle>
            <div className="mt-8 space-y-5">
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
              <p className="text-lg font-bold text-[#0f2b45]">
                Take a guided walkthrough see the finished product.
              </p>
              <p className="mt-2 text-sm font-medium text-[#036057]">
                Look around a fully populated workspace to see what Dalgo can actually do for your
                programme.
              </p>
              <div
                className="mt-4 flex justify-center gap-1"
                role="presentation"
                data-testid="tour-intent-modal-dots"
              >
                {Array.from({ length: DOT_COUNT }, (_, i) => (
                  <span
                    key={`tour-intent-dot-${i}`}
                    className={cn(
                      'h-1 w-8 rounded-full',
                      i === ACTIVE_DOT ? 'bg-primary' : 'bg-white/70'
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
