import { test, expect } from '@playwright/test';

test.describe('Create Sales Bar Chart', () => {
  test('Create bar chart from analytics.sales data', async ({ page }) => {
    test.setTimeout(2 * 60 * 1000); // 2 minutes

    console.log('Starting sales chart creation test...');

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

    // Click Create Chart button
    await page.click('button:has-text("Create Chart")');
    await page.waitForURL('**/charts/new');
    console.log('✅ On create chart page');

    // Fill chart name
    await page.fill('input[placeholder="Enter chart name"]', 'Sales by Category');
    console.log('✅ Filled chart name');

    // Select Bar Chart type
    const barChartOption = page.locator('[data-chart-type="bar"]');
    await barChartOption.click();
    console.log('✅ Selected bar chart type');

    // Click Next to go to data source
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1000);
    console.log('✅ Moved to data source selection');

    // Select analytics schema
    const schemaDropdown = page.locator('button:has-text("Select a schema")').first();
    await schemaDropdown.click();
    await page.waitForTimeout(500);

    const analyticsOption = page.locator('div[role="option"]:has-text("analytics")');
    await analyticsOption.click();
    console.log('✅ Selected analytics schema');

    // Wait for tables to load
    await page.waitForTimeout(1000);

    // Select sales table
    const tableDropdown = page.locator('button:has-text("Select a table")').first();
    await tableDropdown.click();
    await page.waitForTimeout(500);

    const salesOption = page.locator('div[role="option"]:has-text("sales")');
    await salesOption.click();
    console.log('✅ Selected sales table');

    // Wait for data preview to load
    await page.waitForSelector('text="Data Preview"', { timeout: 10000 });
    console.log('✅ Data preview loaded');

    // Take screenshot of data preview
    await page.screenshot({ path: 'test-results/sales-data-preview.png' });

    // Click Next to go to chart configuration
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1000);
    console.log('✅ Moved to chart configuration');

    // Configure X-axis - select category
    const xAxisDropdown = page.locator('button:has-text("Select X-axis column")').first();
    await xAxisDropdown.click();
    await page.waitForTimeout(500);

    const categoryOption = page.locator('div[role="option"]:has-text("category")').first();
    await categoryOption.click();
    console.log('✅ Selected category for X-axis');

    // Configure Y-axis - select amount
    const yAxisDropdown = page.locator('button:has-text("Select Y-axis column")').first();
    await yAxisDropdown.click();
    await page.waitForTimeout(500);

    const amountOption = page.locator('div[role="option"]:has-text("amount")').first();
    await amountOption.click();
    console.log('✅ Selected amount for Y-axis');

    // Select aggregation function (SUM)
    const aggregationDropdown = page.locator('button:has-text("Select aggregation")').first();
    if (await aggregationDropdown.isVisible()) {
      await aggregationDropdown.click();
      await page.waitForTimeout(500);

      const sumOption = page.locator('div[role="option"]:has-text("SUM")').first();
      await sumOption.click();
      console.log('✅ Selected SUM aggregation');
    }

    // Wait for chart preview to render
    await page.waitForSelector('canvas', { timeout: 15000 });
    console.log('✅ Chart preview rendered');

    // Take screenshot of chart preview
    await page.screenshot({ path: 'test-results/sales-chart-preview.png' });

    // Create the chart
    const createButton = page.locator('button:has-text("Create Chart")').last();
    await createButton.click();
    console.log('✅ Clicked Create Chart button');

    // Wait for redirect to chart detail page or charts list
    await page.waitForURL(
      (url) => url.pathname.includes('/charts') && !url.pathname.includes('/new'),
      { timeout: 10000 }
    );
    console.log('✅ Chart created successfully!');

    // Take final screenshot
    await page.screenshot({ path: 'test-results/sales-chart-created.png' });

    // If we're on the chart detail page, verify the chart is displayed
    const chartCanvas = page.locator('canvas').first();
    if (await chartCanvas.isVisible()) {
      console.log('✅ Chart is displayed on detail page');
    }

    // Navigate back to charts list to verify it appears
    await page.goto('http://localhost:3001/charts');
    await page.waitForLoadState('networkidle');

    // Check if our chart appears in the list
    const chartInList = page.locator('text="Sales by Category"').first();
    if (await chartInList.isVisible()) {
      console.log('✅ Chart appears in charts list');
    }

    // Take final screenshot of charts list
    await page.screenshot({ path: 'test-results/charts-list-final.png' });

    console.log('\n=== Sales Chart Creation Complete ===');
    console.log('Successfully created a bar chart from analytics.sales data!');
    console.log('\nScreenshots saved:');
    console.log('- test-results/sales-data-preview.png');
    console.log('- test-results/sales-chart-preview.png');
    console.log('- test-results/sales-chart-created.png');
    console.log('- test-results/charts-list-final.png');
  });
});
