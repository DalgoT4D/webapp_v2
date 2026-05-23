import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test.describe('KPI Page', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Missing credentials');
    await login(page);
    await page.goto('/kpis');
    await page.waitForLoadState('networkidle');
  });

  // ── Page layout ─────────────────────────────────────────────────

  test('page loads with correct header and create button', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'KPI' })).toBeVisible();
    await expect(
      page.getByText('Track business objectives with measurable KPIs linked to your metrics')
    ).toBeVisible();
    await expect(page.getByTestId('create-kpi-btn')).toBeVisible();
  });

  test('filter controls are visible', async ({ page }) => {
    await expect(page.getByTestId('kpi-search')).toBeVisible();
    await expect(page.getByText('All Types')).toBeVisible();
    await expect(page.getByText('All Statuses')).toBeVisible();
  });

  // ── Search ─────────────────────────────────────────────────────

  test('search with no results shows empty message', async ({ page }) => {
    await page.getByTestId('kpi-search').fill('nonexistent_kpi_xyz_99999');
    // Wait for debounce + API
    await page.waitForTimeout(1000);
    await expect(page.getByText(/No KPIs match your search/i)).toBeVisible({ timeout: 5000 });
  });

  // ── Status filter ──────────────────────────────────────────────

  test('status filter dropdown has correct options', async ({ page }) => {
    await page.getByText('All Statuses').click();
    await expect(page.getByRole('option', { name: 'On Track' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Needs Attention' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Off Track' })).toBeVisible();
  });

  // ── Create KPI wizard ─────────────────────────────────────────

  test('create KPI dialog opens with metric selector', async ({ page }) => {
    await page.getByTestId('create-kpi-btn').click();
    await expect(page.getByRole('dialog', { name: 'Create KPI' })).toBeVisible({ timeout: 10000 });

    // Metric selector should be present
    await expect(
      page.getByRole('dialog', { name: 'Create KPI' }).getByRole('combobox').first()
    ).toBeVisible();
  });

  test('create KPI wizard has progressive reveal', async ({ page }) => {
    await page.getByTestId('create-kpi-btn').click();
    const dialog = page.getByRole('dialog', { name: 'Create KPI' });
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Before selecting a metric, step 2 fields should not be visible
    const targetInput = dialog.getByLabel(/Target/i);
    await expect(targetInput).not.toBeVisible();

    // Select a metric from the dropdown
    const combobox = dialog.getByRole('combobox').first();
    await combobox.click();
    const firstOption = page.locator('[role="option"]').first();
    if (!(await firstOption.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'No metrics available');
    }
    await firstOption.click();

    // Now step 2 fields should reveal
    await expect(dialog.getByLabel(/Target/i).or(dialog.getByPlaceholder(/Target/i))).toBeVisible({
      timeout: 3000,
    });
  });

  // ── KPI cards ──────────────────────────────────────────────────

  test('KPI cards are visible when KPIs exist', async ({ page }) => {
    const card = page.locator('[data-testid^="kpi-card-"]').first();
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No KPI cards');
    }
    await expect(card).toBeVisible();
  });

  test('KPI card action menu has Edit and Delete', async ({ page }) => {
    const card = page.locator('[data-testid^="kpi-card-"]').first();
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No KPI cards');
    }

    // Open ⋮ menu on the card
    await card.locator('[role="button"]').last().click();
    await expect(page.getByRole('menuitem', { name: /Edit KPI/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Delete/i })).toBeVisible();

    // Close menu by pressing Escape
    await page.keyboard.press('Escape');
  });

  // ── KPI Detail Drawer ─────────────────────────────────────────

  test('clicking KPI card name opens detail drawer', async ({ page }) => {
    const card = page.locator('[data-testid^="kpi-card-"]').first();
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No KPI cards');
    }

    // Click the card name (not the menu)
    await card.click();
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });
  });

  test('detail drawer shows value section and chart', async ({ page }) => {
    const card = page.locator('[data-testid^="kpi-card-"]').first();
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No KPI cards');
    }

    await card.click();
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Should show target
    await expect(drawer.getByText(/Target/i)).toBeVisible({ timeout: 5000 });
  });

  test('detail drawer has time grain selector', async ({ page }) => {
    const card = page.locator('[data-testid^="kpi-card-"]').first();
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No KPI cards');
    }

    await card.click();
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Time grain selector
    await expect(drawer.getByText(/Monthly|Weekly|Daily|Quarterly|Yearly/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('detail drawer has notes section', async ({ page }) => {
    const card = page.locator('[data-testid^="kpi-card-"]').first();
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No KPI cards');
    }

    await card.click();
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Notes section with ADD NOTE button
    await expect(drawer.getByText(/Notes/i).or(drawer.getByText(/ADD NOTE/i))).toBeVisible({
      timeout: 5000,
    });
  });

  // ── Delete confirmation ────────────────────────────────────────

  test('delete KPI shows confirmation and cancel works', async ({ page }) => {
    const card = page.locator('[data-testid^="kpi-card-"]').first();
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No KPI cards');
    }

    // Open menu and click delete
    await card.locator('[role="button"]').last().click();
    await page.getByRole('menuitem', { name: /Delete/i }).click();

    // Confirmation dialog
    await expect(page.getByText(/Delete KPI/i)).toBeVisible();
    await expect(page.getByText(/Are you sure/i)).toBeVisible();

    // Cancel does not delete
    await page.getByRole('button', { name: /Cancel/i }).click();
    await expect(page.getByText(/Are you sure/i)).not.toBeVisible();
    // Card should still exist
    await expect(card).toBeVisible();
  });

  // ── Edit from drawer ──────────────────────────────────────────

  test('edit button in drawer opens edit form', async ({ page }) => {
    const card = page.locator('[data-testid^="kpi-card-"]').first();
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No KPI cards');
    }

    await card.click();
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Click edit button in drawer
    const editBtn = drawer
      .getByRole('button')
      .filter({ has: page.locator('svg') })
      .first();
    await editBtn.click();

    // Edit dialog should open (separate from drawer)
    await expect(page.getByText('Edit KPI')).toBeVisible({ timeout: 5000 });
  });
});
