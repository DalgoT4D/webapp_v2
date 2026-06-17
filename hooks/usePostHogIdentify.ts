import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { identifyUser, identifyOrg, resetAnalytics } from '@/lib/analytics';

// Bridges auth state to PostHog: identify the person (by user_id) + organization
// group on login, reset on logout. Mounted once in client-layout.tsx.
export function usePostHogIdentify(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const getCurrentOrgUser = useAuthStore((s) => s.getCurrentOrgUser);
  // Dedup on user_id AND org slug: a user's role is org-specific, so switching
  // org (same user_id) must re-run identifyUser to refresh the registered role
  // super-property. Keying on user_id alone would leave the previous org's role.
  const identifiedRef = useRef<{ userId: number; orgSlug: string | null } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      if (identifiedRef.current) {
        resetAnalytics();
        identifiedRef.current = null;
      }
      return;
    }

    // getCurrentOrgUser() resolves the user via the selected org. Before an org
    // is selected it returns null, so the user stays anonymous until an org is
    // chosen. With person_profiles:'identified_only' that window produces no
    // person profile — expected, not a bug.
    const orgUser = getCurrentOrgUser();
    const orgSlug = currentOrg?.slug ?? null;
    if (
      orgUser?.user_id &&
      (identifiedRef.current?.userId !== orgUser.user_id ||
        identifiedRef.current?.orgSlug !== orgSlug)
    ) {
      identifyUser(orgUser.user_id, orgUser.email, {
        role: orgUser.new_role_slug,
        workDomain: orgUser.work_domain,
      });
      identifiedRef.current = { userId: orgUser.user_id, orgSlug };
    }
    if (currentOrg?.slug) {
      identifyOrg(currentOrg.slug, {
        name: currentOrg.name,
        plan: orgUser?.subscription_plan ?? null,
        onboardedDate: currentOrg.created_at ?? null,
      });
    }
  }, [isAuthenticated, currentOrg?.slug, getCurrentOrgUser]);
}
