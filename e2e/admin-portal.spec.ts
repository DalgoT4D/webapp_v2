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

    // The Admin Portal nav link must not be visible to a non-admin.
    await expect(page.getByRole('link', { name: 'Admin Portal' })).toHaveCount(0);

    // Try to reach the admin portal directly by URL — AdminGuard must bounce us.
    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/admin/, { timeout: 15000 });

    // The admin shell (its "Admin Portal" sidebar heading) must never render.
    await expect(page.getByText('Admin Portal')).toHaveCount(0);
  });
});
