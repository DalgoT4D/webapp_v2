/**
 * Who the walkthrough's localStorage scratch space belongs to.
 *
 * Two axes, both needed:
 *  - the ORG, because progress is per-org (a user onboarding org A hasn't onboarded org B), and
 *  - the USER, because a browser can be shared and the same person can belong to several orgs.
 *
 * The frontend never sees an OrgUser primary key, but `user_id` + `org.slug` together identify
 * exactly one OrgUser — which is the granularity the backend's `trial_walkthrough` record uses
 * (UserPreferences has a OneToOne on OrgUser). So the two agree on what "one walkthrough
 * participant" means.
 *
 * Read from authStore here rather than threaded through every call site: the milestone helpers
 * are called from a dozen unrelated components (KPI page, dashboard builder, chart configure,
 * transform publish modal), and passing an org slug down to each was both noise and a live bug
 * class — a component holding a stale slug wrote another org's progress.
 */
import { useAuthStore } from '@/stores/authStore';

export interface WalkthroughScope {
  userId: number;
  orgSlug: string;
}

/**
 * The selected org's scope, or null when there isn't one yet (pre-login, or orgs still
 * loading). Callers treat null as "nothing to record" — onboarding bookkeeping must never
 * throw into the click that triggered it.
 */
export function getWalkthroughScope(): WalkthroughScope | null {
  const { orgUsers, selectedOrgSlug } = useAuthStore.getState();
  const orgUser = orgUsers.find((ou) => ou.org.slug === selectedOrgSlug);
  if (!orgUser) return null;
  return { userId: orgUser.user_id, orgSlug: orgUser.org.slug };
}

/** The `<userId>_<orgSlug>` suffix every walkthrough storage key ends with. */
export function scopeSuffix(scope: WalkthroughScope): string {
  return `${scope.userId}_${scope.orgSlug}`;
}
