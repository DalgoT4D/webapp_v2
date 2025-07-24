import { Page } from '@playwright/test';

export async function setupAuthentication(page: Page) {
  // Navigate to the app first to ensure the domain is loaded
  await page.goto('http://localhost:3001');

  // Set authentication data in localStorage
  await page.evaluate(() => {
    // Set auth token
    localStorage.setItem('auth-token', 'test-jwt-token');

    // Set auth store (Zustand persist)
    const authStore = {
      state: {
        token: 'test-jwt-token',
        user: {
          id: 1,
          email: 'test@dalgo.org',
          name: 'Test User',
          org_id: 1,
        },
        isAuthenticated: true,
        isInitialized: true,
      },
      version: 0,
    };
    localStorage.setItem('auth-store', JSON.stringify(authStore));

    // Set organization store
    const orgStore = {
      state: {
        selectedOrg: {
          id: 1,
          name: 'Test Organization',
        },
        organizations: [
          {
            id: 1,
            name: 'Test Organization',
          },
        ],
        currentOrg: {
          id: 1,
          name: 'Test Organization',
        },
      },
      version: 0,
    };
    localStorage.setItem('org-store', JSON.stringify(orgStore));
  });

  // Set auth headers for API requests
  await page.setExtraHTTPHeaders({
    Authorization: 'Bearer test-jwt-token',
    'x-dalgo-org': '1',
  });

  // Mock the auth/me endpoint
  await page.route('**/api/auth/me', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 1,
        email: 'test@dalgo.org',
        name: 'Test User',
        org_id: 1,
      }),
    });
  });

  // Mock the organizations endpoint
  await page.route('**/api/organizations/', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 1,
          name: 'Test Organization',
        },
      ]),
    });
  });
}
