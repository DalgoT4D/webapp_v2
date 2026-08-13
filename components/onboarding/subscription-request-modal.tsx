'use client';

/**
 * The two modals behind the header's "Subscribe Now" pill: a confirm step, then a success
 * acknowledgement. Fully controlled — the pill (TrialBadge in components/header.tsx) owns the
 * stage and the network call, so this file stays presentational and easy to test.
 *
 * A subscription request is once-per-org and cannot be undone from the UI, which is why the
 * confirm step exists at all: the pill sits next to the notification bell and is easy to hit
 * by accident.
 */
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';

const CELEBRATION_ANIMATION_SRC = '/branding/celebration-checkmark.gif';
const CELEBRATION_ANIMATION_SIZE = 150;

export type SubscriptionRequestStage = 'idle' | 'confirm' | 'sending' | 'sent';

interface SubscriptionRequestModalProps {
  stage: SubscriptionRequestStage;
  onConfirm: () => void;
  /** Called when the user dismisses either modal (Cancel, the X, Esc, or outside click). */
  onClose: () => void;
}

export function SubscriptionRequestModal({
  stage,
  onConfirm,
  onClose,
}: SubscriptionRequestModalProps) {
  if (stage === 'idle') return null;

  if (stage === 'sent') {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className="from-primary/10 overflow-hidden border-none bg-gradient-to-b to-white p-0 sm:max-w-md"
          data-testid="subscription-sent-modal"
          aria-describedby="subscription-sent-description"
        >
          <div className="flex flex-col items-center gap-4 px-10 pt-12 pb-10 text-center">
            {/* Match the celebration moments elsewhere in onboarding. `unoptimized` preserves
                the GIF animation instead of allowing Next to flatten it into a still image. */}
            <Image
              src={CELEBRATION_ANIMATION_SRC}
              alt=""
              width={CELEBRATION_ANIMATION_SIZE}
              height={CELEBRATION_ANIMATION_SIZE}
              unoptimized
              priority
              data-testid="subscription-sent-animation"
            />
            <DialogTitle className="text-2xl font-bold">Subscription request sent</DialogTitle>
            <DialogDescription
              id="subscription-sent-description"
              className="text-muted-foreground text-base leading-relaxed"
            >
              Our team will reach out to you within 1 working day with a request for the relevant
              information to generate an invoice and help set you up.
            </DialogDescription>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isSending = stage === 'sending';

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // ignore dismissals while the request is in flight — closing here would strand the
        // user with no feedback on a call that is still going to succeed or fail
        if (!open && !isSending) onClose();
      }}
    >
      <DialogContent data-testid="subscription-confirm-modal" showCloseButton={!isSending}>
        <DialogTitle className="text-xl font-bold">Request a subscription?</DialogTitle>
        <DialogDescription className="text-base">
          Our team will reach out to you within 1 working day to help set you up.
        </DialogDescription>
        <div className="mt-4 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSending}
            data-testid="subscription-cancel-button"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={isSending}
            data-testid="subscription-confirm-button"
          >
            {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSending ? 'Sending…' : 'Confirm request'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
