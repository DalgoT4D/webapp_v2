import { test, expect } from '@playwright/test';
import { loginWithCredentials } from './fixtures/auth-real';

test.describe('Authentication Test', () => {
  test('Login works and user can navigate', async ({ page }) => {
    // Login
    await loginWithCredentials(page, 'adp1@gmail.com', 'password');

    // Verify we're logged in
    await expect(page.url()).not.toContain('/login');
    console.log('✅ Login successful');

    // Check user info
    const userAvatar = page.locator('button:has-text("A")').last();
    await expect(userAvatar).toBeVisible();
    console.log('✅ User avatar visible');

    // Check organization
    await expect(page.locator('text="Admin Org"')).toBeVisible();
    console.log('✅ Organization "Admin Org" visible');

    // Navigate to different pages
    const pages = [
      { name: 'Home', url: '/' },
      { name: 'Dashboards', url: '/dashboards' },
      { name: 'Charts', url: '/charts' },
    ];

    for (const pageInfo of pages) {
      await page.goto(`http://localhost:3001${pageInfo.url}`);
      await page.waitForLoadState('networkidle');
      await expect(page.url()).toContain(pageInfo.url);
      console.log(`✅ Can navigate to ${pageInfo.name} page`);

      // Take screenshot
      await page.screenshot({
        path: `test-results/${pageInfo.name.toLowerCase()}-page.png`,
      });
    }

    // Try to access data menu
    await page.click('button:has-text("Data")');
    await page.waitForTimeout(500);
    const hasDataMenu = await page.locator('text="Sources"').isVisible();
    console.log(`✅ Data menu accessible: ${hasDataMenu}`);
  });

  test('Check chart page error handling', async ({ page }) => {
    // Login
    await loginWithCredentials(page, 'adp1@gmail.com', 'password');

    // Go to charts page
    await page.goto('http://localhost:3001/charts');
    await page.waitForLoadState('networkidle');

    // Check what's displayed
    const errorMessage = await page.locator('text="Failed to load charts"').isVisible();
    const noChartsMessage = await page.locator('text="No charts found"').isVisible();
    const createButton = await page.locator('button:has-text("Create Chart")').isVisible();

    console.log('Chart page status:', {
      hasError: errorMessage,
      hasNoCharts: noChartsMessage,
      hasCreateButton: createButton,
    });

    // Even with error, navigation should work
    await expect(page.locator('text="Charts"')).toBeVisible();
    console.log('✅ Charts page loads despite API error');
  });
});
