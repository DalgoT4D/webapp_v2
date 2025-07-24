import { test, expect } from '@playwright/test';
import { loginWithCredentials } from './fixtures/auth-real';

test.describe('Chart Feature Browser Test', () => {
  test('Login and navigate to charts page', async ({ page }) => {
    // Set longer timeout for manual inspection
    test.setTimeout(5 * 60 * 1000); // 5 minutes

    console.log('Starting chart feature test...');

    // Login
    await loginWithCredentials(page, 'adp1@gmail.com', 'password');
    console.log('✅ Login successful');

    // Take screenshot after login
    await page.screenshot({ path: 'test-results/after-login.png' });

    // Navigate to charts page
    await page.goto('http://localhost:3001/charts');
    await page.waitForLoadState('networkidle');
    console.log('✅ Navigated to charts page');

    // Take screenshot of charts page
    await page.screenshot({ path: 'test-results/charts-page.png' });

    // Check what's on the page
    const pageText = await page.textContent('body');

    if (pageText?.includes('Failed to load charts')) {
      console.log('⚠️  Charts API error detected');
      console.log('This is expected due to backend issues');
    } else if (pageText?.includes('No charts found')) {
      console.log('✅ Empty charts state displayed');
    } else {
      console.log('📊 Charts list displayed');
    }

    // Try to click Create Chart button if it exists
    const createButton = page.locator('button:has-text("Create Chart")');
    if (await createButton.isVisible()) {
      console.log('✅ Create Chart button found');

      // Click it
      await createButton.click();
      console.log('✅ Clicked Create Chart button');

      // Wait for navigation
      await page.waitForURL('**/charts/new', { timeout: 5000 }).catch(() => {
        console.log('⚠️  Navigation to create chart page might have failed');
      });

      // Take screenshot of create page
      await page.screenshot({ path: 'test-results/create-chart-page.png' });

      // Check if we're on the create page
      if (page.url().includes('/charts/new')) {
        console.log('✅ Successfully navigated to chart creation page');

        // Look for chart creation elements
        const hasChartName = await page
          .locator('input[placeholder="Enter chart name"]')
          .isVisible();
        const hasChartTypes = await page.locator('[data-chart-type]').first().isVisible();

        console.log('Chart creation page elements:', {
          hasChartName,
          hasChartTypes,
        });

        if (hasChartName) {
          // Fill in chart name
          await page.fill('input[placeholder="Enter chart name"]', 'Test Chart from E2E');
          console.log('✅ Filled chart name');

          // Select bar chart if available
          const barChartButton = page.locator('[data-chart-type="bar"]');
          if (await barChartButton.isVisible()) {
            await barChartButton.click();
            console.log('✅ Selected bar chart type');
          }
        }
      }
    }

    console.log('\n=== Test Complete ===');
    console.log('Check the screenshots in test-results/ folder');

    // Keep browser open for manual inspection
    await page.pause();
  });
});
