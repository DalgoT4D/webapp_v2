'use client';

/**
 * Shared shell for the trial's "welcome back" / lifecycle nudge modals — left pane is
 * copy + CTA, right pane is a static illustration. Used by FlowResumeNudgeModal and
 * TrialDayNudgeModal; extracted here since both are the same shape with different copy.
 */
import type { ReactNode } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface TwoPaneNudgeDialogProps {
  onOpenChange: (open: boolean) => void;
  title: string;
  body: ReactNode;
  ctaLabel: string;
  onCta: () => void;
  imageSrc: string;
  testId: string;
}

export function TwoPaneNudgeDialog({
  onOpenChange,
  title,
  body,
  ctaLabel,
  onCta,
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
              data-testid={`${testId}-cta`}
            >
              {ctaLabel}
            </Button>
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm font-medium">Need help structuring your programme data?</p>
              <p className="text-muted-foreground mt-1 text-sm">Contact us at Book a call</p>
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
