'use client';

/**
 * "What brings you to Dalgo" — one-time intent modal shown on a trial user's first visit
 * to /impact. Figma frame: "take tour" intro (tour flow section, 2452:663-equivalent).
 *
 * Only the "Take a Product tour" option is wired to real behavior (starts the driver.js
 * tour via `onStartTour`); the other two just close the modal for now — decided with
 * Himanshu as out of scope for this pass.
 */
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
    label: 'Take a Product tour',
    description: 'Take a quick tour of the sample setup',
  },
  {
    id: 'insight',
    icon: BarChart3,
    label: 'Build an insight',
    description: 'See sample data and start building',
  },
  {
    id: 'pipeline',
    icon: Workflow,
    label: 'Automate Pipeline',
    description: 'Import your source, transform it and run it on a daily schedule',
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
        className="gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-[5fr_6fr]">
          <div className="p-8">
            <DialogTitle className="text-2xl font-bold text-foreground">
              What brings you to Dalgo
            </DialogTitle>
            <div className="mt-6 space-y-3">
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

          <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#e8f7f2] via-[#d5f0e6] to-[#b8e6d4] p-8 md:flex">
            <div />
            <div>
              <p className="text-lg font-bold text-[#0f2b45]">
                Turn your programme data into proof of impact.
              </p>
              <p className="mt-2 text-sm font-medium text-[#036057]">
                Transform scattered numbers into clear, compelling charts.
              </p>
              <div
                className="mt-4 flex gap-1"
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
