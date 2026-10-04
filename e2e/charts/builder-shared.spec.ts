import { test, expect } from '../support/fixtures';
import { e2eTitle } from '../support/env';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import { waitForEChart } from '../support/render';
import { ChartBuilderPage, CHART_DATA_URL, STUB_STATE_VALUES } from './helpers-builder';

/**
 * MATRIX §1.3 — create-builder basics (C-B1..C-B6) per ECharts type, shared data configuration
 * (X axis, time grain, extra dimension, filters, pagination, sort) and metrics.
 * Data: production.mart_education_program. Data-config tests use a bar chart as the vehicle
 * (the controls are the same component for bar/line/pie).
 */

const TYPES = [
  { type: 'bar', titlePrefix: 'Bar chart' },
  { type: 'line', titlePrefix: 'Line chart' },
  { type: 'pie', titlePrefix: 'Pie chart' },
  { type: 'number', titlePrefix: 'Number card' },
] as const;

// "Sep 26, 11:53 PM" — toLocaleString('en-US', {month:'short', day, hour, minute, hour12})
const DEFAULT_TITLE_TIMESTAMP = String.raw`[A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2}\s?(AM|PM)`;

test.describe('C-B create-flow basics', () => {
  for (const { type, titlePrefix } of TYPES) {
    test.describe(type, () => {
      test(`C-B1 ${type}: default title pattern + auto-prefilled config`, async ({ page }) => {
        const b = new ChartBuilderPage(page);
        const firstData = captureRequest(page, {
          method: 'POST',
          url: CHART_DATA_URL,
          timeout: 30_000,
        });
        await b.openCreate(type);

        await expect(b.nameInput).toHaveValue(
          new RegExp(`^${titlePrefix} - mart_education_program ${DEFAULT_TITLE_TIMESTAMP}$`)
        );
        if (type === 'number') {
          await expect(page.getByTestId('chart-x-axis-select-input')).toHaveCount(0);
        } else {
          // Prefill picks the first text column of the table — `id`
          await expect(b.comboInput('chart-x-axis-select')).toHaveValue('id');
        }
        await expect(b.metricTrigger(0)).toContainText('Total Count');
        await expect(b.metricTrigger(0)).toContainText('COUNT(*)');
        expectPayloadSnapshot(await firstData, `cb1-${type}-prefill-chart-data`);
      });

      test(`C-B2 ${type}: save disabled until valid`, async ({ page }) => {
        const b = new ChartBuilderPage(page);
        await b.openCreate(type);
        await expect(b.saveButton).toBeEnabled();

        // Title is required
        await b.nameInput.fill('');
        await expect(b.saveButton).toBeDisabled();
        await b.nameInput.fill(e2eTitle(`cb2-${type}`));
        await expect(b.saveButton).toBeEnabled();

        // A non-count function without a column is not a valid metric
        await b.setMetricAgg(0, 'sum');
        await expect(b.saveButton).toBeDisabled();
        await b.setMetricColumn(0, 'students');
        await expect(b.saveButton).toBeEnabled();
      });

      test(`C-B3 ${type}: create via picker → save payload → lands on detail`, async ({
        page,
        track,
      }) => {
        const b = new ChartBuilderPage(page);
        await b.openCreateViaPicker(type);
        await b.waitForChartDataResponse();
        await b.settle();
        const title = e2eTitle(`cb3-${type}`);
        const { id } = await b.saveAndSnapshot(track, title, `cb3-${type}-create`);
        await expect(page).toHaveURL(new RegExp(`/charts/${id}$`));
        await expect(page.getByText(title)).toBeVisible();
        await waitForEChart(page.locator('main'));
      });

      test(`C-B4 ${type}: preview after default config`, async ({ page }) => {
        const b = new ChartBuilderPage(page);
        await b.openCreate(type);
        await b.expectPreviewShot(`cb4-${type}-default-preview`);
      });

      test(`${type === 'number' ? '[pinned] ' : ''}C-B5 ${type}: DATA tab — Chart Data / Raw Data tables + pagination`, async ({
        page,
      }) => {
        const b = new ChartBuilderPage(page);
        await b.openCreate(type);
        await b.previewDataTab();
        const panel = b.dataPanel;
        const info = panel.getByTestId('chart-data-preview-page-info');

        // Chart Data (default sub-tab for non-table types): aggregated rows, 20 per page in create
        await expect(page.getByTestId('chart-data-tab-chart-data')).toHaveAttribute(
          'data-state',
          'active'
        );
        if (type === 'number') {
          // [pinned] chart-data-preview fails for a dimensionless number payload → warning alert
          await expect(
            panel.getByText(
              "Data preview isn't ready yet. Please check your query settings and try again."
            )
          ).toBeVisible();
        } else {
          await expect(panel.getByRole('columnheader', { name: /Total Count/ })).toBeVisible();
          // Grouped by `id` → one row per source row (156)
          await expect(panel.getByText('Showing 1 to 20 of 156 rows')).toBeVisible();
          await expect(info).toHaveText('Page 1 of 8');
          await panel.getByTestId('chart-data-preview-next-page-btn').click();
          await expect(info).toHaveText('Page 2 of 8');
        }

        // Raw Data: warehouse rows, 20 per page, page size switch resets to page 1
        await page.getByTestId('chart-data-tab-raw-data').click();
        await expect(panel.getByRole('columnheader', { name: /statename/ })).toBeVisible();
        await expect(panel.getByText('Showing 1 to 20 of 156 rows')).toBeVisible();
        await expect(info).toHaveText('Page 1 of 8');
        await panel.getByTestId('chart-data-preview-next-page-btn').click();
        await expect(info).toHaveText('Page 2 of 8');
        await b.pickSelect(
          'chart-data-preview-page-size',
          '50',
          'chart-data-preview-page-size-option-50'
        );
        await expect(info).toHaveText('Page 1 of 4');
        await panel.getByTestId('chart-data-preview-last-page-btn').click();
        await expect(info).toHaveText('Page 4 of 4');
        await expect(panel.getByText('Showing 151 to 156 of 156 rows')).toBeVisible();
      });
    });
  }

  // Guard is type-independent (page-level state) — exercised on bar.
  test('[pinned] C-B6 Back opens the unsaved dialog even with no user edits', async ({ page }) => {
    // Pinned: originalFormData is captured before auto-prefill, so the prefill itself counts as a change
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.backButton.click();
    await expect(page.getByTestId('chart-unsaved-stay-btn')).toBeVisible();
  });

  test('C-B6 Back → Stay on page keeps the builder', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.setXAxis('statename');
    await b.backButton.click();
    await page.getByTestId('chart-unsaved-stay-btn').click();
    await expect(page.getByTestId('chart-unsaved-stay-btn')).toBeHidden();
    await expect(page).toHaveURL(/\/charts\/new\/configure\?/);
    await expect(b.comboInput('chart-x-axis-select')).toHaveValue('statename');
  });

  test('C-B6 Back → Leave without saving goes to /charts/new', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.setXAxis('statename');
    await b.backButton.click();
    await page.getByTestId('chart-unsaved-leave-btn').click();
    await expect(page).toHaveURL(/\/charts\/new$/);
  });

  test('C-B6 Back → Save and leave creates the chart and opens detail', async ({ page, track }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.setXAxis('statename');
    await b.setTitle(e2eTitle('cb6-save-leave'));
    await b.backButton.click();
    const reqP = captureRequest(page, { method: 'POST', url: /\/api\/charts\/$/ });
    const resP = page.waitForResponse(
      (r) => /\/api\/charts\/$/.test(r.url()) && r.request().method() === 'POST'
    );
    await page.getByTestId('chart-unsaved-save-and-leave-btn').click();
    const [req, res] = await Promise.all([reqP, resP]);
    const { id } = (await res.json()) as { id: number };
    track('charts', id);
    expectPayloadSnapshot(req, 'cb6-save-and-leave-create');
    await expect(page).toHaveURL(new RegExp(`/charts/${id}$`));
  });
});

test.describe('Data config (bar vehicle)', () => {
  test('X axis: pick a column', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.expectChartDataPayload('x-axis-statename', () => b.setXAxis('statename'));
  });

  test('X axis: items list every column (no type filter)', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.comboInput('chart-x-axis-select').click();
    const list = page.getByTestId('chart-x-axis-select-listbox');
    for (const col of ['statename', 'date', 'students', 'male_score', 'climate_event']) {
      await expect(list.getByTestId(`chart-x-axis-select-item-${col}`)).toBeVisible();
    }
    await expect(list.getByRole('option')).toHaveCount(16);
  });

  test.describe('time grain', () => {
    test('hidden for non-date X axis', async ({ page }) => {
      const b = new ChartBuilderPage(page);
      await b.openCreate('bar');
      await b.setXAxis('statename');
      await expect(page.getByTestId('chart-time-grain-select')).toHaveCount(0);
    });

    test('date column: hour/minute/second disabled with tooltip', async ({ page }) => {
      const b = new ChartBuilderPage(page);
      await b.openCreate('bar');
      await b.setXAxis('date');
      await page.getByTestId('chart-time-grain-select').click();
      for (const v of ['__none__', 'year', 'month', 'day']) {
        await expect(page.getByTestId(`chart-time-grain-option-${v}`)).not.toHaveAttribute(
          'data-disabled'
        );
      }
      for (const v of ['hour', 'minute', 'second']) {
        await expect(page.getByTestId(`chart-time-grain-option-${v}`)).toHaveAttribute(
          'data-disabled',
          ''
        );
      }
      // Disabled item has pointer-events:none; the tooltip trigger is its wrapper
      await page.getByTestId('chart-time-grain-option-hour').hover({ force: true });
      await expect(page.getByRole('tooltip')).toContainText('Not available for date columns');
    });

    for (const grain of ['year', 'month', 'day'] as const) {
      test(`grain ${grain}`, async ({ page }) => {
        const b = new ChartBuilderPage(page);
        await b.openCreate('bar');
        await b.setXAxis('date');
        await b.expectChartDataPayload(`time-grain-${grain}`, () => b.setTimeGrain(grain));
      });
    }

    test('grain None after Year sends time_grain null', async ({ page }) => {
      const b = new ChartBuilderPage(page);
      await b.openCreate('bar');
      await b.setXAxis('date');
      await b.setTimeGrain('year');
      await b.expectChartDataPayload('time-grain-none', () => b.setTimeGrain('__none__'));
    });

    test('grain auto-cleared when X axis stops being a date', async ({ page }) => {
      const b = new ChartBuilderPage(page);
      await b.openCreate('bar');
      await b.setXAxis('date');
      await b.setTimeGrain('month');
      await b.settle();
      await b.setXAxis('statename');
      await expect(page.getByTestId('chart-time-grain-select')).toHaveCount(0);
      await b.settle();
      // Next change carries the cleared grain
      await b.expectChartDataPayload('time-grain-cleared', () => b.setPagination('20'));
    });
  });

  test.describe('extra dimension', () => {
    test('pick a column', async ({ page }) => {
      const b = new ChartBuilderPage(page);
      await b.openCreate('bar');
      await b.setXAxis('statename');
      await b.expectChartDataPayload('extra-dim-climate-event', () =>
        b.setExtraDimension('climate_event')
      );
    });

    test('None clears it', async ({ page }) => {
      const b = new ChartBuilderPage(page);
      await b.openCreate('bar');
      await b.setXAxis('statename');
      await b.setExtraDimension('climate_event');
      // SWR serves an already-fetched payload from cache without a request → make the end state new
      await b.setPagination('20');
      await b.expectChartDataPayload('extra-dim-none', () => b.setExtraDimension('none'));
    });

    test('list excludes the X axis column; placeholder per type', async ({ page }) => {
      const b = new ChartBuilderPage(page);
      await b.openCreate('bar');
      await b.setXAxis('statename');
      const input = b.comboInput('chart-extra-dimension-select');
      await expect(input).toHaveValue('None');
      await input.click();
      await expect(b.comboItem('chart-extra-dimension-select', 'none')).toBeVisible();
      await expect(b.comboItem('chart-extra-dimension-select', 'statename')).toHaveCount(0);
      await expect(b.comboItem('chart-extra-dimension-select', 'districtname')).toBeVisible();
    });
  });

  test.describe('filters', () => {
    const OPERATOR_CASES = [
      { op: 'equals', column: 'statename', value: 'Assam' },
      { op: 'not_equals', column: 'statename', value: 'Assam' },
      { op: 'greater_than', column: 'students', value: '500000' },
      { op: 'greater_than_equal', column: 'students', value: '500000' },
      { op: 'less_than', column: 'students', value: '500000' },
      { op: 'less_than_equal', column: 'students', value: '500000' },
      { op: 'like', column: 'statename', value: '%a%' },
      { op: 'like_case_insensitive', column: 'statename', value: '%A%' },
      { op: 'in', column: 'statename', value: 'Assam, Odisha' },
      { op: 'not_in', column: 'statename', value: 'Assam, Odisha' },
    ] as const;

    for (const { op, column, value } of OPERATOR_CASES) {
      test(`operator ${op} (text value input)`, async ({ page }) => {
        const b = new ChartBuilderPage(page);
        await b.openCreate('bar');
        await b.setXAxis('statename');
        await b.addFilter();
        await b.setFilterColumn(0, column);
        await b.setFilterOperator(0, op);
        // staging column-values 500s → text fallback; in/not_in get the comma-separated placeholder
        const input = b.filterTextValue(0);
        await expect(input).toHaveAttribute(
          'placeholder',
          op === 'in' || op === 'not_in' ? 'value1, value2, value3' : 'Enter value'
        );
        await b.expectChartDataPayload(`filter-${op}`, () => input.fill(value));
      });
    }

    for (const op of ['is_null', 'is_not_null'] as const) {
      test(`operator ${op} (no value input)`, async ({ page }) => {
        const b = new ChartBuilderPage(page);
        await b.openCreate('bar');
        await b.setXAxis('statename');
        await b.addFilter();
        await b.setFilterColumn(0, 'climate_event');
        await b.expectChartDataPayload(`filter-${op}`, () => b.setFilterOperator(0, op));
        await expect(b.filterTextValue(0)).toHaveCount(0);
        await expect(page.getByTestId('chart-filter-value-0-input')).toHaveCount(0);
      });
    }

    test('value input: single combobox when column values load', async ({ page }) => {
      const b = new ChartBuilderPage(page);
      await b.stubColumnValues();
      await b.openCreate('bar');
      await b.setXAxis('statename');
      await b.addFilter();
      await b.setFilterColumn(0, 'statename');
      await b.comboInput('chart-filter-value-0').click();
      await expect(
        page.getByTestId('chart-filter-value-0-listbox').getByRole('option')
      ).toHaveCount(STUB_STATE_VALUES.length);
      await b.expectChartDataPayload('filter-value-combobox', () =>
        b.comboItem('chart-filter-value-0', 'Karnataka').click()
      );
    });

    test('value input: multi-select for in when column values load', async ({ page }) => {
      const b = new ChartBuilderPage(page);
      await b.stubColumnValues();
      await b.openCreate('bar');
      await b.setXAxis('statename');
      await b.addFilter();
      await b.setFilterColumn(0, 'statename');
      await b.setFilterOperator(0, 'in');
      await page.getByTestId('chart-filter-value-0-search').click();
      await b.comboItem('chart-filter-value-0', 'Assam').click();
      await b.settle();
      await b.expectChartDataPayload('filter-value-multi', () =>
        b.comboItem('chart-filter-value-0', 'Odisha').click()
      );
      await expect(page.getByTestId('chart-filter-value-0-container')).toContainText('Assam');
      await expect(page.getByTestId('chart-filter-value-0-container')).toContainText('Odisha');
    });

    test('value input: date picker for date column', async ({ page }) => {
      const b = new ChartBuilderPage(page);
      await b.openCreate('bar');
      await b.setXAxis('statename');
      await b.addFilter();
      await b.setFilterColumn(0, 'date');
      await b.setFilterOperator(0, 'greater_than_equal');
      const trigger = page.getByTestId('chart-filter-value-0-date-picker-trigger');
      await expect(trigger).toHaveText(/Pick a date/);
      await trigger.click();
      const popover = page.getByTestId('chart-filter-value-0-date-picker-popover');
      // Fixed month so the payload doesn't depend on today's date
      await popover.getByRole('combobox', { name: /month/i }).selectOption({ index: 0 });
      await popover.getByRole('combobox', { name: /year/i }).selectOption('2025');
      await b.expectChartDataPayload('filter-value-date', () =>
        popover.getByRole('button', { name: /January 15th, 2025/ }).click()
      );
      await expect(trigger).toHaveText(/Jan 15th, 2025/);
    });

    test('changing the column clears the value and records data_type', async ({ page }) => {
      const b = new ChartBuilderPage(page);
      await b.openCreate('bar');
      await b.setXAxis('statename');
      await b.addFilter();
      await b.setFilterColumn(0, 'statename');
      await b.fillAndWait('chart-filter-value-0-text', 'Assam');
      await b.expectChartDataPayload('filter-column-change', () =>
        b.setFilterColumn(0, 'districtname')
      );
      // No UI assertion on the text box: it intermittently keeps showing the old "Assam" although the
      // form value (and payload) is '' — DebouncedInput sync race, nondeterministic so not pinnable
      await expect(b.comboInput('chart-filter-column-0')).toHaveValue('districtname');
    });

    test('remove filter', async ({ page }) => {
      const b = new ChartBuilderPage(page);
      await b.openCreate('bar');
      await b.setXAxis('statename');
      await b.addFilter();
      await b.setFilterColumn(0, 'statename');
      await b.fillAndWait('chart-filter-value-0-text', 'Assam');
      // SWR serves an already-fetched payload from cache without a request → make the end state new
      await b.setPagination('20');
      await b.expectChartDataPayload('filter-removed', () =>
        page.getByTestId('remove-filter-0').click()
      );
      await expect(page.getByTestId('chart-filter-operator-0')).toHaveCount(0);
    });

    test('two filters are ANDed in one payload', async ({ page }) => {
      const b = new ChartBuilderPage(page);
      await b.openCreate('bar');
      await b.setXAxis('statename');
      await b.addFilter();
      await b.setFilterColumn(0, 'statename');
      await b.fillAndWait('chart-filter-value-0-text', 'Assam');
      await b.addFilter();
      await b.setFilterColumn(1, 'students');
      await b.setFilterOperator(1, 'greater_than');
      await b.expectChartDataPayload('filter-two', () => b.filterTextValue(1).fill('500000'));
    });
  });

  test.describe('pagination', () => {
    for (const size of ['20', '50', '100', '200'] as const) {
      test(`${size} items`, async ({ page }) => {
        const b = new ChartBuilderPage(page);
        await b.openCreate('bar');
        await b.expectChartDataPayload(`pagination-${size}`, () => b.setPagination(size));
        await expect(page.getByTestId('chart-pagination-select')).toHaveText(`${size} items`);
      });
    }

    test('No pagination after 20', async ({ page }) => {
      const b = new ChartBuilderPage(page);
      await b.openCreate('bar');
      await b.setPagination('20');
      await b.expectChartDataPayload('pagination-none', () => b.setPagination('__none__'));
      await expect(page.getByTestId('chart-pagination-select')).toHaveText('No pagination');
    });
  });

  test.describe('sort', () => {
    test('direction disabled until a column is picked; options are COL + METRIC', async ({
      page,
    }) => {
      const b = new ChartBuilderPage(page);
      await b.openCreate('bar');
      await b.setXAxis('statename');
      await expect(page.getByTestId('chart-sort-direction-select')).toBeDisabled();
      await b.comboInput('chart-sort-column-select').click();
      const list = page.getByTestId('chart-sort-column-select-listbox');
      await expect(list.getByRole('option')).toHaveCount(3);
      await expect(b.comboItem('chart-sort-column-select', '__none__')).toHaveText('None');
      await expect(b.comboItem('chart-sort-column-select', 'statename')).toContainText('COL');
      await expect(b.comboItem('chart-sort-column-select', 'Total Count')).toContainText('METRIC');
    });

    test('by dimension ascending', async ({ page }) => {
      const b = new ChartBuilderPage(page);
      await b.openCreate('bar');
      await b.setXAxis('statename');
      await b.expectChartDataPayload('sort-dimension-asc', () => b.setSortColumn('statename'));
      await expect(page.getByTestId('chart-sort-direction-select')).toBeEnabled();
      await expect(page.getByTestId('chart-sort-direction-select')).toHaveText('Ascending');
    });

    test('by metric descending', async ({ page }) => {
      const b = new ChartBuilderPage(page);
      await b.openCreate('bar');
      await b.setXAxis('statename');
      await b.setSortColumn('Total Count');
      await b.expectChartDataPayload('sort-metric-desc', () => b.setSortDirection('desc'));
    });

    test('None clears the sort', async ({ page }) => {
      const b = new ChartBuilderPage(page);
      await b.openCreate('bar');
      await b.setXAxis('statename');
      await b.setSortColumn('statename');
      await b.expectChartDataPayload('sort-none', () => b.setSortColumn('__none__'));
      await expect(page.getByTestId('chart-sort-direction-select')).toBeDisabled();
    });

    test('auto-clears when the sorted metric alias disappears', async ({ page }) => {
      const b = new ChartBuilderPage(page);
      await b.openCreate('bar');
      await b.setXAxis('statename');
      await b.setSortColumn('Total Count');
      await b.settle();
      // Alias follows the definition → "SUM(*)"-style rename removes the "Total Count" sort option
      await b.setMetricAgg(0, 'sum');
      await b.expectChartDataPayload('sort-auto-cleared', () => b.setMetricColumn(0, 'students'));
      await expect(b.comboInput('chart-sort-column-select')).toHaveValue('None');
    });
  });
});

test.describe('Metrics (bar vehicle)', () => {
  test('add another metric → COUNT(*) "Total Count" expanded', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.setXAxis('statename');
    await b.expectChartDataPayload('metric-add', () =>
      page.getByTestId('add-metric-button').click()
    );
    await expect(b.metricTrigger(1)).toContainText('Total Count');
    await expect(b.metricTrigger(1)).toHaveAttribute('data-state', 'open');
    await expect(b.metricTrigger(0)).toHaveAttribute('data-state', 'closed');
  });

  test('remove a metric', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.setXAxis('statename');
    await page.getByTestId('add-metric-button').click();
    await b.setSimpleMetric(1, 'sum', 'students');
    await b.expectChartDataPayload('metric-remove', () =>
      page.getByTestId('remove-metric-0').click()
    );
    await expect(b.metricTrigger(0)).toContainText('SUM(students)');
    await expect(b.metricTrigger(1)).toHaveCount(0);
  });

  test('[pinned] removing the only bar metric keeps Save enabled', async ({ page }) => {
    // Pinned: isFormValid falls back to the legacy aggregate_function='count' path when metrics is empty
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.setXAxis('statename');
    await b.expectChartDataPayload('metric-remove-last', () =>
      page.getByTestId('remove-metric-0').click()
    );
    await expect(b.metricTrigger(0)).toHaveCount(0);
    await expect(b.saveButton).toBeEnabled();
  });

  test.describe('simple: each aggregate function', () => {
    const AGG_CASES = [
      { agg: 'count', column: 'students', label: 'COUNT(students)' },
      { agg: 'sum', column: 'students', label: 'SUM(students)' },
      { agg: 'avg', column: 'male_score', label: 'AVG(male_score)' },
      { agg: 'min', column: 'female_score', label: 'MIN(female_score)' },
      { agg: 'max', column: 'score_gap', label: 'MAX(score_gap)' },
      { agg: 'count_distinct', column: 'districtname', label: 'COUNT_DISTINCT(districtname)' },
    ] as const;
    for (const { agg, column, label } of AGG_CASES) {
      test(`${agg}(${column})`, async ({ page }) => {
        const b = new ChartBuilderPage(page);
        await b.openCreate('bar');
        await b.setXAxis('statename');
        if (agg !== 'count') await b.setMetricAgg(0, agg);
        await b.expectChartDataPayload(`metric-simple-${agg}`, () => b.setMetricColumn(0, column));
        await expect(b.metricTrigger(0)).toContainText(label);
        await expect(page.getByTestId('metric-alias-0')).toHaveValue(label);
      });
    }
  });

  test('simple: numeric-only columns for non-count functions', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    const item = (v: string) => b.comboItem('metric-column-0', v);

    // count: every column plus "* (Count all rows)"
    await b.expandMetric(0);
    await b.comboInput('metric-column-0').click();
    await expect(item('*')).toHaveText('* (Count all rows)');
    await expect(item('statename')).toHaveAttribute('aria-disabled', 'false');
    await page.keyboard.press('Escape');

    for (const agg of ['sum', 'avg', 'min', 'max']) {
      await b.setMetricAgg(0, agg);
      await b.comboInput('metric-column-0').click();
      await expect(item('*')).toHaveCount(0);
      for (const col of ['students', 'males', 'male_score', 'monthly_coverage_pct', 'population']) {
        await expect(item(col), `${agg}: ${col}`).toHaveAttribute('aria-disabled', 'false');
      }
      for (const col of ['statename', 'date', 'climate_event', 'id']) {
        await expect(item(col), `${agg}: ${col}`).toHaveAttribute('aria-disabled', 'true');
      }
      await page.keyboard.press('Escape');
    }

    // count_distinct: every column, no "*"
    await b.setMetricAgg(0, 'count_distinct');
    await b.comboInput('metric-column-0').click();
    await expect(item('*')).toHaveCount(0);
    await expect(item('statename')).toHaveAttribute('aria-disabled', 'false');
    await expect(item('date')).toHaveAttribute('aria-disabled', 'false');
  });

  test('calculated: valid expression validates then drives the chart', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.setXAxis('statename');
    await b.expandMetric(0);
    await page.getByTestId('metric-tab-calculated-0').click();
    const validate = captureRequest(page, { method: 'POST', url: '/api/metrics/validate/' });
    const captured = await b.captureChartData(() =>
      page.getByTestId('metric-expr-0').fill('SUM(students) / 10')
    );
    expectPayloadSnapshot(await validate, 'metric-calculated-validate');
    expectPayloadSnapshot(captured, 'metric-calculated-valid');
    await expect(b.metricTrigger(0)).toContainText('SUM(students) / 10');
    await expect(page.getByTestId('metric-alias-0')).toHaveValue('SUM(students) / 10');
  });

  test('calculated: invalid expression shows the server error and is not applied', async ({
    page,
  }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.expandMetric(0);
    await page.getByTestId('metric-tab-calculated-0').click();
    const res = page.waitForResponse((r) => r.url().includes('/api/metrics/validate/'));
    await page.getByTestId('metric-expr-0').fill('SUM(no_such_column)');
    const body = (await (await res).json()) as { valid: boolean; error?: string };
    expect(body.valid).toBe(false);
    await expect(page.getByText(body.error || 'Invalid expression')).toBeVisible();
    // Previous (valid) COUNT(*) definition stays in effect
    await expect(b.metricTrigger(0)).toContainText('COUNT(*)');
  });

  test('saved: pick a library metric', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.setXAxis('statename');
    await b.expandMetric(0);
    await page.getByTestId('metric-tab-saved-0').click();
    await b.comboInput('metric-saved-0').click();
    await expect(b.comboItem('metric-saved-0', '620')).toContainText('total_students');
    await expect(b.comboItem('metric-saved-0', '620')).toContainText('SUM(students)');
    await b.expectChartDataPayload('metric-saved-620', () =>
      b.comboItem('metric-saved-0', '620').click()
    );
    await expect(page.getByTestId('metric-library-icon-0')).toBeVisible();
    await expect(b.metricTrigger(0)).toContainText('total_students');
  });

  test('saved: metrics used in another row are hidden', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.expandMetric(0);
    await page.getByTestId('metric-tab-saved-0').click();
    await b.pickCombo('metric-saved-0', '620');
    await page.getByTestId('add-metric-button').click();
    await page.getByTestId('metric-tab-saved-1').click();
    await b.comboInput('metric-saved-1').click();
    await expect(b.comboItem('metric-saved-1', '619')).toBeVisible();
    await expect(b.comboItem('metric-saved-1', '620')).toHaveCount(0);
  });

  test('display name: auto-follows definition until typed, clearing re-enables auto', async ({
    page,
  }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.setXAxis('statename');
    const alias = page.getByTestId('metric-alias-0');
    await b.setSimpleMetric(0, 'sum', 'students');
    await expect(alias).toHaveValue('SUM(students)');

    // Manual name (debounced 500ms) → sent as alias
    await b.expectChartDataPayload('metric-alias-manual', () => alias.fill('Enrolled'));
    await expect(b.metricTrigger(0)).toContainText('Enrolled');
    // Manual name survives a definition change
    await b.setMetricAgg(0, 'max');
    await expect(alias).toHaveValue('Enrolled');

    // Clearing → auto again: next definition change regenerates the label
    await alias.fill('');
    await b.settle();
    await b.setMetricAgg(0, 'min');
    await expect(alias).toHaveValue('MIN(students)');
  });

  test('add metric to library → saved metric reference', async ({ page, track }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.setXAxis('statename');
    await b.setSimpleMetric(0, 'sum', 'males');
    await page.getByTestId('metric-save-toggle-0').click();
    const saveBtn = page.getByTestId('metric-save-btn-0');
    await expect(saveBtn).toBeDisabled();
    await page.getByTestId('metric-save-name-0').fill(e2eTitle('lib-metric'));
    const req = captureRequest(page, { method: 'POST', url: /\/api\/metrics\/$/ });
    const res = page.waitForResponse(
      (r) => /\/api\/metrics\/$/.test(r.url()) && r.request().method() === 'POST'
    );
    await saveBtn.click();
    const [captured, response] = await Promise.all([req, res]);
    const created = (await response.json()) as { id: number };
    track('metrics', created.id);
    expectPayloadSnapshot(captured, 'metric-add-to-library');
    await expect(page.getByText(`Saved metric "${e2eTitle('lib-metric')}"`)).toBeVisible();
    await expect(page.getByTestId('metric-library-icon-0')).toBeVisible();
    await expect(page.getByTestId('metric-tab-saved-0')).toHaveAttribute('data-state', 'active');
    await expect(b.comboInput('metric-saved-0')).toHaveValue(e2eTitle('lib-metric'));
  });
});
