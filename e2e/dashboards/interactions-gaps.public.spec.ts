import { test, expect } from '../support/fixtures';

/**
 * Interaction-coverage gaps (coverage/INTERACTIONS.md) — public dashboard page, logged out.
 */

test('IG-dashboards public "Learn about Dalgo" opens dalgo.org in a new tab', async ({
  page,
  context,
}) => {
  // Never load the real marketing site from a test
  await context.route('https://dalgo.org/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<html>stub</html>' })
  );
  await page.goto('/share/dashboard/e2e-invalid-token-does-not-exist');
  await expect(page.getByTestId('public-dashboard-not-found')).toBeVisible({ timeout: 30_000 });
  const popup = page.waitForEvent('popup');
  await page.getByTestId('public-dashboard-learn-more-btn').click();
  const opened = await popup;
  expect(new URL(opened.url()).origin).toBe('https://dalgo.org');
  await opened.close();
  await expect(page).toHaveURL(/\/share\/dashboard\/e2e-invalid-token-does-not-exist$/);
});
