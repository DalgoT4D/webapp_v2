/**
 * Pipeline List E2E Tests
 *
 * Tests for pipeline list page interactions using data-testid selectors.
 * All tests use mocked API responses - no backend required.
 */

import { test, expect } from '@playwright/test';
import { setupPipelineMocks, setupAuthMocks, captureApiCalls } from './mocks/api-handlers';

test.describe('Pipeline List', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await setupPipelineMocks(page);
  });

  test('displays all pipelines from API', async ({ page }) => {
    await page.goto('/orchestrate');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Pipelines' })).toBeVisible();

    // Verify pipelines are displayed using testids
    await expect(page.getByTestId('pipeline-row-dep-1')).toBeVisible();
    await expect(page.getByTestId('pipeline-row-dep-2')).toBeVisible();
    await expect(page.getByTestId('pipeline-row-dep-3')).toBeVisible();
    await expect(page.getByTestId('pipeline-row-dep-4')).toBeVisible();
  });

  test('displays correct status badges', async ({ page }) => {
    await page.goto('/orchestrate');

    // Check status badges using testids
    await expect(page.getByTestId('status-badge-dep-1')).toHaveText('Active');
    await expect(page.getByTestId('status-badge-dep-2')).toHaveText('Inactive');
    await expect(page.getByTestId('status-badge-dep-3')).toHaveText('Active');
  });

  test('clicking Create Pipeline button triggers navigation', async ({ page }) => {
    await page.goto('/orchestrate');
    await expect(page.getByTestId('pipeline-row-dep-1')).toBeVisible();

    // Click create button
    await page.getByTestId('create-pipeline-btn').click();

    // Verify we've left the list page (Pipelines heading should disappear)
    await expect(page.getByRole('heading', { name: 'Pipelines' })).not.toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe('Pipeline List - Run Action', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await setupPipelineMocks(page);
  });

  test('triggers pipeline run when clicking Run button', async ({ page }) => {
    const apiCalls = captureApiCalls(page, '/flow_run/');

    await page.goto('/orchestrate');
    await expect(page.getByTestId('pipeline-row-dep-1')).toBeVisible();

    // Click run button for Daily Sync (dep-1)
    await page.getByTestId('run-btn-dep-1').click();

    // Verify API was called
    await expect(async () => {
      expect(apiCalls.some((call) => call.method === 'POST')).toBe(true);
    }).toPass();
  });

  test('disables Run button for running pipelines', async ({ page }) => {
    await page.goto('/orchestrate');

    // Running Pipeline (dep-4) should have disabled run button
    await expect(page.getByTestId('run-btn-dep-4')).toBeDisabled();
  });
});

test.describe('Pipeline List - Dropdown Menu Actions', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await setupPipelineMocks(page);
  });

  test('clicking Edit triggers navigation', async ({ page }) => {
    await page.goto('/orchestrate');
    await expect(page.getByTestId('pipeline-row-dep-1')).toBeVisible();

    // Open dropdown menu
    await page.getByTestId('more-btn-dep-1').click();

    // Click Edit
    await page.getByTestId('edit-menu-item-dep-1').click();

    // Verify we've left the list page (Pipelines heading should disappear)
    await expect(page.getByRole('heading', { name: 'Pipelines' })).not.toBeVisible({
      timeout: 10000,
    });
  });

  test('deletes pipeline after confirmation', async ({ page }) => {
    const apiCalls = captureApiCalls(page, '/api/prefect/v1/flows/');

    await page.goto('/orchestrate');
    await expect(page.getByTestId('pipeline-row-dep-2')).toBeVisible();

    // Open dropdown and click Delete
    await page.getByTestId('more-btn-dep-2').click();
    await page.getByTestId('delete-menu-item-dep-2').click();

    // Confirm deletion in dialog
    await expect(page.getByText('Delete Pipeline')).toBeVisible();
    await page.getByRole('button', { name: /delete/i }).click();

    // Verify DELETE API was called
    await expect(async () => {
      expect(apiCalls.some((call) => call.method === 'DELETE')).toBe(true);
    }).toPass();
  });

  test('cancels delete when clicking Cancel', async ({ page }) => {
    const apiCalls = captureApiCalls(page, '/api/prefect/v1/flows/');

    await page.goto('/orchestrate');

    // Open dropdown and click Delete
    await page.getByTestId('more-btn-dep-3').click();
    await page.getByTestId('delete-menu-item-dep-3').click();

    // Cancel deletion
    await expect(page.getByText('Delete Pipeline')).toBeVisible();
    await page.getByRole('button', { name: /cancel/i }).click();

    // Verify DELETE was NOT called
    expect(apiCalls.filter((call) => call.method === 'DELETE').length).toBe(0);
  });

  test('dropdown menu is disabled for running pipelines', async ({ page }) => {
    await page.goto('/orchestrate');

    // Running Pipeline (dep-4) should have disabled more button
    await expect(page.getByTestId('more-btn-dep-4')).toBeDisabled();
  });
});

test.describe('Pipeline List - History Modal', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await setupPipelineMocks(page);
  });

  test('opens history modal when clicking History button', async ({ page }) => {
    await page.goto('/orchestrate');
    await expect(page.getByTestId('pipeline-row-dep-1')).toBeVisible();

    // Click History button
    await page.getByTestId('history-btn-dep-1').click();

    // Modal should open
    await expect(page.getByText('Logs History')).toBeVisible();
    await expect(page.getByTestId('history-pipeline-name')).toHaveText('Daily Sync');
  });
});
