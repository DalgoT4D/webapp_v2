import { test, expect } from '../support/fixtures';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import { waitForEChart } from '../support/render';

/** Proves the harness works end-to-end: stored auth, API factory, cleanup, payload capture, chart render. */
test.describe('harness smoke', () => {
  test('authenticated session lands on charts list', async ({ page }) => {
    await page.goto('/charts');
    await expect(page.getByTestId('charts-create-btn')).toBeVisible();
  });

  test('factory chart renders on detail page and payload is captured', async ({
    page,
    factory,
  }) => {
    const chart = await factory.barChart('smoke');

    const dataReq = captureRequest(page, { method: 'POST', url: '/api/charts/chart-data/' });
    await page.goto(`/charts/${chart.id}`);
    const captured = await dataReq;

    await expect(page.getByText(chart.title)).toBeVisible();
    await waitForEChart(page.locator('main'));
    expectPayloadSnapshot(captured, 'chart-detail-chart-data');
  });
});
