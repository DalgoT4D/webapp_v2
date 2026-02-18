/**
 * Create Pipeline E2E Tests
 *
 * Tests for pipeline creation flow using data-testid selectors.
 * All tests use mocked API responses - no backend required.
 */

import { test, expect } from '@playwright/test';
import { setupPipelineMocks, setupAuthMocks, captureApiCalls } from './mocks/api-handlers';

test.describe('Create Pipeline - Form Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await setupPipelineMocks(page);
  });

  test('renders create form with all sections', async ({ page }) => {
    await page.goto('/orchestrate/create');

    // Header
    await expect(page.getByRole('heading', { name: 'Create Pipeline' })).toBeVisible();

    // Form sections
    await expect(page.getByText('Pipeline Details')).toBeVisible();
    await expect(page.getByText('Schedule')).toBeVisible();
    await expect(page.getByText('Transform Tasks')).toBeVisible();
    await expect(page.getByText('Connections')).toBeVisible();

    // Buttons
    await expect(page.getByTestId('cancel-btn')).toBeVisible();
    await expect(page.getByTestId('submit-btn')).toBeVisible();

    // Active switch should NOT be visible in create mode
    await expect(page.getByTestId('activeSwitch')).not.toBeVisible();
  });

  test('shows Simple mode by default with Run all tasks checkbox', async ({ page }) => {
    await page.goto('/orchestrate/create');

    // Simple mode should be active
    await expect(page.getByTestId('simple-mode-btn')).toHaveAttribute('data-state', 'on');

    // Run all tasks checkbox should be visible
    await expect(page.getByTestId('run-all-tasks-checkbox')).toBeVisible();
  });
});

test.describe('Create Pipeline - Schedule Selection', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await setupPipelineMocks(page);
  });

  test('selects Daily schedule and shows time picker', async ({ page }) => {
    await page.goto('/orchestrate/create');
    await expect(page.getByRole('heading', { name: 'Create Pipeline' })).toBeVisible();

    // Open schedule combobox and select Daily
    await page.getByTestId('cron-input').click();
    await page.getByTestId('cron-item-daily').click();

    // Time picker should appear
    await expect(page.getByTestId('cronTimeOfDay')).toBeVisible();
  });

  test('selects Weekly schedule and shows day picker', async ({ page }) => {
    await page.goto('/orchestrate/create');

    // Select Weekly
    await page.getByTestId('cron-input').click();
    await page.getByTestId('cron-item-weekly').click();

    // Days of week selector should appear
    await expect(page.getByText('Days of the Week')).toBeVisible();
    await expect(page.getByTestId('cronTimeOfDay')).toBeVisible();
  });

  test('selects Manual schedule - no time picker shown', async ({ page }) => {
    await page.goto('/orchestrate/create');

    // Select Manual
    await page.getByTestId('cron-input').click();
    await page.getByTestId('cron-item-manual').click();

    // Time picker should NOT appear
    await expect(page.getByTestId('cronTimeOfDay')).not.toBeVisible();
  });
});

test.describe('Create Pipeline - Connection Selection', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await setupPipelineMocks(page);
  });

  test('selects connections from combobox', async ({ page }) => {
    await page.goto('/orchestrate/create');

    // Open connections combobox
    await page.getByTestId('connections-container').click();

    // Select Postgres Source
    await page.getByTestId('connections-item-conn-1').click();

    // Selected connection should be visible in the container (as a tag)
    await expect(
      page.getByTestId('connections-container').getByText('Postgres Source')
    ).toBeVisible();
  });
});

test.describe('Create Pipeline - Task Mode Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await setupPipelineMocks(page);
  });

  test('switches to Advanced mode and shows task selector', async ({ page }) => {
    await page.goto('/orchestrate/create');

    // Click Advanced toggle
    await page.getByTestId('advanced-mode-btn').click();

    // Run all tasks checkbox should disappear
    await expect(page.getByTestId('run-all-tasks-checkbox')).not.toBeVisible();

    // Task selector should appear
    await expect(page.getByTestId('task-selector-input')).toBeVisible();
  });

  test('switches back to Simple mode', async ({ page }) => {
    await page.goto('/orchestrate/create');

    // Switch to Advanced
    await page.getByTestId('advanced-mode-btn').click();
    await expect(page.getByTestId('task-selector-input')).toBeVisible();

    // Switch back to Simple
    await page.getByTestId('simple-mode-btn').click();

    // Run all tasks should reappear
    await expect(page.getByTestId('run-all-tasks-checkbox')).toBeVisible();
  });
});

test.describe('Create Pipeline - Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await setupPipelineMocks(page);
  });

  test('shows validation error for missing schedule', async ({ page }) => {
    await page.goto('/orchestrate/create');

    // Fill only the name
    await page.getByTestId('name').fill('Test Pipeline');

    // Submit without selecting schedule
    await page.getByTestId('submit-btn').click();

    // Validation error should appear
    await expect(page.getByText('Schedule is required')).toBeVisible();
  });
});

test.describe('Create Pipeline - Form Submission', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await setupPipelineMocks(page);
  });

  test('submits form with Daily schedule - API called', async ({ page }) => {
    const apiCalls = captureApiCalls(page, '/api/prefect/v1/flows/');

    await page.goto('/orchestrate/create');

    // Fill name
    await page.getByTestId('name').fill('My Daily Pipeline');

    // Select Daily schedule
    await page.getByTestId('cron-input').click();
    await page.getByTestId('cron-item-daily').click();

    // Set time
    await page.getByTestId('cronTimeOfDay').fill('09:00');

    // Submit
    await page.getByTestId('submit-btn').click();

    // Verify API was called with POST
    await expect(async () => {
      const postCalls = apiCalls.filter((call) => call.method === 'POST');
      expect(postCalls.length).toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });
  });

  test('submits form with Manual schedule - API called', async ({ page }) => {
    const apiCalls = captureApiCalls(page, '/api/prefect/v1/flows/');

    await page.goto('/orchestrate/create');

    // Fill name
    await page.getByTestId('name').fill('My Manual Pipeline');

    // Select Manual schedule
    await page.getByTestId('cron-input').click();
    await page.getByTestId('cron-item-manual').click();

    // Submit
    await page.getByTestId('submit-btn').click();

    // Verify API was called with POST
    await expect(async () => {
      const postCalls = apiCalls.filter((call) => call.method === 'POST');
      expect(postCalls.length).toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });
  });

  test('cancel button triggers navigation', async ({ page }) => {
    await page.goto('/orchestrate/create');

    // Fill some data
    await page.getByTestId('name').fill('Test Pipeline');

    // Click Cancel - should trigger navigation
    await page.getByTestId('cancel-btn').click();

    // The create form heading should no longer be visible (navigated away)
    await expect(page.getByRole('heading', { name: 'Create Pipeline' })).not.toBeVisible({
      timeout: 10000,
    });
  });
});
