import { test } from '@playwright/test';
import { loginWithCredentials } from './fixtures/auth-real';

test.describe('Manual Chart Testing', () => {
  test('Login and allow manual chart creation', async ({ page }) => {
    // Set a very long timeout for manual interaction
    test.setTimeout(30 * 60 * 1000); // 30 minutes

    console.log('Starting manual chart testing...');

    // Login with real credentials
    await loginWithCredentials(page, 'adp1@gmail.com', 'password');

    console.log('✅ Login successful!');
    console.log('Current URL:', page.url());

    // Navigate to charts page
    await page.goto('http://localhost:3001/charts');
    await page.waitForLoadState('networkidle');

    console.log('✅ Navigated to charts page');

    // Take screenshot
    await page.screenshot({ path: 'test-results/charts-page-manual.png' });

    console.log('\n===========================================');
    console.log('MANUAL INTERACTION TIME!');
    console.log('===========================================');
    console.log('The browser will stay open for you to:');
    console.log('');
    console.log('1. Investigate the charts page error');
    console.log('2. Check browser console for errors (F12)');
    console.log('3. Try clicking around the UI');
    console.log('4. Check network tab for API responses');
    console.log('');
    console.log('You can also try:');
    console.log('- Navigate to other pages (Data, Settings, etc)');
    console.log('- Check if other features work');
    console.log('');
    console.log('Press Resume in Playwright Inspector when done');
    console.log('===========================================\n');

    // This will pause the test and keep the browser open
    await page.pause();

    console.log('Test resumed - taking final screenshot...');

    // Take final screenshot
    await page.screenshot({ path: 'test-results/charts-page-final.png' });

    console.log('Manual testing complete!');
  });
});
