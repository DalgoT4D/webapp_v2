import useSWR from 'swr';
import { apiGet, apiPost } from '@/lib/api';

export const ORG_PLAN_KEY = '/api/orgpreferences/org-plan';

export interface OrgPlan {
  org: {
    name: string;
    slug: string;
  };
  base_plan: string;
  superset_included: boolean;
  subscription_duration: string | null;
  features: Record<string, string[]> | null;
  start_date: string | null;
  end_date: string | null;
  can_upgrade_plan: boolean;
  /** True once anyone in the org has requested a subscription — the request is once-per-org. */
  upgrade_requested: boolean;
}

interface OrgPlanResponse {
  success: boolean;
  res: OrgPlan;
}

export interface UpgradeRequestResponse {
  success: boolean;
  /** True when the org had already requested — no second email was sent. */
  already_requested: boolean;
}

/**
 * The org's current plan, including whether a subscription has already been requested.
 *
 * `enabled` exists because the two consumers differ: the Billing page always wants it, while
 * the header's trial pill only wants it for free-trial orgs — passing false keeps the SWR key
 * null so no request is made at all for everyone else.
 *
 * The backend 400s when the org has no OrgPlans row, which is a legitimate state for older
 * orgs. Callers should treat an error as "unknown plan" and degrade, not as a failure to show.
 */
export function useOrgPlan(enabled: boolean = true) {
  const { data, error, isLoading, mutate } = useSWR<OrgPlanResponse>(
    enabled ? ORG_PLAN_KEY : null,
    apiGet
  );

  return {
    orgPlan: data?.res,
    isLoading,
    error,
    mutate,
  };
}

/**
 * Register a subscription/upgrade request for the current org and notify the biz-dev team.
 *
 * Once-per-org on the backend: a repeat call is a no-op that resolves with
 * `already_requested: true` rather than throwing, so callers can show the same success state
 * either way. Callers must revalidate ORG_PLAN_KEY afterwards to pick up `upgrade_requested`.
 */
export async function requestPlanUpgrade(): Promise<UpgradeRequestResponse> {
  return apiPost(`${ORG_PLAN_KEY}/upgrade`, {});
}
