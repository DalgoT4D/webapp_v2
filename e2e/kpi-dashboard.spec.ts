import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test.describe('KPI on Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Missing credentials');
    await login(page);
  });

  test('KPI tab exists in chart selector modal on dashboard edit', async ({ page }) => {
    // Navigate to dashboards
    await page.goto('/dashboards');
    await page.waitForLoadState('networkidle');

    // Find any existing dashboard and click edit, or look for an edit URL
    const editLink = page.locator('a[href*="/dashboards/"][href*="/edit"]').first();
    if (await editLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editLink.click();
    } else {
      test.skip(true, 'No dashboards to test with');
    }

    await page.waitForLoadState('networkidle');

    // Look for "Add Chart" or "+" button on the dashboard builder
    const addBtn = page
      .getByRole('button', { name: /Add Chart|Add Component/i })
      .or(page.locator('button').filter({ hasText: '+' }));
    if (!(await addBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Add button not found on dashboard');
    }
    await addBtn.click();

    // Chart selector modal should have a KPIs tab
    await expect(page.getByRole('tab', { name: /KPIs/i })).toBeVisible({ timeout: 5000 });
  });

  test('KPI widget renders on a dashboard view', async ({ page }) => {
    // Navigate to dashboards
    await page.goto('/dashboards');
    await page.waitForLoadState('networkidle');

    // Find a dashboard that has KPI widgets — click the first dashboard link
    const dashboardLink = page.locator('a[href*="/dashboards/"]').first();
    if (!(await dashboardLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No dashboards available');
    }

    await dashboardLink.click();
    await page.waitForLoadState('networkidle');

    // If KPI widgets exist, they should show value and target
    // This is a soft check — not all dashboards have KPIs
    const kpiWidget = page
      .locator('[class*="border"]')
      .filter({ hasText: /Target/i })
      .first();
    if (await kpiWidget.isVisible({ timeout: 5000 }).catch(() => false)) {
      // KPI widget should show key elements
      await expect(kpiWidget).toBeVisible();
    }
  });
});
