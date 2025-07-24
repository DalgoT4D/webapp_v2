import { test, expect } from '@playwright/test';
import { loginWithCredentials } from './fixtures/auth-real';

test.describe('Manual Chart Creation', () => {
  test('Login and create chart manually', async ({ page }) => {
    // Set a very long timeout for manual interaction
    test.setTimeout(10 * 60 * 1000); // 10 minutes

    console.log('Starting manual chart creation test...');

    // Login with real credentials
    await loginWithCredentials(page, 'adp1@gmail.com', 'password');

    console.log('Login successful!');
    console.log('Current URL:', page.url());

    // Navigate to charts page
    await page.goto('http://localhost:3001/charts');
    await page.waitForLoadState('networkidle');

    console.log('Navigated to charts page');

    // Take initial screenshot
    await page.screenshot({ path: 'test-results/charts-page-initial.png' });

    // Pause for manual interaction
    console.log('\n===========================================');
    console.log('MANUAL INTERACTION TIME!');
    console.log('===========================================');
    console.log('The browser will stay open for you to:');
    console.log('1. Click "Create Chart" button');
    console.log('2. Fill in the chart creation form');
    console.log('3. Create at least one chart');
    console.log('4. Press any key in the terminal when done');
    console.log('===========================================\n');

    // This will pause the test and keep the browser open
    await page.pause();

    // After manual interaction, verify we have charts
    await page.goto('http://localhost:3001/charts');
    await page.waitForLoadState('networkidle');

    // Take screenshot after chart creation
    await page.screenshot({ path: 'test-results/charts-page-after-creation.png' });

    // Check if charts exist now
    const hasCharts = (await page.locator('table tbody tr').count()) > 0;
    console.log('Charts found after manual creation:', hasCharts);

    if (hasCharts) {
      const chartCount = await page.locator('table tbody tr').count();
      console.log(`Successfully created ${chartCount} chart(s)!`);

      // Get chart names
      const chartNames = await page.locator('table tbody tr td:first-child').allTextContents();
      console.log('Chart names:', chartNames);
    }
  });
});
