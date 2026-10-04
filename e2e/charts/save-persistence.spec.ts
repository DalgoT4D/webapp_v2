import { test, expect } from '../support/fixtures';
import { e2eTitle } from '../support/env';
import { ChartBuilderPage } from './helpers-builder';

/**
 * Every data option set in the builder must reach the SAVED chart (POST on create, PUT on edit).
 * Added after mutation M01 ("sort dropped from the save") was only caught incidentally: the
 * per-option tests assert the preview request, which a save-only slip doesn't change.
 * Explicit field assertions (not only a snapshot) so a dropped field fails with a readable diff.
 */

interface SavedExtraConfig {
  dimension_column?: string;
  extra_dimension_column?: string | null;
  time_grain?: string | null;
  metrics?: Array<{ aggregation: string | null; column: string | null }>;
  sort?: Array<{ column: string; direction: string }>;
  pagination?: { enabled: boolean; page_size: number };
  filters?: Array<{ column: string; operator: string; value: unknown }>;
}

function extraConfigOf(body: unknown): SavedExtraConfig {
  return (body as { extra_config: SavedExtraConfig }).extra_config;
}

const FILTER_VALUE = 'flood';
const PAGE_SIZE = '50';

test.describe('chart save persistence', () => {
  test('SAVE-1 bar: X, extra dimension, 2 metrics, sort, pagination, filter all reach the saved chart; edit keeps them', async ({
    page,
    track,
  }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.setXAxis('statename');
    await b.setExtraDimension('climate_event');
    await b.setSimpleMetric(0, 'sum', 'students');
    await page.getByTestId('add-metric-button').click();
    await b.setSimpleMetric(1, 'avg', 'male_score');
    await b.setSortColumn('statename');
    await b.setSortDirection('desc');
    await b.setPagination(PAGE_SIZE);
    await b.addFilter();
    await b.setFilterColumn(0, 'climate_event');
    await b.fillAndWait('chart-filter-value-0-text', FILTER_VALUE);
    await b.settle();

    await b.setTitle(e2eTitle('save-persist-bar'));
    const created = await b.save(track);
    const saved = extraConfigOf(created.request.body);
    expect(saved.dimension_column, 'X axis').toBe('statename');
    expect(saved.extra_dimension_column, 'extra dimension').toBe('climate_event');
    expect(saved.metrics, 'metrics').toHaveLength(2);
    expect(saved.metrics?.[0]).toMatchObject({ aggregation: 'sum', column: 'students' });
    expect(saved.metrics?.[1]).toMatchObject({ aggregation: 'avg', column: 'male_score' });
    expect(saved.sort, 'sort').toEqual([{ column: 'statename', direction: 'desc' }]);
    expect(saved.pagination, 'pagination').toMatchObject({
      enabled: true,
      page_size: Number(PAGE_SIZE),
    });
    expect(saved.filters, 'filters').toHaveLength(1);
    expect(saved.filters?.[0]).toMatchObject({ column: 'climate_event', value: FILTER_VALUE });

    // Edit: change ONE thing (sort direction) → Update existing; everything else must survive
    await page.goto(`/charts/${created.id}/edit`);
    await expect(page.getByTestId('chart-sort-direction-select')).toHaveText('Descending');
    await b.setSortDirection('asc');
    await b.settle();
    const putReq = page.waitForRequest(
      (r) => r.method() === 'PUT' && new URL(r.url()).pathname === `/api/charts/${created.id}/`
    );
    await b.saveButton.click();
    await page.getByTestId('chart-save-update-existing-btn').click();
    const updated = extraConfigOf((await putReq).postDataJSON());
    expect(updated.sort, 'edited sort').toEqual([{ column: 'statename', direction: 'asc' }]);
    expect(updated.dimension_column).toBe('statename');
    expect(updated.extra_dimension_column).toBe('climate_event');
    expect(updated.metrics).toHaveLength(2);
    expect(updated.pagination).toMatchObject({ enabled: true, page_size: Number(PAGE_SIZE) });
    expect(updated.filters?.[0]).toMatchObject({ column: 'climate_event', value: FILTER_VALUE });
  });

  test('SAVE-2 line: date X axis + time grain reach the saved chart; edit keeps them', async ({
    page,
    track,
  }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('line');
    await b.setXAxis('date');
    await b.setTimeGrain('month');
    await b.setSimpleMetric(0, 'sum', 'students');
    await b.settle();

    await b.setTitle(e2eTitle('save-persist-line'));
    const created = await b.save(track);
    const saved = extraConfigOf(created.request.body);
    expect(saved.dimension_column).toBe('date');
    expect(saved.time_grain, 'time grain').toBe('month');
    expect(saved.metrics?.[0]).toMatchObject({ aggregation: 'sum', column: 'students' });

    await page.goto(`/charts/${created.id}/edit`);
    await expect(page.getByTestId('chart-time-grain-select')).toHaveText('Month');
    await b.setTimeGrain('year');
    await b.settle();
    const putReq = page.waitForRequest(
      (r) => r.method() === 'PUT' && new URL(r.url()).pathname === `/api/charts/${created.id}/`
    );
    await b.saveButton.click();
    await page.getByTestId('chart-save-update-existing-btn').click();
    const updated = extraConfigOf((await putReq).postDataJSON());
    expect(updated.time_grain, 'edited time grain').toBe('year');
    expect(updated.dimension_column).toBe('date');
    expect(updated.metrics?.[0]).toMatchObject({ aggregation: 'sum', column: 'students' });
  });
});
