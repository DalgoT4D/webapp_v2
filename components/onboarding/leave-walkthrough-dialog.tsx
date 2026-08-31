'use client';

/**
 * "Leave the walkthrough?" — the one confirmation between a running walkthrough and dropping
 * out of it. Raised by both exits the user has: the coachmark's ✕, and a click anywhere the
 * current stage isn't asking for (see walkthrough-exit-guard.ts).
 *
 * Built on the Radix primitives directly rather than on `ui/dialog`'s `DialogContent` because
 * this dialog has to out-stack driver.js: the coachmark popover ships a `z-index: 1e9`, and
 * `DialogContent` hardcodes its overlay and card at `z-50` — the shared component gives no way
 * to raise them, and this is the one dialog in the app that needs to sit above a tour overlay.
 */
import { useEffect } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

/**
 * One above driver.js's own popover (`z-index: 1000000000`, set in driver.css), so the prompt
 * and its dim land over the coachmark rather than under it. The overlay sits level with the
 * popover so the coachmark is dimmed along with the page.
 */
const OVERLAY_Z_CLASS = 'z-[1000000000]';
const CONTENT_Z_CLASS = 'z-[1000000001]';

/** Which walkthrough raised the prompt — an analytics property, not a behaviour switch. */
export type WalkthroughExitSurface = 'product_tour' | 'insight_walkthrough';

interface LeaveWalkthroughDialogProps {
  open: boolean;
  /** The step/stage the user was on when the prompt appeared — analytics only. */
  stage?: string | number | null;
  surface: WalkthroughExitSurface;
  /** Dismiss the prompt and leave the walkthrough running exactly where it was. */
  onContinue: () => void;
  /** Actually end the walkthrough — the surface's existing skip path. */
  onSkip: () => void;
}

export function LeaveWalkthroughDialog({
  open,
  stage,
  surface,
  onContinue,
  onSkip,
}: LeaveWalkthroughDialogProps) {
  const eventProps = { surface, stage: stage ?? null };

  // Fired here rather than at each call site so every raise of the prompt is counted the same
  // way, whichever exit (✕ or a guarded click) triggered it.
  useEffect(() => {
    if (open) trackEvent(ANALYTICS_EVENTS.WALKTHROUGH_EXIT_PROMPT_VIEWED, eventProps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog
      open={open}
      // Escape means "I didn't want to leave after all" — the walkthrough stays where it is.
      // Only the Skip button ends it.
      onOpenChange={(next) => {
        if (!next) {
          trackEvent(ANALYTICS_EVENTS.WALKTHROUGH_EXIT_PROMPT_CONTINUED, eventProps);
          onContinue();
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={`data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 bg-black/50 ${OVERLAY_Z_CLASS}`}
        />
        <DialogPrimitive.Content
          data-testid="leave-walkthrough-dialog"
          // Read by tour.css to keep this dialog clickable: driver.js kills pointer events on
          // everything under `body.driver-active`, this portal included.
          data-walkthrough-exit-dialog=""
          // The prompt is answered by its two buttons alone. Radix would otherwise close it on
          // any outside interaction, and driver.js supplies those constantly without the user
          // doing anything: it calls .focus() on its popover every time it re-highlights, which
          // the sync-running coachmark does on a loop as its target swaps between the sync and
          // cancel buttons. The prompt appeared and vanished in the same breath.
          onPointerDownOutside={(event) => event.preventDefault()}
          onFocusOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          className={`bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed top-[50%] left-[50%] grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-md ${CONTENT_Z_CLASS}`}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Leave the walkthrough?</DialogTitle>
            <DialogDescription className="text-base">
              You can start it again anytime from the Get Started panel. Skip it, or carry on from
              where you left off?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              id="leave-walkthrough-skip"
              data-testid="leave-walkthrough-skip-btn"
              onClick={() => {
                trackEvent(ANALYTICS_EVENTS.WALKTHROUGH_EXIT_PROMPT_SKIPPED, eventProps);
                onSkip();
              }}
            >
              Skip walkthrough
            </Button>
            <Button
              variant="primary"
              // `outline` (the Skip button) bakes `uppercase` into the variant while `primary`
              // doesn't, so the pair read as two different button styles. Matched to the
              // uppercase side, which is what every other outline/default/secondary button in
              // the app already renders as.
              className="uppercase font-medium"
              id="leave-walkthrough-continue"
              data-testid="leave-walkthrough-continue-btn"
              onClick={() => {
                trackEvent(ANALYTICS_EVENTS.WALKTHROUGH_EXIT_PROMPT_CONTINUED, eventProps);
                onContinue();
              }}
            >
              Continue walkthrough
            </Button>
          </DialogFooter>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}
