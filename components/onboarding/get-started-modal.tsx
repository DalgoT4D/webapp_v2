'use client';

/**
 * The trial onboarding's single "what do you want to build" dialog. Two screens in ONE
 * Dialog instance (the left pane swaps, the illustration stays) so moving between them
 * doesn't unmount/remount and flicker:
 *
 *  - 'choice'  — shown when the guided product tour finishes ("Finish Tour", not Skip).
 *  - 'insight' — the sample-data / own-data fork. Also the entry point on its own, opened
 *                from the Get Started widget or resumed when the user closed the tab while
 *                this screen was up (stage 'fork2').
 *
 * Rendered by tour-gate.tsx, which owns open/screen state — all three entry points have to
 * hit the same instance for the in-place screen swap to work.
 *
 * Closing via the X is a plain dismiss, NOT a skip: no fork was chosen, so nothing was
 * started and nothing is recorded as skipped — the widget can reopen it. Skipping a flow
 * for good is the coachmark's Skip button (see insight-walkthrough-coachmark.tsx).
 */
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, BarChart3, ChevronRight, Workflow, type LucideIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

/**
 * Carries its own mint gradient (fading to near-white at the bottom edge), so the pane it
 * fills needs no background of its own — the fade is what reads as the illustration sitting
 * inset in the dialog. Two things were baked into the asset when it was exported from the
 * design, both deliberate:
 *  - the design's decorative ✕ was painted out. The Dialog renders a REAL close button at
 *    `top-4 right-4`, which lands in exactly that corner, and the two rendered as a double ✕.
 *  - it was padded top and bottom with its own edge gradient. `object-cover` scales on
 *    whichever axis binds; at the source's original 346x324 the pane's height bound, and the
 *    ~5% horizontal crop that followed sliced through the "2,847" stat card at the right
 *    edge. The taller source makes WIDTH bind instead, so the full illustration shows and the
 *    crop lands in the padding.
 */
const ILLUSTRATION_SRC = '/branding/get-started-illustration.jpg';

export type GetStartedScreen = 'choice' | 'insight';
/** Where the dialog was opened from — analytics only. */
export type GetStartedEntry = 'post_tour' | 'widget' | 'resume' | 'intent_modal';

interface GetStartedModalProps {
  open: boolean;
  /** Which screen to show when it opens. The back arrow exists on 'insight' when the user
   *  got there from the post-tour choice, including when that choice is restored on refresh. */
  initialScreen: GetStartedScreen;
  entry: GetStartedEntry;
  /**
   * Which rows the 'choice' screen offers. The tour is re-runnable, so a user who already
   * finished (or skipped) one of the two flows shouldn't be offered it again — the owner
   * (tour-gate.tsx) decides that from the backend record and suppresses the dialog entirely
   * when neither is left. 'insight' screen options are unaffected.
   */
  showInsightOption?: boolean;
  showPipelineOption?: boolean;
  onOpenChange: (open: boolean) => void;
  /** Persists movement inside the post-tour chooser so a refresh restores the same screen. */
  onScreenChange: (screen: GetStartedScreen) => void;
  /** Start the automate-pipeline flow and navigate — owner also handles the store write. */
  onSelectPipeline: () => void;
  onSelectSample: () => void;
  onSelectOwnData: () => void;
}

interface OptionCardProps {
  testId: string;
  icon?: LucideIcon;
  label: string;
  description: string;
  onClick: () => void;
}

function OptionCard({ testId, icon: Icon, label, description, onClick }: OptionCardProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className="hover:border-primary focus-visible:border-primary focus-visible:ring-primary/30 flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
    >
      {Icon && (
        <span className="bg-muted text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-lg">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <span className="flex-1">
        <span className="text-foreground block text-base font-semibold">{label}</span>
        <span className="text-muted-foreground block text-sm">{description}</span>
      </span>
      <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0" />
    </button>
  );
}

export function GetStartedModal({
  open,
  initialScreen,
  entry,
  showInsightOption = true,
  showPipelineOption = true,
  onOpenChange,
  onScreenChange,
  onSelectPipeline,
  onSelectSample,
  onSelectOwnData,
}: GetStartedModalProps) {
  const [screen, setScreen] = useState<GetStartedScreen>(initialScreen);
  // Re-derived on every open rather than kept from last time: the entry point decides
  // which screen this is, and a stale 'insight' would skip the post-tour choice.
  const [cameFromChoice, setCameFromChoice] = useState(false);

  useEffect(() => {
    if (!open) return;
    setScreen(initialScreen);
    // A restored post-tour insight screen still belongs to the journey chooser, so its back
    // arrow must survive the refresh too. Widget/resume entry points open the same screen
    // directly and intentionally have no journey list behind them.
    setCameFromChoice(initialScreen === 'insight' && entry === 'post_tour');
    trackEvent(
      initialScreen === 'choice'
        ? ANALYTICS_EVENTS.POST_TOUR_MODAL_VIEWED
        : ANALYTICS_EVENTS.INSIGHT_FORK_MODAL_VIEWED,
      { entry }
    );
  }, [open, initialScreen, entry]);

  const openInsightScreen = () => {
    trackEvent(ANALYTICS_EVENTS.POST_TOUR_MODAL_DISMISSED, { choice: 'insight' });
    setCameFromChoice(true);
    setScreen('insight');
    onScreenChange('insight');
    trackEvent(ANALYTICS_EVENTS.INSIGHT_FORK_MODAL_VIEWED, { entry: 'post_tour' });
  };

  const returnToChoiceScreen = () => {
    setScreen('choice');
    setCameFromChoice(false);
    onScreenChange('choice');
  };

  const handlePipeline = () => {
    trackEvent(ANALYTICS_EVENTS.POST_TOUR_MODAL_DISMISSED, { choice: 'pipeline' });
    onOpenChange(false);
    onSelectPipeline();
  };

  const handleFork = (choice: 'sample' | 'own_data') => {
    trackEvent(ANALYTICS_EVENTS.INSIGHT_FORK_CHOSEN, { choice });
    onOpenChange(false);
    if (choice === 'sample') {
      onSelectSample();
    } else {
      onSelectOwnData();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          trackEvent(ANALYTICS_EVENTS.POST_TOUR_MODAL_DISMISSED, { choice: 'close', screen });
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="max-w-5xl gap-0 overflow-hidden p-0 sm:max-w-5xl"
        data-testid="get-started-modal"
        // This is the onboarding fork — a stray click on the backdrop shouldn't drop the user
        // out of it. Dismissing is a deliberate act: the X (or Escape).
        preventOutsideClose
      >
        {/* 3fr/2fr, not an even split: at this width an even one left the copy column wider
            than its longest line while squeezing the illustration. Both screens share this one
            DialogContent, so 'choice' and 'insight' are guaranteed the same width — swapping
            screens must not resize the dialog under the user's cursor. */}
        <div className="grid sm:grid-cols-[3fr_2fr]">
          <div className="flex flex-col gap-6 p-10">
            {screen === 'choice' ? (
              <>
                <DialogTitle className="text-2xl leading-tight font-bold">
                  You’ve completed Dalgo’s product tour.
                  <span className="block">Let’s get to building!</span>
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-base">
                  We’ve setup some samples to make this easier for you, you can connect your own
                  data too!
                </DialogDescription>
                <div className="flex flex-col gap-3">
                  {showInsightOption && (
                    <OptionCard
                      testId="get-started-option-insight"
                      icon={BarChart3}
                      label="Build your first insight"
                      description="Build out your first dashboard and share it"
                      onClick={openInsightScreen}
                    />
                  )}
                  {showPipelineOption && (
                    <OptionCard
                      testId="get-started-option-pipeline"
                      icon={Workflow}
                      label="Setup an automated data pipeline"
                      description="Setup your data to be updated, cleaned and computed regularly"
                      onClick={handlePipeline}
                    />
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  {cameFromChoice && (
                    <button
                      type="button"
                      aria-label="Back"
                      data-testid="get-started-back-btn"
                      onClick={returnToChoiceScreen}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                  )}
                  <DialogTitle className="text-2xl leading-tight font-bold">
                    Build your first insight
                  </DialogTitle>
                </div>
                <DialogDescription className="text-muted-foreground text-base">
                  How do you want to build it, with our ready-made sample data, or by connecting
                  your own?
                </DialogDescription>
                <div className="flex flex-col gap-3">
                  <OptionCard
                    testId="get-started-option-sample"
                    label="Use sample data"
                    description="See results straight away with ready-made NGO data"
                    onClick={() => handleFork('sample')}
                  />
                  <OptionCard
                    testId="get-started-option-own-data"
                    label="Connect my own data"
                    description="Bring in a source and build from your real numbers"
                    onClick={() => handleFork('own_data')}
                  />
                </div>
              </>
            )}
          </div>
          <div className="hidden p-4 sm:block" data-testid="get-started-modal-illustration-pane">
            <div className="relative h-full overflow-hidden rounded-xl">
              <Image src={ILLUSTRATION_SRC} alt="" fill className="object-cover" priority />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
