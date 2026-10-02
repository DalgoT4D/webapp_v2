import { type Locator, type Page, expect } from '@playwright/test';
import { SCREENSHOTS_ENABLED } from './env';

// ECharts animates for ~1s after data arrives; screenshots taken earlier are flaky
const ECHARTS_SETTLE_MS = 1_200;
const RENDER_TIMEOUT_MS = 30_000;
// Every in-app spinner caption ("Loading table data...", "Loading map boundaries...", …)
const LOADING_CAPTION = /^Loading [\w ]+\.\.\.$/;

/** Wait until an ECharts instance inside `container` has drawn a canvas and settled. */
export async function waitForEChart(container: Locator) {
  const canvas = container.locator('div[_echarts_instance_] canvas').first();
  await expect(canvas).toBeVisible({ timeout: RENDER_TIMEOUT_MS });
  await container.page().waitForTimeout(ECHARTS_SETTLE_MS);
}

/** Screenshot baseline for a rendered chart (ECharts canvas, table, pivot or map). */
export async function expectChartScreenshot(container: Locator, name: string) {
  if (!SCREENSHOTS_ENABLED) return;
  // A fast build can hit the screenshot between data refetches — never baseline a spinner
  await expect(container.getByText(LOADING_CAPTION)).toHaveCount(0, { timeout: RENDER_TIMEOUT_MS });
  await expect(container).toHaveScreenshot(`${name}.png`, {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
    timeout: RENDER_TIMEOUT_MS,
  });
}

/** Wait for all in-flight chart data requests to settle (dashboards fire many in parallel). */
export async function waitForChartData(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: RENDER_TIMEOUT_MS });
}
