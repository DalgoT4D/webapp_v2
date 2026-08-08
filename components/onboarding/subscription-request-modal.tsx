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
import { Loader2 } from 'lucide-react';

export type SubscriptionRequestStage = 'idle' | 'confirm' | 'sending' | 'sent';

interface SubscriptionRequestModalProps {
  stage: SubscriptionRequestStage;
  onConfirm: () => void;
  /** Called when the user dismisses either modal (Cancel, the X, Esc, or outside click). */
  onClose: () => void;
}

/**
 * Green tick with scattered confetti, drawn inline rather than shipped as an image so it
 * stays crisp at any size and needs no network fetch inside a modal that appears instantly.
 * Decorative only — the heading carries the meaning, so it is hidden from screen readers.
 */
function SuccessIllustration() {
  return (
    <svg
      viewBox="0 0 120 120"
      className="h-24 w-24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="60" cy="60" r="26" className="fill-green-500" />
      <path
        d="M48 60.5 L56.5 69 L72 53"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* confetti — deliberately irregular so it reads as a burst rather than a pattern */}
      <g strokeWidth="2.5" strokeLinecap="round" fill="none">
        <path d="M28 44 L34 41" className="stroke-emerald-600" />
        <path d="M40 28 L43 22" className="stroke-blue-800" />
        <path d="M78 24 Q82 26 80 30" className="stroke-emerald-700" />
        <path d="M95 62 Q92 66 95 69" className="stroke-blue-800" />
        <path d="M52 92 Q57 96 63 93" className="stroke-blue-900" />
        <path d="M86 88 L91 92" className="stroke-blue-800" />
        <path d="M24 78 Q28 83 25 88" className="stroke-emerald-800" />
      </g>
      <g strokeWidth="0">
        <circle cx="36" cy="66" r="3" className="fill-rose-900" />
        <circle cx="90" cy="44" r="2.5" className="fill-yellow-700" />
        <circle cx="66" cy="20" r="2.5" className="fill-emerald-600" />
      </g>
      <g className="fill-blue-800">
        <path d="M31 32 l4 1 -1 4 -4 -1 z" />
      </g>
      <g className="fill-yellow-700">
        <path d="M88 74 l4 1 -1 4 -4 -1 z" />
      </g>
    </svg>
  );
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
          className="sm:max-w-xl"
          data-testid="subscription-sent-modal"
          aria-describedby="subscription-sent-description"
        >
          <div className="flex flex-col items-center gap-6 px-6 py-8 text-center">
            <SuccessIllustration />
            <DialogTitle className="text-3xl font-bold">Subscription request sent</DialogTitle>
            <DialogDescription
              id="subscription-sent-description"
              className="text-foreground text-lg leading-relaxed"
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
