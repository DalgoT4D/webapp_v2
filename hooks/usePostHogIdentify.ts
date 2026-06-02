import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { identifyUser, identifyOrg, resetAnalytics } from '@/lib/analytics';

// Bridges auth state to PostHog: identify the person + organization group on
// login, reset on logout. Idempotent per-email so it does not re-identify on
// every render. Mounted once in client-layout.tsx.
export function usePostHogIdentify(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const getCurrentOrgUser = useAuthStore((s) => s.getCurrentOrgUser);
  const identifiedEmail = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      if (identifiedEmail.current) {
        resetAnalytics();
        identifiedEmail.current = null;
      }
      return;
    }

    // getCurrentOrgUser() resolves the user via the selected org. Before an org
    // is selected (e.g. first login, pre-org-pick), it returns null, so the user
    // stays anonymous until an org is chosen. With person_profiles:'identified_only'
    // that pre-selection window produces no person profile — expected, not a bug.
    const orgUser = getCurrentOrgUser();
    if (orgUser?.email && identifiedEmail.current !== orgUser.email) {
      identifyUser(orgUser.email, { role: orgUser.new_role_slug });
      identifiedEmail.current = orgUser.email;
    }
    if (currentOrg?.slug) {
      identifyOrg(currentOrg.slug, currentOrg.name);
    }
    // currentOrg?.slug triggers re-grouping on org switch.
  }, [isAuthenticated, currentOrg?.slug, getCurrentOrgUser]);
}
