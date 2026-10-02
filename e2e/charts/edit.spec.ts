import { test, expect } from '../support/fixtures';
import { e2eTitle } from '../support/env';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import { waitForEChart } from '../support/render';
import type { Page } from '@playwright/test';
import { type CreatedChart, createChart, gotoChartEdit } from './helpers-core';

/** MATRIX §1.4 — /charts/[id]/edit. */

// TODO testid: SaveOptionsDialog / UnsavedChangesExitDialog content have no testid → role
const saveDialog = (page: Page) => page.getByRole('dialog', { name: /Save (Chart|as New Chart)/ });
const exitDialog = (page: Page) => page.getByRole('dialog', { name: 'Unsaved Changes' });

async function renameInEditor(page: Page, title: string) {
  const input = page.getByTestId('chart-name-input');
  await input.fill(title);
  await expect(input).toHaveValue(title);
}

async function waitForPreview(page: Page) {
  await waitForEChart(page.getByRole('tabpanel', { name: 'CHART' }));
}

test.describe('charts edit', () => {
  // ---- C-E1 load per type ---------------------------------------------------------------

  test('C-E1 bar: form shows saved dataset, X axis, metric', async ({ page, api, track }) => {
    const chart = await createChart(api, track, 'bar', 'edit-load-bar');
    await gotoChartEdit(page, chart);
    await expect(page.getByTestId('chart-dataset-select-input')).toHaveValue(
      'production.mart_education_program'
    );
    await expect(page.getByTestId('chart-x-axis-select-input')).toHaveValue('statename');
    await expect(page.getByTestId('metric-trigger-0')).toContainText('Students');
    await expect(page.getByTestId('metric-trigger-0')).toContainText('SUM(students)');
    await expect(page.getByTestId('metric-trigger-1')).toHaveCount(0);
    await expect(page.getByTestId('chart-edit-save-button')).toBeEnabled();
    await waitForPreview(page);
  });

  test('C-E1 line: form shows date X axis and Month time grain', async ({ page, api, track }) => {
    const chart = await createChart(api, track, 'line', 'edit-load-line');
    await gotoChartEdit(page, chart);
    await expect(page.getByTestId('chart-x-axis-select-input')).toHaveValue('date');
    await expect(page.getByTestId('chart-time-grain-select')).toHaveText('Month');
    await expect(page.getByTestId('metric-trigger-0')).toContainText('SUM(students)');
    await waitForPreview(page);
  });

  test('C-E1 pie: form shows dimension and single metric (no add-metric)', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChart(api, track, 'pie', 'edit-load-pie');
    await gotoChartEdit(page, chart);
    await expect(page.getByTestId('chart-dataset-select-input')).toHaveValue(
      'production.mart_health_menstrual_distribution'
    );
    await expect(page.getByTestId('chart-x-axis-select-input')).toHaveValue('product_type');
    await expect(page.getByTestId('metric-trigger-0')).toContainText('Products');
    await expect(page.getByTestId('add-metric-button')).toHaveCount(0);
    await waitForPreview(page);
  });

  test('C-E1 number: form shows metric and saved styling', async ({ page, api, track }) => {
    const chart = await createChart(api, track, 'number', 'edit-load-number');
    await gotoChartEdit(page, chart);
    await expect(page.getByTestId('metric-trigger-0')).toContainText('SUM(students)');
    await expect(page.getByTestId('add-metric-button')).toHaveCount(0);
    await page.getByTestId('chart-styling-tab').click();
    await expect(page.getByTestId('chart-styling-subtitle')).toHaveValue('students reached');
    await waitForPreview(page);
  });

  test('C-E1 map: form shows state column and district drill-down', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChart(api, track, 'map', 'edit-load-map');
    await gotoChartEdit(page, chart);
    await expect(page.getByTestId('chart-map-state-column-select-input')).toHaveValue('statename');
    await expect(page.getByTestId('chart-map-district-column-select-input')).toHaveValue(
      'districtname'
    );
    await expect(page.getByTestId('metric-trigger-0')).toContainText('SUM(students)');
    await expect(page.getByTestId('chart-edit-save-button')).toBeEnabled();
  });

  test('C-E1 table: form shows both dimensions and drill-down on', async ({ page, api, track }) => {
    const chart = await createChart(api, track, 'table', 'edit-load-table');
    await gotoChartEdit(page, chart);
    await expect(page.getByTestId('chart-table-dimension-0-input')).toHaveValue('statename');
    await expect(page.getByTestId('chart-table-dimension-1-input')).toHaveValue('districtname');
    await expect(page.getByTestId('chart-table-drill-down-switch')).toBeChecked();
    await expect(page.getByTestId('metric-trigger-0')).toContainText('SUM(students)');
  });

  test('C-E1 pivot: form shows row/column dimensions and totals', async ({ page, api, track }) => {
    const chart = await createChart(api, track, 'pivot_table', 'edit-load-pivot');
    await gotoChartEdit(page, chart);
    await expect(page.getByTestId('pivot-row-dimension-0-input')).toHaveValue('district');
    await expect(page.getByTestId('pivot-col-dimension-0-input')).toHaveValue('severity');
    await expect(page.getByTestId('pivot-show-row-grand-total')).toBeChecked();
    await expect(page.getByTestId('pivot-show-column-grand-total')).toBeChecked();
    await expect(page.getByTestId('metric-trigger-0')).toContainText('COUNT_DISTINCT(child_id)');
  });

  test('C-E1 missing chart shows "Chart not found"-style alert', async ({ page }) => {
    await page.goto('/charts/999999999/edit');
    await expect(page.getByRole('heading', { name: 'Edit Chart' })).toBeVisible();
    await expect(page.getByText(/^Chart (needs attention|not found)$/)).toBeVisible();
  });

  test('C-E1 member without edit access sees "Access Denied"', async ({ factory, pageAs }) => {
    const chart = await factory.barChart('edit-member-denied');
    const member = await pageAs('member');
    await member.goto(`/charts/${chart.id}/edit`);
    await expect(member.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    await expect(member.getByText("You don't have edit access to this chart.")).toBeVisible();
    await expect(member.getByTestId('chart-edit-access-denied-back-btn')).toHaveText(
      'Back to Charts'
    );
    await expect(member.getByTestId('chart-name-input')).toHaveCount(0);
  });

  // ---- C-E2 / C-E3 save -----------------------------------------------------------------

  test('C-E2 Save → Update existing sends PUT and lands on detail', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChart(api, track, 'bar', 'edit-update');
    await gotoChartEdit(page, chart);
    const renamed = e2eTitle('edit-update-renamed');
    await renameInEditor(page, renamed);

    await page.getByTestId('chart-edit-save-button').click();
    await expect(saveDialog(page)).toContainText('Choose how you want to save your changes');
    const put = captureRequest(page, { method: 'PUT', url: `/api/charts/${chart.id}/` });
    await page.getByTestId('chart-save-update-existing-btn').click();
    expectPayloadSnapshot(await put, 'edit-update-existing');

    await expect(page).toHaveURL(`/charts/${chart.id}`);
    const saved = await api.get<{ title: string }>(`/api/charts/${chart.id}/`);
    expect(saved.title).toBe(renamed);
    await expect(page.getByText('Chart updated successfully!')).toBeVisible();
    // The detail page first renders the SWR-cached chart (the update doesn't invalidate
    // `/api/charts/{id}/`) and only shows the new title once its own revalidation lands —
    // timing-dependent, so assert the persisted title after a reload
    await page.reload();
    await expect(page.getByRole('heading', { name: renamed, exact: true })).toBeVisible();
  });

  test('C-E3 Save as new: name step, blank disabled, back, creates a new chart', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChart(api, track, 'bar', 'edit-saveas');
    await gotoChartEdit(page, chart);

    await page.getByTestId('chart-edit-save-button').click();
    await page.getByTestId('chart-save-as-new-btn').click();
    const name = page.getByTestId('chart-save-new-title-input');
    await expect(saveDialog(page)).toContainText('Save as New Chart');
    await expect(name).toHaveValue(chart.title);
    await name.fill('   ');
    await expect(page.getByTestId('chart-save-new-confirm-btn')).toBeDisabled();

    await page.getByTestId('chart-save-new-back-btn').click();
    await expect(page.getByTestId('chart-save-update-existing-btn')).toBeVisible();
    await page.getByTestId('chart-save-as-new-btn').click();
    await page.getByTestId('chart-save-new-back-arrow-btn').click();
    await expect(page.getByTestId('chart-save-as-new-btn')).toBeVisible();

    await page.getByTestId('chart-save-as-new-btn').click();
    const newTitle = e2eTitle('edit-saveas-copy');
    await name.fill(`  ${newTitle}  `);
    await expect(page.getByTestId('chart-save-new-confirm-btn')).toHaveText('CREATE NEW CHART');
    const post = captureRequest(page, { method: 'POST', url: /\/api\/charts\/$/ });
    const resp = page.waitForResponse(
      (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/charts/'
    );
    await page.getByTestId('chart-save-new-confirm-btn').click();
    const created = (await (await resp).json()) as CreatedChart;
    track('charts', created.id);
    expectPayloadSnapshot(await post, 'edit-save-as-new'); // title is trimmed

    expect(created.id).not.toBe(chart.id);
    await expect(page).toHaveURL(`/charts/${created.id}`);
    await expect(page.getByText(`Chart "${newTitle}" created successfully!`)).toBeVisible();
    const original = await api.get<{ title: string }>(`/api/charts/${chart.id}/`);
    expect(original.title).toBe(chart.title);
  });

  // ---- C-E4 cancel / back ---------------------------------------------------------------

  test('C-E4 no changes: Cancel and Back go straight to detail', async ({ page, api, track }) => {
    const chart = await createChart(api, track, 'bar', 'edit-clean');
    await gotoChartEdit(page, chart);
    await waitForPreview(page);
    await page.getByTestId('chart-edit-cancel-button').click();
    await expect(page).toHaveURL(`/charts/${chart.id}`);

    await gotoChartEdit(page, chart);
    await waitForPreview(page);
    await expect(page.getByTestId('chart-edit-back-button')).toHaveText('Back');
    await page.getByTestId('chart-edit-back-button').click();
    await expect(page).toHaveURL(`/charts/${chart.id}`);
  });

  test('C-E4 Cancel with changes: Stay keeps editing, Leave discards (no PUT)', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChart(api, track, 'bar', 'edit-cancel-dirty');
    await gotoChartEdit(page, chart);
    const edited = e2eTitle('edit-cancel-dirty-x');
    await renameInEditor(page, edited);
    let putSent = false;
    page.on('request', (r) => {
      if (r.method() === 'PUT' && r.url().includes(`/api/charts/${chart.id}/`)) putSent = true;
    });

    await page.getByTestId('chart-edit-cancel-button').click();
    await expect(exitDialog(page)).toContainText(
      'You have unsaved changes. What would you like to do?'
    );
    await page.getByTestId('chart-unsaved-stay-btn').click();
    await expect(exitDialog(page)).toBeHidden();
    await expect(page.getByTestId('chart-name-input')).toHaveValue(edited);

    await page.getByTestId('chart-edit-cancel-button').click();
    await page.getByTestId('chart-unsaved-leave-btn').click();
    await expect(page).toHaveURL(`/charts/${chart.id}`);
    await expect(page.getByRole('heading', { name: chart.title })).toBeVisible();
    expect(putSent).toBe(false);
  });

  test('C-E4 Cancel with changes → Save and leave → update → returns to /charts', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChart(api, track, 'bar', 'edit-save-leave');
    await gotoChartEdit(page, chart);
    const edited = e2eTitle('edit-save-leave-x');
    await renameInEditor(page, edited);

    await page.getByTestId('chart-edit-cancel-button').click();
    await page.getByTestId('chart-unsaved-save-and-leave-btn').click();
    await expect(exitDialog(page)).toBeHidden();
    const put = captureRequest(page, { method: 'PUT', url: `/api/charts/${chart.id}/` });
    await page.getByTestId('chart-save-update-existing-btn').click();
    await put;
    await expect(page).toHaveURL('/charts');
    const saved = await api.get<{ title: string }>(`/api/charts/${chart.id}/`);
    expect(saved.title).toBe(edited);
  });

  test('C-E4 Back with changes: confirm dialog — Cancel stays, Leave goes to detail', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChart(api, track, 'bar', 'edit-back-dirty');
    await gotoChartEdit(page, chart);
    await renameInEditor(page, e2eTitle('edit-back-dirty-x'));

    await page.getByTestId('chart-edit-back-button').click();
    const confirm = page.getByTestId('chart-edit-leave-confirm');
    await expect(confirm).toContainText('Unsaved Changes');
    await expect(confirm).toContainText(
      'You have unsaved changes. Are you sure you want to leave without saving?'
    );
    await page.getByTestId('chart-edit-leave-confirm-cancel-btn').click();
    await expect(confirm).toBeHidden();
    await expect(page).toHaveURL(`/charts/${chart.id}/edit`);

    await page.getByTestId('chart-edit-back-button').click();
    await expect(page.getByTestId('chart-edit-leave-confirm-confirm-btn')).toHaveText(
      'LEAVE WITHOUT SAVING'
    );
    await page.getByTestId('chart-edit-leave-confirm-confirm-btn').click();
    await expect(page).toHaveURL(`/charts/${chart.id}`);
  });

  test('C-E4 reverting the change clears the dirty state', async ({ page, api, track }) => {
    const chart = await createChart(api, track, 'bar', 'edit-revert');
    await gotoChartEdit(page, chart);
    await renameInEditor(page, e2eTitle('edit-revert-x'));
    await renameInEditor(page, chart.title);
    await page.getByTestId('chart-edit-cancel-button').click();
    await expect(page).toHaveURL(`/charts/${chart.id}`);
  });

  // ---- C-E5 invalid config --------------------------------------------------------------

  test('C-E5 invalid config: overlay, save disabled, last-good preview kept, dismiss', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChart(api, track, 'bar', 'edit-invalid');
    await gotoChartEdit(page, chart);
    await waitForPreview(page);
    const overlay = page.getByTestId('chart-config-incomplete-overlay');
    await expect(overlay).toBeHidden();

    await page.getByTestId('remove-metric-0').click();
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText(
      'Please check the dataset or metric column to complete the chart configuration'
    );
    await expect(overlay).toContainText('✕ Click to dismiss');
    await expect(page.getByTestId('chart-edit-save-button')).toBeDisabled();
    // last valid chart keeps rendering underneath
    await expect(
      page
        .getByRole('tabpanel', { name: 'CHART' })
        .locator('div[_echarts_instance_] canvas')
        .first()
    ).toBeVisible();

    await overlay.click();
    await expect(overlay).toBeHidden();

    // a key-field change re-validates: adding COUNT(*) makes the config valid again
    await page.getByTestId('add-metric-button').click();
    await expect(page.getByTestId('metric-trigger-0')).toContainText('Total Count');
    await expect(page.getByTestId('chart-edit-save-button')).toBeEnabled();
    await expect(overlay).toBeHidden();
  });

  // ---- C-E6 navigation source -----------------------------------------------------------

  for (const [from, label, origin] of [
    ['dashboard', 'Back to Dashboard', '/dashboards'],
    ['report', 'Back to Report', '/reports'],
  ] as const) {
    test(`C-E6 ?from=${from}: "${label}" and Cancel return to the origin`, async ({
      page,
      api,
      track,
    }) => {
      const chart = await createChart(api, track, 'bar', `edit-from-${from}`);
      await page.goto(origin);
      await gotoChartEdit(page, chart, `?from=${from}`);
      const back = page.getByTestId('chart-edit-back-button');
      await expect(back).toHaveText(label);
      await back.click();
      await expect(page).toHaveURL(origin);

      await gotoChartEdit(page, chart, `?from=${from}`);
      await page.getByTestId('chart-edit-cancel-button').click();
      await expect(page).toHaveURL(origin);
    });
  }

  test('C-E6 ?from=dashboard: update replaces history → detail keeps from, back → dashboard', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChart(api, track, 'bar', 'edit-from-dash-save');
    await page.goto('/dashboards');
    await gotoChartEdit(page, chart, '?from=dashboard');
    await renameInEditor(page, e2eTitle('edit-from-dash-save-x'));
    await page.getByTestId('chart-edit-save-button').click();
    await page.getByTestId('chart-save-update-existing-btn').click();
    await expect(page).toHaveURL(`/charts/${chart.id}?from=dashboard`);
    await expect(page.getByTestId('chart-detail-back-dashboard')).toHaveText('Back to Dashboard');
    await page.goBack();
    await expect(page).toHaveURL('/dashboards');
  });

  test('C-E6 ?from=report with changes: Leave without saving goes back to the report', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChart(api, track, 'bar', 'edit-from-report-leave');
    await page.goto('/reports');
    await gotoChartEdit(page, chart, '?from=report');
    await renameInEditor(page, e2eTitle('edit-from-report-leave-x'));
    await page.getByTestId('chart-edit-cancel-button').click();
    await page.getByTestId('chart-unsaved-leave-btn').click();
    await expect(page).toHaveURL('/reports');
  });

  // ---- C-E7 create vs edit differences --------------------------------------------------

  for (const type of ['bar', 'pie'] as const) {
    test(`[pinned] C-E7 ${type}: create sends count + create defaults, preview page size 20`, async ({
      page,
    }) => {
      // The builder is duplicated (configure vs edit page) with differing defaults
      const data = captureRequest(page, { method: 'POST', url: '/api/charts/chart-data/' });
      // the DATA tab's preview is fetched eagerly on load (SWR), not on tab click
      const preview = captureRequest(page, {
        method: 'POST',
        url: '/api/charts/chart-data-preview/?',
      });
      await page.goto(
        `/charts/new/configure?schema=production&table=mart_education_program&type=${type}`
      );
      const captured = await data;
      expectPayloadSnapshot(captured, `create-${type}-chart-data-defaults`);
      const body = captured.body as { aggregate_func: string; customizations: object };
      expect(body.aggregate_func).toBe('count');
      expect(body.customizations).not.toHaveProperty('legendDisplay');
      expect((await preview).query.limit).toBe(20);
    });

    test(`[pinned] C-E7 ${type}: edit fills edit defaults, preview page size 25`, async ({
      page,
      api,
      track,
    }) => {
      // Saved chart without customizations/aggregate_function → edit page's own defaults apply
      const chart = await createChart(api, track, type, `edit-defaults-${type}`, (b) => {
        const extra = { ...b.extra_config };
        delete extra.customizations;
        return { ...b, extra_config: extra };
      });
      const data = captureRequest(page, { method: 'POST', url: '/api/charts/chart-data/' });
      const preview = captureRequest(page, {
        method: 'POST',
        url: '/api/charts/chart-data-preview/?',
      });
      await gotoChartEdit(page, chart);
      const captured = await data;
      expectPayloadSnapshot(captured, `edit-${type}-chart-data-defaults`);
      const body = captured.body as { customizations: Record<string, unknown> };
      expect(body.customizations.legendDisplay).toBe('paginated');
      expect(body.customizations.legendPosition).toBe('top');
      expect((await preview).query.limit).toBe(25);
    });
  }
});
