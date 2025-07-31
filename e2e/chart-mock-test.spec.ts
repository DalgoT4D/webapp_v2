import { test, expect } from '@playwright/test';
import { setupAuthentication } from './fixtures/auth-bypass';
import { ApiMocks } from './fixtures/api-mocks';

test.describe('Chart Feature with Mocked Data', () => {
  test('Complete chart workflow with mocked backend', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000); // 5 minutes

    const apiMocks = new ApiMocks(page);

    console.log('Setting up authentication...');
    await setupAuthentication(page);

    console.log('Setting up API mocks...');

    // Mock empty charts list initially
    await apiMocks.mockChartsList([]);

    // Set up mocks for chart creation
    await apiMocks.mockSchemas([{ schema_name: 'public' }, { schema_name: 'analytics' }]);

    await apiMocks.mockTables('public', [
      { table_name: 'sales', table_schema: 'public' },
      { table_name: 'customers', table_schema: 'public' },
      { table_name: 'products', table_schema: 'public' },
    ]);

    await apiMocks.mockTableColumns('public', 'sales', [
      { column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
      { column_name: 'product_name', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'category', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'amount', data_type: 'numeric', is_nullable: 'NO' },
      { column_name: 'quantity', data_type: 'integer', is_nullable: 'NO' },
      { column_name: 'sale_date', data_type: 'date', is_nullable: 'NO' },
    ]);

    await apiMocks.mockTableCount('public', 'sales', 5000);

    await apiMocks.mockChartDataPreview({
      data: [
        {
          product_name: 'Laptop',
          category: 'Electronics',
          amount: 1200,
          quantity: 2,
          sale_date: '2024-01-15',
        },
        {
          product_name: 'Mouse',
          category: 'Electronics',
          amount: 25,
          quantity: 5,
          sale_date: '2024-01-16',
        },
        {
          product_name: 'Desk',
          category: 'Furniture',
          amount: 350,
          quantity: 1,
          sale_date: '2024-01-17',
        },
        {
          product_name: 'Chair',
          category: 'Furniture',
          amount: 150,
          quantity: 2,
          sale_date: '2024-01-18',
        },
        {
          product_name: 'Monitor',
          category: 'Electronics',
          amount: 400,
          quantity: 3,
          sale_date: '2024-01-19',
        },
      ],
      total: 5000,
      page: 1,
      limit: 5,
    });

    await apiMocks.mockChartData({
      chartOptions: {
        title: { text: 'Sales by Category' },
        xAxis: { type: 'category', data: ['Electronics', 'Furniture'] },
        yAxis: { type: 'value', name: 'Total Amount' },
        series: [
          {
            name: 'Sales',
            type: 'bar',
            data: [1625, 500],
          },
        ],
      },
      data: [
        { category: 'Electronics', total_amount: 1625 },
        { category: 'Furniture', total_amount: 500 },
      ],
    });

    await apiMocks.mockCreateChart();

    // Navigate to charts page
    await page.goto('http://localhost:3001/charts');
    await page.waitForLoadState('networkidle');
    console.log('✅ On charts page');

    // Verify empty state
    await expect(page.locator('text="No charts found"')).toBeVisible();
    console.log('✅ Empty state displayed');

    // Click create chart
    await page.click('button:has-text("Create Chart")');
    await page.waitForURL('**/charts/new');
    console.log('✅ Navigated to create chart page');

    // Fill chart details
    await page.fill('input[placeholder="Enter chart name"]', 'Sales by Category');
    console.log('✅ Filled chart name');

    // Select bar chart
    await page.click('[data-chart-type="bar"]');
    console.log('✅ Selected bar chart type');

    // Click Next
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(500);

    // Select schema
    await page.click('button:has-text("Select schema")');
    await page.click('text="public"');
    console.log('✅ Selected schema: public');

    // Select table
    await page.click('button:has-text("Select table")');
    await page.click('text="sales"');
    console.log('✅ Selected table: sales');

    // Wait for data preview
    await page.waitForSelector('text="Data Preview"');
    console.log('✅ Data preview loaded');

    // Click Next to configuration
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(500);

    // Configure chart
    await page.click('button:has-text("Select X-axis column")');
    await page.click('text="category"');
    console.log('✅ Selected X-axis: category');

    await page.click('button:has-text("Select Y-axis column")');
    await page.click('text="amount"');
    console.log('✅ Selected Y-axis: amount');

    // Wait for chart preview
    await page.waitForSelector('canvas', { timeout: 10000 });
    console.log('✅ Chart preview rendered');

    // Take screenshot of preview
    await page.screenshot({ path: 'test-results/chart-preview.png' });

    // Create chart
    await page.click('button:has-text("Create Chart")');
    console.log('✅ Clicked create chart');

    // Should redirect to chart detail
    await page.waitForURL('**/charts/123');
    console.log('✅ Redirected to chart detail page');

    // Mock the charts list with our new chart
    await apiMocks.mockChartsList([
      {
        id: 123,
        name: 'Sales by Category',
        type: 'bar',
        config: {},
        query: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    // Go back to charts list
    await page.goto('http://localhost:3001/charts');
    await page.waitForLoadState('networkidle');

    // Verify chart appears in list
    await expect(page.locator('text="Sales by Category"')).toBeVisible();
    console.log('✅ Chart appears in list');

    // Take final screenshot
    await page.screenshot({ path: 'test-results/charts-list-with-chart.png' });

    console.log('\n=== Mock Test Complete ===');
    console.log('Successfully demonstrated full chart creation workflow with mocked data');

    // Pause for manual inspection
    await page.pause();
  });
});
