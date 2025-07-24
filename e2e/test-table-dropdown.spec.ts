import { test, expect } from '@playwright/test';

test.describe('Table Dropdown Test', () => {
  test('Verify table dropdown shows tables after schema selection', async ({ page }) => {
    test.setTimeout(60000); // 1 minute

    console.log('Starting table dropdown test...');

    // Navigate to login page
    await page.goto('http://localhost:3001/login');

    // Login
    await page.fill('input[placeholder="eg. user@domain.com"]', 'adp1@gmail.com');
    await page.fill('input[placeholder="Enter your password"]', 'password');
    await page.click('button:has-text("Sign In")');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
    console.log('✅ Login successful');

    // Navigate to create chart page
    await page.goto('http://localhost:3001/charts/new');
    await page.waitForLoadState('networkidle');
    console.log('✅ On create chart page');

    // Wait for schemas to load
    await page.waitForResponse(
      (response) => response.url().includes('/api/warehouse/schemas') && response.status() === 200,
      { timeout: 10000 }
    );
    console.log('✅ Schemas loaded');

    // Click schema dropdown
    const schemaSelect = page
      .locator('div:has(label:has-text("Schema")) button[role="combobox"]')
      .first();
    await schemaSelect.click();
    console.log('✅ Clicked schema dropdown');

    // Take screenshot of schema dropdown
    await page.screenshot({ path: 'test-results/schema-dropdown.png' });

    // Select analytics schema
    await page.click('div[role="option"]:has-text("analytics")');
    console.log('✅ Selected analytics schema');

    // Wait for tables API to be called
    const tablesResponse = await page.waitForResponse(
      (response) =>
        response.url().includes('/api/warehouse/tables/analytics') && response.status() === 200,
      { timeout: 10000 }
    );
    const tablesData = await tablesResponse.json();
    console.log('✅ Tables API called, returned:', tablesData);

    // Wait a bit for dropdown to update
    await page.waitForTimeout(1000);

    // Click table dropdown
    const tableSelect = page
      .locator('div:has(label:has-text("Table")) button[role="combobox"]')
      .first();
    await tableSelect.click();
    console.log('✅ Clicked table dropdown');

    // Take screenshot of table dropdown
    await page.screenshot({ path: 'test-results/table-dropdown.png' });

    // Check if sales table is visible
    const salesOption = page.locator('div[role="option"]:has-text("sales")');
    await expect(salesOption).toBeVisible({ timeout: 5000 });
    console.log('✅ Sales table is visible in dropdown');

    // Click sales table
    await salesOption.click();
    console.log('✅ Selected sales table');

    // Wait for columns API to be called
    const columnsResponse = await page.waitForResponse(
      (response) =>
        response.url().includes('/api/warehouse/table_columns/analytics/sales') &&
        response.status() === 200,
      { timeout: 10000 }
    );
    const columnsData = await columnsResponse.json();
    console.log('✅ Columns API called, returned', columnsData.length, 'columns');

    // Wait for data type radio buttons to appear
    await expect(page.locator('label:has-text("Data Type")')).toBeVisible({ timeout: 5000 });
    console.log('✅ Data type options appeared');

    // Select aggregated data
    await page.click('label[for="aggregated"]');
    console.log('✅ Selected aggregated data type');

    // Check if dimension dropdown is visible
    const dimensionLabel = page.locator('label:has-text("Dimension Column")');
    await expect(dimensionLabel).toBeVisible({ timeout: 5000 });
    console.log('✅ Dimension column dropdown is visible');

    // Click dimension dropdown
    const dimensionSelect = page
      .locator('div:has(label:has-text("Dimension Column")) button[role="combobox"]')
      .first();
    await dimensionSelect.click();
    console.log('✅ Clicked dimension dropdown');

    // Take screenshot of column dropdown
    await page.screenshot({ path: 'test-results/column-dropdown.png' });

    // Check if category column is visible
    const categoryOption = page.locator('div[role="option"]:has-text("category")');
    await expect(categoryOption).toBeVisible({ timeout: 5000 });
    console.log('✅ Category column is visible in dropdown');

    // Take final screenshot
    await page.screenshot({ path: 'test-results/table-selection-complete.png' });

    console.log('\n=== Test Summary ===');
    console.log('✅ Schema dropdown works');
    console.log('✅ Table dropdown shows tables after schema selection');
    console.log('✅ Column dropdowns appear after table selection');
    console.log('✅ All dropdowns are functional');
  });
});
