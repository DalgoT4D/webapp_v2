import { test as base, Page } from '@playwright/test';

// Define the authentication state type
export interface AuthState {
  token: string;
  user: {
    id: number;
    email: string;
    name: string;
    org_id: number;
  };
  selectedOrg: {
    id: number;
    name: string;
  };
}

// Extend the base test to include authentication
export const test = base.extend<{
  authenticatedPage: Page;
  authState: AuthState;
}>({
  authState: async ({}, use) => {
    // Default test user state
    const state: AuthState = {
      token: 'test-jwt-token',
      user: {
        id: 1,
        email: 'test@dalgo.org',
        name: 'Test User',
        org_id: 1,
      },
      selectedOrg: {
        id: 1,
        name: 'Test Organization',
      },
    };
    await use(state);
  },

  authenticatedPage: async ({ page, authState, baseURL }, use) => {
    // First navigate to the app to ensure localStorage is available
    await page.goto(baseURL || 'http://localhost:3001');

    // Set authentication in localStorage
    await page.evaluate((authState) => {
      // Set auth token
      localStorage.setItem('auth-token', authState.token);

      // Set user data in Zustand store format
      const authStore = {
        state: {
          token: authState.token,
          user: authState.user,
          isAuthenticated: true,
        },
        version: 0,
      };
      localStorage.setItem('auth-store', JSON.stringify(authStore));

      // Set organization data
      const orgStore = {
        state: {
          selectedOrg: authState.selectedOrg,
          organizations: [authState.selectedOrg],
        },
        version: 0,
      };
      localStorage.setItem('org-store', JSON.stringify(orgStore));
    }, authState);

    // Also set the auth header for API requests
    await page.setExtraHTTPHeaders({
      Authorization: `Bearer ${authState.token}`,
      'x-dalgo-org': authState.selectedOrg.id.toString(),
    });

    await use(page);
  },
});

export { expect } from '@playwright/test';
