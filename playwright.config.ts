import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import path from 'path';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
config({ path: path.resolve(__dirname, '.env') });

// One id per `playwright test` invocation, inherited by every worker → e2e-<runId>-* object names
process.env.E2E_RUN_ID ||= Date.now().toString(36);

// See the `isolated` project below
// Tests that send real notification emails (the test users share one inbox) — excluded unless
// E2E_ALLOW_EMAIL=on. The email guard (e2e/support/email-guard.ts) fails any untagged test that tries.
const SENDS_EMAIL = /@sends-email/;
const EMAIL_ALLOWED = process.env.E2E_ALLOW_EMAIL === 'on';

const ISOLATED_SPECS = [
  /dashboards\/list\.spec\.ts/,
  /dashboards\/list-gaps\.spec\.ts/,
  /reports\/list-gaps\.spec\.ts/,
];

const AUTH_STATE_PATH = path.resolve(__dirname, 'playwright/.auth/admin.json');

// Above every layout breakpoint in the app (lg 1024, desktop 1200, xl 1280) → one stable desktop layout
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Per-invocation artifacts dir — concurrent runs in one worktree otherwise wipe each other's traces */
  outputDir: `test-results/${process.env.E2E_RUN_ID}`,
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{arg}{ext}',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  // One retry: staging has intermittent slow spells (tests hang, then pass on retry). A test that
  // passes on retry is reported as "flaky" (still visible); a real regression fails both attempts.
  retries: process.env.CI ? 2 : 1,
  /* Staging backend is shared — keep concurrency modest */
  // 2, not 4: long runs at 4 exhausted staging's RAM (522s, 2026-09-28). Override with --workers.
  workers: process.env.CI ? 1 : 2,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['list'], ['html', { open: 'never' }], ['./e2e/support/skip-guard-reporter.ts']],
  timeout: 60_000,
  grepInvert: EMAIL_ALLOWED ? undefined : SENDS_EMAIL,
  expect: { timeout: 10_000 },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    /* Override with E2E_BASE_URL env var to test against staging/production */
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    ...devices['Desktop Chrome'],
    viewport: DESKTOP_VIEWPORT,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    contextOptions: { reducedMotion: 'reduce' },
  },

  projects: [
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
      teardown: 'teardown',
    },
    {
      name: 'teardown',
      testMatch: /global\.teardown\.ts/,
    },
    {
      // Logged-out flows: login page, public share links
      name: 'public',
      testMatch: [/login\.spec\.ts/, /\.public\.spec\.ts/],
      // Public specs set up their shared objects through the admin API session
      dependencies: ['setup'],
    },
    {
      name: 'chromium',
      testIgnore: [
        /login\.spec\.ts/,
        /\.public\.spec\.ts/,
        /global\.(setup|teardown)\.ts/,
        ...ISOLATED_SPECS,
      ],
      dependencies: ['setup'],
      use: { storageState: AUTH_STATE_PATH },
    },
    {
      // Specs asserting on org-wide list counts/pagination: any concurrent test creating the same
      // resource shifts the numbers. Run them in a separate invocation (npm run e2e), one at a time.
      name: 'isolated',
      testMatch: ISOLATED_SPECS,
      dependencies: ['setup'],
      fullyParallel: false,
      use: { storageState: AUTH_STATE_PATH },
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
        timeout: 180_000,
      },
});
