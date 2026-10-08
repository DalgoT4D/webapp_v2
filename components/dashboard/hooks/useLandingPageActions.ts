import { useCallback } from 'react';
import { mutate as swrMutate } from 'swr';
import { useLandingPage } from '@/hooks/api/useLandingPage';
import { CURRENT_USER_KEY } from './useCurrentOrgUser';

/**
 * "Set as my landing page" / "Remove as my landing page" / "Set as org default", used by the
 * dashboard list row menu and the dashboard view header. useLandingPage already revalidates
 * the current user; the second revalidation here is kept as both callers did it.
 */
export function useLandingPageActions(onLandingChanged?: () => void) {
  const { setPersonalLanding, removePersonalLanding, setOrgDefault, isLoading } = useLandingPage();

  const setMyLanding = useCallback(
    async (dashboardId: number) => {
      await setPersonalLanding(dashboardId);
      await swrMutate(CURRENT_USER_KEY);
      onLandingChanged?.();
    },
    [setPersonalLanding, onLandingChanged]
  );

  const removeMyLanding = useCallback(async () => {
    await removePersonalLanding();
    await swrMutate(CURRENT_USER_KEY);
    onLandingChanged?.();
  }, [removePersonalLanding, onLandingChanged]);

  const makeOrgDefault = useCallback(
    async (dashboardId: number) => {
      await setOrgDefault(dashboardId);
      await swrMutate(CURRENT_USER_KEY);
      onLandingChanged?.();
    },
    [setOrgDefault, onLandingChanged]
  );

  return { setMyLanding, removeMyLanding, makeOrgDefault, isLandingPageLoading: isLoading };
}
