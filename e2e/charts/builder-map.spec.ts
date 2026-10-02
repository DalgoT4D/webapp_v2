import { test, expect } from '../support/fixtures';
import { expectPayloadSnapshot, type CapturedRequest } from '../support/payload';
import { expectChartScreenshot, waitForEChart } from '../support/render';
import {
  API,
  createChartViaApi,
  echartsRoot,
  field,
  findRegion,
  MAP_BASE_CONFIG,
  MAP_DISTRICT_HIERARCHY,
  mapTooltip,
  MtpBuilder,
  parkMouse,
  RequestLog,
  isAggregatedPreview,
} from './helpers-mtp';
import type { Page } from '@playwright/test';

/**
 * MATRIX §1.3 Map + §1.5 C-D4 (map drill toasts) + §1.4 C-E2 (edit round trip / layers conversion).
 * Dataset: production.mart_education_program (statename / districtname).
 */

const STATE = 'Rajasthan';
// A state present in the GeoJSON with no rows in the education mart
const NO_DATA_STATE = 'Gujarat';

const sumStudents = (c: CapturedRequest) =>
  field(c.body, 'metrics', 0, 'column') === 'students' &&
  field(c.body, 'metrics', 0, 'aggregation') === 'sum' &&
  field(c.body, 'value_column') === 'students';

const previewWith = (key: string, value: unknown) => (c: CapturedRequest) =>
  isAggregatedPreview(c) && field(c.body, 'customizations', key) === value;

/** Create builder with SUM(students) by statename, rendered. */
async function openMapWithSum(page: Page) {
  const b = new MtpBuilder(page);
  await b.openCreate('map');
  b.overlay.mark();
  await b.setSimpleMetric(0, 'sum', 'students');
  const overlay = await b.overlay.next(sumStudents);
  await waitForEChart(b.preview);
  return { b, overlay };
}

async function renderedMap(b: MtpBuilder) {
  await parkMouse(b.page);
  await waitForEChart(b.preview);
}

test.describe('builder map — data configuration', () => {
  test('C-B1 map auto-prefill: statename state column + default GeoJSON, COUNT metric', async ({
    page,
  }) => {
    const b = new MtpBuilder(page);
    await b.openCreate('map');
    await expect(page.getByTestId('chart-map-state-column-select-input')).toHaveValue('statename');
    await expect(page.getByTestId('chart-map-country-select')).toBeDisabled();
    await expect(page.getByTestId('metric-trigger-0')).toContainText('Total Count');

    const preview = await b.dataPreview.next(
      (c) => isAggregatedPreview(c) && field(c.body, 'selected_geojson_id') !== undefined
    );
    expectPayloadSnapshot(preview, 'map-prefill-chart-data-preview');
    const overlay = await b.overlay.next(
      (c) => field(c.body, 'metrics', 0, 'aggregation') === 'count'
    );
    expectPayloadSnapshot(overlay, 'map-prefill-overlay');
    await expect(page.getByTestId('chart-edit-save-button')).toBeEnabled();
    await renderedMap(b);
    await expectChartScreenshot(b.preview, 'map-prefill');
  });

  test('C-B4 map SUM(students) preview renders + overlay payload', async ({ page }) => {
    const { b, overlay } = await openMapWithSum(page);
    expectPayloadSnapshot(overlay, 'map-sum-overlay');
    await renderedMap(b);
    await expectChartScreenshot(b.preview, 'map-sum');
  });

  test('map state column change → GeoJSON re-selected, overlay by new column', async ({ page }) => {
    const { b } = await openMapWithSum(page);
    b.overlay.mark();
    await b.pickCombobox('chart-map-state-column-select', 'districtname');
    const overlay = await b.overlay.next(
      (c) => field(c.body, 'geographic_column') === 'districtname'
    );
    expectPayloadSnapshot(overlay, 'map-state-column-change-overlay');
    await expect(page.getByTestId('chart-map-district-column-select-input')).toHaveValue(
      'No drill-down'
    );
  });

  test('map district drill level → geographic_hierarchy in create POST', async ({
    page,
    track,
  }) => {
    const { b } = await openMapWithSum(page);
    await b.pickCombobox('chart-map-district-column-select', 'districtname');
    await expect(page.getByTestId('chart-map-district-column-select-input')).toHaveValue(
      'districtname'
    );
    await b.setTitle('map-district');
    const { captured } = await b.saveCreate(track);
    expectPayloadSnapshot(captured, 'map-district-create-post');
  });

  test('[pinned] map region click without drill config → info toast, no drill', async ({
    page,
  }) => {
    const { b } = await openMapWithSum(page);
    const { x, y } = await findRegion(b.preview, STATE);
    await page.mouse.click(x, y);
    await expect(
      page.getByText('Configure drill-down levels to enable region drilling')
    ).toBeVisible();
    await expect(page.getByTestId('chart-map-breadcrumb-home')).toHaveCount(0);
  });

  test('map drill-down click → toast, breadcrumb, district overlay', async ({ page }) => {
    const { b } = await openMapWithSum(page);
    await b.pickCombobox('chart-map-district-column-select', 'districtname');
    const { x, y } = await findRegion(b.preview, STATE);
    b.overlay.mark();
    await page.mouse.click(x, y);
    await expect(page.getByText(`✨ Drilling down to ${STATE} districts!`)).toBeVisible();
    const overlay = await b.overlay.next((c) => field(c.body, 'filters', 'statename') === STATE);
    expectPayloadSnapshot(overlay, 'map-drill-overlay');
    await expect(page.getByTestId('chart-map-breadcrumb-level-0')).toHaveText(STATE);
    await expect(page.getByTestId('chart-map-level-badge')).toHaveText('Level 1');
    await renderedMap(b);
    await expectChartScreenshot(b.preview, 'map-drill-district');
  });

  test('map drill breadcrumb Back returns to state level', async ({ page }) => {
    const { b } = await openMapWithSum(page);
    await b.pickCombobox('chart-map-district-column-select', 'districtname');
    const { x, y } = await findRegion(b.preview, STATE);
    await page.mouse.click(x, y);
    await expect(page.getByTestId('chart-map-breadcrumb-back')).toBeVisible();
    await page.getByTestId('chart-map-breadcrumb-back').click();
    await expect(page.getByTestId('chart-map-breadcrumb-home')).toHaveCount(0);
    await expect(page.getByTestId('chart-map-level-badge')).toHaveCount(0);
    await renderedMap(b);
    await expectChartScreenshot(b.preview, 'map-drill-back');
  });

  test('map drill breadcrumb Home returns to state level', async ({ page }) => {
    const { b } = await openMapWithSum(page);
    await b.pickCombobox('chart-map-district-column-select', 'districtname');
    const { x, y } = await findRegion(b.preview, STATE);
    await page.mouse.click(x, y);
    // Clicking the current level crumb keeps the drill (slice to same depth)
    await page.getByTestId('chart-map-breadcrumb-level-0').click();
    await expect(page.getByTestId('chart-map-level-badge')).toHaveText('Level 1');
    await page.getByTestId('chart-map-breadcrumb-home').click();
    await expect(page.getByTestId('chart-map-breadcrumb-home')).toHaveCount(0);
  });

  test('[pinned] map filter value is a text box (raw distinct-values preview 500s on staging)', async ({
    page,
  }) => {
    // SearchableValueInput asks chart-data-preview for raw rows; the backend rejects raw
    // ("At least one metric is required") so the combobox never appears
    const { b } = await openMapWithSum(page);
    await page.getByTestId('chart-add-filter-btn').click();
    await b.pickCombobox('chart-filter-column-0', 'climate_event');
    await expect(page.getByTestId('chart-filter-value-0-text')).toBeVisible();
    await expect(page.getByTestId('chart-filter-value-0-input')).toHaveCount(0);
    await expect(page.getByTestId('chart-filter-operator-0')).toHaveText('Equals');
  });

  test('[pinned] map filters reach chart-data-preview but not the builder overlay', async ({
    page,
  }) => {
    // transformMapDataOverlayPayload drops `chart_filters`, so the create-builder map ignores filters
    const { b } = await openMapWithSum(page);
    await page.getByTestId('chart-add-filter-btn').click();
    await b.pickCombobox('chart-filter-column-0', 'climate_event');
    b.dataPreview.mark();
    b.overlay.mark();
    await page.getByTestId('chart-filter-value-0-text').fill('flood');
    const preview = await b.dataPreview.next(
      (c) =>
        isAggregatedPreview(c) && field(c.body, 'extra_config', 'filters', 0, 'value') === 'flood'
    );
    expectPayloadSnapshot(preview, 'map-filter-chart-data-preview');
    await renderedMap(b);
    for (const c of b.overlay.since()) {
      expect(field(c.body, 'filters')).toEqual({});
      expect(field(c.body, 'extra_config')).toEqual({});
    }
  });

  test('map filter remove ✕ drops the filter from the saved chart', async ({ page, track }) => {
    const { b } = await openMapWithSum(page);
    await page.getByTestId('chart-add-filter-btn').click();
    await b.pickCombobox('chart-filter-column-0', 'climate_event');
    b.dataPreview.mark();
    await page.getByTestId('chart-filter-value-0-text').fill('flood');
    // Let the (debounced) filtered request land before removing, so removal is a real state change
    await b.dataPreview.next(
      (c) =>
        isAggregatedPreview(c) && field(c.body, 'extra_config', 'filters', 0, 'value') === 'flood'
    );
    await page.getByTestId('remove-filter-0').click();
    await expect(page.getByTestId('chart-filter-column-0-input')).toHaveCount(0);
    // The unfiltered preview is usually served from SWR cache (no request), so assert on the save
    await b.setTitle('map-filter-removed');
    const { captured } = await b.saveCreate(track);
    expect(field(captured.body, 'extra_config', 'filters')).toEqual([]);
    expectPayloadSnapshot(captured, 'map-filter-removed-save');
  });

  test('map Download States CSV → ind_states.csv', async ({ page }) => {
    const b = new MtpBuilder(page);
    await b.openCreate('map');
    const download = page.waitForEvent('download');
    await page.getByTestId('chart-map-download-states-btn').click();
    expect((await download).suggestedFilename()).toBe('ind_states.csv');
    await expect(page.getByText('Downloaded state names for IND')).toBeVisible();
  });

  test('map Download Districts CSV → ind_districts.csv', async ({ page }) => {
    const b = new MtpBuilder(page);
    await b.openCreate('map');
    const download = page.waitForEvent('download');
    await page.getByTestId('chart-map-download-districts-btn').click();
    expect((await download).suggestedFilename()).toBe('ind_districts.csv');
    await expect(page.getByText('Downloaded district names for IND')).toBeVisible();
  });
});

test.describe('builder map — styling', () => {
  test('map color scheme default is Blues', async ({ page }) => {
    const { b } = await openMapWithSum(page);
    await b.stylingTab();
    await expect(page.getByTestId('chart-styling-color-scheme')).toHaveText('Blues');
  });

  for (const scheme of ['Reds', 'Greens', 'Purples', 'Oranges', 'Greys']) {
    test(`map color scheme ${scheme}`, async ({ page }) => {
      const { b } = await openMapWithSum(page);
      await b.stylingTab();
      b.dataPreview.mark();
      await b.pickSelect(
        'chart-styling-color-scheme',
        `chart-styling-color-scheme-option-${scheme}`
      );
      expectPayloadSnapshot(
        await b.dataPreview.next(previewWith('colorScheme', scheme)),
        `map-color-${scheme}-chart-data-preview`
      );
      await renderedMap(b);
      await expectChartScreenshot(b.preview, `map-color-${scheme}`);
    });
  }

  test('map tooltip on (default) shows region + metric value', async ({ page }) => {
    const { b } = await openMapWithSum(page);
    await findRegion(b.preview, STATE);
    await expect(mapTooltip(b.preview)).toHaveText(new RegExp(`^${STATE}SUM\\(students\\): \\d+$`));
  });

  test('map tooltip off → no tooltip on hover', async ({ page }) => {
    const { b } = await openMapWithSum(page);
    const { x, y } = await findRegion(b.preview, STATE);
    await b.stylingTab();
    b.dataPreview.mark();
    await page.getByTestId('chart-styling-show-tooltip').click();
    expectPayloadSnapshot(
      await b.dataPreview.next(previewWith('showTooltip', false)),
      'map-tooltip-off-chart-data-preview'
    );
    await renderedMap(b);
    await page.mouse.move(x, y);
    await expect(echartsRoot(b.preview).locator('b')).toHaveCount(0);
  });

  test('map legend off', async ({ page }) => {
    const { b } = await openMapWithSum(page);
    await b.stylingTab();
    b.dataPreview.mark();
    await page.getByTestId('chart-styling-show-legend').click();
    expectPayloadSnapshot(
      await b.dataPreview.next(previewWith('showLegend', false)),
      'map-legend-off-chart-data-preview'
    );
    await renderedMap(b);
    await expectChartScreenshot(b.preview, 'map-legend-off');
  });

  for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
    test(`map legend position ${corner}`, async ({ page }) => {
      const { b } = await openMapWithSum(page);
      await b.stylingTab();
      // Unset position renders bottom-left
      await expect(page.getByTestId('chart-styling-legend-position')).toHaveText('Bottom Left');
      if (corner === 'bottom-left') {
        // Re-picking the displayed value is a Radix no-op → go via another corner first
        await b.pickSelect(
          'chart-styling-legend-position',
          'chart-styling-legend-position-option-top-left'
        );
      }
      b.dataPreview.mark();
      await b.pickSelect(
        'chart-styling-legend-position',
        `chart-styling-legend-position-option-${corner}`
      );
      expectPayloadSnapshot(
        await b.dataPreview.next(previewWith('legendPosition', corner)),
        `map-legend-${corner}-chart-data-preview`
      );
      await renderedMap(b);
      await expectChartScreenshot(b.preview, `map-legend-${corner}`);
    });
  }

  test('map no-data label shows in tooltip for regions without data', async ({ page }) => {
    const { b } = await openMapWithSum(page);
    await findRegion(b.preview, NO_DATA_STATE);
    await expect(mapTooltip(b.preview)).toHaveText(`${NO_DATA_STATE}No Data`);
    await b.stylingTab();
    b.dataPreview.mark();
    await page.getByTestId('chart-styling-null-value-label').fill('Nothing here');
    expectPayloadSnapshot(
      await b.dataPreview.next(previewWith('nullValueLabel', 'Nothing here')),
      'map-null-label-chart-data-preview'
    );
    await renderedMap(b);
    await findRegion(b.preview, NO_DATA_STATE);
    await expect(mapTooltip(b.preview)).toHaveText(`${NO_DATA_STATE}Nothing here`);
  });

  test('map show region names', async ({ page }) => {
    const { b } = await openMapWithSum(page);
    await b.stylingTab();
    b.dataPreview.mark();
    await page.getByTestId('chart-styling-show-region-names').click();
    expectPayloadSnapshot(
      await b.dataPreview.next(previewWith('showLabels', true)),
      'map-region-names-chart-data-preview'
    );
    await renderedMap(b);
    await expectChartScreenshot(b.preview, 'map-region-names');
  });

  test('map number format applies to tooltip (frontend-only)', async ({ page }) => {
    const { b } = await openMapWithSum(page);
    await b.stylingTab();
    // numberFormat/decimalPlaces are stripped from the API payload for maps (getApiCustomizations),
    // so this is a browser-only change — asserted on the tooltip
    await b.pickSelect('mapNumberFormat', 'mapNumberFormat-option-indian');
    await renderedMap(b);
    await findRegion(b.preview, STATE);
    await expect(mapTooltip(b.preview)).toHaveText(
      new RegExp(`^${STATE}SUM\\(students\\): \\d{1,2}(,\\d\\d)*,\\d{3}$`)
    );
  });

  test('map zoom in', async ({ page }) => {
    const { b } = await openMapWithSum(page);
    await page.getByTestId('chart-map-zoom-in').click();
    await renderedMap(b);
    await expectChartScreenshot(b.preview, 'map-zoom-in');
  });

  test('map zoom out', async ({ page }) => {
    const { b } = await openMapWithSum(page);
    await page.getByTestId('chart-map-zoom-out').click();
    await renderedMap(b);
    await expectChartScreenshot(b.preview, 'map-zoom-out');
  });
});

test.describe('builder map — save, edit, detail', () => {
  test('C-B3 map save → POST payload → detail renders with overlay', async ({ page, track }) => {
    const { b } = await openMapWithSum(page);
    await b.pickCombobox('chart-map-district-column-select', 'districtname');
    await b.stylingTab();
    await b.pickSelect('chart-styling-color-scheme', 'chart-styling-color-scheme-option-Greens');
    await b.setTitle('map-save');
    const detailOverlay = new RequestLog(page, API.mapOverlay);
    const { captured } = await b.saveCreate(track);
    expectPayloadSnapshot(captured, 'map-save-create-post');
    expectPayloadSnapshot(await detailOverlay.next(sumStudents), 'map-save-detail-overlay');
    await waitForEChart(page.locator('main'));
  });

  test('[pinned] C-D4 UI-built drill hierarchy is saved as country→state, so the detail toast says "state"', async ({
    page,
    track,
  }) => {
    // DynamicLevelConfig takes region types from the country root: base=country, drill level=state
    const { b } = await openMapWithSum(page);
    await b.pickCombobox('chart-map-district-column-select', 'districtname');
    await b.setTitle('map-ui-hierarchy');
    const { captured } = await b.saveCreate(track);
    expect(
      field(
        captured.body,
        'extra_config',
        'geographic_hierarchy',
        'drill_down_levels',
        0,
        'region_type'
      )
    ).toBe('state');
    const main = page.locator('main');
    await waitForEChart(main);
    const { x, y } = await findRegion(main, STATE);
    await page.mouse.click(x, y);
    await expect(page.getByText(`🗺️ Drilling down to state in ${STATE}`)).toBeVisible();
  });

  test('C-E2 map edit round trip: hierarchy kept, single layer saved on update', async ({
    page,
    track,
  }) => {
    const { b } = await openMapWithSum(page);
    await b.pickCombobox('chart-map-district-column-select', 'districtname');
    await b.setTitle('map-roundtrip');
    const { id } = await b.saveCreate(track);

    const edit = new MtpBuilder(page);
    await edit.openEdit(id);
    await expect(page.getByTestId('chart-map-state-column-select-input')).toHaveValue('statename');
    await expect(page.getByTestId('chart-map-district-column-select-input')).toHaveValue(
      'districtname'
    );
    await edit.stylingTab();
    await edit.pickSelect(
      'chart-styling-color-scheme',
      'chart-styling-color-scheme-option-Purples'
    );
    expectPayloadSnapshot(await edit.saveUpdate(id), 'map-roundtrip-put');
  });

  test('C-E2 map edit: picking a district converts simplified fields to 2 layers', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChartViaApi(api, track, 'map-edit-layers', 'map', MAP_BASE_CONFIG);
    const edit = new MtpBuilder(page);
    await edit.openEdit(chart.id);
    await expect(page.getByTestId('chart-map-district-column-select-input')).toHaveValue(
      'No drill-down'
    );
    await edit.pickCombobox('chart-map-district-column-select', 'districtname');
    expectPayloadSnapshot(await edit.saveUpdate(chart.id), 'map-edit-layers-put');
  });

  test('[pinned] map edit preview: region click without drill config does nothing', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChartViaApi(api, track, 'map-edit-noclick', 'map', MAP_BASE_CONFIG);
    const edit = new MtpBuilder(page);
    await edit.openEdit(chart.id);
    await waitForEChart(edit.preview);
    const { x, y } = await findRegion(edit.preview, STATE);
    await page.mouse.click(x, y);
    await expect(
      page.getByText('Configure drill-down levels to enable region drilling')
    ).toHaveCount(0);
    await expect(page.getByTestId('chart-map-breadcrumb-home')).toHaveCount(0);
  });

  test('[pinned] map edit preview: drill with hierarchy has no toast', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChartViaApi(api, track, 'map-edit-drill', 'map', {
      ...MAP_BASE_CONFIG,
      geographic_hierarchy: MAP_DISTRICT_HIERARCHY,
    });
    const edit = new MtpBuilder(page);
    await edit.openEdit(chart.id);
    await waitForEChart(edit.preview);
    const { x, y } = await findRegion(edit.preview, STATE);
    edit.overlay.mark();
    await page.mouse.click(x, y);
    await expect(page.getByTestId('chart-map-breadcrumb-level-0')).toHaveText(STATE);
    expectPayloadSnapshot(
      await edit.overlay.next((c) => field(c.body, 'filters', 'statename') === STATE),
      'map-edit-drill-overlay'
    );
    await expect(page.getByText(`✨ Drilling down to ${STATE} districts!`)).toHaveCount(0);
  });
});

test.describe('C-D4 detail page map drill-down', () => {
  const main = (page: Page) => page.locator('main');

  async function openDetail(page: Page, id: number) {
    const overlay = new RequestLog(page, API.mapOverlay);
    await page.goto(`/charts/${id}`);
    await overlay.next();
    await waitForEChart(main(page));
    return overlay;
  }

  test('C-D4 hierarchy drill: toast, breadcrumb, district overlay, then "no further levels"', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChartViaApi(api, track, 'map-detail-drill', 'map', {
      ...MAP_BASE_CONFIG,
      geographic_hierarchy: MAP_DISTRICT_HIERARCHY,
    });
    const overlay = await openDetail(page, chart.id);
    const { x, y } = await findRegion(main(page), STATE);
    overlay.mark();
    await page.mouse.click(x, y);
    await expect(page.getByText(`🗺️ Drilling down to district in ${STATE}`)).toBeVisible();
    expectPayloadSnapshot(
      await overlay.next((c) => field(c.body, 'filters', 'statename') === STATE),
      'map-detail-drill-overlay'
    );
    await expect(page.getByTestId('chart-map-breadcrumb-level-0')).toHaveText(STATE);
    await waitForEChart(main(page));
    const district = await findRegion(main(page));
    await page.mouse.click(district.x, district.y);
    await expect(page.getByText('No further drill-down levels configured')).toBeVisible();
    await page.getByTestId('chart-map-breadcrumb-home').click();
    await expect(page.getByTestId('chart-map-breadcrumb-home')).toHaveCount(0);
  });

  test('C-D4 no drill config and no layers → "No further drill-down levels configured"', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChartViaApi(api, track, 'map-detail-nodrill', 'map', MAP_BASE_CONFIG);
    await openDetail(page, chart.id);
    const { x, y } = await findRegion(main(page), STATE);
    await page.mouse.click(x, y);
    await expect(page.getByText('🗺️ No further drill-down levels configured')).toBeVisible();
    await expect(
      page.getByText('Configure additional layers in edit mode to enable deeper drill-down')
    ).toBeVisible();
  });

  test('C-D4 legacy district_column drill → "Drilling down to districts in …"', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChartViaApi(api, track, 'map-detail-legacy', 'map', {
      ...MAP_BASE_CONFIG,
      district_column: 'districtname',
    });
    const overlay = await openDetail(page, chart.id);
    const { x, y } = await findRegion(main(page), STATE);
    overlay.mark();
    await page.mouse.click(x, y);
    await expect(page.getByText(`🗺️ Drilling down to districts in ${STATE}`)).toBeVisible();
    expectPayloadSnapshot(
      await overlay.next((c) => field(c.body, 'filters', 'statename') === STATE),
      'map-detail-legacy-drill-overlay'
    );
    await page.getByTestId('chart-map-breadcrumb-back').click();
    await expect(page.getByTestId('chart-map-level-badge')).toHaveCount(0);
  });

  const legacyLayers = [
    { id: '0', level: 0, geographic_column: 'statename', geojson_id: 35 },
    {
      id: '1',
      level: 1,
      geographic_column: 'districtname',
      // Only another state is configured for drill-down
      selected_regions: [{ region_id: 0, region_name: 'Kerala', geojson_id: 1 }],
    },
  ];

  test('C-D4 legacy layers: unconfigured region → "not configured for drill-down"', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChartViaApi(api, track, 'map-detail-layers', 'map', {
      ...MAP_BASE_CONFIG,
      layers: legacyLayers,
    });
    await openDetail(page, chart.id);
    const { x, y } = await findRegion(main(page), STATE);
    await page.mouse.click(x, y);
    await expect(page.getByText(`🗺️ ${STATE} not configured for drill-down`)).toBeVisible();
  });

  test('[pinned] C-D4 legacy layers + UI "not_equals" filter → still "not configured", not "excluded"', async ({
    page,
    api,
    track,
  }) => {
    // Detail only recognises operator 'not equals' / '!=' — the builder writes 'not_equals'
    const chart = await createChartViaApi(api, track, 'map-detail-noteq', 'map', {
      ...MAP_BASE_CONFIG,
      layers: legacyLayers,
      filters: [{ column: 'climate_event', operator: 'not_equals', value: STATE }],
    });
    await openDetail(page, chart.id);
    const { x, y } = await findRegion(main(page), STATE);
    await page.mouse.click(x, y);
    await expect(page.getByText(`🗺️ ${STATE} not configured for drill-down`)).toBeVisible();
    await expect(page.getByText(`🚫 ${STATE} excluded by filter`)).toHaveCount(0);
  });
});
