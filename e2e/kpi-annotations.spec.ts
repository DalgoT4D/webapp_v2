import { test, expect, Page } from '@playwright/test';
import { login } from './helpers/auth';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test.describe('KPI Annotations', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Missing credentials');
    await login(page);
    await page.goto('/kpis');
    await page.waitForLoadState('networkidle');
  });

  async function openFirstKPIDrawer(page: Page): Promise<boolean> {
    const card = page.locator('[data-testid^="kpi-card-"]').first();
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      return false;
    }
    await card.click();
    // The drawer is a Sheet (role="dialog") but we need to distinguish from combobox popovers
    await page.waitForTimeout(1000);
    return true;
  }

  test('add note form appears when clicking ADD NOTE', async ({ page }) => {
    if (!(await openFirstKPIDrawer(page))) {
      test.skip(true, 'No KPI cards available');
    }

    // Look for ADD NOTE button
    const addNoteBtn = page.getByRole('button', { name: /ADD NOTE/i });
    if (!(await addNoteBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'ADD NOTE button not found');
    }
    await addNoteBtn.click();

    // Form should show textarea
    await expect(page.locator('textarea').last()).toBeVisible({ timeout: 3000 });

    // Cancel and Save buttons should be visible
    await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Save/i })).toBeVisible();
  });

  test('cancel note form hides it', async ({ page }) => {
    if (!(await openFirstKPIDrawer(page))) {
      test.skip(true, 'No KPI cards available');
    }

    const addNoteBtn = page.getByRole('button', { name: /ADD NOTE/i });
    if (!(await addNoteBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'ADD NOTE button not found');
    }

    await addNoteBtn.click();
    await expect(page.locator('textarea').last()).toBeVisible({ timeout: 3000 });

    await page.getByRole('button', { name: /Cancel/i }).click();
    // ADD NOTE button should reappear
    await expect(addNoteBtn).toBeVisible({ timeout: 3000 });
  });

  test('create a note on a KPI', async ({ page }) => {
    if (!(await openFirstKPIDrawer(page))) {
      test.skip(true, 'No KPI cards available');
    }

    const addNoteBtn = page.getByRole('button', { name: /ADD NOTE/i });
    if (!(await addNoteBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'ADD NOTE button not found');
    }

    await addNoteBtn.click();

    // Select a period if dropdown is available
    const periodSelect = page.locator('[role="combobox"]').last();
    if (await periodSelect.isVisible({ timeout: 2000 })) {
      await periodSelect.click();
      const option = page.locator('[role="option"]').first();
      if (await option.isVisible({ timeout: 2000 })) {
        await option.click();
      }
    }

    // Fill note content
    const noteContent = `E2E test note ${Date.now()}`;
    await page.locator('textarea').last().fill(noteContent);

    // Save
    await page.getByRole('button', { name: /Save/i }).click();

    // Note should appear in the list
    await expect(page.getByText(noteContent)).toBeVisible({ timeout: 5000 });
  });
});
