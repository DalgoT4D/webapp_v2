import { test, expect } from '@playwright/test';
import { ApiMocks } from '../fixtures/api-mocks';

test.describe('Chart Basic Tests (No Auth)', () => {
  test('should test chart list page with direct mocking', async ({ page }) => {
    const apiMocks = new ApiMocks(page);

    // Mock authentication check to always return authenticated
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

    // Mock organization data
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

    // Mock empty charts list
    await apiMocks.mockChartsList([]);

    // Navigate to charts page with auth token in header
    await page.setExtraHTTPHeaders({
      Authorization: 'Bearer test-token',
      'x-dalgo-org': '1',
    });

    await page.goto('http://localhost:3001/charts');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if we're on the charts page or redirected to login
    const url = page.url();
    console.log('Current URL:', url);

    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/chart-test-debug.png' });

    // Try to find any content on the page
    const pageContent = await page.textContent('body');
    console.log('Page content preview:', pageContent?.substring(0, 200));
  });

  test('should test chart creation flow with mocked backend', async ({ page }) => {
    const apiMocks = new ApiMocks(page);

    // Set up all mocks
    await apiMocks.mockChartCreationFlow();

    // Mock auth endpoints
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

    // Set auth headers
    await page.setExtraHTTPHeaders({
      Authorization: 'Bearer test-token',
      'x-dalgo-org': '1',
    });

    // Navigate directly to chart creation page
    await page.goto('http://localhost:3001/charts/new');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Take a screenshot
    await page.screenshot({ path: 'test-results/chart-create-debug.png' });

    // Log current URL
    console.log('Chart create page URL:', page.url());
  });
});
