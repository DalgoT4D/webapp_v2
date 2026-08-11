'use client';

/**
 * Shell for the trial's lifecycle nudge modals — left pane is copy + CTA, right pane is
 * a static illustration. Used by TrialDayNudgeModal; kept as its own component so a
 * future second nudge of the same shape (the flow-resume popup used to be one) doesn't
 * duplicate this markup.
 */
import type { ReactNode } from 'react';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { BOOK_A_CALL_URL } from '@/constants/trial';

interface TwoPaneNudgeDialogProps {
  onOpenChange: (open: boolean) => void;
  title: string;
  body: ReactNode;
  ctaLabel: string;
  onCta: () => void;
  /** Renders the CTA as an inert state label (e.g. "Request sent") rather than an action. */
  ctaDisabled?: boolean;
  imageSrc: string;
  testId: string;
}

export function TwoPaneNudgeDialog({
  onOpenChange,
  title,
  body,
  ctaLabel,
  onCta,
  ctaDisabled = false,
  imageSrc,
  testId,
}: TwoPaneNudgeDialogProps) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl gap-0 overflow-hidden p-0 sm:max-w-3xl"
        data-testid={testId}
      >
        <div className="grid sm:grid-cols-2">
          <div className="flex flex-col gap-6 p-10">
            <DialogTitle className="text-2xl leading-tight font-bold">{title}</DialogTitle>
            <div className="text-muted-foreground text-base">{body}</div>
            <Button
              variant="primary"
              className="w-fit"
              onClick={onCta}
              disabled={ctaDisabled}
              data-testid={`${testId}-cta`}
            >
              {ctaLabel}
            </Button>
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm font-medium">Need help structuring your programme data?</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Contact us at{' '}
                <a
                  href={BOOK_A_CALL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackEvent(ANALYTICS_EVENTS.BOOK_A_CALL_CLICKED, { source: 'nudge' })
                  }
                  className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
                  data-testid={`${testId}-book-a-call`}
                >
                  Book a call
                  <ArrowRight className="h-4 w-4" />
                </a>
              </p>
            </div>
          </div>
          <div className="relative hidden bg-[#d5f0e6] sm:block">
            <Image src={imageSrc} alt="" fill className="object-contain" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
