import { test, expect } from '@playwright/test';

test.describe('Complete Chart Creation Flow', () => {
  test('Create bar chart with schema and table API calls', async ({ page }) => {
    test.setTimeout(3 * 60 * 1000); // 3 minutes

    console.log('Starting complete chart creation test...');

    // Monitor API calls
    const apiCalls: { method: string; url: string; status?: number }[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/')) {
        const call = { method: request.method(), url };
        apiCalls.push(call);
        console.log(`📡 API Request: ${call.method} ${call.url}`);
      }
    });

    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/')) {
        const callIndex = apiCalls.findIndex((c) => c.url === url && !c.status);
        if (callIndex >= 0) {
          apiCalls[callIndex].status = response.status();
          console.log(`✅ API Response: ${response.status()} ${url}`);
        }
      }
    });

    // Navigate to login page
    await page.goto('http://localhost:3001/login');

    // Login
    await page.fill('input[placeholder="eg. user@domain.com"]', 'adp1@gmail.com');
    await page.fill('input[placeholder="Enter your password"]', 'password');
    await page.click('button:has-text("Sign In")');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
    console.log('✅ Login successful');

    // Navigate to charts page
    await page.goto('http://localhost:3001/charts');
    await page.waitForLoadState('networkidle');
    console.log('✅ On charts page');

    // Click Create Chart
    await page.click('button:has-text("Create Chart")');
    await page.waitForURL('**/charts/new');
    console.log('✅ Navigated to create chart page');

    // Wait for page to load
    await page.waitForSelector('h3:has-text("1. Select Chart Type")', { timeout: 10000 });

    // Step 1: Select Chart Type (Bar is default)
    const barChartType = page.locator('[data-chart-type="bar"]');
    await expect(barChartType).toHaveAttribute('data-selected', 'true');
    console.log('✅ Bar chart type is selected by default');

    // Step 2: Configure Data Source
    console.log('\n📊 Step 2: Configure Data Source');

    // Click on schema dropdown - this should trigger the schemas API call
    const schemaSelect = page
      .locator(
        'div:has(label:has-text("Schema")) select, div:has(label:has-text("Schema")) button[role="combobox"]'
      )
      .first();
    await schemaSelect.click();
    console.log('✅ Clicked schema dropdown');

    // Wait for schemas API to be called
    await page.waitForResponse(
      (response) => response.url().includes('/api/warehouse/schemas') && response.status() === 200,
      { timeout: 15000 }
    );
    console.log('✅ Schemas API called successfully');

    // Select analytics schema
    await page.click('div[role="option"]:has-text("analytics")');
    console.log('✅ Selected analytics schema');

    // Now click on table dropdown - this should trigger the tables API call
    const tableSelect = page
      .locator(
        'div:has(label:has-text("Table")) select, div:has(label:has-text("Table")) button[role="combobox"]'
      )
      .first();
    await tableSelect.click();
    console.log('✅ Clicked table dropdown');

    // Wait for tables API to be called
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/warehouse/tables/analytics') && response.status() === 200,
      { timeout: 15000 }
    );
    console.log('✅ Tables API called successfully');

    // Select sales table
    await page.click('div[role="option"]:has-text("sales")');
    console.log('✅ Selected sales table');

    // Wait for columns API to be called
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/warehouse/table_columns/analytics/sales') &&
        response.status() === 200,
      { timeout: 15000 }
    );
    console.log('✅ Columns API called successfully');

    // Select computation type - Aggregated
    await page.click('label[for="aggregated"]');
    console.log('✅ Selected aggregated computation type');

    // Configure aggregation fields
    // Dimension column
    const dimensionSelect = page
      .locator('div:has(label:has-text("Dimension Column")) button[role="combobox"]')
      .first();
    await dimensionSelect.click();
    await page.click('div[role="option"]:has-text("category")');
    console.log('✅ Selected category as dimension');

    // Aggregate column
    const aggregateSelect = page
      .locator('div:has(label:has-text("Aggregate Column")) button[role="combobox"]')
      .first();
    await aggregateSelect.click();
    await page.click('div[role="option"]:has-text("amount")');
    console.log('✅ Selected amount as aggregate column');

    // Aggregate function
    const functionSelect = page
      .locator('div:has(label:has-text("Aggregate Function")) button[role="combobox"]')
      .first();
    await functionSelect.click();
    await page.click('div[role="option"]:has-text("SUM")');
    console.log('✅ Selected SUM as aggregate function');

    // Wait for data preview API to be called
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/charts/chart-data-preview/') && response.status() === 200,
      { timeout: 15000 }
    );
    console.log('✅ Chart data preview API called');

    // Wait for chart to render
    await page.waitForSelector('canvas', { timeout: 15000 });
    console.log('✅ Chart preview rendered');

    // Step 3: Customize Chart (skip for now)

    // Step 4: Add Details
    console.log('\n📊 Step 4: Add Details');
    const titleInput = page.locator('input[placeholder="Enter chart title"]');
    await titleInput.fill('Sales Revenue by Category');
    console.log('✅ Filled chart title');

    const descriptionInput = page.locator('textarea[placeholder="Enter chart description"]');
    await descriptionInput.fill('Total sales revenue grouped by product category');
    console.log('✅ Filled chart description');

    // Take screenshot before saving
    await page.screenshot({ path: 'test-results/chart-before-save.png' });

    // Save the chart
    const saveButton = page.locator('button:has-text("Save Chart")');
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    console.log('✅ Clicked Save Chart');

    // Wait for chart creation API
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/charts/') &&
        response.request().method() === 'POST' &&
        response.status() === 201,
      { timeout: 15000 }
    );
    console.log('✅ Chart created successfully via API');

    // Should redirect to chart detail page
    await page.waitForURL(/\/charts\/\d+/, { timeout: 10000 });
    console.log('✅ Redirected to chart detail page');

    // Take final screenshot
    await page.screenshot({ path: 'test-results/chart-detail-page.png' });

    // Navigate back to charts list
    await page.goto('http://localhost:3001/charts');
    await page.waitForLoadState('networkidle');

    // Verify chart appears
    await expect(page.locator('text="Sales Revenue by Category"')).toBeVisible();
    console.log('✅ Chart appears in charts list');

    // Take final screenshot
    await page.screenshot({ path: 'test-results/charts-list-final.png' });

    // Summary
    console.log('\n=== Test Summary ===');
    console.log('✅ All steps completed successfully');
    console.log(`📊 Total API calls: ${apiCalls.length}`);
    console.log('\nKey API calls made:');
    const keyApis = [
      '/api/warehouse/schemas',
      '/api/warehouse/tables/analytics',
      '/api/warehouse/table_columns/analytics/sales',
      '/api/charts/chart-data-preview/',
      '/api/charts/',
    ];
    keyApis.forEach((api) => {
      const calls = apiCalls.filter((c) => c.url.includes(api));
      if (calls.length > 0) {
        console.log(`  ✅ ${api} - ${calls.length} call(s)`);
      } else {
        console.log(`  ❌ ${api} - No calls made`);
      }
    });
  });
});
