import useSWR, { mutate as globalMutate } from 'swr';
import { apiGet, apiPut } from '@/lib/api';

/**
 * Backend persistence for the three trial onboarding walkthroughs.
 *
 * Division of labour (deliberate — don't merge these two sources):
 *  - BACKEND (this file) is the permanent record, and the only one: per flow, whether it
 *    was skipped or completed. That's what the Get Started ticks read, so they survive a
 *    cleared browser.
 *  - localStorage (components/onboarding/insight-walkthrough-constants.ts) is scratch space
 *    for a flow that is still running — coachmark stage, chosen fork, milestone flags for
 *    "where do I resume". Wiped once the flow resolves and its backend write lands (see the
 *    store's finish/skip), so a restarted flow always begins from nothing.
 */

const USER_PREFERENCES_KEY = '/api/userpreferences/';

/**
 * The three guided walkthroughs, plus the one-shot feature nudges (see
 * components/onboarding/feature-nudge-constants.ts). They share one union — and one endpoint —
 * because both are "has this user been shown X" bookkeeping on the same backend dict. A nudge
 * only ever writes 'completed'; it has no skipped state.
 */
export type TrialWalkthroughFlow =
  | 'product_tour'
  | 'insights'
  | 'automate_pipeline'
  | 'reports_nudge'
  | 'alerts_nudge'
  | 'metrics_nudge';

export interface TrialWalkthroughFlowState {
  skipped: boolean;
  completed: boolean;
}

export type TrialWalkthroughState = Partial<
  Record<TrialWalkthroughFlow, TrialWalkthroughFlowState>
>;

interface UserPreferencesResponse {
  success: boolean;
  res: {
    trial_walkthrough?: TrialWalkthroughState;
  };
}

/**
 * A flow is "decided" once the user has either completed it or explicitly skipped it —
 * either outcome means stop auto-offering it. A pure function rather than a method on the
 * hook so callers can use it inside effects without a new function identity re-triggering
 * them every render.
 */
export function isFlowDecided(
  state: TrialWalkthroughState | undefined,
  flow: TrialWalkthroughFlow
): boolean {
  const flowState = state?.[flow];
  return Boolean(flowState?.completed || flowState?.skipped);
}

/** Completed only — a skipped flow is decided, but nothing was achieved by it. */
export function isFlowCompleted(
  state: TrialWalkthroughState | undefined,
  flow: TrialWalkthroughFlow
): boolean {
  return Boolean(state?.[flow]?.completed);
}

/**
 * @param enabled - pass false for non-trial users so SWR skips the request entirely.
 *   TourGate mounts app-wide and can't early-return before its hooks, so this is what
 *   keeps the fetch off every page load for the (majority) non-trial case.
 */
export function useTrialWalkthrough(enabled = true) {
  const { data, error, isLoading, mutate } = useSWR<UserPreferencesResponse>(
    enabled ? USER_PREFERENCES_KEY : null,
    apiGet
  );

  return {
    // Deliberately not defaulted to {} — a fresh object literal each render would be an
    // unstable effect dependency. isFlowDecided() handles undefined.
    walkthroughState: data?.res?.trial_walkthrough,
    isLoading,
    error,
    mutate,
  };
}

/**
 * Records a flow's final state. Never throws — this is onboarding bookkeeping and must not
 * break the click that triggered it — but DOES report whether the write landed, because the
 * caller drops its local scratch state on success and keeps it as the fallback on failure
 * (see the store's finish/skip).
 *
 * Skipped and completed are mutually exclusive; the backend clears the other flag, so
 * completing a previously-skipped flow correctly un-skips it.
 */
export async function saveTrialWalkthroughFlow(
  flow: TrialWalkthroughFlow,
  outcome: 'skipped' | 'completed'
): Promise<boolean> {
  try {
    await apiPut('/api/userpreferences/trial-walkthrough', {
      flow,
      [outcome]: true,
    });
    // The checklist ticks read this cache, so refresh it rather than waiting for the next
    // mount — a tick should appear the moment its write lands.
    void globalMutate(USER_PREFERENCES_KEY);
    return true;
  } catch (error) {
    console.error(`Failed to persist trial walkthrough state for "${flow}":`, error);
    return false;
  }
}
