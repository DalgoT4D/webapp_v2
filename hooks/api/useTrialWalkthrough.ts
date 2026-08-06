import useSWR, { mutate as globalMutate } from 'swr';
import { apiGet, apiPut } from '@/lib/api';

/**
 * Backend persistence for the three trial onboarding walkthroughs.
 *
 * Division of labour (deliberate — don't merge these two sources):
 *  - BACKEND (this file) answers "has the user already decided about this flow?", so we
 *    stop offering it unprompted. Only final states: skipped or completed, per flow.
 *  - localStorage (components/onboarding/insight-walkthrough-constants.ts) answers "what
 *    has the user actually accomplished?" — per-step stage, chosen fork, and the milestone
 *    flags the Get Started checklist reads. Intentionally not persisted server-side;
 *    cross-device resume is explicitly out of scope.
 */

const USER_PREFERENCES_KEY = '/api/userpreferences/';

export type TrialWalkthroughFlow = 'product_tour' | 'insights' | 'automate_pipeline';

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
 * Records a flow's final state. Fire-and-forget by design: this is onboarding bookkeeping,
 * so a failed write must never block the click that triggered it — worst case the flow is
 * offered again on a fresh browser (localStorage still suppresses it on this one).
 *
 * Skipped and completed are mutually exclusive; the backend clears the other flag, so
 * completing a previously-skipped flow correctly un-skips it.
 */
export async function saveTrialWalkthroughFlow(
  flow: TrialWalkthroughFlow,
  outcome: 'skipped' | 'completed'
): Promise<void> {
  try {
    await apiPut('/api/userpreferences/trial-walkthrough', {
      flow,
      [outcome]: true,
    });
    // Keep the gate's cached copy honest for anything that reads it later this session
    // without a remount (e.g. navigating back to /impact right after skipping).
    void globalMutate(USER_PREFERENCES_KEY);
  } catch (error) {
    console.error(`Failed to persist trial walkthrough state for "${flow}":`, error);
  }
}
