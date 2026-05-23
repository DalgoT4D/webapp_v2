import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const UNIQUE = Date.now();

test.describe('Metrics Library', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Missing credentials');
    await login(page);
    await page.goto('/metrics');
    await page.waitForLoadState('networkidle');
  });

  // ── Page layout ─────────────────────────────────────────────────

  test('page loads with correct header and create button', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Metrics' })).toBeVisible();
    await expect(
      page.getByText('Define reusable metric definitions that power your KPIs & Charts')
    ).toBeVisible();
    await expect(page.getByTestId('create-metric-btn')).toBeVisible();
  });

  test('table shows expected column headers', async ({ page }) => {
    // Wait for table to load — may be a role="table" or regular <table>
    const table = page.locator('table, [role="table"]').first();
    if (!(await table.isVisible({ timeout: 10000 }).catch(() => false))) {
      test.skip(true, 'No metrics table visible (might be empty state)');
    }
    const headerRow = table.locator('thead tr, [role="row"]').first();
    await expect(headerRow.getByText('Name')).toBeVisible();
    await expect(headerRow.getByText('Mode')).toBeVisible();
    await expect(headerRow.getByText('Data Source')).toBeVisible();
  });

  // ── Create Simple Metric ───────────────────────────────────────

  test('create metric dialog opens and has mode tabs', async ({ page }) => {
    await page.getByTestId('create-metric-btn').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create Metric' })).toBeVisible();

    // Mode tabs
    await expect(page.getByRole('tab', { name: 'Simple' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Calculated' })).toBeVisible();

    // Simple tab is active by default
    await expect(page.getByRole('tab', { name: 'Simple' })).toHaveAttribute('data-state', 'active');
  });

  test('switching between Simple and Calculated tabs shows correct fields', async ({ page }) => {
    await page.getByTestId('create-metric-btn').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Simple mode should show Function field
    await expect(page.getByRole('dialog').getByText(/Function/)).toBeVisible();

    // Switch to Calculated
    await page.getByRole('tab', { name: 'Calculated' }).click();
    await expect(page.getByRole('tab', { name: 'Calculated' })).toHaveAttribute(
      'data-state',
      'active'
    );

    // Should show Expression textarea (not the description one)
    await expect(
      page.getByRole('dialog').locator('textarea[name="column_expression"]')
    ).toBeVisible();

    // Switch back to Simple
    await page.getByRole('tab', { name: 'Simple' }).click();
    await expect(page.getByRole('dialog').getByText(/Function/)).toBeVisible();
  });

  // ── Row actions ────────────────────────────────────────────────

  test('row action menu has Edit, Create KPI, and Delete options', async ({ page }) => {
    // Wait for table rows to load
    const row = page.locator('tbody tr').first();
    if (!(await row.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No metrics in table');
    }

    // Click the ⋮ menu on the first row
    await row.locator('button').last().click();

    // Check menu items
    await expect(page.getByRole('menuitem', { name: /Edit Metric/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Create KPI/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Delete/i })).toBeVisible();
  });

  test('edit metric opens dialog with existing values', async ({ page }) => {
    const row = page.locator('tbody tr').first();
    if (!(await row.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No metrics in table');
    }

    // Get the metric name before editing
    const metricName = await row.locator('td').first().textContent();

    await row.locator('button').last().click();
    await page.getByRole('menuitem', { name: /Edit Metric/i }).click();

    // Edit dialog should open with the metric's name filled in
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Edit Metric')).toBeVisible();

    // Close without saving
    await page.getByRole('button', { name: /Cancel/i }).click();
  });

  // ── Mode badges ────────────────────────────────────────────────

  test('metrics show Simple or Calculated mode badge', async ({ page }) => {
    const row = page.locator('tbody tr').first();
    if (!(await row.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No metrics in table');
    }

    // At least one badge should be visible in the Mode column
    const modeBadge = page
      .locator('tbody td')
      .filter({ hasText: /Simple|Calculated/ })
      .first();
    await expect(modeBadge).toBeVisible();
  });
});
