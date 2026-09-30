import { test, expect } from '../support/fixtures';

/**
 * Interaction-coverage gap (coverage/INTERACTIONS.md): the "Learn about Dalgo" link on the
 * logged-out "Report Not Found" card of a public report link.
 */

test('IG-reports public not-found "Learn about Dalgo" opens dalgo.org in a new tab', async ({
  page,
}) => {
  await page.goto('/share/report/e2e-no-such-token');
  await expect(page.getByTestId('public-report-not-found')).toBeVisible({ timeout: 30_000 });
  // External site: answer it locally so the test doesn't depend on dalgo.org being reachable
  await page
    .context()
    .route('https://dalgo.org/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html>dalgo</html>' })
    );
  const popup = page.waitForEvent('popup');
  await page.getByTestId('public-report-learn-more-btn').click();
  const tab = await popup;
  await expect(tab).toHaveURL(/^https:\/\/dalgo\.org\/?$/);
  await tab.close();
  await expect(page.getByTestId('public-report-not-found')).toBeVisible();
});
