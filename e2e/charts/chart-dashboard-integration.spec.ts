import { test, expect } from '../fixtures/auth';
import { ApiMocks } from '../fixtures/api-mocks';

test.describe('Chart Dashboard Integration', () => {
  let apiMocks: ApiMocks;

  test.beforeEach(async ({ authenticatedPage }) => {
    apiMocks = new ApiMocks(authenticatedPage);

    // Mock charts for dashboard
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

    // Mock chart data for each chart
    await apiMocks.mockChartData({
      chartOptions: {
        xAxis: { type: 'category', data: ['Q1', 'Q2', 'Q3', 'Q4'] },
        yAxis: { type: 'value' },
        series: [
          {
            data: [1000, 1500, 1200, 1800],
            type: 'bar',
          },
        ],
      },
      data: [],
    });
  });

  test('should add chart to dashboard from chart list', async ({ authenticatedPage }) => {
    // Navigate to charts page
    await authenticatedPage.goto('/charts');

    // Open dropdown for first chart
    await authenticatedPage
      .locator('tr')
      .first()
      .locator('button[aria-label="More options"]')
      .click();

    // Click add to dashboard
    await authenticatedPage.click('text="Add to Dashboard"');

    // Select dashboard in dialog
    await expect(authenticatedPage.locator('text="Select Dashboard"')).toBeVisible();

    // Mock dashboards list
    await authenticatedPage.route('**/api/dashboards/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, name: 'Main Dashboard' },
          { id: 2, name: 'Analytics Dashboard' },
        ]),
      });
    });

    // Select a dashboard
    await authenticatedPage.click('button[role="combobox"]:has-text("Select a dashboard")');
    await authenticatedPage.click('[role="option"]:has-text("Main Dashboard")');

    // Confirm addition
    await authenticatedPage.click('button:has-text("Add to Dashboard")');

    // Verify success message
    await expect(authenticatedPage.locator('text="Chart added to dashboard"')).toBeVisible();
  });

  test('should create new dashboard with chart', async ({ authenticatedPage }) => {
    // Navigate to charts page
    await authenticatedPage.goto('/charts');

    // Click create dashboard button
    await authenticatedPage.click('button:has-text("Create Dashboard")');

    // Fill dashboard name
    await authenticatedPage.fill('input[placeholder="Dashboard name"]', 'Sales Dashboard');

    // Mock dashboard creation
    await authenticatedPage.route('**/api/dashboards/', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 3,
            name: 'Sales Dashboard',
            elements: [],
          }),
        });
      } else {
        route.continue();
      }
    });

    // Create dashboard
    await authenticatedPage.click('button:has-text("Create")');

    // Should redirect to dashboard builder
    await expect(authenticatedPage).toHaveURL(/\/dashboards\/3/);
  });

  test('should display charts in dashboard builder', async ({ authenticatedPage }) => {
    // Mock dashboard with charts
    await authenticatedPage.route('**/api/dashboards/1/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          name: 'Main Dashboard',
          elements: [
            {
              id: 'elem-1',
              type: 'chart',
              chartId: 1,
              position: { x: 0, y: 0 },
              size: { width: 6, height: 4 },
            },
            {
              id: 'elem-2',
              type: 'chart',
              chartId: 2,
              position: { x: 6, y: 0 },
              size: { width: 6, height: 4 },
            },
          ],
        }),
      });
    });

    // Navigate to dashboard
    await authenticatedPage.goto('/dashboards/1');

    // Wait for charts to load
    await authenticatedPage.waitForSelector('canvas', { timeout: 10000 });

    // Verify both charts are displayed
    const canvases = await authenticatedPage.locator('canvas').count();
    expect(canvases).toBeGreaterThanOrEqual(2);
  });

  test('should drag and drop chart in dashboard', async ({ authenticatedPage }) => {
    // Mock dashboard
    await authenticatedPage.route('**/api/dashboards/1/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          name: 'Main Dashboard',
          elements: [
            {
              id: 'elem-1',
              type: 'chart',
              chartId: 1,
              position: { x: 0, y: 0 },
              size: { width: 6, height: 4 },
            },
          ],
        }),
      });
    });

    // Navigate to dashboard in edit mode
    await authenticatedPage.goto('/dashboards/1?edit=true');

    // Find the chart element
    const chartElement = authenticatedPage.locator('[data-element-id="elem-1"]');
    await expect(chartElement).toBeVisible();

    // Get initial position
    const initialBox = await chartElement.boundingBox();
    expect(initialBox).not.toBeNull();

    // Drag the chart to a new position
    await chartElement.dragTo(authenticatedPage.locator('.dashboard-grid'), {
      targetPosition: { x: 200, y: 200 },
    });

    // Mock update dashboard call
    await authenticatedPage.route('**/api/dashboards/1/', (route) => {
      if (route.request().method() === 'PUT') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        route.continue();
      }
    });

    // Save dashboard
    await authenticatedPage.click('button:has-text("Save Dashboard")');

    // Verify success message
    await expect(authenticatedPage.locator('text="Dashboard saved"')).toBeVisible();
  });

  test('should resize chart in dashboard', async ({ authenticatedPage }) => {
    // Mock dashboard
    await authenticatedPage.route('**/api/dashboards/1/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          name: 'Main Dashboard',
          elements: [
            {
              id: 'elem-1',
              type: 'chart',
              chartId: 1,
              position: { x: 0, y: 0 },
              size: { width: 6, height: 4 },
            },
          ],
        }),
      });
    });

    // Navigate to dashboard in edit mode
    await authenticatedPage.goto('/dashboards/1?edit=true');

    // Find resize handle
    const resizeHandle = authenticatedPage.locator('[data-element-id="elem-1"] .resize-handle');
    await expect(resizeHandle).toBeVisible();

    // Drag resize handle
    const handleBox = await resizeHandle.boundingBox();
    if (handleBox) {
      await authenticatedPage.mouse.move(
        handleBox.x + handleBox.width / 2,
        handleBox.y + handleBox.height / 2
      );
      await authenticatedPage.mouse.down();
      await authenticatedPage.mouse.move(handleBox.x + 100, handleBox.y + 100);
      await authenticatedPage.mouse.up();
    }

    // Save dashboard
    await authenticatedPage.click('button:has-text("Save Dashboard")');

    // Verify the chart size changed
    const chartElement = authenticatedPage.locator('[data-element-id="elem-1"]');
    const newBox = await chartElement.boundingBox();
    expect(newBox?.width).toBeGreaterThan(300); // Assuming initial width was smaller
  });

  test('should remove chart from dashboard', async ({ authenticatedPage }) => {
    // Mock dashboard with chart
    await authenticatedPage.route('**/api/dashboards/1/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          name: 'Main Dashboard',
          elements: [
            {
              id: 'elem-1',
              type: 'chart',
              chartId: 1,
              position: { x: 0, y: 0 },
              size: { width: 6, height: 4 },
            },
          ],
        }),
      });
    });

    // Navigate to dashboard in edit mode
    await authenticatedPage.goto('/dashboards/1?edit=true');

    // Find the chart element
    const chartElement = authenticatedPage.locator('[data-element-id="elem-1"]');
    await expect(chartElement).toBeVisible();

    // Click remove button
    await chartElement.hover();
    await chartElement.locator('button[aria-label="Remove from dashboard"]').click();

    // Confirm removal
    await authenticatedPage.click('button:has-text("Remove")');

    // Verify chart is removed
    await expect(chartElement).not.toBeVisible();

    // Mock update dashboard call
    await authenticatedPage.route('**/api/dashboards/1/', (route) => {
      if (route.request().method() === 'PUT') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        route.continue();
      }
    });

    // Save dashboard
    await authenticatedPage.click('button:has-text("Save Dashboard")');

    // Verify success message
    await expect(authenticatedPage.locator('text="Dashboard saved"')).toBeVisible();
  });
});
