/**
 * Run History E2E Tests
 *
 * Tests for pipeline run history modal using data-testid selectors.
 * All tests use mocked API responses - no backend required.
 */

import { test, expect } from '@playwright/test';
import { setupPipelineMocks, setupAuthMocks } from './mocks/api-handlers';

test.describe('Run History Modal', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthMocks(page);
    await setupPipelineMocks(page);
  });

  test('opens history modal with pipeline information', async ({ page }) => {
    await page.goto('/orchestrate');
    await expect(page.getByTestId('pipeline-row-dep-1')).toBeVisible();

    // Click History button for Daily Sync
    await page.getByTestId('history-btn-dep-1').click();

    // Modal should open with correct info
    await expect(page.getByText('Logs History')).toBeVisible();
    await expect(page.getByTestId('history-pipeline-name')).toHaveText('Daily Sync');
    await expect(page.getByTestId('history-pipeline-status')).toHaveText('Active');
  });

  test('shows inactive status for inactive pipeline', async ({ page }) => {
    await page.goto('/orchestrate');
    await expect(page.getByTestId('pipeline-row-dep-2')).toBeVisible();

    // Click History button for Weekly Report (inactive)
    await page.getByTestId('history-btn-dep-2').click();

    // Modal should show inactive status
    await expect(page.getByTestId('history-pipeline-status')).toHaveText('Inactive');
  });

  test('closes modal when clicking outside or close button', async ({ page }) => {
    await page.goto('/orchestrate');

    // Open history modal
    await page.getByTestId('history-btn-dep-1').click();
    await expect(page.getByText('Logs History')).toBeVisible();

    // Press Escape to close (common pattern for modals)
    await page.keyboard.press('Escape');

    // Modal should be closed
    await expect(page.getByText('Logs History')).not.toBeVisible();
  });
});
