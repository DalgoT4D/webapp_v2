import { test, expect } from '../support/fixtures';
import { expectPayloadSnapshot, type CapturedRequest } from '../support/payload';
import { expectChartScreenshot } from '../support/render';
import type { Page } from '@playwright/test';
import { API, field, MtpBuilder, RequestLog } from './helpers-mtp';

/**
 * MATRIX §1.3 Pivot + §1.4 C-E2 (update PUT). Renders with the pivot-* testids from PR #384.
 * Dataset: production.mart_education_program. Pivot cells come back sorted by key → stable shots.
 */

const SUM = 'SUM(students)';
const STATES = 6;
// PRESET_COLORS[0] (#C8E6C9) and TABLE_THEMES header / zebra colours
const LIGHT_GREEN = 'rgb(200, 230, 201)';
const NO_BG = 'rgba(0, 0, 0, 0)';
const GRAY_HEADER = 'rgb(243, 244, 246)';
const BLUE_HEADER = 'rgb(219, 234, 254)';
const GRAY_ZEBRA = 'rgb(249, 250, 251)';
const WHITE = 'rgb(255, 255, 255)';
// e.g. 14,178,659
const INTL = /^\d{1,3}(,\d{3})+$/;
const num = (text: string | null) => Number((text ?? '').replace(/,/g, ''));

const json = (v: unknown) => JSON.stringify(v);
const pivotData = (rows: string[], cols: string[]) => (c: CapturedRequest) =>
  json(field(c.body, 'row_dimensions')) === json(rows) &&
  json(field(c.body, 'column_dimensions')) === json(cols);
const flag = (key: string, value: boolean) => (c: CapturedRequest) => field(c.body, key) === value;

function pivot(page: Page) {
  return page.getByTestId('pivot-table');
}

/** Opens the create builder (auto-prefill: rows [id], columns [date], COUNT). */
async function openPivot(page: Page) {
  const b = new MtpBuilder(page);
  await b.openCreate('pivot_table');
  await expect(page.getByTestId('pivot-table-chart')).toBeVisible();
  return b;
}

/**
 * Rows `rows`, columns `cols`, metric SUM(students). Waits for the matching chart-data request
 * and the rendered rows.
 */
async function openPivotWith(page: Page, rows: string[], cols: string[]) {
  const b = await openPivot(page);
  b.chartData.mark();
  await b.setSimpleMetric(0, 'sum', 'students');
  for (const [i, col] of rows.entries()) {
    if (i > 0) await page.getByTestId('add-row-dimension-btn').click();
    await b.pickCombobox(`pivot-row-dimension-${i}`, col);
  }
  // Prefill has one column dimension (date)
  if (cols.length === 0) await page.getByTestId('remove-col-dim-0').click();
  for (const [i, col] of cols.entries()) {
    if (i > 0) await page.getByTestId('add-col-dimension-btn').click();
    await b.pickCombobox(`pivot-col-dimension-${i}`, col);
  }
  await b.chartData.next(
    (c) => pivotData(rows, cols)(c) && field(c.body, 'metrics', 0, 'column') === 'students'
  );
  await expect(page.getByTestId('pivot-row-0')).toBeVisible();
  return b;
}

/** Value cells (last cell) of every data row — with no column dims that's the metric. */
function lastCellOfRow(page: Page, i: number) {
  return page.getByTestId(`pivot-row-${i}`).getByRole('cell').last();
}

test.describe('builder pivot — dimensions', () => {
  test('C-B1 pivot auto-prefill: first text column as rows, first date column as columns, COUNT', async ({
    page,
  }) => {
    const b = new MtpBuilder(page);
    await b.openCreate('pivot_table');
    await expect(page.getByTestId('pivot-row-dimension-0-input')).toHaveValue('id');
    await expect(page.getByTestId('pivot-col-dimension-0-input')).toHaveValue('date');
    expectPayloadSnapshot(
      await b.chartData.next(pivotData(['id'], ['date'])),
      'pivot-prefill-chart-data'
    );
    await expect(page.getByTestId('pivot-table-chart')).toBeVisible();
    await expect(page.getByTestId('chart-edit-save-button')).toBeEnabled();
  });

  test('C-B2 pivot without a metric: save disabled, "Configure your pivot table"', async ({
    page,
  }) => {
    const b = await openPivot(page);
    await page.getByTestId('remove-metric-0').click();
    await expect(page.getByTestId('chart-edit-save-button')).toBeDisabled();
    await expect(b.preview.getByText('Configure your pivot table')).toBeVisible();
  });

  test('pivot row dimension change → statename', async ({ page }) => {
    const b = await openPivot(page);
    b.chartData.mark();
    await b.pickCombobox('pivot-row-dimension-0', 'statename');
    expectPayloadSnapshot(
      await b.chartData.next(pivotData(['statename'], ['date'])),
      'pivot-row-statename-chart-data'
    );
    await expect(page.getByTestId(`pivot-row-${STATES - 1}`)).toBeVisible();
    await expect(page.getByTestId(`pivot-row-${STATES}`)).toHaveCount(0);
  });

  test('pivot add row dimension appends the first unused column; used columns hidden', async ({
    page,
  }) => {
    const b = await openPivot(page);
    await b.pickCombobox('pivot-row-dimension-0', 'statename');
    b.chartData.mark();
    await page.getByTestId('add-row-dimension-btn').click();
    await expect(page.getByTestId('pivot-row-dimension-1-input')).toHaveValue('id');
    expectPayloadSnapshot(
      await b.chartData.next(pivotData(['statename', 'id'], ['date'])),
      'pivot-row-add-chart-data'
    );
    await page.getByTestId('pivot-row-dimension-1-input').click();
    await expect(page.getByTestId('pivot-row-dimension-1-item-statename')).toHaveCount(0);
    await expect(page.getByTestId('pivot-row-dimension-1-item-districtname')).toBeVisible();
  });

  test('pivot remove row dimension; the last one cannot be removed', async ({ page }) => {
    const b = await openPivotWith(page, ['statename', 'districtname'], []);
    b.chartData.mark();
    await page.getByTestId('remove-row-dim-1').click();
    expectPayloadSnapshot(
      await b.chartData.next(pivotData(['statename'], [])),
      'pivot-row-remove-chart-data'
    );
    await expect(page.getByTestId('remove-row-dim-0')).toBeDisabled();
  });

  test('pivot column dimensions: change, add, remove to zero', async ({ page }) => {
    const b = await openPivotWith(page, ['statename'], ['climate_event']);
    b.chartData.mark();
    await page.getByTestId('add-col-dimension-btn').click();
    await b.pickCombobox('pivot-col-dimension-1', 'climate_resilience_status');
    expectPayloadSnapshot(
      await b.chartData.next(
        pivotData(['statename'], ['climate_event', 'climate_resilience_status'])
      ),
      'pivot-col-add-chart-data'
    );
    b.chartData.mark();
    await page.getByTestId('remove-col-dim-1').click();
    await page.getByTestId('remove-col-dim-0').click();
    expectPayloadSnapshot(
      await b.chartData.next(pivotData(['statename'], [])),
      'pivot-col-remove-all-chart-data'
    );
    await expect(page.getByTestId('pivot-col-dimension-0-input')).toHaveCount(0);
  });

  test('pivot render: statename × climate_event, SUM(students)', async ({ page }) => {
    const b = await openPivotWith(page, ['statename'], ['climate_event']);
    await expect(
      pivot(page).getByRole('columnheader', { name: 'flood', exact: true })
    ).toBeVisible();
    await expectChartScreenshot(b.preview, 'pivot-state-by-event');
  });
});

test.describe('builder pivot — totals', () => {
  test('pivot row subtotals need 2+ row dimensions', async ({ page }) => {
    await openPivotWith(page, ['statename'], ['climate_event']);
    await expect(page.getByTestId('pivot-show-row-subtotals')).toBeDisabled();
    await expect(page.getByTestId('pivot-show-column-subtotals')).toBeDisabled();
  });

  test('pivot row subtotals on + custom label', async ({ page }) => {
    const b = await openPivotWith(page, ['statename', 'districtname'], ['climate_event']);
    b.chartData.mark();
    await page.getByTestId('pivot-show-row-subtotals').click();
    expectPayloadSnapshot(
      await b.chartData.next(flag('show_row_subtotals', true)),
      'pivot-row-subtotals-chart-data'
    );
    const label = page.getByTestId('pivot-row-subtotal-display-name');
    await expect(label).toHaveValue('Subtotal');
    await expect(pivot(page).getByText('Assam Subtotal')).toBeVisible();
    await label.fill('State total');
    await expect(pivot(page).getByText('Assam State total')).toBeVisible();
    await expectChartScreenshot(b.preview, 'pivot-row-subtotals');
  });

  test('pivot row subtotals auto-off when row dimensions drop below 2', async ({ page, track }) => {
    const b = await openPivotWith(page, ['statename', 'districtname'], ['climate_event']);
    await page.getByTestId('pivot-show-row-subtotals').click();
    await expect(pivot(page).getByText('Assam Subtotal')).toBeVisible();
    await page.getByTestId('remove-row-dim-1').click();
    await expect(page.getByTestId('pivot-show-row-subtotals')).not.toBeChecked();
    await expect(page.getByTestId('pivot-show-row-subtotals')).toBeDisabled();
    await expect(page.getByTestId('pivot-row-subtotal-display-name')).toHaveCount(0);
    await expect(pivot(page).getByText('Assam Subtotal')).toHaveCount(0);
    // The reverted data key may be served from SWR cache, so the saved config is the payload guard
    await b.setTitle('pivot-row-subtotals-off');
    const { captured } = await b.saveCreate(track);
    expect(field(captured.body, 'extra_config', 'show_row_subtotals')).toBe(false);
    expectPayloadSnapshot(captured, 'pivot-row-subtotals-auto-off-create-post');
  });

  test('pivot column subtotals on + custom label', async ({ page }) => {
    const b = await openPivotWith(
      page,
      ['statename'],
      ['climate_event', 'climate_resilience_status']
    );
    b.chartData.mark();
    await page.getByTestId('pivot-show-column-subtotals').click();
    expectPayloadSnapshot(
      await b.chartData.next(flag('show_column_subtotals', true)),
      'pivot-col-subtotals-chart-data'
    );
    const label = page.getByTestId('pivot-column-subtotal-display-name');
    await expect(label).toHaveValue('Subtotal');
    await expect(pivot(page).getByRole('columnheader', { name: 'Subtotal' }).first()).toBeVisible();
    await label.fill('Event total');
    await expect(
      pivot(page).getByRole('columnheader', { name: 'Event total' }).first()
    ).toBeVisible();
  });

  test('pivot column subtotals auto-off when column dimensions drop below 2', async ({
    page,
    track,
  }) => {
    const b = await openPivotWith(
      page,
      ['statename'],
      ['climate_event', 'climate_resilience_status']
    );
    await page.getByTestId('pivot-show-column-subtotals').click();
    await expect(page.getByTestId('pivot-column-subtotal-display-name')).toBeVisible();
    await page.getByTestId('remove-col-dim-1').click();
    await expect(page.getByTestId('pivot-show-column-subtotals')).not.toBeChecked();
    await expect(page.getByTestId('pivot-show-column-subtotals')).toBeDisabled();
    await b.setTitle('pivot-col-subtotals-off');
    const { captured } = await b.saveCreate(track);
    expect(field(captured.body, 'extra_config', 'show_column_subtotals')).toBe(false);
    expectPayloadSnapshot(captured, 'pivot-col-subtotals-auto-off-create-post');
  });

  test('pivot row grand total needs a column dimension', async ({ page }) => {
    await openPivotWith(page, ['statename'], []);
    await expect(page.getByTestId('pivot-show-row-grand-total')).toBeDisabled();
    await expect(page.getByTestId('pivot-show-column-grand-total')).toBeEnabled();
  });

  test('pivot row grand total (right column) + custom label', async ({ page }) => {
    const b = await openPivotWith(page, ['statename'], ['climate_event']);
    b.chartData.mark();
    await page.getByTestId('pivot-show-row-grand-total').click();
    expectPayloadSnapshot(
      await b.chartData.next(flag('show_row_grand_total', true)),
      'pivot-row-grand-total-chart-data'
    );
    const label = page.getByTestId('pivot-row-grand-total-display-name');
    await expect(label).toHaveValue('Grand Total');
    await expect(pivot(page).getByRole('columnheader', { name: 'Grand Total' })).toBeVisible();
    await label.fill('All events');
    await expect(pivot(page).getByRole('columnheader', { name: 'All events' })).toBeVisible();
    await expectChartScreenshot(b.preview, 'pivot-row-grand-total');
  });

  test('pivot column grand total (bottom row) + custom label', async ({ page }) => {
    const b = await openPivotWith(page, ['statename'], ['climate_event']);
    await expect(page.getByTestId('pivot-grand-total-row')).toHaveCount(0);
    b.chartData.mark();
    await page.getByTestId('pivot-show-column-grand-total').click();
    expectPayloadSnapshot(
      await b.chartData.next(flag('show_column_grand_total', true)),
      'pivot-col-grand-total-chart-data'
    );
    await expect(page.getByTestId('pivot-grand-total-row')).toContainText('Grand Total');
    await page.getByTestId('pivot-column-grand-total-display-name').fill('All states');
    await expect(page.getByTestId('pivot-grand-total-row')).toContainText('All states');
    await expectChartScreenshot(b.preview, 'pivot-col-grand-total');
  });
});

test.describe('builder pivot — styling', () => {
  test('pivot per-metric number format (Indian, 1 decimal)', async ({ page }) => {
    const b = await openPivotWith(page, ['statename'], []);
    // Unformatted pivot values already render with thousands separators
    await expect(lastCellOfRow(page, 0)).toHaveText(INTL);
    await b.stylingTab();
    await expect(page.getByTestId(`pivot-column-row-${SUM}`)).toContainText('No Formatting');
    await page.getByTestId(`pivot-column-row-${SUM}`).click();
    await b.pickSelect(`pivot-${SUM}NumberFormat`, `pivot-${SUM}NumberFormat-option-indian`);
    await page.getByTestId(`pivot-${SUM}DecimalPlaces`).fill('1');
    await expect(lastCellOfRow(page, 0)).toHaveText(/^\d{1,2}(,\d\d)*,\d{3}\.\d$/);
    await expectChartScreenshot(b.preview, 'pivot-number-format');
    await page.getByTestId(`pivot-remove-format-${SUM}`).click();
    await expect(lastCellOfRow(page, 0)).toHaveText(INTL);
  });

  test('pivot date format for a date dimension (display only)', async ({ page }) => {
    const b = await openPivotWith(page, ['statename'], ['date']);
    const header = pivot(page).getByRole('columnheader', { name: '2025-06-01', exact: true });
    await expect(header).toBeVisible();
    await b.stylingTab();
    await expect(page.getByTestId('pivot-date-format-date')).toBeVisible();
    b.chartData.mark();
    await b.pickSelect('pivot-dateDateFormat', 'pivot-dateDateFormat-option-dd_mm_yyyy');
    await expect(
      pivot(page).getByRole('columnheader', { name: '01/06/2025', exact: true })
    ).toBeVisible();
    // customizations are not part of the pivot chart-data payload
    expect(b.chartData.since()).toHaveLength(0);
  });

  test('pivot conditional formatting (numeric rule on the metric)', async ({ page }) => {
    const b = await openPivotWith(page, ['statename'], []);
    const values: number[] = [];
    for (let i = 0; i < STATES; i++) values.push(num(await lastCellOfRow(page, i).textContent()));
    const threshold = [...values].sort((x, y) => x - y)[2];
    await b.stylingTab();
    await page.getByTestId('add-formatting-rule-btn').click();
    await expect(page.getByTestId('rule-column-0')).toHaveText(SUM);
    await b.pickSelect('rule-operator-0', 'rule-operator-0-option->=');
    await page.getByTestId('rule-value-0').fill(String(threshold));
    for (const [i, v] of values.entries()) {
      await expect(lastCellOfRow(page, i)).toHaveCSS(
        'background-color',
        v >= threshold ? LIGHT_GREEN : NO_BG
      );
    }
    await expectChartScreenshot(b.preview, 'pivot-conditional-formatting');
  });

  test('pivot freeze first column', async ({ page }) => {
    const b = await openPivotWith(page, ['statename'], ['climate_event']);
    const firstCell = page.getByTestId('pivot-row-0').getByRole('cell').first();
    await expect(firstCell).not.toHaveCSS('position', 'sticky');
    await b.stylingTab();
    await page.getByTestId('pivot-freeze-column-switch').click();
    await expect(firstCell).toHaveCSS('position', 'sticky');
  });

  test('pivot theme gray (default) → blue', async ({ page }) => {
    const b = await openPivotWith(page, ['statename'], ['climate_event']);
    const header = pivot(page).getByRole('columnheader', { name: 'statename', exact: true });
    await expect(header).toHaveCSS('background-color', GRAY_HEADER);
    await b.stylingTab();
    await page.getByTestId('theme-option-blue').click();
    await expect(header).toHaveCSS('background-color', BLUE_HEADER);
    await expectChartScreenshot(b.preview, 'pivot-theme-blue');
  });

  test('pivot zebra rows off by default → on', async ({ page }) => {
    const b = await openPivotWith(page, ['statename'], ['climate_event']);
    await expect(page.getByTestId('pivot-row-1')).toHaveCSS('background-color', WHITE);
    await b.stylingTab();
    await expect(page.getByTestId('zebra-rows-switch')).not.toBeChecked();
    await page.getByTestId('zebra-rows-switch').click();
    await expect(page.getByTestId('pivot-row-1')).toHaveCSS('background-color', GRAY_ZEBRA);
  });

  test('pivot search highlights matches', async ({ page }) => {
    await openPivotWith(page, ['statename'], ['climate_event']);
    await page.getByTestId('table-search-input').fill('Assam');
    await expect(page.getByTestId('table-search-count')).toHaveText('1 match');
    await page.getByTestId('table-search-clear-btn').click();
    await expect(page.getByTestId('table-search-count')).toHaveCount(0);
  });
});

test.describe('builder pivot — save, edit, detail', () => {
  test('C-B3 pivot save → POST payload → detail renders pivot', async ({ page, track }) => {
    const b = await openPivotWith(page, ['statename', 'districtname'], ['climate_event']);
    await page.getByTestId('pivot-show-row-subtotals').click();
    await page.getByTestId('pivot-row-subtotal-display-name').fill('State total');
    await page.getByTestId('pivot-show-column-grand-total').click();
    await b.stylingTab();
    await page.getByTestId(`pivot-column-row-${SUM}`).click();
    await b.pickSelect(`pivot-${SUM}NumberFormat`, `pivot-${SUM}NumberFormat-option-international`);
    await page.getByTestId('theme-option-blue').click();
    await page.getByTestId('zebra-rows-switch').click();
    await page.getByTestId('pivot-freeze-column-switch').click();
    await b.setTitle('pivot-save');
    const detailData = new RequestLog(page, API.chartData);
    const { captured } = await b.saveCreate(track);
    expectPayloadSnapshot(captured, 'pivot-save-create-post');
    expectPayloadSnapshot(await detailData.next(), 'pivot-save-detail-chart-data');
    await expect(page.getByTestId('pivot-table-chart')).toBeVisible();
    await expect(page.getByTestId('pivot-grand-total-row')).toBeVisible();
    await expect(pivot(page).getByText('Assam State total')).toBeVisible();
    await expectChartScreenshot(page.getByTestId('pivot-table-chart'), 'pivot-save-detail');
  });

  test('C-E2 pivot edit round trip → PUT payload', async ({ page, track }) => {
    const b = await openPivotWith(page, ['statename'], ['climate_event']);
    await b.setTitle('pivot-roundtrip');
    const { id } = await b.saveCreate(track);
    const edit = new MtpBuilder(page);
    await edit.openEdit(id);
    await expect(page.getByTestId('pivot-row-dimension-0-input')).toHaveValue('statename');
    await expect(page.getByTestId('pivot-col-dimension-0-input')).toHaveValue('climate_event');
    await page.getByTestId('add-row-dimension-btn').click();
    await edit.pickCombobox('pivot-row-dimension-1', 'districtname');
    await page.getByTestId('pivot-show-row-grand-total').click();
    expectPayloadSnapshot(await edit.saveUpdate(id), 'pivot-roundtrip-put');
  });
});
