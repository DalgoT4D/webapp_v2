import { test, expect } from '@playwright/test';
import { ApiMocks } from '../fixtures/api-mocks';
import { setupAuthentication } from '../fixtures/auth-bypass';
import { waitForChartToRender, fillChartForm, verifyChartInList } from '../utils/helpers';

test.describe('Chart E2E Tests', () => {
  let apiMocks: ApiMocks;

  test.beforeEach(async ({ page }) => {
    apiMocks = new ApiMocks(page);

    // Set up authentication
    await setupAuthentication(page);
  });

  test('Chart List - Empty State', async ({ page }) => {
    // Mock empty charts list
    await apiMocks.mockChartsList([]);

    // Navigate to charts page
    await page.goto('http://localhost:3001/charts');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Verify empty state
    await expect(page.locator('text="No charts found"')).toBeVisible();
    await expect(page.locator('text="Create your first chart to get started"')).toBeVisible();
    await expect(page.locator('button:has-text("Create Chart")')).toBeVisible();
  });

  test('Chart List - Display Charts', async ({ page }) => {
    // Mock charts list
    const mockCharts = [
      {
        id: 1,
        name: 'Sales by Product',
        type: 'bar' as const,
        config: {},
        query: 'SELECT * FROM sales',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 2,
        name: 'Revenue Trend',
        type: 'line' as const,
        config: {},
        query: 'SELECT * FROM revenue',
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
    ];
    await apiMocks.mockChartsList(mockCharts);

    // Navigate to charts page
    await page.goto('http://localhost:3001/charts');
    await page.waitForLoadState('networkidle');

    // Verify charts are displayed
    await expect(page.locator('text="Sales by Product"')).toBeVisible();
    await expect(page.locator('text="Revenue Trend"')).toBeVisible();
  });

  test('Create Bar Chart', async ({ page }) => {
    // Set up all mocks for chart creation
    await apiMocks.mockChartCreationFlow();

    // Navigate to create chart page
    await page.goto('http://localhost:3001/charts/new');
    await page.waitForLoadState('networkidle');

    // Fill chart name
    await page.fill('input[placeholder="Enter chart name"]', 'Product Sales Chart');

    // Select bar chart type
    await page.click('[data-chart-type="bar"]');

    // Click next
    await page.click('button:has-text("Next")');

    // Select schema
    await page.click('button:has-text("Select schema")');
    await page.click('text="public"');

    // Select table
    await page.click('button:has-text("Select table")');
    await page.click('text="sales"');

    // Wait for columns to load and click next
    await page.waitForTimeout(500);
    await page.click('button:has-text("Next")');

    // Configure chart axes
    await page.click('button:has-text("Select X-axis column")');
    await page.click('text="product"');

    await page.click('button:has-text("Select Y-axis column")');
    await page.click('text="amount"');

    // Wait for preview to render
    await waitForChartToRender(page);

    // Create chart
    await page.click('button:has-text("Create Chart")');

    // Verify success
    await expect(page).toHaveURL(/\/charts\/\d+/);
    await expect(page.locator('text="Chart created successfully"')).toBeVisible();
  });

  test('View Chart Details', async ({ page }) => {
    const mockChart = {
      id: 1,
      name: 'Sales by Product',
      type: 'bar' as const,
      config: {
        xAxis: { field: 'product' },
        yAxis: { field: 'amount' },
      },
      query: 'SELECT product, SUM(amount) as amount FROM sales GROUP BY product',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    // Mock chart endpoints
    await apiMocks.mockChart(mockChart);
    await apiMocks.mockChartData({
      chartOptions: {
        xAxis: { type: 'category', data: ['Product A', 'Product B', 'Product C'] },
        yAxis: { type: 'value' },
        series: [
          {
            data: [1000, 1500, 2000],
            type: 'bar',
          },
        ],
      },
      data: [
        { product: 'Product A', amount: 1000 },
        { product: 'Product B', amount: 1500 },
        { product: 'Product C', amount: 2000 },
      ],
    });

    // Navigate to chart detail page
    await page.goto('http://localhost:3001/charts/1');
    await page.waitForLoadState('networkidle');

    // Verify chart name
    await expect(page.locator('h1:has-text("Sales by Product")')).toBeVisible();

    // Wait for chart to render
    await waitForChartToRender(page);

    // Verify chart is rendered
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('Delete Chart', async ({ page }) => {
    const mockChart = {
      id: 1,
      name: 'Sales by Product',
      type: 'bar' as const,
      config: {},
      query: 'SELECT * FROM sales',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    // Mock initial chart list
    await apiMocks.mockChartsList([mockChart]);
    await apiMocks.mockDeleteChart(1);

    // Navigate to charts page
    await page.goto('http://localhost:3001/charts');
    await page.waitForLoadState('networkidle');

    // Verify chart exists
    await expect(page.locator('text="Sales by Product"')).toBeVisible();

    // Open dropdown menu
    await page.click('button[aria-label="More options"]');

    // Click delete
    await page.click('text="Delete"');

    // Mock empty list after deletion
    await apiMocks.mockChartsList([]);

    // Confirm deletion
    await page.click('button:has-text("Delete"):not([aria-label])');

    // Verify chart is removed
    await expect(page.locator('text="Sales by Product"')).not.toBeVisible();
    await expect(page.locator('text="No charts found"')).toBeVisible();
  });

  test('Export Chart as PNG', async ({ page }) => {
    const mockChart = {
      id: 1,
      name: 'Sales by Product',
      type: 'bar' as const,
      config: {},
      query: 'SELECT * FROM sales',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    // Mock chart endpoints
    await apiMocks.mockChart(mockChart);
    await apiMocks.mockChartData({
      chartOptions: {
        xAxis: { type: 'category', data: ['Product A', 'Product B', 'Product C'] },
        yAxis: { type: 'value' },
        series: [
          {
            data: [1000, 1500, 2000],
            type: 'bar',
          },
        ],
      },
      data: [],
    });

    // Navigate to chart detail page
    await page.goto('http://localhost:3001/charts/1');
    await page.waitForLoadState('networkidle');

    // Wait for chart to render
    await waitForChartToRender(page);

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click export button
    await page.click('button:has-text("Export")');

    // Click PNG option
    await page.click('text="Export as PNG"');

    // Wait for download
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toContain('Sales by Product');
    expect(download.suggestedFilename()).toContain('.png');
  });

  test('Chart Validation', async ({ page }) => {
    // Set up mocks
    await apiMocks.mockChartCreationFlow();

    // Navigate to create chart page
    await page.goto('http://localhost:3001/charts/new');
    await page.waitForLoadState('networkidle');

    // Try to proceed without name
    await page.click('button:has-text("Next")');

    // Should show validation error
    await expect(page.locator('text="Chart name is required"')).toBeVisible();

    // Fill name and try to proceed without selecting chart type
    await page.fill('input[placeholder="Enter chart name"]', 'Test Chart');
    await page.click('button:has-text("Next")');

    // Should still be on the same step
    await expect(page.locator('text="Select a chart type"')).toBeVisible();
  });

  test('Chart Data Preview', async ({ page }) => {
    // Set up mocks
    await apiMocks.mockChartCreationFlow();

    // Navigate to create chart page
    await page.goto('http://localhost:3001/charts/new');
    await page.waitForLoadState('networkidle');

    // Fill basic info
    await page.fill('input[placeholder="Enter chart name"]', 'Test Chart');
    await page.click('[data-chart-type="bar"]');
    await page.click('button:has-text("Next")');

    // Select schema and table
    await page.click('button:has-text("Select schema")');
    await page.click('text="public"');

    await page.click('button:has-text("Select table")');
    await page.click('text="sales"');

    // Wait for data preview
    await page.waitForSelector('text="Data Preview"');

    // Verify preview data
    await expect(page.locator('text="Product A"')).toBeVisible();
    await expect(page.locator('text="Product B"')).toBeVisible();
    await expect(page.locator('text="Product C"')).toBeVisible();
  });
});
