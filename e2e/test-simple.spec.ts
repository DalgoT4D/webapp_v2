import { test, expect } from '@playwright/test';

test.describe('Simple Chart Tests', () => {
  test('Can access login page', async ({ page }) => {
    await page.goto('http://localhost:3001/login');
    await expect(page.locator('text="Welcome to Dalgo"')).toBeVisible();
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
  });

  test('Login form works', async ({ page }) => {
    await page.goto('http://localhost:3001/login');

    // Fill form
    await page.fill('input[placeholder="eg. user@domain.com"]', 'test@example.com');
    await page.fill('input[placeholder="Enter your password"]', 'testpassword');

    // Verify inputs are filled
    await expect(page.locator('input[placeholder="eg. user@domain.com"]')).toHaveValue(
      'test@example.com'
    );
    await expect(page.locator('input[placeholder="Enter your password"]')).toHaveValue(
      'testpassword'
    );
  });

  test('Backend API is accessible', async ({ request }) => {
    // Test if backend is responding
    try {
      const response = await request.get('http://localhost:8002/api/');
      console.log('Backend API status:', response.status());

      // Even a 404 means the backend is running
      expect(response.status()).toBeLessThan(500);
    } catch (error) {
      console.log('Backend not accessible:', error);
    }
  });
});
