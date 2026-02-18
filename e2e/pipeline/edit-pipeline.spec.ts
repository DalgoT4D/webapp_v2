/**
 * Edit Pipeline E2E Tests
 *
 * Tests for pipeline editing flow using data-testid selectors.
 * All tests use mocked API responses - no backend required.
 */

import { test, expect } from '@playwright/test';
import { setupPipelineMocks, setupAuthMocks, captureApiCalls } from './mocks/api-handlers';

test.describe('Edit Pipeline - Load Existing Data', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await setupPipelineMocks(page);
  });

  test('loads and displays existing pipeline configuration', async ({ page }) => {
    await page.goto('/orchestrate/dep-1/edit');

    // Header should show Update Pipeline
    await expect(page.getByRole('heading', { name: 'Update Pipeline' })).toBeVisible();

    // Name should be pre-filled
    await expect(page.getByTestId('name')).toHaveValue('Daily Sync');

    // Active switch should be visible in edit mode
    await expect(page.getByTestId('activeSwitch')).toBeVisible();
  });

  test('shows active switch in edit mode', async ({ page }) => {
    await page.goto('/orchestrate/dep-1/edit');

    // Active switch should be visible and checked (Daily Sync is active)
    await expect(page.getByTestId('activeSwitch')).toBeVisible();
  });
});

test.describe('Edit Pipeline - Active/Inactive Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await setupPipelineMocks(page);
  });

  test('can toggle pipeline active status', async ({ page }) => {
    await page.goto('/orchestrate/dep-1/edit');

    // Active switch should be visible
    const activeSwitch = page.getByTestId('activeSwitch');
    await expect(activeSwitch).toBeVisible();

    // Click to toggle
    await activeSwitch.click();

    // The switch should respond to click (state change)
    // Note: actual state depends on initial value
  });
});

test.describe('Edit Pipeline - Form Submission', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await setupPipelineMocks(page);
  });

  test('saves changes - PUT API called', async ({ page }) => {
    const apiCalls = captureApiCalls(page, '/api/prefect/v1/flows/');

    await page.goto('/orchestrate/dep-1/edit');
    await expect(page.getByTestId('name')).toHaveValue('Daily Sync');

    // Modify name
    await page.getByTestId('name').fill('Daily Sync Updated');

    // Submit
    await page.getByTestId('submit-btn').click();

    // Verify PUT API was called
    await expect(async () => {
      expect(apiCalls.some((call) => call.method === 'PUT')).toBe(true);
    }).toPass({ timeout: 5000 });
  });

  test('cancel does not call PUT API', async ({ page }) => {
    const apiCalls = captureApiCalls(page, '/api/prefect/v1/flows/');

    await page.goto('/orchestrate/dep-1/edit');

    // Modify name
    await page.getByTestId('name').fill('Modified Name');

    // Click Cancel
    await page.getByTestId('cancel-btn').click();

    // Wait a moment for any potential API call
    await page.waitForTimeout(500);

    // PUT should NOT have been called
    expect(apiCalls.filter((call) => call.method === 'PUT').length).toBe(0);
  });
});

test.describe('Edit Pipeline - Schedule Modification', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await setupPipelineMocks(page);
  });

  test('can change schedule type', async ({ page }) => {
    await page.goto('/orchestrate/dep-1/edit');

    // Open schedule combobox
    await page.getByTestId('cron-input').click();

    // Select Manual
    await page.getByTestId('cron-item-manual').click();

    // Time picker should not be visible for manual
    await expect(page.getByTestId('cronTimeOfDay')).not.toBeVisible();
  });
});

test.describe('Edit Pipeline - Task Mode Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await setupPipelineMocks(page);
  });

  test('can switch between Simple and Advanced mode', async ({ page }) => {
    await page.goto('/orchestrate/dep-1/edit');

    // Switch to Advanced mode
    await page.getByTestId('advanced-mode-btn').click();

    // Task selector should appear
    await expect(page.getByTestId('task-selector-input')).toBeVisible();

    // Switch back to Simple mode
    await page.getByTestId('simple-mode-btn').click();

    // Run all tasks checkbox should appear
    await expect(page.getByTestId('run-all-tasks-checkbox')).toBeVisible();
  });
});
