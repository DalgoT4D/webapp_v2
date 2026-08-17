/**
 * Walkthrough storage is scoped to the selected org's OrgUser (see walkthrough-scope.ts), so
 * every test that touches it has to put a user+org on authStore first. Two distinct users and
 * two distinct orgs are exported so isolation tests can assert across both axes.
 */
import { useAuthStore, type OrgUser } from '@/stores/authStore';

export const USER_A = 1;
export const USER_B = 2;
export const ORG_A = 'org-a';
export const ORG_B = 'org-b';

function orgUser(userId: number, slug: string): OrgUser {
  return { user_id: userId, org: { slug } } as OrgUser;
}

/** Point the walkthrough's storage scope at one user+org pair. */
export function setWalkthroughScope(userId: number, orgSlug: string): void {
  useAuthStore.setState({
    orgUsers: [orgUser(userId, orgSlug)],
    selectedOrgSlug: orgSlug,
  });
}

export function clearWalkthroughScope(): void {
  useAuthStore.setState({ orgUsers: [], selectedOrgSlug: null });
}
