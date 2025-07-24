import { test, expect } from '@playwright/test';

test.describe('Chart Creation E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authentication token
    await page.addInitScript(() => {
      localStorage.setItem('dalgo-token', 'test-token');
      localStorage.setItem('selectedOrg', '1');
    });

    // Navigate to charts page
    await page.goto('/charts');
  });

  test('should create a bar chart with sales data', async ({ page }) => {
    // Click on Create Chart button
    await page.getByRole('button', { name: /create chart/i }).click();

    // Wait for the chart creation form
    await expect(page.getByRole('heading', { name: /create new chart/i })).toBeVisible();

    // Fill in basic information
    await page.getByLabel('Chart Title').fill('Sales by Category');
    await page
      .getByLabel('Description')
      .fill('Bar chart showing sales amounts by product category');

    // Select chart type
    await page.getByLabel('Chart Type').click();
    await page.getByRole('option', { name: 'Bar Chart' }).click();

    // Select computation type
    await page.getByLabel('Computation Type').click();
    await page.getByRole('option', { name: 'Aggregated' }).click();

    // Configure data source
    await page.getByText('Data Configuration').click();

    // Select schema
    await page.getByLabel('Schema').click();
    await page.getByRole('option', { name: 'analytics' }).click();

    // Select table
    await page.getByLabel('Table').click();
    await page.getByRole('option', { name: 'sales' }).click();

    // Wait for columns to load
    await page.waitForTimeout(1000);

    // Configure aggregation
    await page.getByLabel('Dimension Column').click();
    await page.getByRole('option', { name: 'category' }).click();

    await page.getByLabel('Aggregate Column').click();
    await page.getByRole('option', { name: 'amount' }).click();

    await page.getByLabel('Aggregate Function').click();
    await page.getByRole('option', { name: 'SUM' }).click();

    // Preview the chart
    await page.getByRole('button', { name: /preview chart/i }).click();

    // Wait for chart preview to load
    await expect(page.getByTestId('chart-preview')).toBeVisible({ timeout: 10000 });

    // Verify chart is rendered
    const chartCanvas = page.locator('canvas');
    await expect(chartCanvas).toBeVisible();

    // Save the chart
    await page.getByRole('button', { name: /save chart/i }).click();

    // Wait for success message
    await expect(page.getByText(/chart created successfully/i)).toBeVisible();

    // Verify redirect to charts list
    await expect(page).toHaveURL('/charts');

    // Verify the new chart appears in the list
    await expect(page.getByText('Sales by Category')).toBeVisible();
  });

  test('should show data preview', async ({ page }) => {
    // Navigate to create chart
    await page.getByRole('button', { name: /create chart/i }).click();

    // Select schema and table
    await page.getByText('Data Configuration').click();
    await page.getByLabel('Schema').click();
    await page.getByRole('option', { name: 'analytics' }).click();

    await page.getByLabel('Table').click();
    await page.getByRole('option', { name: 'sales' }).click();

    // Click data preview button
    await page.getByRole('button', { name: /preview data/i }).click();

    // Wait for data preview table
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });

    // Verify table has data
    const rows = page.getByRole('row');
    await expect(rows).toHaveCount({ min: 2 }); // At least header + 1 data row

    // Verify columns are shown
    await expect(page.getByRole('columnheader', { name: /product_name/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /amount/i })).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Intercept API call and return error
    await page.route('**/api/charts/chart-data/', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ detail: 'Internal server error' }),
      });
    });

    // Navigate to create chart
    await page.getByRole('button', { name: /create chart/i }).click();

    // Fill minimum required fields
    await page.getByLabel('Chart Title').fill('Test Chart');
    await page.getByLabel('Chart Type').click();
    await page.getByRole('option', { name: 'Bar Chart' }).click();

    // Try to preview
    await page.getByRole('button', { name: /preview chart/i }).click();

    // Verify error message is shown
    await expect(page.getByText(/failed to load chart data/i)).toBeVisible();
  });
});

test.describe('Chart List E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('dalgo-token', 'test-token');
      localStorage.setItem('selectedOrg', '1');
    });
  });

  test('should display list of charts', async ({ page }) => {
    await page.goto('/charts');

    // Wait for charts to load
    await expect(page.getByRole('heading', { name: /charts/i })).toBeVisible();

    // Verify create button exists
    await expect(page.getByRole('button', { name: /create chart/i })).toBeVisible();

    // Check if charts are displayed (or empty state)
    const chartsGrid = page.getByTestId('charts-grid');
    const emptyState = page.getByText(/no charts found/i);

    // Either charts or empty state should be visible
    await expect(chartsGrid.or(emptyState)).toBeVisible();
  });

  test('should toggle favorite status', async ({ page }) => {
    await page.goto('/charts');

    // Wait for any chart card
    const chartCard = page.locator('[data-testid="chart-card"]').first();
    await expect(chartCard).toBeVisible({ timeout: 10000 });

    // Click favorite button
    const favoriteButton = chartCard.getByRole('button', { name: /favorite/i });
    await favoriteButton.click();

    // Verify the favorite status changed (button should have different state)
    await expect(favoriteButton).toHaveAttribute('data-favorite', 'true');
  });
});
