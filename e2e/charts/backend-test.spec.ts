import { test, expect } from '@playwright/test';

test('Test Backend Connection', async ({ page }) => {
  // First, let's check if we can access the backend directly
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002';
  console.log('Testing backend at:', backendUrl);

  // Try to fetch from the backend API
  const response = await page.request.post(`${backendUrl}/api/login/`, {
    data: {
      username: 'apd1@gmail.com',
      password: 'password',
    },
    headers: {
      'Content-Type': 'application/json',
    },
  });

  console.log('Login response status:', response.status());
  const responseData = await response.text();
  console.log('Login response:', responseData);

  if (response.ok()) {
    const data = JSON.parse(responseData);
    console.log('Login successful, token:', data.token?.substring(0, 20) + '...');
  }

  // Now test the frontend login page
  await page.goto('http://localhost:3001/login');
  await page.waitForLoadState('networkidle');

  // Take a screenshot
  await page.screenshot({ path: 'test-results/login-page-test.png' });

  // Check what backend URL the frontend is using
  const frontendBackendUrl = await page.evaluate(() => {
    return (window as any).NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
  });
  console.log('Frontend is configured to use backend at:', frontendBackendUrl);
});
