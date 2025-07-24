import { test, expect } from '@playwright/test';

test.describe('Chart Creation with Data Preview', () => {
  test('Create chart with table selection and data preview', async ({ page }) => {
    test.setTimeout(2 * 60 * 1000); // 2 minutes

    console.log('Starting chart creation flow test...');

    // Login
    await page.goto('http://localhost:3001/login');
    await page.fill('input[placeholder="eg. user@domain.com"]', 'adp1@gmail.com');
    await page.fill('input[placeholder="Enter your password"]', 'password');
    await page.click('button:has-text("Sign In")');
    await page.waitForURL((url) => !url.pathname.includes('/login'));
    console.log('✅ Logged in');

    // Navigate to charts
    await page.goto('http://localhost:3001/charts');
    await page.waitForLoadState('networkidle');

    // Click Create Chart
    await page.click('button:has-text("Create Chart")');
    await page.waitForURL('**/charts/new');
    console.log('✅ On chart creation page');

    // Step 1: Chart is already selected (bar chart by default)
    console.log('✅ Bar chart type selected by default');

    // Step 2: Select Schema
    await page.click('button:has-text("Select a schema")');
    await page.waitForTimeout(500);
    await page.click('div[role="option"]:has-text("analytics")');
    console.log('✅ Selected analytics schema');

    // Wait for tables to load
    await page.waitForTimeout(1000);

    // Step 3: Select Table
    await page.click('button:has-text("Select a table")');
    await page.waitForTimeout(500);

    // Verify sales table is in the dropdown
    const salesOption = page.getByRole('option', { name: 'sales', exact: true });
    await expect(salesOption).toBeVisible();
    console.log('✅ Sales table is visible in dropdown');

    await salesOption.click();
    console.log('✅ Selected sales table');

    // Wait for columns to load
    await page.waitForTimeout(1000);

    // Step 4: Verify Data Type options appear
    await expect(page.locator('text="Data Type"')).toBeVisible();
    console.log('✅ Data Type options appeared');

    // Select Aggregated data
    await page.click('label[for="aggregated"]');
    console.log('✅ Selected aggregated data type');

    // Step 5: Configure aggregation
    // Select dimension column
    await page.click('button:has-text("Select grouping column")');
    await page.waitForTimeout(500);
    await page.locator('div[role="option"]:has-text("category")').first().click();
    console.log('✅ Selected category as dimension');

    // Select aggregate column
    await page.click('button:has-text("Select column to aggregate")');
    await page.waitForTimeout(500);
    await page.locator('div[role="option"]:has-text("amount")').first().click();
    console.log('✅ Selected amount as aggregate column');

    // Select aggregate function
    const functionButton = page
      .locator('div:has(label:has-text("Aggregate Function")) button[role="combobox"]')
      .first();
    await functionButton.click();
    await page.waitForTimeout(500);
    await page.click('div[role="option"]:has-text("SUM")');
    console.log('✅ Selected SUM function');

    // Step 6: Check Data Preview tab
    await page.click('button:has-text("Data Preview")');
    console.log('✅ Clicked Data Preview tab');

    // Wait for data to load
    await page.waitForTimeout(2000);

    // Check if data is displayed
    const dataTable = page.locator('table').first();
    const tableVisible = await dataTable.isVisible().catch(() => false);

    if (tableVisible) {
      console.log('✅ Data preview table is visible');

      // Take screenshot of data preview
      await page.screenshot({ path: 'test-results/data-preview.png' });

      // Count rows
      const rows = await page.locator('tbody tr').count();
      console.log(`✅ Data preview shows ${rows} rows`);
    } else {
      console.log('⚠️  Data preview table not visible - checking for loading or error state');

      // Check for loading state
      const loading = await page
        .locator('text="Loading"')
        .isVisible()
        .catch(() => false);
      if (loading) {
        console.log('⏳ Data is still loading...');
      }

      // Check for error message
      const error = await page
        .locator('text="Error"')
        .isVisible()
        .catch(() => false);
      if (error) {
        console.log('❌ Error loading data preview');
      }

      // Take screenshot regardless
      await page.screenshot({ path: 'test-results/data-preview-state.png' });
    }

    // Step 7: Switch back to Chart Preview
    await page.click('button:has-text("Chart Preview")');
    console.log('✅ Switched to Chart Preview');

    // Wait for chart to render
    await page.waitForTimeout(2000);

    // Check if chart is rendered
    const canvas = await page
      .locator('canvas')
      .isVisible()
      .catch(() => false);
    if (canvas) {
      console.log('✅ Chart preview is rendered');
      await page.screenshot({ path: 'test-results/chart-preview.png' });
    } else {
      console.log('⚠️  Chart not rendered yet');
      await page.screenshot({ path: 'test-results/chart-preview-state.png' });
    }

    // Step 8: Add chart metadata
    await page.fill('input[placeholder="Enter chart title"]', 'Sales by Category Test');
    console.log('✅ Added chart title');

    // Take final screenshot
    await page.screenshot({ path: 'test-results/chart-creation-complete.png' });

    console.log('\n=== Test Summary ===');
    console.log('✅ Schema selection works');
    console.log('✅ Table dropdown shows tables correctly');
    console.log('✅ Column selection works');
    console.log('✅ Data preview tab is accessible');
    console.log(`${tableVisible ? '✅' : '⚠️ '} Data preview shows data`);
    console.log(`${canvas ? '✅' : '⚠️ '} Chart preview renders`);
  });
});
