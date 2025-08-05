import { test } from '@playwright/test';

test.describe('Manual Chart Creation Test', () => {
  test('Open chart creation page for manual testing', async ({ page }) => {
    test.setTimeout(10 * 60 * 1000); // 10 minutes for manual testing

    console.log('Starting manual chart creation test...');

    // Login
    await page.goto('http://localhost:3001/login');
    await page.fill('input[placeholder="eg. user@domain.com"]', 'adp1@gmail.com');
    await page.fill('input[placeholder="Enter your password"]', 'password');
    await page.click('button:has-text("Sign In")');
    await page.waitForURL((url) => !url.pathname.includes('/login'));
    console.log('✅ Logged in');

    // Go to chart creation page
    await page.goto('http://localhost:3001/charts/new');
    console.log('✅ On chart creation page');

    // Wait for the page to load
    await page.waitForTimeout(2000);

    console.log('\n========================================');
    console.log('MANUAL TESTING TIME!');
    console.log('========================================');
    console.log('Please test the following:');
    console.log('1. Click on Schema dropdown and select "analytics"');
    console.log('2. Check if Table dropdown becomes enabled');
    console.log('3. Click on Table dropdown and verify tables are shown');
    console.log('4. Select "sales" table');
    console.log('5. Check if Data Type radio buttons appear');
    console.log('');
    console.log('Check browser console (F12) for any errors');
    console.log('========================================\n');

    // Pause for manual testing
    await page.pause();

    console.log('Manual testing completed!');
  });
});
