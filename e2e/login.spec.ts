import { test, expect } from '@playwright/test';

// Get test credentials from environment variables
const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display the login page with all elements', async ({ page }) => {
    // Check page title/heading
    await expect(page.getByRole('heading', { name: 'Welcome to Dalgo' })).toBeVisible();
    await expect(page.getByText('Sign in to your account')).toBeVisible();

    // Check form fields exist
    await expect(page.getByLabel('Business Email*')).toBeVisible();
    await expect(page.getByLabel('Password*')).toBeVisible();

    // Check sign in button
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();

    // Check forgot password link
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    // Click sign in without filling form
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Check validation messages appear
    await expect(page.getByText('Username is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('should toggle password visibility', async ({ page }) => {
    const passwordInput = page.getByLabel('Password*');
    const toggleButton = page.getByRole('button', { name: 'Show password' });

    // Password should be hidden by default
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click toggle to show password
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click toggle to hide password again
    await page.getByRole('button', { name: 'Hide password' }).click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should navigate to forgot password page', async ({ page }) => {
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page).toHaveURL('/forgot-password');
  });

  test('should login successfully and redirect to impact page', async ({ page }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Missing E2E_TEST_EMAIL or E2E_TEST_PASSWORD');

    // Fill login form
    await page.getByLabel('Business Email*').fill(TEST_EMAIL!);
    await page.getByLabel('Password*').fill(TEST_PASSWORD!);

    // Click sign in
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for redirect to impact page (successful login)
    await expect(page).toHaveURL('/impact', { timeout: 10000 });
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill with invalid credentials
    await page.getByLabel('Business Email*').fill('invalid@example.com');
    await page.getByLabel('Password*').fill('wrongpassword');

    // Click sign in
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should show error message (red text in center) and stay on login page
    const errorMessage = page.locator('.text-red-600.text-center');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL('/login');
  });
});
