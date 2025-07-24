import { Page } from '@playwright/test';

export async function loginWithCredentials(
  page: Page,
  email: string = 'adp1@gmail.com',
  password: string = 'password'
) {
  // Navigate to login page
  await page.goto('http://localhost:3001/login');

  // Wait for login form to be visible
  await page.waitForSelector('text="Business Email"', { timeout: 5000 });

  // Fill in login form using correct placeholders
  await page.fill('input[placeholder="eg. user@domain.com"]', email);
  await page.fill('input[placeholder="Enter your password"]', password);

  // Click sign in button
  await page.click('button:has-text("Sign In")');

  // Wait for navigation after successful login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

  // Wait for the page to fully load
  await page.waitForLoadState('networkidle');
}
