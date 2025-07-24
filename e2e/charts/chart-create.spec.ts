import { test, expect } from '../fixtures/auth';
import { ApiMocks } from '../fixtures/api-mocks';
import { fillChartForm, waitForChartToRender } from '../utils/helpers';

test.describe('Chart Creation', () => {
  let apiMocks: ApiMocks;

  test.beforeEach(async ({ authenticatedPage }) => {
    apiMocks = new ApiMocks(authenticatedPage);

    // Set up all necessary mocks for chart creation
    await apiMocks.mockChartCreationFlow();
  });

  test('should create a bar chart', async ({ authenticatedPage }) => {
    // Navigate to create chart page
    await authenticatedPage.goto('/charts/new');

    // Fill the chart form
    await fillChartForm(authenticatedPage, {
      name: 'Product Sales Chart',
      type: 'bar',
      schema: 'public',
      table: 'sales',
      xAxis: 'product',
      yAxis: 'amount',
    });

    // Wait for preview to render
    await waitForChartToRender(authenticatedPage);

    // Verify preview is shown
    await expect(authenticatedPage.locator('canvas')).toBeVisible();

    // Click create button
    await authenticatedPage.click('button:has-text("Create Chart")');

    // Verify navigation to chart detail page
    await expect(authenticatedPage).toHaveURL(/\/charts\/\d+/);

    // Verify success message
    await expect(authenticatedPage.locator('text="Chart created successfully"')).toBeVisible();
  });

  test('should create a line chart', async ({ authenticatedPage }) => {
    // Navigate to create chart page
    await authenticatedPage.goto('/charts/new');

    // Fill the chart form
    await fillChartForm(authenticatedPage, {
      name: 'Revenue Trend',
      type: 'line',
      schema: 'public',
      table: 'sales',
      xAxis: 'date',
      yAxis: 'amount',
    });

    // Wait for preview to render
    await waitForChartToRender(authenticatedPage);

    // Verify preview is shown
    await expect(authenticatedPage.locator('canvas')).toBeVisible();

    // Click create button
    await authenticatedPage.click('button:has-text("Create Chart")');

    // Verify success
    await expect(authenticatedPage).toHaveURL(/\/charts\/\d+/);
    await expect(authenticatedPage.locator('text="Chart created successfully"')).toBeVisible();
  });

  test('should create a pie chart', async ({ authenticatedPage }) => {
    // Navigate to create chart page
    await authenticatedPage.goto('/charts/new');

    // Fill the chart form
    await fillChartForm(authenticatedPage, {
      name: 'Sales Distribution',
      type: 'pie',
      schema: 'public',
      table: 'sales',
      dimension: 'product',
      measure: 'amount',
    });

    // Wait for preview to render
    await waitForChartToRender(authenticatedPage);

    // Verify preview is shown
    await expect(authenticatedPage.locator('canvas')).toBeVisible();

    // Click create button
    await authenticatedPage.click('button:has-text("Create Chart")');

    // Verify success
    await expect(authenticatedPage).toHaveURL(/\/charts\/\d+/);
    await expect(authenticatedPage.locator('text="Chart created successfully"')).toBeVisible();
  });

  test('should validate required fields', async ({ authenticatedPage }) => {
    // Navigate to create chart page
    await authenticatedPage.goto('/charts/new');

    // Try to proceed without filling name
    await authenticatedPage.click('button:has-text("Next")');

    // Should show validation error
    await expect(authenticatedPage.locator('text="Chart name is required"')).toBeVisible();

    // Fill name and select chart type
    await authenticatedPage.fill('input[placeholder="Enter chart name"]', 'Test Chart');
    await authenticatedPage.click('button[data-chart-type="bar"]');

    // Go to next step
    await authenticatedPage.click('button:has-text("Next")');

    // Try to proceed without selecting schema/table
    await authenticatedPage.click('button:has-text("Next")');

    // Should not proceed
    await expect(authenticatedPage.locator('text="Select schema"')).toBeVisible();
  });

  test('should show data preview', async ({ authenticatedPage }) => {
    // Navigate to create chart page
    await authenticatedPage.goto('/charts/new');

    // Fill basic info
    await authenticatedPage.fill('input[placeholder="Enter chart name"]', 'Test Chart');
    await authenticatedPage.click('button[data-chart-type="bar"]');
    await authenticatedPage.click('button:has-text("Next")');

    // Select schema and table
    await authenticatedPage.click('button[role="combobox"]:has-text("Select schema")');
    await authenticatedPage.click('[role="option"]:has-text("public")');

    await authenticatedPage.click('button[role="combobox"]:has-text("Select table")');
    await authenticatedPage.click('[role="option"]:has-text("sales")');

    // Wait for data preview to load
    await authenticatedPage.waitForSelector('text="Data Preview"');

    // Verify preview data is shown
    await expect(authenticatedPage.locator('text="Product A"')).toBeVisible();
    await expect(authenticatedPage.locator('text="Product B"')).toBeVisible();
    await expect(authenticatedPage.locator('text="Product C"')).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ authenticatedPage }) => {
    // Override create chart mock to return error
    await authenticatedPage.route('**/api/charts/', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            detail: 'Invalid chart configuration',
          }),
        });
      } else {
        route.continue();
      }
    });

    // Navigate to create chart page
    await authenticatedPage.goto('/charts/new');

    // Fill the chart form
    await fillChartForm(authenticatedPage, {
      name: 'Test Chart',
      type: 'bar',
      schema: 'public',
      table: 'sales',
      xAxis: 'product',
      yAxis: 'amount',
    });

    // Try to create chart
    await authenticatedPage.click('button:has-text("Create Chart")');

    // Verify error message is shown
    await expect(authenticatedPage.locator('text="Invalid chart configuration"')).toBeVisible();
  });

  test('should navigate through wizard steps', async ({ authenticatedPage }) => {
    // Navigate to create chart page
    await authenticatedPage.goto('/charts/new');

    // Step 1: Basic Info
    await expect(authenticatedPage.locator('text="Basic Information"')).toBeVisible();
    await authenticatedPage.fill('input[placeholder="Enter chart name"]', 'Test Chart');
    await authenticatedPage.click('button[data-chart-type="bar"]');
    await authenticatedPage.click('button:has-text("Next")');

    // Step 2: Data Source
    await expect(authenticatedPage.locator('text="Data Source"')).toBeVisible();
    await authenticatedPage.click('button[role="combobox"]:has-text("Select schema")');
    await authenticatedPage.click('[role="option"]:has-text("public")');
    await authenticatedPage.click('button[role="combobox"]:has-text("Select table")');
    await authenticatedPage.click('[role="option"]:has-text("sales")');

    // Go back
    await authenticatedPage.click('button:has-text("Previous")');
    await expect(authenticatedPage.locator('text="Basic Information"')).toBeVisible();

    // Go forward again
    await authenticatedPage.click('button:has-text("Next")');
    await expect(authenticatedPage.locator('text="Data Source"')).toBeVisible();

    // Continue to configuration
    await authenticatedPage.click('button:has-text("Next")');
    await expect(authenticatedPage.locator('text="Configuration"')).toBeVisible();
  });
});
