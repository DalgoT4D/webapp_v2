'use client';

/**
 * The walkthrough's celebration beat — a full dialog rather than a toast at the two moments
 * the flow reaches something the user actually built: their first KPI (see kpi-page.tsx) and
 * their shared dashboard (see dashboard-native-view.tsx).
 *
 * It never navigates on its own. Each caller decides what closing means: revealing the next
 * coachmark, or simply getting out of the way of the thing just built.
 */
import { Check, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/lib/analytics';
import type { AnalyticsEvent } from '@/constants/analytics';

interface CelebrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  ctaLabel: string;
  /** Runs after the dialog closes. Omit when closing is the whole action. */
  onCta?: () => void;
  /** Fired on both exits, with `{ choice: 'cta' | 'close' }`. */
  dismissEvent: AnalyticsEvent;
  testId: string;
}

export function CelebrationModal({
  open,
  onOpenChange,
  title,
  description,
  ctaLabel,
  onCta,
  dismissEvent,
  testId,
}: CelebrationModalProps) {
  const close = (choice: 'cta' | 'close') => {
    trackEvent(dismissEvent, { choice });
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          close('close');
          return;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        data-testid={testId}
        showCloseButton={false}
        className="overflow-hidden border-none bg-gradient-to-b from-[#e8f8f0] to-white p-0 sm:max-w-md"
      >
        <button
          type="button"
          aria-label="Close"
          data-testid={`${testId}-close`}
          onClick={() => close('close')}
          className="text-muted-foreground hover:text-foreground absolute top-4 right-4"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center gap-4 px-10 pt-12 pb-10 text-center">
          <span className="border-primary/30 flex h-24 w-24 items-center justify-center rounded-full border">
            <span className="bg-primary flex h-16 w-16 items-center justify-center rounded-full">
              <Check className="h-8 w-8 text-white" strokeWidth={3} />
            </span>
          </span>
          <DialogTitle className="text-2xl font-bold">{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground text-base">
            {description}
          </DialogDescription>
          <Button
            variant="primary"
            data-testid={`${testId}-cta`}
            onClick={() => {
              close('cta');
              onCta?.();
            }}
          >
            {ctaLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
