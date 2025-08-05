import { test, expect } from '@playwright/test';

test('Debug Login Process', async ({ page }) => {
  // Navigate to login page
  await page.goto('http://localhost:3001/login');

  // Take screenshot
  await page.screenshot({ path: 'test-results/login-page.png' });

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Log all input fields on the page
  const inputs = await page.locator('input').all();
  console.log(`Found ${inputs.length} input fields`);

  for (let i = 0; i < inputs.length; i++) {
    const placeholder = await inputs[i].getAttribute('placeholder');
    const type = await inputs[i].getAttribute('type');
    const name = await inputs[i].getAttribute('name');
    console.log(`Input ${i}: placeholder="${placeholder}", type="${type}", name="${name}"`);
  }

  // Try different selectors for email field
  const selectors = [
    'input[placeholder="Business Email"]',
    'input[type="email"]',
    'input[name="email"]',
    'input:has-text("Business Email")',
    'input:near(:text("Business Email"))',
  ];

  for (const selector of selectors) {
    try {
      const element = await page.locator(selector).isVisible();
      console.log(`Selector "${selector}": ${element ? 'FOUND' : 'NOT FOUND'}`);
    } catch (error) {
      console.log(`Selector "${selector}": ERROR`);
    }
  }

  // Try to find the email input using different methods
  const emailLabel = page.locator('text="Business Email"');
  if (await emailLabel.isVisible()) {
    console.log('Found "Business Email" label');

    // Try to find the associated input
    const inputNearLabel = page.locator('input').locator('near', emailLabel);
    if ((await inputNearLabel.count()) > 0) {
      console.log('Found input near label');
    }
  }

  // Get page content for debugging
  const pageContent = await page.content();
  console.log('Page HTML preview:', pageContent.substring(0, 500));
});
