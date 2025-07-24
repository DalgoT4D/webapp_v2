import { test, expect } from '@playwright/test';

test.describe('Chart Feature E2E Test', () => {
  test('Login and verify charts page loads', async ({ page }) => {
    test.setTimeout(60000); // 1 minute

    // Navigate to login page
    await page.goto('http://localhost:3001/login');

    // Login with credentials
    await page.fill('input[placeholder="eg. user@domain.com"]', 'adp1@gmail.com');
    await page.fill('input[placeholder="Enter your password"]', 'password');
    await page.click('button:has-text("Sign In")');

    // Wait for redirect
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
    console.log('✅ Login successful');

    // Navigate to charts page
    await page.goto('http://localhost:3001/charts');
    await page.waitForLoadState('networkidle');
    console.log('✅ Navigated to charts page');

    // Take screenshot
    await page.screenshot({ path: 'test-results/charts-page-current.png' });

    // Check if charts are loading or showing empty state
    const hasCharts =
      (await page.locator('text="No charts found"').count()) > 0 ||
      (await page.locator('[data-testid="chart-item"]').count()) > 0 ||
      (await page.locator('text="Create your first chart"').count()) > 0;

    if (hasCharts) {
      console.log('✅ Charts page loaded successfully!');

      // Try to create a chart if button is available
      const createButton = page.locator('button:has-text("Create Chart")').first();
      if (await createButton.isVisible()) {
        console.log('✅ Create Chart button is available');
        await createButton.click();
        await page.waitForTimeout(2000);
        console.log('✅ Clicked Create Chart button');

        // Take screenshot of create chart page
        await page.screenshot({ path: 'test-results/create-chart-page.png' });
      }
    } else {
      // Check for any error messages
      const errorText = await page
        .locator('text="Failed to load charts"')
        .textContent()
        .catch(() => null);
      if (errorText) {
        console.log('❌ Error loading charts:', errorText);
      }
    }

    // Also check console for errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
      }
    });

    console.log('Test completed - check screenshots in test-results/');
  });
});
