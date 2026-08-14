'use client';

/**
 * The walkthrough's celebration beat — a full dialog rather than a toast at the two moments
 * the flow reaches something the user actually built: their first KPI (see kpi-page.tsx) and
 * their shared dashboard (see dashboard-native-view.tsx).
 *
 * It never navigates on its own. Each caller decides what closing means: revealing the next
 * coachmark, or simply getting out of the way of the thing just built.
 */
import Image from 'next/image';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import type { AnalyticsEvent } from '@/constants/analytics';

// Animated tick shown at the top of every celebration modal.
const CELEBRATION_ANIMATION_SRC = '/branding/celebration-checkmark.gif';
/** The GIF's native size (150x150). Rendered 1:1 so it stays crisp and doesn't resample. */
const CELEBRATION_ANIMATION_SIZE = 150;
/**
 * Every celebration modal is the SAME card: 600x440. Fixed rather than content-sized so the
 * four call sites (chart, KPI, dashboard, pipeline) don't each render a differently-shaped
 * dialog off the back of how long their copy happens to be. Content is centred inside it, so
 * shorter copy sits in the middle instead of riding the top edge.
 */
const CELEBRATION_MODAL_SIZE_CLASS = 'h-[440px] w-[600px] max-w-[calc(100vw-2rem)]';

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
        className={cn(
          'overflow-hidden border-none bg-gradient-to-b from-[#e8f8f0] to-white p-0',
          // Beats DialogContent's own `sm:max-w-lg`, which would otherwise cap the card at
          // 512px on desktop.
          CELEBRATION_MODAL_SIZE_CLASS,
          'sm:max-w-[600px]'
        )}
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

        <div className="flex h-full flex-col items-center justify-center gap-3 px-8 py-6 text-center">
          {/* Animated tick. `unoptimized` is required — Next's image optimizer re-encodes
              GIFs to a single still frame, which would silently kill the animation. */}
          <Image
            src={CELEBRATION_ANIMATION_SRC}
            alt=""
            width={CELEBRATION_ANIMATION_SIZE}
            height={CELEBRATION_ANIMATION_SIZE}
            unoptimized
            priority
            data-testid={`${testId}-animation`}
          />
          <DialogTitle className="text-3xl font-bold">{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground text-lg">
            {description}
          </DialogDescription>
          <Button
            variant="primary"
            size="lg"
            className="mt-1 text-base"
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
