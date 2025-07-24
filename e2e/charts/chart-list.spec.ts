import { test, expect } from '../fixtures/auth';
import { ApiMocks } from '../fixtures/api-mocks';

test.describe('Chart List Page', () => {
  let apiMocks: ApiMocks;

  test.beforeEach(async ({ authenticatedPage }) => {
    apiMocks = new ApiMocks(authenticatedPage);
  });

  test('should display empty state when no charts exist', async ({ authenticatedPage }) => {
    // Mock empty charts list
    await apiMocks.mockChartsList([]);

    // Navigate to charts page
    await authenticatedPage.goto('/charts');

    // Verify empty state
    await expect(authenticatedPage.locator('text="No charts found"')).toBeVisible();
    await expect(
      authenticatedPage.locator('text="Create your first chart to get started"')
    ).toBeVisible();
    await expect(authenticatedPage.locator('button:has-text("Create Chart")')).toBeVisible();
  });

  test('should display list of charts', async ({ authenticatedPage }) => {
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
    await authenticatedPage.goto('/charts');

    // Verify charts are displayed
    await expect(authenticatedPage.locator('text="Sales by Product"')).toBeVisible();
    await expect(authenticatedPage.locator('text="Revenue Trend"')).toBeVisible();

    // Verify chart types are shown
    await expect(authenticatedPage.locator('text="bar"')).toBeVisible();
    await expect(authenticatedPage.locator('text="line"')).toBeVisible();
  });

  test('should navigate to create chart page', async ({ authenticatedPage }) => {
    await apiMocks.mockChartsList([]);

    // Navigate to charts page
    await authenticatedPage.goto('/charts');

    // Click create chart button
    await authenticatedPage.click('button:has-text("Create Chart")');

    // Verify navigation
    await expect(authenticatedPage).toHaveURL('/charts/new');
  });

  test('should navigate to chart detail page', async ({ authenticatedPage }) => {
    // Mock charts list
    const mockChart = {
      id: 1,
      name: 'Sales by Product',
      type: 'bar' as const,
      config: {},
      query: 'SELECT * FROM sales',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };
    await apiMocks.mockChartsList([mockChart]);
    await apiMocks.mockChart(mockChart);

    // Navigate to charts page
    await authenticatedPage.goto('/charts');

    // Click on chart name
    await authenticatedPage.click('text="Sales by Product"');

    // Verify navigation
    await expect(authenticatedPage).toHaveURL('/charts/1');
  });

  test('should delete a chart', async ({ authenticatedPage }) => {
    // Mock initial chart
    const mockChart = {
      id: 1,
      name: 'Sales by Product',
      type: 'bar' as const,
      config: {},
      query: 'SELECT * FROM sales',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };
    await apiMocks.mockChartsList([mockChart]);
    await apiMocks.mockDeleteChart(1);

    // Navigate to charts page
    await authenticatedPage.goto('/charts');

    // Ensure chart is visible
    await expect(authenticatedPage.locator('text="Sales by Product"')).toBeVisible();

    // Open dropdown menu for the chart
    await authenticatedPage.click('button[aria-label="More options"]');

    // Mock empty list after deletion
    await apiMocks.mockChartsList([]);

    // Click delete
    await authenticatedPage.click('text="Delete"');

    // Confirm deletion in dialog
    await authenticatedPage.click('button:has-text("Delete"):not([aria-label])');

    // Verify chart is removed
    await expect(authenticatedPage.locator('text="Sales by Product"')).not.toBeVisible();
    await expect(authenticatedPage.locator('text="No charts found"')).toBeVisible();
  });

  test('should show loading state while fetching charts', async ({ authenticatedPage }) => {
    // Delay the response to see loading state
    await authenticatedPage.route('**/api/charts/', async (route) => {
      await authenticatedPage.waitForTimeout(1000);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Navigate to charts page
    await authenticatedPage.goto('/charts');

    // Verify loading state is shown
    await expect(authenticatedPage.locator('.animate-pulse')).toBeVisible();

    // Wait for loading to complete
    await expect(authenticatedPage.locator('.animate-pulse')).not.toBeVisible();
  });
});
