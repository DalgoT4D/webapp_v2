import { test, expect } from '../fixtures/auth';
import { ApiMocks } from '../fixtures/api-mocks';
import { waitForChartToRender } from '../utils/helpers';

test.describe('Chart Detail Page', () => {
  let apiMocks: ApiMocks;

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

  test.beforeEach(async ({ authenticatedPage }) => {
    apiMocks = new ApiMocks(authenticatedPage);

    // Mock chart data
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
  });

  test('should display chart details and visualization', async ({ authenticatedPage }) => {
    // Navigate to chart detail page
    await authenticatedPage.goto('/charts/1');

    // Verify chart name is displayed
    await expect(authenticatedPage.locator('h1:has-text("Sales by Product")')).toBeVisible();

    // Wait for chart to render
    await waitForChartToRender(authenticatedPage);

    // Verify chart canvas is visible
    await expect(authenticatedPage.locator('canvas')).toBeVisible();

    // Verify edit and delete buttons are present
    await expect(authenticatedPage.locator('button:has-text("Edit Chart")')).toBeVisible();
    await expect(authenticatedPage.locator('button:has-text("Delete")')).toBeVisible();
  });

  test('should navigate to edit mode', async ({ authenticatedPage }) => {
    // Set up mocks for edit mode
    await apiMocks.mockChartCreationFlow();

    // Navigate to chart detail page
    await authenticatedPage.goto('/charts/1');

    // Click edit button
    await authenticatedPage.click('button:has-text("Edit Chart")');

    // Verify we're in edit mode
    await expect(authenticatedPage.locator('text="Edit Chart"')).toBeVisible();
    await expect(authenticatedPage.locator('input[value="Sales by Product"]')).toBeVisible();
  });

  test('should update chart', async ({ authenticatedPage }) => {
    // Set up mocks for edit mode
    await apiMocks.mockChartCreationFlow();
    await apiMocks.mockUpdateChart(1);

    // Navigate to chart detail page
    await authenticatedPage.goto('/charts/1');

    // Click edit button
    await authenticatedPage.click('button:has-text("Edit Chart")');

    // Update chart name
    await authenticatedPage.fill('input[value="Sales by Product"]', 'Updated Sales Chart');

    // Save changes
    await authenticatedPage.click('button:has-text("Update Chart")');

    // Verify success message
    await expect(authenticatedPage.locator('text="Chart updated successfully"')).toBeVisible();
  });

  test('should delete chart from detail page', async ({ authenticatedPage }) => {
    await apiMocks.mockDeleteChart(1);

    // Navigate to chart detail page
    await authenticatedPage.goto('/charts/1');

    // Click delete button
    await authenticatedPage.click('button:has-text("Delete")');

    // Confirm deletion in dialog
    await authenticatedPage.click('button:has-text("Delete"):not(:has-text("Cancel"))');

    // Should redirect to charts list
    await expect(authenticatedPage).toHaveURL('/charts');

    // Verify success message
    await expect(authenticatedPage.locator('text="Chart deleted successfully"')).toBeVisible();
  });

  test('should export chart as image', async ({ authenticatedPage }) => {
    // Navigate to chart detail page
    await authenticatedPage.goto('/charts/1');

    // Wait for chart to render
    await waitForChartToRender(authenticatedPage);

    // Set up download promise before clicking
    const downloadPromise = authenticatedPage.waitForEvent('download');

    // Click export button
    await authenticatedPage.click('button:has-text("Export")');

    // Click PNG option
    await authenticatedPage.click('text="Export as PNG"');

    // Wait for download
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toContain('Sales by Product');
    expect(download.suggestedFilename()).toContain('.png');
  });

  test('should export chart as PDF', async ({ authenticatedPage }) => {
    // Navigate to chart detail page
    await authenticatedPage.goto('/charts/1');

    // Wait for chart to render
    await waitForChartToRender(authenticatedPage);

    // Set up download promise before clicking
    const downloadPromise = authenticatedPage.waitForEvent('download');

    // Click export button
    await authenticatedPage.click('button:has-text("Export")');

    // Click PDF option
    await authenticatedPage.click('text="Export as PDF"');

    // Wait for download
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toContain('Sales by Product');
    expect(download.suggestedFilename()).toContain('.pdf');
  });

  test('should handle loading state', async ({ authenticatedPage }) => {
    // Delay chart data response
    await authenticatedPage.route('**/api/charts/chart-data/', async (route) => {
      await authenticatedPage.waitForTimeout(1000);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          chartOptions: {},
          data: [],
        }),
      });
    });

    // Navigate to chart detail page
    await authenticatedPage.goto('/charts/1');

    // Verify loading state is shown
    await expect(authenticatedPage.locator('.animate-pulse')).toBeVisible();

    // Wait for loading to complete
    await expect(authenticatedPage.locator('.animate-pulse')).not.toBeVisible();
  });

  test('should handle error state', async ({ authenticatedPage }) => {
    // Mock error response
    await authenticatedPage.route('**/api/charts/1/', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'Chart not found',
        }),
      });
    });

    // Navigate to chart detail page
    await authenticatedPage.goto('/charts/1');

    // Verify error message
    await expect(authenticatedPage.locator('text="Chart not found"')).toBeVisible();
  });

  test('should refresh chart data', async ({ authenticatedPage }) => {
    // Navigate to chart detail page
    await authenticatedPage.goto('/charts/1');

    // Wait for initial render
    await waitForChartToRender(authenticatedPage);

    // Mock updated data
    await apiMocks.mockChartData({
      chartOptions: {
        xAxis: { type: 'category', data: ['Product A', 'Product B', 'Product C', 'Product D'] },
        yAxis: { type: 'value' },
        series: [
          {
            data: [1200, 1600, 2100, 1800],
            type: 'bar',
          },
        ],
      },
      data: [
        { product: 'Product A', amount: 1200 },
        { product: 'Product B', amount: 1600 },
        { product: 'Product C', amount: 2100 },
        { product: 'Product D', amount: 1800 },
      ],
    });

    // Click refresh button
    await authenticatedPage.click('button[aria-label="Refresh chart"]');

    // Wait for chart to re-render
    await waitForChartToRender(authenticatedPage);

    // Verify success message (if shown)
    await expect(authenticatedPage.locator('text="Chart refreshed"')).toBeVisible();
  });
});
