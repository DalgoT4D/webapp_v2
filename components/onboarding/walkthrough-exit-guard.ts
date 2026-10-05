'use client';

/**
 * Keeps a running walkthrough on rails: while a coachmark is on screen, the only clicks that
 * reach the app are the ones the coachmark is asking for. Anything else is swallowed and turned
 * into a "leave the walkthrough?" prompt (see leave-walkthrough-dialog.tsx) instead of quietly
 * dropping the user out of the flow.
 *
 * Why a document-level CAPTURE listener rather than driver.js's own overlay-click hook: the
 * coachmark's overlay is deliberately transparent AND click-through (see
 * `dalgo-tour-passthrough` in tour.css) so the user can click the real control a stage points
 * at — driver.js never sees those clicks at all. Capturing on `document` is the only place that
 * sees a click before the app's own handlers (React binds at its root container, below
 * `document`) and can still cancel it.
 */
import { useEffect, useRef } from 'react';

/**
 * Regions that stay clickable whatever stage is live.
 *
 * Deliberately short. Outside a modal the coached control is the ONLY thing the user may click,
 * so this list holds only what that click needs in order to work at all. (Inside a modal the
 * rule is looser — see the DIALOG_SELECTOR branch in isClickAllowedDuringWalkthrough.)
 */
const ALWAYS_ALLOWED_SELECTORS = [
  // driver.js's own popover — the coachmark card, its Next button and its ✕.
  '.driver-popover',
  // The leave-confirmation dialog itself.
  '[data-walkthrough-exit-dialog]',
  // Radix dropdown/select/combobox content is portaled to the body, OUTSIDE the field it
  // belongs to, so a stage pointing at a dropdown can't reach its own option list without it.
  '[data-radix-popper-content-wrapper]',
  // Toasts (sonner) — dismissing one is never an attempt to leave the walkthrough.
  '[data-sonner-toaster]',
  // The Get Started widget and its pill. The prompt names this panel as the way back into the
  // walkthrough, so guarding the one control it points at would be absurd.
  '[data-testid="getting-started-widget"]',
  '[data-testid="getting-started-widget-pill"]',
] as const;

/** Dialogs, sheets and any other Radix layer that stacks over the page. */
const DIALOG_SELECTOR = '[role="dialog"], [role="alertdialog"]';

/**
 * The transform canvas's operation panel — a modal in everything but implementation.
 *
 * It's a side panel rather than a Radix dialog, so the modal rule above didn't reach it, and
 * strict mode made it unusable: picking an operation, ticking columns, Select All, the search
 * box, a Generic SQL body — none of that is what the current stage points at, and all of it is
 * required to reach the Save the stage is waiting for.
 *
 * Its BACK arrow stays clickable on purpose (`panel-back-btn`, "Go back"): returning to the
 * operation list to pick a different function is working inside the panel, not leaving it. Only
 * the ✕ closes the panel and abandons the step.
 */
const WORK_PANEL_SELECTOR = '[data-testid="operation-config-layout"]';
const WORK_PANEL_EXIT_SELECTOR = '[data-testid="panel-close-btn"]';

/** A dropdown/select/combobox list that is currently open. */
const OPEN_POPPER_LAYER_SELECTOR = '[data-radix-popper-content-wrapper] [data-state="open"]';

/**
 * Controls that ABANDON a wizard rather than move around inside it.
 *
 * BACK is deliberately absent: stepping back to an earlier step of the KPI wizard, or to the
 * add-source wizard's previous step, is working inside the flow — the coachmark for that step is
 * waiting there. Only Cancel and ✕ end the thing the walkthrough is mid-way through asking for.
 *
 * Matched by slot/testid first, then by the control's own label, so a dialog that rolls its own
 * footer buttons (rather than using DialogClose) is still covered.
 */
const DIALOG_EXIT_SELECTORS = [
  // shadcn's built-in ✕ on DialogContent / SheetContent.
  '[data-slot="dialog-close"]',
  '[data-slot="sheet-close"]',
  // e.g. wizard-cancel-btn.
  '[data-testid$="-cancel-btn"]',
] as const;

/** Anchored, so an option reading "Close for the season" isn't mistaken for a Close button. */
const DIALOG_EXIT_LABELS = /^(cancel|close|discard|exit)$/;

function isDialogExitControl(target: Element): boolean {
  if (DIALOG_EXIT_SELECTORS.some((selector) => target.closest(selector) !== null)) return true;
  const control = target.closest('button, [role="button"], a');
  if (!control) return false;
  const label = (control.getAttribute('aria-label') || control.textContent || '')
    // Drops the ← / ✕ glyphs these buttons often carry alongside their word.
    .replace(/[^a-z ]/gi, '')
    .trim()
    .toLowerCase();
  return DIALOG_EXIT_LABELS.test(label);
}

/**
 * All three are cancelled, but only `pointerdown` raises the prompt.
 *
 * Cancelling `pointerdown` alone isn't enough: it stops focus and drag, not the `click` that
 * follows, so a button's own handler would still run. Cancelling all three and prompting once
 * (on the first of them) keeps a single click to a single dialog.
 */
const GUARDED_EVENTS = ['pointerdown', 'mousedown', 'click'] as const;

export interface WalkthroughExitGuardOptions {
  /**
   * Whether a coachmark is actually on screen right now. Read through a function (not a prop)
   * so the guard's listeners can be attached once for the component's life instead of being
   * torn down and re-bound on every stage change.
   */
  isArmed: () => boolean;
  /**
   * The stage's own clickable elements — the highlighted target first, then its separate
   * interaction target where the stage has one. Resolved per click because a stage's target can
   * be re-resolved mid-stage (see the trackTarget recovery loop).
   *
   * The FIRST entry is treated as the coached target for the foreign-dialog rule, so keep the
   * highlighted element at the front.
   */
  getAllowedRoots: () => (Element | null | undefined)[];
  /**
   * Selectors that stay guarded even when a wider region is allowed — the controls that leave
   * the screen the stage lives on. Only meaningful for a stage that opens its whole page up
   * (see StageConfig.allowPageRoam): the dashboard builder is entirely usable mid-walkthrough,
   * and its Back button is the one thing in it that ends the step.
   */
  getGuardedExits?: () => string[];
  /** Called once per guarded click — opens the "leave the walkthrough?" prompt. */
  onLeaveIntent: () => void;
}

/**
 * Whether a click on `target` should be allowed through. Exported for tests.
 */
export function isClickAllowedDuringWalkthrough(
  target: EventTarget | null,
  allowedRoots: (Element | null | undefined)[],
  guardedExits: string[] = []
): boolean {
  if (!(target instanceof Element)) return true;
  // Already detached — a menu that closed under the click, a row that re-rendered. There's no
  // ancestor chain left to attribute it to, so it can't be judged; don't prompt on the app's
  // own teardown.
  if (!target.isConnected) return true;
  // Ahead of every allowance below: these are the controls that walk off the stage's screen, and
  // they sit INSIDE the region a page-roam stage otherwise opens up.
  if (guardedExits.some((selector) => target.closest(selector) !== null)) return false;
  for (const root of allowedRoots) {
    if (root && (root === target || root.contains(target))) return true;
  }
  if (ALWAYS_ALLOWED_SELECTORS.some((selector) => target.closest(selector) !== null)) return true;
  // An open dropdown must stay dismissable: the multi-select comboboxes (pipeline connections,
  // KPI dimensions) stay open after a pick, and clicking away is the only way to close them —
  // guarding that would leave the list covering the page with nothing able to shut it. Matched
  // on the open state, not the wrapper alone, which lingers through the close animation.
  if (document.querySelector(OPEN_POPPER_LAYER_SELECTOR)) return true;
  // Contained workspaces are where the user gets room to work: a wizard step or an operation
  // panel is a set of choices and fields the walkthrough can't coach one at a time, and can't be
  // completed without them. Only the controls that walk out of them are held back.
  if (target.closest(WORK_PANEL_SELECTOR)) {
    return target.closest(WORK_PANEL_EXIT_SELECTOR) === null;
  }
  const dialog = target.closest(DIALOG_SELECTOR);
  if (dialog) {
    // Guarded exits apply to the dialog the flow is IN — the one holding the coached target. A
    // dialog the coached click OPENED (Add Chart's picker, a filter config, the save-chart name
    // dialog) covers no stage of its own, so cancelling out of it is a change of mind inside the
    // step, not an exit from the walkthrough.
    //
    // No coached target at all means the guard is armed by a protected modal instead (see
    // WALKTHROUGH_PROTECTED_DIALOGS — the add-source wizard's coachmark-less steps), and that
    // modal is exactly the flow. So the absence of a target guards exits rather than freeing
    // them.
    const coachedTarget = allowedRoots[0] ?? null;
    const isFlowDialog = !coachedTarget || dialog.contains(coachedTarget);
    return !isFlowDialog || !isDialogExitControl(target);
  }
  return false;
}

export function useWalkthroughExitGuard({
  isArmed,
  getAllowedRoots,
  getGuardedExits,
  onLeaveIntent,
}: WalkthroughExitGuardOptions): void {
  // Latest callbacks behind one stable ref: the effect below must bind exactly once (see
  // isArmed's note), so it can't close over the callbacks directly.
  const optionsRef = useRef({ isArmed, getAllowedRoots, getGuardedExits, onLeaveIntent });
  optionsRef.current = { isArmed, getAllowedRoots, getGuardedExits, onLeaveIntent };

  useEffect(() => {
    const handleEvent = (event: Event) => {
      const options = optionsRef.current;
      if (!options.isArmed()) return;
      // Left button only. Right-click opens the browser menu (no app action to intercept) and
      // middle-click paste/scroll isn't a walkthrough exit either.
      if (event instanceof MouseEvent && event.button !== 0) return;
      if (
        isClickAllowedDuringWalkthrough(
          event.target,
          options.getAllowedRoots(),
          options.getGuardedExits?.() ?? []
        )
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      // Also immediate: driver.js and Radix both bind their own capture-phase listeners on
      // document, and a click we're rejecting must not reach either of them.
      event.stopImmediatePropagation();
      if (event.type === 'pointerdown') options.onLeaveIntent();
    };

    for (const type of GUARDED_EVENTS) {
      document.addEventListener(type, handleEvent, true);
    }
    return () => {
      for (const type of GUARDED_EVENTS) {
        document.removeEventListener(type, handleEvent, true);
      }
    };
  }, []);
}
