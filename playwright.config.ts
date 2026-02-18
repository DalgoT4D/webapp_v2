import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import path from 'path';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
config({ path: path.resolve(__dirname, '.env') });

/**
 * Playwright Test Configuration
 *
 * Test Types:
 * - Integration tests (default): Run with mocked APIs, no backend required
 *   - Use: npx playwright test
 *   - Files: e2e/pipeline/*.spec.ts (mocked)
 *
 * - E2E tests (real backend): Run against staging/production
 *   - Use: E2E_BASE_URL=https://staging.dalgo.com npx playwright test --project=e2e
 *   - Requires: E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD env vars
 *
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    /* Override with E2E_BASE_URL env var to test against staging/production */
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for different test types and browsers */
  projects: [
    // ============ Integration Tests (Mocked APIs) ============
    // Run with: npx playwright test
    // These tests use route interception to mock API responses
    {
      name: 'integration',
      testDir: './e2e',
      testIgnore: ['**/login.spec.ts'], // Skip tests that need real backend
      use: {
        ...devices['Desktop Chrome'],
        // Shorter timeouts for mocked tests
        actionTimeout: 10000,
        navigationTimeout: 15000,
      },
    },

    // ============ E2E Tests (Real Backend) ============
    // Run with: E2E_BASE_URL=https://staging.dalgo.com npx playwright test --project=e2e-*
    // Requires authentication env vars
    {
      name: 'e2e-chromium',
      testDir: './e2e',
      testMatch: ['**/login.spec.ts'], // Only run tests designed for real backend
      use: {
        ...devices['Desktop Chrome'],
        // Longer timeouts for real API calls
        actionTimeout: 30000,
        navigationTimeout: 30000,
      },
    },

    // ============ Cross-browser Testing ============
    // Run all integration tests across browsers
    {
      name: 'firefox',
      testDir: './e2e',
      testIgnore: ['**/login.spec.ts'],
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testDir: './e2e',
      testIgnore: ['**/login.spec.ts'],
      use: { ...devices['Desktop Safari'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  /* Disabled when E2E_BASE_URL is set (testing against remote server) */
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3001',
        reuseExistingServer: !process.env.CI,
      },
});
