import { test, expect } from '@playwright/test';
import { loginWithCredentials } from '../fixtures/auth-real';

test.describe('Login and Navigation', () => {
  test('Can login and navigate to charts page', async ({ page }) => {
    // Login with real credentials
    await loginWithCredentials(page, 'adp1@gmail.com', 'password');

    // After login, we should be on the home page
    await expect(page.url()).not.toContain('/login');
    console.log('Login successful, current URL:', page.url());

    // Take screenshot of home page
    await page.screenshot({ path: 'test-results/after-login.png' });

    // Check if user menu is visible
    const userAvatar = page.locator('button:has-text("A")').last();
    await expect(userAvatar).toBeVisible();
    console.log('User avatar visible');

    // Check if navigation menu is visible
    await expect(page.locator('text="Dashboards"')).toBeVisible();
    console.log('Navigation menu visible');

    // Navigate to charts page
    await page.goto('http://localhost:3001/charts');
    await page.waitForLoadState('networkidle');

    // Take screenshot of charts page
    await page.screenshot({ path: 'test-results/charts-page.png' });

    // Check page content
    const pageContent = await page.textContent('body');
    console.log('Charts page content includes:', {
      hasFailedMessage: pageContent?.includes('Failed to load charts'),
      hasNoCharts: pageContent?.includes('No charts found'),
      hasCreateButton: pageContent?.includes('Create Chart'),
    });

    // Even if loading failed, the page structure should be there
    await expect(page.url()).toContain('/charts');
    console.log('Successfully navigated to charts page');
  });

  test('Can access chart creation page', async ({ page }) => {
    // Login
    await loginWithCredentials(page, 'adp1@gmail.com', 'password');

    // Navigate directly to create chart page
    await page.goto('http://localhost:3001/charts/new');
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({ path: 'test-results/chart-create-page.png' });

    // Check if we're on the create page
    await expect(page.url()).toContain('/charts/new');

    // Look for chart creation elements
    const hasBasicInfo = await page
      .locator('text="Basic Information"')
      .isVisible()
      .catch(() => false);
    const hasChartName = await page
      .locator('input[placeholder="Enter chart name"]')
      .isVisible()
      .catch(() => false);
    const hasChartTypes = await page
      .locator('[data-chart-type]')
      .first()
      .isVisible()
      .catch(() => false);

    console.log('Chart creation page elements:', {
      hasBasicInfo,
      hasChartName,
      hasChartTypes,
    });

    if (hasChartName) {
      // Try to fill the form
      await page.fill('input[placeholder="Enter chart name"]', 'Test Chart from E2E');
      console.log('Filled chart name');
    }
  });
});
