import { Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

export function requireCredentials() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Missing E2E_ADMIN_EMAIL or E2E_ADMIN_PASSWORD');
  }
  return { email: ADMIN_EMAIL, password: ADMIN_PASSWORD };
}

export async function login(page: Page) {
  const { email, password } = requireCredentials();
  await page.goto('/login');
  await page.getByLabel('Business Email*').fill(email);
  await page.getByLabel('Password*').fill(password);
  await Promise.all([
    page.waitForURL('/impact', { timeout: 15000 }),
    page.getByRole('button', { name: 'Sign In' }).click(),
  ]);
}
