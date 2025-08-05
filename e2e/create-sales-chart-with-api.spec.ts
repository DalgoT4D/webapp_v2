import { test, expect } from '@playwright/test';

test.describe('Create Sales Bar Chart with API Calls', () => {
  test('Create bar chart from analytics.sales with proper API calls', async ({ page }) => {
    test.setTimeout(3 * 60 * 1000); // 3 minutes

    console.log('Starting sales chart creation test with API monitoring...');

    // Monitor API calls
    const apiCalls: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/warehouse/') || url.includes('/api/charts/')) {
        console.log(`📡 API Call: ${request.method()} ${url}`);
        apiCalls.push(`${request.method()} ${url}`);
      }
    });

    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/warehouse/') || url.includes('/api/charts/')) {
        console.log(`✅ API Response: ${response.status()} ${url}`);
      }
    });

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

    // Wait for charts list API call
    await page.waitForResponse(
      (response) => response.url().includes('/api/charts/') && response.status() === 200,
      { timeout: 10000 }
    );
    console.log('✅ Charts list loaded');

    // Click Create Chart button
    await page.click('button:has-text("Create Chart")');
    await page.waitForURL('**/charts/new');
    console.log('✅ On create chart page');

    // Fill chart name
    await page.fill('input[placeholder="Enter chart name"]', 'Sales by Category - API Test');
    console.log('✅ Filled chart name');

    // Select Bar Chart type
    const barChartOption = page.locator('[data-chart-type="bar"]');
    await barChartOption.click();
    console.log('✅ Selected bar chart type');

    // Click Next to go to data source
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(500);
    console.log('✅ Moved to data source selection');

    // Wait for schemas API call
    const schemasResponse = await page.waitForResponse(
      (response) => response.url().includes('/api/warehouse/schemas') && response.status() === 200,
      { timeout: 15000 }
    );
    console.log('✅ Schemas API called and responded');

    const schemasData = await schemasResponse.json();
    console.log(`📊 Found ${schemasData.length} schemas:`, schemasData);

    // Click on schema dropdown
    const schemaDropdown = page.locator('button:has-text("Select a schema")').first();
    await schemaDropdown.click();
    await page.waitForTimeout(500);

    // Select analytics schema
    const analyticsOption = page.locator('div[role="option"]:has-text("analytics")').first();
    await analyticsOption.click();
    console.log('✅ Selected analytics schema');

    // Wait for tables API call
    const tablesResponse = await page.waitForResponse(
      (response) =>
        response.url().includes('/api/warehouse/tables/analytics') && response.status() === 200,
      { timeout: 15000 }
    );
    console.log('✅ Tables API called for analytics schema');

    const tablesData = await tablesResponse.json();
    console.log(
      `📊 Found ${tablesData.length} tables in analytics schema:`,
      tablesData.map((t: any) => t.table_name)
    );

    // Click on table dropdown
    const tableDropdown = page.locator('button:has-text("Select a table")').first();
    await tableDropdown.click();
    await page.waitForTimeout(500);

    // Select sales table
    const salesOption = page.locator('div[role="option"]:has-text("sales")').first();
    await salesOption.click();
    console.log('✅ Selected sales table');

    // Wait for columns API call
    const columnsResponse = await page.waitForResponse(
      (response) =>
        response.url().includes('/api/warehouse/table_columns/analytics/sales') &&
        response.status() === 200,
      { timeout: 15000 }
    );
    console.log('✅ Columns API called for analytics.sales');

    const columnsData = await columnsResponse.json();
    console.log(
      `📊 Found ${columnsData.length} columns:`,
      columnsData.map((c: any) => c.column_name)
    );

    // Select computation type (aggregated)
    const aggregatedRadio = page.locator('input[value="aggregated"]');
    await aggregatedRadio.click();
    console.log('✅ Selected aggregated data type');

    // Configure aggregation
    // Select dimension column (category)
    const dimensionDropdown = page
      .locator(
        'label:has-text("Dimension Column") + select, label:has-text("Dimension Column") ~ div button'
      )
      .first();
    await dimensionDropdown.click();
    await page.waitForTimeout(500);

    const categoryDimension = page.locator('div[role="option"]:has-text("category")').first();
    await categoryDimension.click();
    console.log('✅ Selected category as dimension column');

    // Select aggregate column (amount)
    const aggregateDropdown = page
      .locator(
        'label:has-text("Aggregate Column") + select, label:has-text("Aggregate Column") ~ div button'
      )
      .first();
    await aggregateDropdown.click();
    await page.waitForTimeout(500);

    const amountAggregate = page.locator('div[role="option"]:has-text("amount")').first();
    await amountAggregate.click();
    console.log('✅ Selected amount as aggregate column');

    // Select aggregate function (SUM)
    const functionDropdown = page
      .locator(
        'label:has-text("Aggregate Function") + select, label:has-text("Aggregate Function") ~ div button'
      )
      .first();
    await functionDropdown.click();
    await page.waitForTimeout(500);

    const sumFunction = page.locator('div[role="option"]:has-text("SUM")').first();
    await sumFunction.click();
    console.log('✅ Selected SUM as aggregate function');

    // Click Next to preview
    const nextButton = page.locator('button:has-text("Next")').last();
    await nextButton.click();
    await page.waitForTimeout(1000);
    console.log('✅ Moved to preview step');

    // Wait for chart data preview API call
    const chartPreviewResponse = await page.waitForResponse(
      (response) =>
        response.url().includes('/api/charts/chart-data-preview/') && response.status() === 200,
      { timeout: 15000 }
    );
    console.log('✅ Chart data preview API called');

    const previewData = await chartPreviewResponse.json();
    console.log(`📊 Preview data loaded with ${previewData.data?.length || 0} rows`);

    // Wait for chart to render
    await page.waitForSelector('canvas', { timeout: 15000 });
    console.log('✅ Chart preview rendered');

    // Take screenshot of preview
    await page.screenshot({ path: 'test-results/sales-chart-api-preview.png' });

    // Create the chart
    const createButton = page.locator('button:has-text("Create Chart")').last();
    await createButton.click();
    console.log('✅ Clicked Create Chart button');

    // Wait for chart creation API call
    const createResponse = await page.waitForResponse(
      (response) =>
        response.url().includes('/api/charts/') &&
        response.request().method() === 'POST' &&
        response.status() === 201,
      { timeout: 15000 }
    );
    console.log('✅ Chart created via API');

    const createdChart = await createResponse.json();
    console.log(`📊 Created chart with ID: ${createdChart.id}`);

    // Wait for redirect
    await page.waitForURL((url) => url.pathname.includes(`/charts/${createdChart.id}`), {
      timeout: 10000,
    });
    console.log('✅ Redirected to chart detail page');

    // Take final screenshot
    await page.screenshot({ path: 'test-results/sales-chart-api-created.png' });

    // Navigate to charts list
    await page.goto('http://localhost:3001/charts');
    await page.waitForLoadState('networkidle');

    // Verify chart appears in list
    const chartInList = page.locator(`text="Sales by Category - API Test"`).first();
    await expect(chartInList).toBeVisible({ timeout: 5000 });
    console.log('✅ Chart appears in charts list');

    // Take final screenshot
    await page.screenshot({ path: 'test-results/charts-list-api-final.png' });

    console.log('\n=== API Call Summary ===');
    console.log('Total API calls made:', apiCalls.length);
    apiCalls.forEach((call) => console.log(`  - ${call}`));

    console.log('\n=== Test Complete ===');
    console.log('Successfully created a bar chart with proper API integration!');
  });
});
