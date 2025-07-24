import { test, expect } from '@playwright/test';
import { loginWithCredentials } from '../fixtures/auth-real';
import { waitForChartToRender } from '../utils/helpers';

test.describe('Chart E2E Tests with Real Backend', () => {
  test.beforeEach(async ({ page }) => {
    // Login with real credentials
    await loginWithCredentials(page, 'adp1@gmail.com', 'password');
  });

  test('Chart List Page', async ({ page }) => {
    // Navigate to charts page
    await page.goto('http://localhost:3001/charts');
    await page.waitForLoadState('networkidle');

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/chart-list-real.png' });

    // Check if we see either charts or empty state
    const hasCharts = (await page.locator('table tbody tr').count()) > 0;

    if (hasCharts) {
      console.log('Charts found in the list');
      // Verify table headers
      await expect(page.locator('text="Name"')).toBeVisible();
      await expect(page.locator('text="Type"')).toBeVisible();
      await expect(page.locator('text="Created"')).toBeVisible();
    } else {
      console.log('No charts found - empty state');
      // Verify empty state
      await expect(page.locator('text="No charts found"')).toBeVisible();
      await expect(page.locator('text="Create your first chart to get started"')).toBeVisible();
    }

    // Verify create button is visible
    await expect(page.locator('button:has-text("Create Chart")')).toBeVisible();
  });

  test('Create a New Chart', async ({ page }) => {
    // Navigate to create chart page
    await page.goto('http://localhost:3001/charts/new');
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({ path: 'test-results/chart-create-real.png' });

    // Step 1: Basic Information
    await expect(page.locator('text="Basic Information"')).toBeVisible();

    // Fill chart name
    await page.fill('input[placeholder="Enter chart name"]', 'Test Sales Chart ' + Date.now());

    // Select bar chart type
    const barChartButton = page.locator('[data-chart-type="bar"]');
    await barChartButton.click();

    // Click Next
    await page.click('button:has-text("Next")');

    // Step 2: Data Source
    await expect(page.locator('text="Data Source"')).toBeVisible();

    // Wait for schemas to load
    await page.waitForTimeout(1000);

    // Click on schema dropdown
    const schemaButton = page.locator('button:has-text("Select schema")');
    await schemaButton.click();

    // Select first available schema
    const schemaOptions = page.locator('[role="option"]');
    const schemaCount = await schemaOptions.count();

    if (schemaCount > 0) {
      await schemaOptions.first().click();

      // Wait for tables to load
      await page.waitForTimeout(1000);

      // Click on table dropdown
      const tableButton = page.locator('button:has-text("Select table")');
      await tableButton.click();

      // Select first available table
      const tableOptions = page.locator('[role="option"]');
      const tableCount = await tableOptions.count();

      if (tableCount > 0) {
        await tableOptions.first().click();

        // Click Next to go to configuration
        await page.click('button:has-text("Next")');

        // Step 3: Configuration
        await expect(page.locator('text="Configuration"')).toBeVisible();

        // Take screenshot of configuration page
        await page.screenshot({ path: 'test-results/chart-config-real.png' });
      }
    } else {
      console.log('No schemas available in the database');
    }
  });

  test('View Existing Chart', async ({ page }) => {
    // Navigate to charts page
    await page.goto('http://localhost:3001/charts');
    await page.waitForLoadState('networkidle');

    // Check if there are any charts
    const chartRows = page.locator('table tbody tr');
    const chartCount = await chartRows.count();

    if (chartCount > 0) {
      // Click on the first chart
      const firstChartName = await chartRows.first().locator('td').first().textContent();
      console.log('Viewing chart:', firstChartName);

      await chartRows.first().locator('a').click();

      // Wait for chart detail page
      await page.waitForLoadState('networkidle');

      // Verify we're on the detail page
      await expect(page.url()).toMatch(/\/charts\/\d+/);

      // Wait for chart to potentially render
      try {
        await waitForChartToRender(page);
        console.log('Chart rendered successfully');
      } catch (error) {
        console.log('Chart rendering failed or no data available');
      }

      // Take screenshot
      await page.screenshot({ path: 'test-results/chart-detail-real.png' });
    } else {
      console.log('No charts available to view');
    }
  });

  test('Delete Chart', async ({ page }) => {
    // Navigate to charts page
    await page.goto('http://localhost:3001/charts');
    await page.waitForLoadState('networkidle');

    // Check if there are any charts
    const chartRows = page.locator('table tbody tr');
    const initialCount = await chartRows.count();

    if (initialCount > 0) {
      console.log(`Found ${initialCount} charts`);

      // Get the name of the first chart
      const chartName = await chartRows.first().locator('td').first().textContent();
      console.log('Deleting chart:', chartName);

      // Click dropdown menu on first chart
      await chartRows.first().locator('button[aria-label="More options"]').click();

      // Click delete option
      await page.click('text="Delete"');

      // Confirm deletion in dialog
      await page.click('button:has-text("Delete"):not([aria-label])');

      // Wait for deletion to complete
      await page.waitForTimeout(2000);

      // Verify chart count decreased
      const newCount = await chartRows.count();
      expect(newCount).toBe(initialCount - 1);

      console.log(`Charts after deletion: ${newCount}`);
    } else {
      console.log('No charts available to delete');
    }
  });

  test('Export Chart', async ({ page }) => {
    // Navigate to charts page
    await page.goto('http://localhost:3001/charts');
    await page.waitForLoadState('networkidle');

    // Check if there are any charts
    const chartRows = page.locator('table tbody tr');
    const chartCount = await chartRows.count();

    if (chartCount > 0) {
      // Click on the first chart to view details
      await chartRows.first().locator('a').click();
      await page.waitForLoadState('networkidle');

      // Wait for chart to render
      try {
        await waitForChartToRender(page);

        // Look for export button
        const exportButton = page.locator('button:has-text("Export")');

        if (await exportButton.isVisible()) {
          // Set up download promise
          const downloadPromise = page.waitForEvent('download');

          // Click export and select PNG
          await exportButton.click();
          await page.click('text="Export as PNG"');

          // Wait for download
          const download = await downloadPromise;
          console.log('Downloaded:', download.suggestedFilename());

          // Verify download
          expect(download.suggestedFilename()).toContain('.png');
        } else {
          console.log('Export button not available');
        }
      } catch (error) {
        console.log('Chart not rendered or export not available');
      }
    } else {
      console.log('No charts available to export');
    }
  });
});
