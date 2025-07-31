import { createAppStore } from '@/lib/zustand';

export interface Org {
  slug: string;
  name: string;
  viz_url: string;
}

export interface OrgUser {
  email: string;
  org: Org;
  active: boolean;
  new_role_slug: string;
  permissions: string[];
}

interface AuthState {
  // State
  token: string | null;
  refreshToken: string | null;
  selectedOrgSlug: string | null;
  currentOrg: Org | null;
  orgUsers: OrgUser[];
  isAuthenticated: boolean;
  isOrgSwitching: boolean;
  isRefreshing: boolean;

  // Actions
  setTokens: (token: string, refreshToken?: string) => void;
  setToken: (token: string) => void;
  setOrgUsers: (orgUsers: OrgUser[]) => void;
  setSelectedOrg: (orgSlug: string) => void;
  setOrgSwitching: (switching: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  logout: () => void;
  initialize: () => void;
  getCurrentOrgUser: () => OrgUser | null;
}

export const useAuthStore = createAppStore<AuthState>(
  (set, get) => ({
    // Initial state
    token: null,
    refreshToken: null,
    selectedOrgSlug: null,
    currentOrg: null,
    orgUsers: [],
    isAuthenticated: false,
    isOrgSwitching: false,
    isRefreshing: false,

    // Actions
    setTokens: (token: string, refreshToken?: string) => {
      localStorage.setItem('authToken', token);
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
      set({ token, refreshToken, isAuthenticated: true });
    },

    setToken: (token: string) => {
      localStorage.setItem('authToken', token);
      const { refreshToken } = get(); // preserve existing refresh token
      set({ token, refreshToken, isAuthenticated: true });
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

    setRefreshing: (refreshing: boolean) => {
      set({ isRefreshing: refreshing });
    },

    logout: () => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('selectedOrg');
      set({
        token: null,
        refreshToken: null,
        selectedOrgSlug: null,
        currentOrg: null,
        orgUsers: [],
        isAuthenticated: false,
        isOrgSwitching: false,
        isRefreshing: false,
      });
    },

    initialize: () => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('authToken');
        const refreshToken = localStorage.getItem('refreshToken');
        const selectedOrgSlug = localStorage.getItem('selectedOrg');

        if (token) {
          set({
            token,
            refreshToken,
            selectedOrgSlug,
            isAuthenticated: true,
          });
        }
      }
    },

    getCurrentOrgUser: () => {
      const { orgUsers, selectedOrgSlug } = get();
      return orgUsers.find((ou) => ou.org.slug === selectedOrgSlug) || null;
    },
  }),
  {
    name: 'auth-store',
    persist: false, // We handle persistence manually for better control
    devtools: true,
  }
);
