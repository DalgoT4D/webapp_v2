import { test, expect } from '../support/fixtures';
import { expectPayloadSnapshot, type CapturedRequest } from '../support/payload';
import { expectChartScreenshot } from '../support/render';
import type { Page } from '@playwright/test';
import {
  API,
  createChartViaApi,
  field,
  isAggregatedPreview,
  dragTo,
  MtpBuilder,
  RequestLog,
  tableBodyRows,
  tableColumnCells,
  tableHeader,
  tableHeaders,
} from './helpers-mtp';
import { fetchForRewrite } from '../support/routes';

/**
 * MATRIX §1.3 Table + §1.5 C-D4 (table drill-down) + §1.4 C-E2 (update PUT).
 * Dataset: production.mart_education_program — 6 states × 2 districts, 13 monthly rows each (156).
 * Aggregated rows come back unordered, so every screenshot test sorts by a unique metric first.
 */

const SUM = 'SUM(students)';
const TOTAL_ROWS = 156;

// PRESET_COLORS in components/charts/types/table/constants.ts
const LIGHT_GREEN = 'rgb(200, 230, 201)'; // #C8E6C9 (default rule colour, swatch 0)
const LIGHT_BLUE = 'rgb(187, 222, 251)'; // #BBDEFB (swatch 3)
const LIGHT_RED = 'rgb(255, 205, 210)'; // #FFCDD2 (swatch 1)
const NO_BG = 'rgba(0, 0, 0, 0)';
// TABLE_THEMES header / zebra colours
const GRAY_HEADER = 'rgb(243, 244, 246)';
const BLUE_HEADER = 'rgb(219, 234, 254)';
const GRAY_ZEBRA = 'rgb(249, 250, 251)';
const WHITE = 'rgb(255, 255, 255)';

const dims = (c: CapturedRequest) => JSON.stringify(field(c.body, 'dimensions'));
const previewWithDims =
  (...d: string[]) =>
  (c: CapturedRequest) =>
    isAggregatedPreview(c) && dims(c) === JSON.stringify(d);

async function openTable(page: Page) {
  const b = new MtpBuilder(page);
  await b.openCreate('table');
  return b;
}

/** statename + districtname, SUM(students), sorted by SUM asc → 12 deterministic rows. */
async function openStateDistrictTable(page: Page) {
  const b = await openTable(page);
  await b.pickCombobox('chart-table-dimension-0', 'statename');
  await page.getByTestId('chart-table-dimension-add-btn').click();
  await b.pickCombobox('chart-table-dimension-1', 'districtname');
  await b.setSimpleMetric(0, 'sum', 'students');
  b.dataPreview.mark();
  await b.pickCombobox('chart-sort-column-select', SUM);
  await b.dataPreview.next(
    (c) =>
      previewWithDims('statename', 'districtname')(c) &&
      field(c.body, 'extra_config', 'sort', 0, 'column') === SUM
  );
  await expect(tableBodyRows(b.preview)).toHaveCount(12);
  return b;
}

async function expectRowsText(b: MtpBuilder, text: string) {
  await expect(b.preview.getByText(text)).toBeVisible();
}

test.describe('builder table — dimensions', () => {
  test('C-B1 table auto-prefill: first text column (id) + Total Count', async ({ page }) => {
    const b = new MtpBuilder(page);
    await b.openCreate('table');
    await expect(page.getByTestId('chart-table-dimension-0-input')).toHaveValue('id');
    await expect(page.getByTestId('metric-trigger-0')).toContainText('Total Count');
    expectPayloadSnapshot(await b.dataPreview.next(previewWithDims('id')), 'table-prefill-preview');
    await expectRowsText(b, `Showing 1 to 20 of ${TOTAL_ROWS} rows`);
    await expect(page.getByTestId('chart-table-page-info')).toHaveText('Page 1 of 8');
    // C-B2: table is savable with just dataset + title
    await expect(page.getByTestId('chart-edit-save-button')).toBeEnabled();
    b.dataPreview.mark();
    await b.pickCombobox('chart-sort-column-select', 'id');
    await b.dataPreview.next((c) => field(c.body, 'extra_config', 'sort', 0, 'column') === 'id');
    await expectChartScreenshot(b.preview, 'table-prefill');
  });

  test('table dimension change → statename', async ({ page }) => {
    const b = await openTable(page);
    b.dataPreview.mark();
    await b.pickCombobox('chart-table-dimension-0', 'statename');
    expectPayloadSnapshot(
      await b.dataPreview.next(previewWithDims('statename')),
      'table-dim-statename-preview'
    );
    await expect(tableBodyRows(b.preview)).toHaveCount(6);
    expect(await tableHeaders(b.preview)).toEqual(['statename', 'Total Count']);
  });

  test('table ADD DIMENSION(s) appends the first unused column', async ({ page }) => {
    const b = await openTable(page);
    await b.pickCombobox('chart-table-dimension-0', 'statename');
    b.dataPreview.mark();
    await page.getByTestId('chart-table-dimension-add-btn').click();
    // Column order of the table: id is the first column not yet used
    await expect(page.getByTestId('chart-table-dimension-1-input')).toHaveValue('id');
    expectPayloadSnapshot(
      await b.dataPreview.next(previewWithDims('statename', 'id')),
      'table-dim-add-preview'
    );
  });

  test('table multi dimensions statename + districtname', async ({ page }) => {
    const b = await openTable(page);
    await b.pickCombobox('chart-table-dimension-0', 'statename');
    await page.getByTestId('chart-table-dimension-add-btn').click();
    b.dataPreview.mark();
    await b.pickCombobox('chart-table-dimension-1', 'districtname');
    expectPayloadSnapshot(
      await b.dataPreview.next(previewWithDims('statename', 'districtname')),
      'table-dim-multi-preview'
    );
    await expect(tableBodyRows(b.preview)).toHaveCount(12);
  });

  test('table multi dimensions render (sorted by SUM)', async ({ page }) => {
    const b = await openStateDistrictTable(page);
    expect(await tableHeaders(b.preview)).toEqual(['statename', 'districtname', SUM]);
    await expectChartScreenshot(b.preview, 'table-state-district');
  });

  test('table remove dimension; last one cannot be removed', async ({ page }) => {
    const b = await openStateDistrictTable(page);
    b.dataPreview.mark();
    await page.getByTestId('chart-table-dimension-remove-1').click();
    expectPayloadSnapshot(
      await b.dataPreview.next(previewWithDims('statename')),
      'table-dim-remove-preview'
    );
    await expect(page.getByTestId('chart-table-dimension-1-input')).toHaveCount(0);
    await expect(page.getByTestId('chart-table-dimension-remove-0')).toBeDisabled();
  });

  test('table reorder dimensions (drag handle)', async ({ page }) => {
    const b = await openTable(page);
    await b.pickCombobox('chart-table-dimension-0', 'statename');
    await page.getByTestId('chart-table-dimension-add-btn').click();
    await b.pickCombobox('chart-table-dimension-1', 'districtname');
    b.dataPreview.mark();
    await dragTo(
      page.getByTestId('chart-table-dimension-drag-0'),
      page.getByTestId('chart-table-dimension-drag-1')
    );
    expectPayloadSnapshot(
      await b.dataPreview.next(previewWithDims('districtname', 'statename')),
      'table-dim-reorder-preview'
    );
    await expect(page.getByTestId('chart-table-dimension-0-input')).toHaveValue('districtname');
  });
});

test.describe('builder table — drill-down', () => {
  test('table drill-down toggle → only the first dimension is queried', async ({ page }) => {
    const b = await openStateDistrictTable(page);
    b.dataPreview.mark();
    await page.getByTestId('chart-table-drill-down-switch').click();
    await expect(
      page.getByText('Drill-down will follow the order: statename → districtname')
    ).toBeVisible();
    expectPayloadSnapshot(
      await b.dataPreview.next(previewWithDims('statename')),
      'table-drill-on-preview'
    );
    await expect(page.getByTestId('chart-table-drill-cell-0-statename')).toBeVisible();
  });

  test('[pinned] table drill-down cell click → equals filter + next dimension; last level no-op; ← Back', async ({
    page,
  }) => {
    const b = await openStateDistrictTable(page);
    await page.getByTestId('chart-table-drill-down-switch').click();
    const cell = page.getByTestId('chart-table-drill-cell-0-statename');
    await expect(cell).toBeVisible();
    const state = (await cell.textContent())!.trim();
    b.dataPreview.mark();
    await cell.click();
    expectPayloadSnapshot(
      await b.dataPreview.next(
        (c) =>
          previewWithDims('districtname')(c) &&
          field(c.body, 'extra_config', 'filters', 0, 'value') === state
      ),
      'table-drill-click-preview'
    );
    await expect(page.getByText(`statename: ${state}`)).toBeVisible();
    await expect(tableBodyRows(b.preview)).toHaveCount(2);
    // [pinned] the last level still renders as a clickable drill cell, but clicking is a no-op
    const lastLevel = page.getByTestId('chart-table-drill-cell-0-districtname');
    await expect(lastLevel).toBeVisible();
    await lastLevel.click();
    await expect(tableBodyRows(b.preview)).toHaveCount(2);
    await expect(page.getByText(`statename: ${state}`)).toBeVisible();
    await page.getByTestId('chart-table-drill-back-btn').click();
    await expect(page.getByTestId('chart-table-drill-back-btn')).toHaveCount(0);
    await expect(page.getByTestId('chart-table-drill-cell-0-statename')).toBeVisible();
  });
});

test.describe('builder table — styling', () => {
  test('table freeze first column', async ({ page }) => {
    const b = await openStateDistrictTable(page);
    await expect(tableHeader(b.preview, 'statename')).not.toHaveCSS('position', 'sticky');
    await b.stylingTab();
    await page.getByTestId('freeze-column-switch').click();
    await expect(page.getByTestId('freeze-column-switch')).toBeChecked();
    await expect(tableHeader(b.preview, 'statename')).toHaveCSS('position', 'sticky');
    const [first] = await tableColumnCells(b.preview, 'statename');
    await expect(first).toHaveCSS('position', 'sticky');
  });

  test('table column alignment default (auto): first left, last right', async ({ page }) => {
    const b = await openStateDistrictTable(page);
    await b.stylingTab();
    await expect(page.getByTestId('alignment-statename')).toHaveText('Auto');
    await expect(tableHeader(b.preview, 'statename')).toHaveCSS('text-align', 'left');
    await expect(tableHeader(b.preview, SUM)).toHaveCSS('text-align', 'right');
  });

  for (const align of ['left', 'center', 'right']) {
    test(`table column alignment ${align}`, async ({ page }) => {
      const b = await openStateDistrictTable(page);
      await b.stylingTab();
      await b.pickSelect('alignment-districtname', `alignment-districtname-option-${align}`);
      await expect(tableHeader(b.preview, 'districtname')).toHaveCSS('text-align', align);
      const [first] = await tableColumnCells(b.preview, 'districtname');
      await expect(first).toHaveCSS('text-align', align);
    });
  }

  test('table column order via column formatting drag', async ({ page }) => {
    const b = await openStateDistrictTable(page);
    await b.stylingTab();
    await dragTo(page.getByTestId(`column-drag-${SUM}`), page.getByTestId('column-drag-statename'));
    await expect.poll(() => tableHeaders(b.preview)).toEqual([SUM, 'statename', 'districtname']);
  });

  test('table number format per column (International, 2 decimals)', async ({ page }) => {
    const b = await openStateDistrictTable(page);
    await b.stylingTab();
    await expect(page.getByTestId(`column-row-${SUM}`)).toContainText('No Formatting');
    await page.getByTestId(`column-row-${SUM}`).click();
    await b.pickSelect(`table-${SUM}NumberFormat`, `table-${SUM}NumberFormat-option-international`);
    await page.getByTestId(`table-${SUM}DecimalPlaces`).fill('2');
    const [first] = await tableColumnCells(b.preview, SUM);
    await expect(first).toHaveText(/^\d{1,3}(,\d{3})+\.00$/);
    await page.getByTestId(`column-row-${SUM}`).click();
    await expect(page.getByTestId(`column-row-${SUM}`)).toContainText('International • 2 dec');
    await expectChartScreenshot(b.preview, 'table-number-format');
    await page.getByTestId(`remove-format-${SUM}`).click();
    await expect(first).toHaveText(/^\d+$/);
  });

  test('table number formatting lists only numeric columns', async ({ page }) => {
    const b = await openStateDistrictTable(page);
    await b.stylingTab();
    await expect(page.getByTestId(`column-row-${SUM}`)).toBeVisible();
    await expect(page.getByTestId('column-row-statename')).toHaveCount(0);
    await expect(page.getByText('No date columns to format.')).toBeVisible();
  });

  test('table date format per column (dd/mm/yyyy) + reset', async ({ page }) => {
    const b = await openTable(page);
    b.dataPreview.mark();
    await b.pickCombobox('chart-table-dimension-0', 'date');
    await b.dataPreview.next(previewWithDims('date'));
    await expect(tableBodyRows(b.preview)).toHaveCount(13);
    await b.stylingTab();
    await page.getByTestId('table-date-column-toggle-date').click();
    await b.pickSelect('table-date-dateDateFormat', 'table-date-dateDateFormat-option-dd_mm_yyyy');
    const cells = await tableColumnCells(b.preview, 'date');
    await expect(cells[0]).toHaveText(/^\d{2}\/\d{2}\/\d{4}$/);
    await page.getByTestId('table-date-column-reset-date').click();
    await expect(cells[0]).toHaveText(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('table conditional formatting: empty state + ADD RULE defaults to first column (text)', async ({
    page,
  }) => {
    const b = await openStateDistrictTable(page);
    await b.stylingTab();
    await expect(
      page.getByText('No rules defined. Add a rule to highlight cells based on conditions.')
    ).toBeVisible();
    await page.getByTestId('add-formatting-rule-btn').click();
    await expect(page.getByTestId('rule-column-0')).toHaveText('statename');
    await expect(page.getByTestId('rule-operator-0')).toHaveText('Equal to (==)');
    await expect(page.getByTestId('formatting-rule-0')).toContainText(
      'Exact match, case-sensitive.'
    );
    await page.getByTestId('delete-rule-0').click();
    await expect(page.getByTestId('formatting-rule-0')).toHaveCount(0);
  });

  const numericOps: Array<{ op: string; test: (v: number, t: number) => boolean }> = [
    { op: '>', test: (v, t) => v > t },
    { op: '<', test: (v, t) => v < t },
    { op: '>=', test: (v, t) => v >= t },
    { op: '<=', test: (v, t) => v <= t },
    { op: '==', test: (v, t) => v === t },
    { op: '!=', test: (v, t) => v !== t },
  ];

  for (const { op, test: matches } of numericOps) {
    test(`table conditional formatting numeric ${op}`, async ({ page }) => {
      const b = await openStateDistrictTable(page);
      const cells = await tableColumnCells(b.preview, SUM);
      // Threshold = an actual value, so ==/>=/<= have a boundary hit
      const threshold = Number((await cells[5].textContent())!.trim());
      await b.stylingTab();
      await page.getByTestId('add-formatting-rule-btn').click();
      await b.pickSelect('rule-column-0', `rule-column-0-option-${SUM}`);
      await b.pickSelect('rule-operator-0', `rule-operator-0-option-${op}`);
      await page.getByTestId('rule-value-0').fill(String(threshold));
      for (const cell of cells) {
        const value = Number((await cell.textContent())!.trim());
        await expect(cell).toHaveCSS(
          'background-color',
          matches(value, threshold) ? LIGHT_GREEN : NO_BG
        );
      }
    });
  }

  for (const op of ['==', '!=']) {
    test(`table conditional formatting text ${op} (exact, case-sensitive)`, async ({ page }) => {
      const b = await openStateDistrictTable(page);
      await b.stylingTab();
      await page.getByTestId('add-formatting-rule-btn').click();
      await b.pickSelect('rule-operator-0', `rule-operator-0-option-${op}`);
      await page.getByTestId('rule-value-0').fill('Assam');
      for (const cell of await tableColumnCells(b.preview, 'statename')) {
        const isAssam = (await cell.textContent())!.trim() === 'Assam';
        await expect(cell).toHaveCSS(
          'background-color',
          (op === '==') === isAssam ? LIGHT_GREEN : NO_BG
        );
      }
      // Case-sensitive: 'assam' matches nothing for ==
      await page.getByTestId('rule-value-0').fill('assam');
      const [first] = await tableColumnCells(b.preview, 'statename');
      await expect(first).toHaveCSS('background-color', op === '==' ? NO_BG : LIGHT_GREEN);
    });
  }

  test('table conditional formatting colour swatch', async ({ page }) => {
    const b = await openStateDistrictTable(page);
    await b.stylingTab();
    await page.getByTestId('add-formatting-rule-btn').click();
    await b.pickSelect('rule-column-0', `rule-column-0-option-${SUM}`);
    await page.getByTestId('rule-color-0').click();
    await page.getByTestId('color-swatch-3').click();
    await page.keyboard.press('Escape');
    const [first] = await tableColumnCells(b.preview, SUM);
    // Default numeric rule is "> 0" → every metric cell matches
    await expect(first).toHaveCSS('background-color', LIGHT_BLUE);
    await expectChartScreenshot(b.preview, 'table-cf-swatch');
  });

  test('table conditional formatting: last matching rule wins', async ({ page }) => {
    const b = await openStateDistrictTable(page);
    await b.stylingTab();
    for (const [index, swatch] of [
      [0, 3],
      [1, 1],
    ] as const) {
      await page.getByTestId('add-formatting-rule-btn').click();
      await b.pickSelect(`rule-column-${index}`, `rule-column-${index}-option-${SUM}`);
      await page.getByTestId(`rule-color-${index}`).click();
      await page.getByTestId(`color-swatch-${swatch}`).click();
      await page.keyboard.press('Escape');
    }
    for (const cell of await tableColumnCells(b.preview, SUM)) {
      await expect(cell).toHaveCSS('background-color', LIGHT_RED);
    }
  });

  test('table theme gray (default) → blue', async ({ page }) => {
    const b = await openStateDistrictTable(page);
    await expect(tableHeader(b.preview, 'statename')).toHaveCSS('background-color', GRAY_HEADER);
    await b.stylingTab();
    await page.getByTestId('theme-option-blue').click();
    await expect(tableHeader(b.preview, 'statename')).toHaveCSS('background-color', BLUE_HEADER);
    await expectChartScreenshot(b.preview, 'table-theme-blue');
    await page.getByTestId('theme-option-gray').click();
    await expect(tableHeader(b.preview, 'statename')).toHaveCSS('background-color', GRAY_HEADER);
  });

  test('table zebra rows on by default → off', async ({ page }) => {
    const b = await openStateDistrictTable(page);
    const rows = tableBodyRows(b.preview);
    await expect(rows.nth(1)).toHaveCSS('background-color', GRAY_ZEBRA);
    await b.stylingTab();
    await expect(page.getByTestId('zebra-rows-switch')).toBeChecked();
    await page.getByTestId('zebra-rows-switch').click();
    await expect(rows.nth(1)).toHaveCSS('background-color', WHITE);
  });
});

test.describe('builder table — render', () => {
  test('table search: match count, clear button, Escape', async ({ page }) => {
    const b = await openStateDistrictTable(page);
    const input = page.getByTestId('table-search-input');
    await expect(page.getByTestId('table-search-count')).toHaveCount(0);
    await input.fill('Assam');
    await expect(page.getByTestId('table-search-count')).toHaveText('2 matches');
    await input.fill('Kamrup');
    await expect(page.getByTestId('table-search-count')).toHaveText('1 match');
    await expectChartScreenshot(b.preview, 'table-search-match');
    await page.getByTestId('table-search-clear-btn').click();
    await expect(input).toHaveValue('');
    await expect(page.getByTestId('table-search-count')).toHaveCount(0);
    await input.fill('zzz');
    await expect(page.getByTestId('table-search-count')).toHaveText('0 matches');
    await input.press('Escape');
    await expect(input).toHaveValue('');
  });

  test('table URL cells render as "Link" (http(s):// and www.)', async ({ page }) => {
    // No staging mart has URL values → rewrite two cells of the real response
    await page.route(/\/api\/charts\/chart-data-preview\/\?/, async (route) => {
      const response = await fetchForRewrite(route);
      if (!response) return;
      const json = (await response.json()) as { data?: Array<Record<string, unknown>> };
      if (json.data?.length && 'statename' in json.data[0]) {
        json.data[0].statename = 'https://example.org/report';
        json.data[1].statename = 'www.example.org';
      }
      await route.fulfill({ response, json });
    });
    await openStateDistrictTable(page);
    await expect(page.getByTestId('chart-table-link-0-statename')).toHaveText('Link');
    await expect(page.getByTestId('chart-table-link-0-statename')).toHaveAttribute(
      'href',
      'https://example.org/report'
    );
    await expect(page.getByTestId('chart-table-link-1-statename')).toHaveAttribute(
      'href',
      'https://www.example.org'
    );
    await expect(page.getByTestId('chart-table-link-0-statename')).toHaveAttribute(
      'target',
      '_blank'
    );
  });

  test('table pagination next / prev / last / first', async ({ page }) => {
    const b = await openTable(page);
    await b.pickCombobox('chart-sort-column-select', 'id');
    const prev = page.getByTestId('chart-table-prev-page-btn');
    await expect(prev).toBeDisabled();
    b.dataPreview.mark();
    await page.getByTestId('chart-table-next-page-btn').click();
    expectPayloadSnapshot(
      await b.dataPreview.next((c) => c.query.page === 1),
      'table-page-next-preview'
    );
    await expect(page.getByTestId('chart-table-page-info')).toHaveText('Page 2 of 8');
    await expectRowsText(b, `Showing 21 to 40 of ${TOTAL_ROWS} rows`);
    await page.getByTestId('chart-table-last-page-btn').click();
    await expect(page.getByTestId('chart-table-page-info')).toHaveText('Page 8 of 8');
    await expectRowsText(b, `Showing 141 to 156 of ${TOTAL_ROWS} rows`);
    await expect(page.getByTestId('chart-table-next-page-btn')).toBeDisabled();
    await expect(tableBodyRows(b.preview)).toHaveCount(16);
    await prev.click();
    await expect(page.getByTestId('chart-table-page-info')).toHaveText('Page 7 of 8');
    await page.getByTestId('chart-table-first-page-btn').click();
    await expect(page.getByTestId('chart-table-page-info')).toHaveText('Page 1 of 8');
  });

  test('table page size 50 → limit=50, resets to page 1', async ({ page }) => {
    const b = await openTable(page);
    await page.getByTestId('chart-table-next-page-btn').click();
    await expect(page.getByTestId('chart-table-page-info')).toHaveText('Page 2 of 8');
    b.dataPreview.mark();
    await b.pickSelect('chart-table-page-size', 'chart-table-page-size-option-50');
    expectPayloadSnapshot(
      await b.dataPreview.next((c) => c.query.limit === 50),
      'table-page-size-50-preview'
    );
    await expect(page.getByTestId('chart-table-page-info')).toHaveText('Page 1 of 4');
    await expect(tableBodyRows(b.preview)).toHaveCount(50);
  });

  test('table row-limit pagination config (20 items) → extra_config.pagination', async ({
    page,
  }) => {
    const b = await openTable(page);
    b.dataPreview.mark();
    await b.pickSelect('chart-pagination-select', 'chart-pagination-option-20');
    expectPayloadSnapshot(
      await b.dataPreview.next(
        (c) => field(c.body, 'extra_config', 'pagination', 'enabled') === true
      ),
      'table-row-limit-preview'
    );
  });
});

test.describe('builder table — save, edit, detail', () => {
  test('[pinned] C-B3 table save with dataset + title only (no metrics) → rows are not grouped', async ({
    page,
    track,
  }) => {
    // With no metrics the backend returns every raw row of the dimension (156), not 6 groups —
    // in the builder and on the detail page alike
    const b = await openTable(page);
    await b.pickCombobox('chart-table-dimension-0', 'statename');
    b.dataPreview.mark();
    await page.getByTestId('remove-metric-0').click();
    await expect(page.getByTestId('metric-trigger-0')).toHaveCount(0);
    expectPayloadSnapshot(
      await b.dataPreview.next(
        (c) => previewWithDims('statename')(c) && JSON.stringify(field(c.body, 'metrics')) === '[]'
      ),
      'table-only-dataset-builder-preview'
    );
    await expect(tableBodyRows(b.preview)).toHaveCount(20);
    await expectRowsText(b, `Showing 1 to 20 of ${TOTAL_ROWS} rows`);
    await expect(page.getByTestId('chart-edit-save-button')).toBeEnabled();
    await b.setTitle('table-only-dataset');
    const detailPreview = new RequestLog(page, API.chartDataPreview);
    const { captured } = await b.saveCreate(track);
    expectPayloadSnapshot(captured, 'table-only-dataset-create-post');
    expectPayloadSnapshot(await detailPreview.next(), 'table-only-dataset-detail-preview');
    await expect(tableBodyRows(page.locator('main'))).toHaveCount(20);
    await expect(
      page.locator('main').getByText(`Showing 1 to 20 of ${TOTAL_ROWS} rows`)
    ).toBeVisible();
  });

  test('C-B3 table save with styling (freeze, alignment, formats, rules, theme, zebra)', async ({
    page,
    track,
  }) => {
    const b = await openStateDistrictTable(page);
    await b.stylingTab();
    await page.getByTestId('freeze-column-switch').click();
    await b.pickSelect('alignment-districtname', 'alignment-districtname-option-center');
    await page.getByTestId(`column-row-${SUM}`).click();
    await b.pickSelect(`table-${SUM}NumberFormat`, `table-${SUM}NumberFormat-option-indian`);
    await page.getByTestId('add-formatting-rule-btn').click();
    await page.getByTestId('rule-value-0').fill('Assam');
    await page.getByTestId('add-formatting-rule-btn').click();
    await b.pickSelect('rule-column-1', `rule-column-1-option-${SUM}`);
    await b.pickSelect('rule-operator-1', 'rule-operator-1-option->=');
    await page.getByTestId('rule-value-1').fill('12000000');
    await page.getByTestId('theme-option-blue').click();
    await page.getByTestId('zebra-rows-switch').click();
    await b.setTitle('table-styled');
    const { captured } = await b.saveCreate(track);
    expectPayloadSnapshot(captured, 'table-styled-create-post');
    const main = page.locator('main');
    await expect(tableBodyRows(main)).toHaveCount(12);
    await expect(tableHeader(main, 'statename')).toHaveCSS('background-color', BLUE_HEADER);
    await expect(tableHeader(main, 'districtname')).toHaveCSS('text-align', 'center');
  });

  test('C-E2 table edit round trip → PUT payload', async ({ page, track }) => {
    const b = await openStateDistrictTable(page);
    await b.setTitle('table-roundtrip');
    const { id } = await b.saveCreate(track);
    const edit = new MtpBuilder(page);
    await edit.openEdit(id);
    await expect(page.getByTestId('chart-table-dimension-0-input')).toHaveValue('statename');
    await expect(page.getByTestId('chart-table-dimension-1-input')).toHaveValue('districtname');
    await page.getByTestId('chart-table-drill-down-switch').click();
    await edit.stylingTab();
    await page.getByTestId('theme-option-blue').click();
    expectPayloadSnapshot(await edit.saveUpdate(id), 'table-roundtrip-put');
  });

  test('C-D4 table drill-down on detail page + ← Back', async ({ page, api, track }) => {
    const chart = await createChartViaApi(api, track, 'table-detail-drill', 'table', {
      dimensions: [
        { column: 'statename', enable_drill_down: true },
        { column: 'districtname', enable_drill_down: true },
      ],
      dimension_columns: ['statename', 'districtname'],
      dimension_column: 'statename',
      metrics: [{ column: 'students', aggregation: 'sum', alias: SUM }],
      sort: [{ column: SUM, direction: 'asc' }],
      filters: [] as unknown[],
      pagination: { enabled: false, page_size: 50 },
      customizations: {},
    });
    const preview = new RequestLog(page, API.chartDataPreview);
    await page.goto(`/charts/${chart.id}`);
    const main = page.locator('main');
    const cell = main.getByTestId('chart-table-drill-cell-0-statename');
    await expect(cell).toBeVisible();
    expectPayloadSnapshot(await preview.next(), 'table-detail-preview');
    const state = (await cell.textContent())!.trim();
    preview.mark();
    await cell.click();
    expectPayloadSnapshot(
      await preview.next((c) => field(c.body, 'extra_config', 'filters', 0, 'value') === state),
      'table-detail-drill-preview'
    );
    await expect(page.getByText(`statename: ${state}`)).toBeVisible();
    await expect(tableBodyRows(main)).toHaveCount(2);
    await page.getByTestId('chart-table-drill-back-btn').click();
    await expect(tableBodyRows(main)).toHaveCount(6);
  });
});
