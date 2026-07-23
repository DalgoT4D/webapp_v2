import { test, expect } from '@playwright/test';

// A non-platform-admin user's credentials. Skipped when not provided, mirroring
// e2e/login.spec.ts — this test needs a real logged-in non-admin session.
const NONADMIN_EMAIL = process.env.E2E_NONADMIN_EMAIL;
const NONADMIN_PASSWORD = process.env.E2E_NONADMIN_PASSWORD;

test.describe('Admin Portal access control', () => {
  test('a non-platform-admin is bounced from /admin', async ({ page }) => {
    test.skip(
      !NONADMIN_EMAIL || !NONADMIN_PASSWORD,
      'Missing E2E_NONADMIN_EMAIL or E2E_NONADMIN_PASSWORD'
    );

    // Log in as a non-admin user.
    await page.goto('/login');
    await page.getByLabel('Business Email*').fill(NONADMIN_EMAIL!);
    await page.getByLabel('Password*').fill(NONADMIN_PASSWORD!);
    await Promise.all([
      page.waitForURL('/impact', { timeout: 15000 }),
      page.getByRole('button', { name: 'Sign In' }).click(),
    ]);

    // Try to reach the admin portal directly by URL. The admin portal runs an independent
    // session, so a normal product login grants nothing here — AdminGuard must bounce us to
    // the admin sign-in page (not to the normal app's /login).
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login$/, { timeout: 15000 });

    // The admin shell must never render. Assert on a sidebar item unique to the shell —
    // "Admin Portal" alone is not a valid marker, since the sign-in page uses it as its heading.
    await expect(page.getByRole('link', { name: 'Organizations' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Back to Dalgo' })).toHaveCount(0);
  });
});
