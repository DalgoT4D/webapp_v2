import { type Page, expect, test as setup } from '@playwright/test';
import { type RoleName, ORG_SLUG, ROLE_USERS } from './support/env';

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Business Email*').fill(email);
  await page.getByLabel('Password*').fill(password);
  await Promise.all([
    page.waitForURL(/\/impact/, { timeout: 30_000 }),
    page.getByRole('button', { name: 'Sign In' }).click(),
  ]);
  // apiFetch reads the org from localStorage; pin it so every test targets the e2e org
  await page.evaluate((slug) => localStorage.setItem('selectedOrg', slug), ORG_SLUG);
  await page.reload();
  await expect(page).toHaveURL(/\/impact/);
}

/** Logs in once per role and saves cookies + localStorage for the specs. Roles without creds are skipped. */
for (const role of Object.keys(ROLE_USERS) as RoleName[]) {
  setup(`authenticate ${role}`, async ({ page }) => {
    const user = ROLE_USERS[role];
    setup.skip(!user.email || !user.password, `no credentials for ${role} in .env`);
    await loginAs(page, user.email!, user.password!);
    await page.context().storageState({ path: user.statePath });
  });
}
