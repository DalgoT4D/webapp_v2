import { test, expect } from '../support/fixtures';
import {
  addChartViaModal,
  addKpiViaModal,
  addText,
  chartComponent,
  expectBuilderPayload,
  FIXED_IDS,
  layoutOf,
  openBuilder,
  putTabs,
  releaseBuilderLocks,
  saveAndCapture,
  SEED_CHARTS,
  SEED_KPIS,
  textComponent,
} from './helpers-builder';

/**
 * Where newly added widgets land on a dashboard that ALREADY has widgets.
 * (Added after mutation M17 — "new chart lands at y=0" — slipped through: the existing add-widget
 * tests start from an empty canvas, where top and bottom are the same position.)
 */

// Existing layout: a full-width text on top, a full-width chart under it
const EXISTING_TEXT_H = 4;
const EXISTING_CHART_H = 10;
const EXISTING_BOTTOM = EXISTING_TEXT_H + EXISTING_CHART_H;

test.describe('dashboard builder — placement of new widgets', () => {
  test.afterEach(async ({ api }) => releaseBuilderLocks(api));

  test('D-B5b new chart, KPI and text land below existing widgets; existing ones stay put', async ({
    page,
    api,
    factory,
  }) => {
    const chart = await factory.barChart('placement-new');
    const dash = await factory.dashboard('placement');
    await putTabs(api, dash, [
      {
        id: FIXED_IDS.tab1,
        title: 'Tab',
        layout_config: [
          { i: FIXED_IDS.text1, x: 0, y: 0, w: 12, h: EXISTING_TEXT_H },
          { i: FIXED_IDS.chart1, x: 0, y: EXISTING_TEXT_H, w: 12, h: EXISTING_CHART_H },
        ],
        components: {
          [FIXED_IDS.text1]: textComponent(FIXED_IDS.text1, 'Existing header'),
          [FIXED_IDS.chart1]: chartComponent(FIXED_IDS.chart1, SEED_CHARTS.bar),
        },
      },
    ]);
    await openBuilder(page, dash.id);

    const newChart = await addChartViaModal(page, chart);
    const newKpi = await addKpiViaModal(page, SEED_KPIS.femaleScores);
    const newText = await addText(page);

    const put = await saveAndCapture(page, dash.id);
    const text = layoutOf(put.body, FIXED_IDS.text1);
    const existingChart = layoutOf(put.body, FIXED_IDS.chart1);
    const c = layoutOf(put.body, newChart);
    const k = layoutOf(put.body, newKpi);
    const t = layoutOf(put.body, newText);

    // Existing widgets are not pushed down by the additions
    expect(text).toMatchObject({ x: 0, y: 0, h: EXISTING_TEXT_H });
    expect(existingChart).toMatchObject({ x: 0, y: EXISTING_TEXT_H, h: EXISTING_CHART_H });
    // Each addition lands at the current bottom, in the order added
    expect(Number(c.y)).toBeGreaterThanOrEqual(EXISTING_BOTTOM);
    expect(Number(k.y)).toBeGreaterThanOrEqual(Number(c.y) + Number(c.h));
    expect(Number(t.y)).toBeGreaterThanOrEqual(Number(k.y) + Number(k.h));

    expectBuilderPayload(put, 'd-b5b-placement-put', [chart.id]);
  });
});
