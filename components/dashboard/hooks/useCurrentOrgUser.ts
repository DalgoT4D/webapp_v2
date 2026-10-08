import useSWR from 'swr';
import { apiGet } from '@/lib/api';
import { useAuthStore, type OrgUser } from '@/stores/authStore';

/** Fresh user data (landing-page ids change while the app is open). */
export const CURRENT_USER_KEY = '/api/currentuserv2';

/**
 * The signed-in org user for dashboard screens: the fresh `/api/currentuserv2` row for the
 * selected org, falling back to the auth store. Public mode has no user and makes no request.
 */
export function useCurrentOrgUser(isPublicMode = false): OrgUser | null {
  const getCurrentOrgUser = useAuthStore((state) => state.getCurrentOrgUser);
  const authCurrentUser = isPublicMode ? null : getCurrentOrgUser();

  const { data: orgUsersData } = useSWR<OrgUser[]>(
    !isPublicMode ? CURRENT_USER_KEY : null,
    apiGet,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  const selectedOrgSlug = useAuthStore((state) => state.selectedOrgSlug);
  if (isPublicMode) return null;
  return orgUsersData?.find((ou) => ou.org.slug === selectedOrgSlug) || authCurrentUser;
}
