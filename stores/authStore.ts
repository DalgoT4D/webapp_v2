import { createAppStore } from '@/lib/zustand';
import { mutate } from 'swr';

export interface Org {
  slug: string;
  name: string;
  viz_url: string;
}

export interface Permission {
  slug: string;
  name: string;
}

export interface OrgUser {
  email: string;
  org: Org;
  active: boolean;
  new_role_slug: string;
  permissions: Permission[];
  landing_dashboard_id?: number | null; // Personal landing page dashboard ID
  org_default_dashboard_id?: number | null; // Organization default dashboard ID
}

interface AuthState {
  // State
  selectedOrgSlug: string | null;
  currentOrg: Org | null;
  orgUsers: OrgUser[];
  isAuthenticated: boolean;
  isOrgSwitching: boolean;

  // Actions
  setAuthenticated: (authenticated: boolean) => void;
  setOrgUsers: (orgUsers: OrgUser[]) => void;
  setSelectedOrg: (orgSlug: string) => void;
  setOrgSwitching: (switching: boolean) => void;
  logout: () => void;
  initialize: () => void;
  checkAuthentication: () => Promise<boolean>;
  getCurrentOrgUser: () => OrgUser | null;
  refreshOrganizations: () => Promise<void>;
}

export const useAuthStore = createAppStore<AuthState>(
  (set, get) => ({
    // Initial state
    selectedOrgSlug: null,
    currentOrg: null,
    orgUsers: [],
    isAuthenticated: false,
    isOrgSwitching: false,

    // Actions
    setAuthenticated: (authenticated: boolean) => {
      set({ isAuthenticated: authenticated });
    },

    setOrgUsers: (orgUsers: OrgUser[]) => {
      const { selectedOrgSlug } = get();
      set({ orgUsers });

      // If we have a selectedOrgSlug from localStorage but no currentOrg set,
      // find and set the currentOrg from the loaded orgUsers
      if (selectedOrgSlug && orgUsers.length > 0) {
        const orgUser = orgUsers.find((ou) => ou.org.slug === selectedOrgSlug);
        if (orgUser) {
          set({ currentOrg: orgUser.org });
        }
      }
    },

    setSelectedOrg: (orgSlug: string) => {
      const { orgUsers } = get();
      const orgUser = orgUsers.find((ou) => ou.org.slug === orgSlug);

      if (orgUser) {
        localStorage.setItem('selectedOrg', orgSlug);
        set({
          selectedOrgSlug: orgSlug,
          currentOrg: orgUser.org,
        });
      }
    },

    setOrgSwitching: (switching: boolean) => {
      set({ isOrgSwitching: switching });
    },

    logout: () => {
      localStorage.clear();
      sessionStorage.clear();

      // Clear all SWR cache to prevent stale data from previous user
      // This clears ALL cached data globally
      mutate(
        () => true, // Match all keys
        undefined, // Set to undefined to clear
        { revalidate: false } // Don't revalidate (we're logging out)
      );

      set({
        selectedOrgSlug: null,
        currentOrg: null,
        orgUsers: [],
        isAuthenticated: false,
        isOrgSwitching: false,
      });

      // Note: iframe logout is handled automatically by SharedIframe component
      // monitoring the auth state change
    },

    initialize: () => {
      if (typeof window !== 'undefined') {
        const selectedOrgSlug = localStorage.getItem('selectedOrg');

        set({
          selectedOrgSlug,
          isAuthenticated: false, // Will be determined by SWR API calls
        });
      }
    },

    // Helper to check if user is authenticated based on successful API call
    checkAuthentication: async () => {
      try {
        // This will be called by SWR when it successfully fetches user data
        set({ isAuthenticated: true });
        return true;
      } catch {
        set({ isAuthenticated: false });
        return false;
      }
    },

    getCurrentOrgUser: () => {
      const { orgUsers, selectedOrgSlug } = get();
      return orgUsers.find((ou) => ou.org.slug === selectedOrgSlug) || null;
    },

    refreshOrganizations: async () => {
      // Revalidate the current user data which includes all organizations
      await mutate('/api/currentuserv2');
    },
  }),
  {
    name: 'auth-store',
    persist: false, // We handle persistence manually for better control
    devtools: true,
  }
);
