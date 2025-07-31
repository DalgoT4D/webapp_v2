import { Page } from '@playwright/test';

export async function waitForChartToRender(page: Page) {
  // Wait for ECharts canvas to be rendered
  await page.waitForSelector('canvas', { timeout: 10000 });
  // Additional wait for chart animations to complete
  await page.waitForTimeout(1000);
}

export async function waitForDataToLoad(page: Page) {
  // Wait for loading skeleton to disappear
  await page.waitForSelector('.animate-pulse', { state: 'hidden', timeout: 10000 });
}

export async function fillChartForm(
  page: Page,
  chartData: {
    name: string;
    type: 'bar' | 'line' | 'pie';
    schema: string;
    table: string;
    xAxis?: string;
    yAxis?: string;
    dimension?: string;
    measure?: string;
  }
) {
  // Fill chart name
  await page.fill('input[placeholder="Enter chart name"]', chartData.name);

  // Select chart type
  await page.click(`button[data-chart-type="${chartData.type}"]`);

  // Click next to go to data source
  await page.click('button:has-text("Next")');

  // Select schema
  await page.click('button[role="combobox"]:has-text("Select schema")');
  await page.click(`[role="option"]:has-text("${chartData.schema}")`);

  // Select table
  await page.click('button[role="combobox"]:has-text("Select table")');
  await page.click(`[role="option"]:has-text("${chartData.table}")`);

  // Wait for columns to load
  await page.waitForTimeout(500);

  // Click next to go to configuration
  await page.click('button:has-text("Next")');

  // Configure axes based on chart type
  if (chartData.type === 'bar' || chartData.type === 'line') {
    // Select X-axis
    if (chartData.xAxis) {
      await page.click('button[role="combobox"]:has-text("Select X-axis column")');
      await page.click(`[role="option"]:has-text("${chartData.xAxis}")`);
    }

    // Select Y-axis
    if (chartData.yAxis) {
      await page.click('button[role="combobox"]:has-text("Select Y-axis column")');
      await page.click(`[role="option"]:has-text("${chartData.yAxis}")`);
    }
  } else if (chartData.type === 'pie') {
    // Select dimension
    if (chartData.dimension) {
      await page.click('button[role="combobox"]:has-text("Select dimension column")');
      await page.click(`[role="option"]:has-text("${chartData.dimension}")`);
    }

    // Select measure
    if (chartData.measure) {
      await page.click('button[role="combobox"]:has-text("Select measure column")');
      await page.click(`[role="option"]:has-text("${chartData.measure}")`);
    }
  }
}

export async function verifyChartInList(page: Page, chartName: string) {
  await page.waitForSelector(`text="${chartName}"`, { timeout: 5000 });
}

export async function deleteChart(page: Page, chartName: string) {
  // Find the chart row
  const chartRow = page.locator('tr').filter({ hasText: chartName });

  // Click the dropdown menu
  await chartRow.locator('button[aria-label="More options"]').click();

  // Click delete
  await page.click('text="Delete"');

  // Confirm deletion
  await page.click('button:has-text("Delete"):not([aria-label])');

  // Wait for chart to be removed from list
  await page.waitForSelector(`text="${chartName}"`, { state: 'hidden' });
}
