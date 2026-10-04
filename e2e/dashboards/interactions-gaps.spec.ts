import type { Page, Route } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { ORG_SLUG } from '../support/env';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import { fetchForRewrite } from '../support/routes';
import { waitForEChart } from '../support/render';
import {
  FIXED_IDS,
  SEED_CHARTS,
  addText,
  cell,
  chartComponent,
  expectBuilderPayload,
  openBuilder,
  putTabs,
  releaseBuilderLocks,
  saveAndCapture,
  watchBuilderReady,
} from './helpers-builder';
import { openBuilderAt, startEditingText } from './helpers-gaps-builder';
import {
  EDUCATION,
  FILTERS,
  buildFilterDashboard,
  createFilter,
  filterElement,
  openBuilder as openFilterBuilder,
  openView,
  waitForViewChart,
} from './helpers-view';

/**
 * Interaction-coverage gaps (coverage/INTERACTIONS.md "Untouched interactive elements") —
 * dashboards area. Each test clicks a control no other spec touched and asserts its effect.
 * Org-wide / personal state (landing pages, org default) is always stubbed with page.route so
 * nothing reaches the backend; the Superset view is served from a stubbed API (org has none).
 */

const MOBILE = { width: 390, height: 844 };
// No dashboard on staging has this id → native lookup 404s and the Superset view renders
const MISSING_DASHBOARD_ID = 999999999;
const DATASET_VALUE = `${EDUCATION.schema}.${EDUCATION.table}`;
const CURRENT_USER_URL = /\/api\/currentuserv2(\?.*)?$/;
const LIST_URL = /\/api\/dashboards\/\?/;
// Synthetic list size for the pagination test: > 100 so every page size yields a different range
const STUB_LIST_SIZE = 120;
// Base for the synthetic list ids — no real dashboard has ids this high
const STUB_ID_BASE = 990_000;

interface OrgUserLike {
  org: { slug: string };
  landing_dashboard_id: number | null;
  org_default_dashboard_id?: number | null;
}

/**
 * Serve the real current-user response with this org's landing ids replaced by `state()`.
 * Lets landing-page menus show "My Landing" / "Org Default" without changing real user state.
 */
async function overrideLanding(
  page: Page,
  state: () => { landing?: number | null; orgDefault?: number | null }
) {
  await page.route(CURRENT_USER_URL, async (route: Route) => {
    const res = await fetchForRewrite(route);
    if (!res) return;
    const body = (await res.json()) as OrgUserLike[];
    const s = state();
    const rewritten = body.map((ou) =>
      ou.org?.slug !== ORG_SLUG
        ? ou
        : {
            ...ou,
            ...(s.landing !== undefined ? { landing_dashboard_id: s.landing } : {}),
            ...(s.orgDefault !== undefined ? { org_default_dashboard_id: s.orgDefault } : {}),
          }
    );
    await route.fulfill({ response: res, json: rewritten });
  });
}

/** Fulfil a landing-page endpoint with a success stub; returns the requests it saw. */
async function stubLanding(page: Page, path: RegExp, message: string, onHit?: () => void) {
  const seen: string[] = [];
  await page.route(path, (route) => {
    seen.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
    onHit?.();
    return route.fulfill({ status: 200, json: { success: true, message } });
  });
  return seen;
}

/** Serve GET /api/dashboards/<id>/ with `patch` merged into the real body. */
async function patchDetail(page: Page, id: number, patch: Record<string, unknown>) {
  await page.route(new RegExp(`/api/dashboards/${id}/$`), async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const res = await fetchForRewrite(route);
    if (!res) return;
    const json = (await res.json()) as Record<string, unknown>;
    await route.fulfill({ response: res, json: { ...json, ...patch } });
  });
}

// ------------------------------------------------------------------------------------------
// Edit page gates

test.describe('IG-dashboards edit page gates', () => {
  test('IG-dashboards access-denied back button (view-only access)', async ({ page, factory }) => {
    const dash = await factory.dashboard('ig-denied');
    await patchDetail(page, dash.id, { access_level: 'view' });
    await page.goto(`/dashboards/${dash.id}/edit`);
    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('You have view-only access to this dashboard.')).toBeVisible();
    await page.getByTestId('dashboard-edit-access-denied-back-btn').click();
    await expect(page).toHaveURL('/dashboards');
  });

  test('IG-dashboards locked screen header back button', async ({ page, factory }) => {
    const dash = await factory.dashboard('ig-locked');
    await patchDetail(page, dash.id, { is_locked: true, locked_by: 'someone-else@example.com' });
    await page.goto(`/dashboards/${dash.id}/edit`);
    await expect(page.getByTestId('dashboard-locked-title')).toHaveText(
      'Dashboard is Currently Locked',
      { timeout: 30_000 }
    );
    await page.getByTestId('dashboard-locked-back-btn').click();
    await expect(page).toHaveURL('/dashboards');
  });
});

// ------------------------------------------------------------------------------------------
// Builder

test.describe('IG-dashboards builder', () => {
  test.afterEach(async ({ api }) => releaseBuilderLocks(api));

  test('IG-dashboards map drill breadcrumb goes back to the top level', async ({
    page,
    factory,
    api,
  }) => {
    const chart = SEED_CHARTS.map;
    const dash = await factory.dashboard('ig-map-crumb');
    await putTabs(api, dash, [
      {
        id: FIXED_IDS.tab1,
        title: 'Tab',
        layout_config: [{ i: FIXED_IDS.chart1, x: 0, y: 0, w: 12, h: 18 }],
        components: { [FIXED_IDS.chart1]: chartComponent(FIXED_IDS.chart1, chart, 'map') },
      },
    ]);
    await openBuilder(page, dash.id);
    const c = cell(page, FIXED_IDS.chart1);
    await waitForEChart(c);

    // Centre of the map canvas (central India) hits a state polygon
    const canvas = c.locator('div[_echarts_instance_] canvas').first();
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.5);
    const home = c.getByTestId(`dashboard-chart-map-home-${chart.id}`);
    await expect(home).toBeVisible({ timeout: 15_000 });

    const crumb = c.getByTestId(`dashboard-chart-map-crumb-${chart.id}-0`);
    await crumb.click();
    // handleDrillUp(index - 1) with index 0 → back to the country level
    await expect(crumb).toHaveCount(0);
    await expect(home).toHaveCount(0);
    await waitForEChart(c);
  });

  test('IG-dashboards chart "Click to add title" placeholder sets a custom title', async ({
    page,
    factory,
    api,
  }) => {
    const chart = SEED_CHARTS.bar;
    const dash = await factory.dashboard('ig-add-title');
    const component = chartComponent(FIXED_IDS.chart1, chart);
    // Empty-string override = "no title" but still shown → the add-title placeholder
    component.config = { ...component.config, titleOverride: '', showTitle: true } as never;
    await putTabs(api, dash, [
      {
        id: FIXED_IDS.tab1,
        title: 'Tab',
        layout_config: [{ i: FIXED_IDS.chart1, x: 0, y: 0, w: 12, h: 18 }],
        components: { [FIXED_IDS.chart1]: component },
      },
    ]);
    await openBuilder(page, dash.id);

    const add = page.getByTestId(`dashboard-chart-title-add-${chart.id}`);
    await expect(add).toHaveText('Click to add title', { timeout: 30_000 });
    await add.click();
    const input = page.getByTestId(`dashboard-chart-title-input-${chart.id}`);
    await expect(input).toBeVisible();
    await input.fill('Added title');
    await input.press('Enter');
    await expect(page.getByTestId(`dashboard-chart-title-display-${chart.id}`)).toHaveText(
      'Added title'
    );
    const put = await saveAndCapture(page, dash.id);
    const body = put.body as {
      tabs: Array<{ components: Record<string, { config: Record<string, unknown> }> }>;
    };
    expect(body.tabs[0].components[FIXED_IDS.chart1].config.titleOverride).toBe('Added title');
    expectBuilderPayload(put, 'ig-d-add-title-put');
  });

  test('IG-dashboards description Save button saves the description', async ({ page, factory }) => {
    const dash = await factory.dashboard('ig-desc-save');
    await openBuilder(page, dash.id);
    await page.getByTestId('dashboard-description-display').click();
    await page.getByTestId('dashboard-description-input').fill('Saved with the button');
    const put = captureRequest(page, {
      method: 'PUT',
      url: new RegExp(`/api/dashboards/${dash.id}/$`),
    });
    await page.getByTestId('dashboard-description-save').click();
    const captured = await put;
    expect((captured.body as { description: string }).description).toBe('Saved with the button');
    expectBuilderPayload(captured, 'ig-d-description-save-put');
    await expect(page.getByTestId('dashboard-description-input')).toBeHidden();
    await expect(page.getByTestId('dashboard-description-display')).toHaveText(
      'Saved with the button'
    );
  });

  test('IG-dashboards text widget custom background colour: cancel, hex, OK', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('ig-bg-custom');
    await openBuilder(page, dash.id);
    const textId = await addText(page);
    await startEditingText(page, textId);
    await page.keyboard.type('Background');

    await page.getByTestId('rich-text-bg-color-picker').click();
    await page.getByTestId('rich-text-custom-bg-color-toggle').click();
    await page.getByTestId('rich-text-custom-bg-color-cancel').click();
    // Cancel returns to the preset grid
    await expect(page.getByTestId('rich-text-bg-color-f59e0b')).toBeVisible();

    await page.getByTestId('rich-text-custom-bg-color-toggle').click();
    const hex = page.getByTestId('rich-text-custom-bg-color-hex');
    await hex.fill('#1D4ED8');
    await page.getByTestId('rich-text-custom-bg-color-ok').click();
    await expect(hex).toBeHidden();
    const ed = cell(page, textId).getByTestId('dashboard-rich-text-editor');
    // TODO testid: the widget background lives on the editor's container div
    await expect(ed.locator('xpath=ancestor::div[contains(@style,"background")][1]')).toHaveCSS(
      'background-color',
      'rgb(29, 78, 216)'
    );
    expectBuilderPayload(await saveAndCapture(page, dash.id), 'ig-d-bg-custom-put');
  });

  test('IG-dashboards filter modal: dataset / column chevrons, single-select, Info tab', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'ig-filter-single');
    await openFilterBuilder(page, dash.id);
    await page.getByTestId('dashboard-filter-add-btn').click();
    const modal = page.getByTestId('filter-config-modal');
    await expect(modal.getByRole('heading', { name: 'Create Dashboard Filter' })).toBeVisible();

    // Chevrons open the dropdowns
    await page.getByTestId('filter-config-dataset-select-chevron').click();
    await page.getByTestId('filter-config-dataset-select-input').fill(EDUCATION.table);
    await page.getByTestId(`filter-config-dataset-select-item-${DATASET_VALUE}`).click();
    const columnInput = page.getByTestId('filter-config-column-select-input');
    await expect(columnInput).toBeEnabled({ timeout: 15_000 });
    await page.getByTestId('filter-config-column-select-chevron').click();
    await columnInput.fill('statename');
    await page.getByTestId('filter-config-column-select-item-statename').click();

    // Multi → Single again
    const single = page.getByTestId('filter-config-single-select');
    await page.getByTestId('filter-config-multi-select').click();
    await expect(single).not.toBeChecked();
    await single.click();
    await expect(single).toBeChecked();
    await expect(modal.getByText('radio buttons (single selection)')).toBeVisible();

    // Preview → Info brings the form back
    await page.getByTestId('filter-config-tab-preview').click();
    await page.getByTestId('filter-config-tab-info').click();
    await expect(page.getByTestId('filter-config-name-input')).toBeVisible();

    const post = captureRequest(page, {
      method: 'POST',
      url: `/api/dashboards/${dash.id}/filters/`,
    });
    await page.getByTestId('filter-config-create-btn').click();
    const captured = await post;
    expect(
      (captured.body as { settings: { can_select_multiple: boolean } }).settings
    ).toMatchObject({ can_select_multiple: false });
    expectPayloadSnapshot(captured, 'ig-d-filter-single-post');
    await expect(modal).toBeHidden();
  });

  test('IG-dashboards filter modal: numerical "Interactive Slider" checkbox', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'ig-filter-slider');
    await openFilterBuilder(page, dash.id);
    await page.getByTestId('dashboard-filter-add-btn').click();
    await page.getByTestId('filter-config-dataset-select-input').click();
    await page.getByTestId('filter-config-dataset-select-input').fill(EDUCATION.table);
    await page.getByTestId(`filter-config-dataset-select-item-${DATASET_VALUE}`).click();
    const columnInput = page.getByTestId('filter-config-column-select-input');
    await expect(columnInput).toBeEnabled({ timeout: 15_000 });
    await columnInput.click();
    await columnInput.fill('students');
    await page.getByTestId('filter-config-column-select-item-students').click();

    const slider = page.getByTestId('filter-config-slider-ui');
    await expect(slider).toBeChecked();
    await page.getByTestId('filter-config-input-ui').click();
    await expect(slider).not.toBeChecked();
    await slider.click();
    await expect(slider).toBeChecked();

    const post = captureRequest(page, {
      method: 'POST',
      url: `/api/dashboards/${dash.id}/filters/`,
    });
    await page.getByTestId('filter-config-create-btn').click();
    const captured = await post;
    expect((captured.body as { settings: { ui_mode: string } }).settings.ui_mode).toBe('slider');
    expectPayloadSnapshot(captured, 'ig-d-filter-slider-post');
  });

  test('IG-dashboards filter modal Cancel closes without creating and resets the form', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'ig-filter-cancel');
    await openFilterBuilder(page, dash.id);
    const posts: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes(`/api/dashboards/${dash.id}/filters/`)) {
        posts.push(r.url());
      }
    });
    await page.getByTestId('dashboard-filter-add-btn').click();
    const modal = page.getByTestId('filter-config-modal');
    await page.getByTestId('filter-config-name-input').fill('never saved');
    await page.getByTestId('filter-config-cancel-btn').click();
    await expect(modal).toBeHidden();

    await page.getByTestId('dashboard-filter-add-btn').click();
    await expect(page.getByTestId('filter-config-name-input')).toHaveValue('');
    expect(posts).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------
// View

test.describe('IG-dashboards view', () => {
  test('IG-dashboards multi-select value filter "Select all" row + checkbox', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'ig-select-all');
    const filter = await createFilter(api, dash.id, FILTERS.stateMulti());
    await openView(page, dash.id);
    await waitForViewChart(page, dash.barChartId);

    const base = `dashboard-filter-value-${filter.id}`;
    const el = filterElement(page, filter.id);
    await page.getByTestId(`${base}-container`).click();
    const selectAll = page.getByTestId(`${base}-select-all`);
    await expect(selectAll).toBeVisible({ timeout: 15_000 });
    const items = page.locator(`[data-testid^="${base}-item-"]`);
    const optionCount = await items.count();
    expect(optionCount).toBeGreaterThan(1);

    await selectAll.click();
    const checkbox = page.getByTestId(`${base}-checkbox-select-all`);
    await expect(checkbox).toBeChecked();
    // Selection badge shows the number of selected values
    await expect(el.getByText(String(optionCount), { exact: true })).toBeVisible();

    await checkbox.click();
    await expect(checkbox).not.toBeChecked();
    await expect(el.getByText(String(optionCount), { exact: true })).toHaveCount(0);
  });

  test('IG-dashboards single-select value filter chevron opens the options', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'ig-single-chevron');
    const filter = await createFilter(api, dash.id, FILTERS.stateSingle());
    await openView(page, dash.id);
    await waitForViewChart(page, dash.barChartId);

    const base = `dashboard-filter-value-${filter.id}`;
    await page.getByTestId(`${base}-chevron`).click();
    await expect(page.getByTestId(`${base}-listbox`)).toBeVisible({ timeout: 15_000 });
    await page.getByTestId(`${base}-item-Assam`).click();
    await expect(page.getByTestId(`${base}-input`)).toHaveValue('Assam');
  });

  test('IG-dashboards embed code textarea selects the snippet for manual copy', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('ig-embed-textarea');
    const token = 'e2e-stub-token';
    // Detail API omits public_share_token (pinned D-V8) — inject one so the embed menu renders
    await patchDetail(page, dash.id, { public_share_token: token });
    await openView(page, dash.id);
    await page.getByTestId('dashboard-embed-trigger').locator('visible=true').click();
    const textarea = page.getByTestId('dashboard-embed-code-textarea');
    await textarea.click();
    await page.keyboard.press('ControlOrMeta+a');
    const selected = await textarea.evaluate((el: HTMLTextAreaElement) =>
      el.value.substring(el.selectionStart, el.selectionEnd)
    );
    expect(selected).toBe(await textarea.inputValue());
    expect(selected).toContain(`/share/dashboard/${token}`);
    // readOnly: typing doesn't change the snippet
    const before = await textarea.inputValue();
    await page.keyboard.type('x');
    await expect(textarea).toHaveValue(before);
  });

  test('IG-dashboards view landing menu "Set as org default" (stubbed)', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('ig-org-default-view');
    let isDefault = false;
    await overrideLanding(page, () => (isDefault ? { orgDefault: dash.id } : {}));
    const seen = await stubLanding(
      page,
      /\/api\/dashboards\/landing-page\/set-org-default\/\d+$/,
      'E2E stub org default',
      () => (isDefault = true)
    );
    await openView(page, dash.id);
    const trigger = page.getByTestId('dashboard-view-landing-trigger');
    await trigger.click();
    await page.getByTestId('dashboard-view-landing-org-default').click();
    await expect(page.getByText('E2E stub org default')).toBeVisible();
    expect(seen).toEqual([`POST /api/dashboards/landing-page/set-org-default/${dash.id}`]);
    await expect(trigger).toHaveText('Org Default');
  });

  test('IG-dashboards Superset view: retry on error card', async ({ page }) => {
    let calls = 0;
    await page.route(new RegExp(`/api/superset/dashboards/${MISSING_DASHBOARD_ID}/$`), (route) => {
      calls++;
      return route.fulfill({ status: 500, json: { detail: 'e2e forced failure' } });
    });
    await page.goto(`/dashboards/${MISSING_DASHBOARD_ID}`);
    await expect(page.getByRole('heading', { name: 'Error Loading Dashboard' })).toBeVisible({
      timeout: 30_000,
    });
    const before = calls;
    await page.getByTestId('superset-dashboard-retry-btn').click();
    await expect.poll(() => calls).toBeGreaterThan(before);
    await expect(page.getByRole('heading', { name: 'Error Loading Dashboard' })).toBeVisible();
  });

  test('IG-dashboards Superset view header: share, refresh, open, back (stubbed API)', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const supersetUrl = 'https://superset.e2e.invalid/superset/dashboard/1/';
    let detailCalls = 0;
    await page.route(new RegExp(`/api/superset/dashboards/${MISSING_DASHBOARD_ID}/$`), (route) => {
      detailCalls++;
      return route.fulfill({
        status: 200,
        json: {
          id: MISSING_DASHBOARD_ID,
          uuid: 'e2e-uuid',
          dashboard_title: 'E2E stub Superset dashboard',
          published: true,
          changed_on: '2026-01-01T00:00:00',
          changed_on_utc: '2026-01-01T00:00:00Z',
          url: supersetUrl,
        },
      });
    });
    // Embedding needs a guest token; fail it so the SDK never loads a real Superset
    await page.route(/\/api\/superset\/dashboards\/\d+\/guest_token\/$/, (route) =>
      route.fulfill({ status: 500, json: { detail: 'e2e no superset' } })
    );
    await context.route('https://superset.e2e.invalid/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html>stub</html>' })
    );

    await page.goto(`/dashboards/${MISSING_DASHBOARD_ID}`);
    await expect(page.getByRole('heading', { name: 'E2E stub Superset dashboard' })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByTestId('superset-dashboard-share-btn').click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());

    const before = detailCalls;
    await page.getByTestId('superset-dashboard-refresh-btn').click();
    await expect.poll(() => detailCalls).toBeGreaterThan(before);

    const popup = page.waitForEvent('popup');
    await page.getByTestId('superset-dashboard-open-btn').click();
    const opened = await popup;
    expect(opened.url()).toBe(supersetUrl);
    await opened.close();

    await page.getByTestId('superset-dashboard-back-btn').click();
    await expect(page).toHaveURL('/dashboards');
  });
});

// ------------------------------------------------------------------------------------------
// List

test.describe('IG-dashboards list', () => {
  test.afterEach(async ({ api }) => releaseBuilderLocks(api));

  test('IG-dashboards list row "Set as org default" (stubbed)', async ({ page, factory }) => {
    const dash = await factory.dashboard('ig-org-default-list');
    const seen = await stubLanding(
      page,
      /\/api\/dashboards\/landing-page\/set-org-default\/\d+$/,
      'E2E stub org default'
    );
    const loaded = page.waitForResponse(
      (r) => r.request().method() === 'GET' && LIST_URL.test(r.url())
    );
    await page.goto('/dashboards');
    await loaded;
    await page.getByTestId('dashboard-list-filter-name-trigger').click();
    await page.getByTestId('dashboard-list-name-filter-search').fill(dash.title);
    await page.keyboard.press('Escape');
    await page.getByTestId(`dashboard-list-menu-${dash.id}`).click();
    await page.getByTestId(`dashboard-list-set-org-default-${dash.id}`).click();
    await expect(page.getByText('E2E stub org default')).toBeVisible();
    expect(seen).toEqual([`POST /api/dashboards/landing-page/set-org-default/${dash.id}`]);
  });

  test('IG-dashboards list page-size 10 / 50 / 100 and previous page', async ({ page }) => {
    // Synthetic list (copies of one real row) → deterministic counts regardless of staging
    await page.route(LIST_URL, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const res = await fetchForRewrite(route);
      if (!res) return;
      const body = (await res.json()) as
        | Array<Record<string, unknown>>
        | { data: Array<Record<string, unknown>> };
      const rows = Array.isArray(body) ? body : body.data;
      const template = rows[0];
      const data = Array.from({ length: STUB_LIST_SIZE }, (_, i) => ({
        ...template,
        id: STUB_ID_BASE + i,
        title: `e2e-stub-row-${String(i).padStart(3, '0')}`,
        is_locked: false,
        locked_by: null as string | null,
      }));
      await route.fulfill({
        response: res,
        json: Array.isArray(body)
          ? data
          : {
              ...body,
              data,
              total: STUB_LIST_SIZE,
              page: 1,
              page_size: STUB_LIST_SIZE,
              total_pages: 1,
            },
      });
    });
    await page.goto('/dashboards');
    const info = page.locator('#dashboard-pagination-info'); // TODO testid
    await expect(info).toHaveText(`1–10 of ${STUB_LIST_SIZE}`, { timeout: 30_000 });

    const pickSize = async (size: number) => {
      await page.getByTestId('dashboard-page-size-trigger').click();
      await page.getByTestId(`dashboard-page-size-option-${size}`).click();
    };
    await pickSize(50);
    await expect(info).toHaveText(`1–50 of ${STUB_LIST_SIZE}`);
    await pickSize(100);
    await expect(info).toHaveText(`1–100 of ${STUB_LIST_SIZE}`);
    await pickSize(10);
    await expect(info).toHaveText(`1–10 of ${STUB_LIST_SIZE}`);

    const prev = page.getByTestId('dashboard-prev-page-button');
    const next = page.getByTestId('dashboard-next-page-button');
    // The onboarding pill can overlay the pager at this viewport — use the keyboard for Next
    await next.focus();
    await page.keyboard.press('Enter');
    await expect(info).toHaveText(`11–20 of ${STUB_LIST_SIZE}`);
    await prev.click();
    await expect(info).toHaveText(`1–10 of ${STUB_LIST_SIZE}`);
    await expect(prev).toBeDisabled();
  });

  test('IG-dashboards empty list "Create your first dashboard" button', async ({ page, track }) => {
    await page.route(LIST_URL, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const res = await fetchForRewrite(route);
      if (!res) return;
      const body = (await res.json()) as unknown;
      await route.fulfill({
        response: res,
        json: Array.isArray(body)
          ? []
          : { ...(body as object), data: [], total: 0, total_pages: 1 },
      });
    });
    // No landing/org-default rows either, or they'd be pinned above the empty state
    await overrideLanding(page, () => ({ landing: null, orgDefault: null }));
    await page.goto('/dashboards');
    const create = page.getByTestId('dashboard-empty-create-button');
    await expect(create).toBeVisible({ timeout: 30_000 });

    const created = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/dashboards\/$/.test(r.url())
    );
    const ready = watchBuilderReady(page, null);
    await create.click();
    const { id } = (await (await created).json()) as { id: number };
    // UI-created "Untitled Dashboard" — track it so it's deleted after the test
    track('dashboards', id);
    await expect(page).toHaveURL(new RegExp(`/dashboards/${id}/edit\\?new=true$`));
    await ready();
  });
});

// ------------------------------------------------------------------------------------------
// Mobile (class B: mobile-only duplicates of desktop controls)

test.describe('IG-dashboards mobile view header (390px)', () => {
  test.use({ viewport: MOBILE });

  test('IG-dashboards mobile view: landing set/remove + org default (stubbed), fullscreen, back', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('ig-mobile-view');
    let landing: number | null = null;
    await overrideLanding(page, () => ({ landing }));
    const setSeen = await stubLanding(
      page,
      /\/api\/dashboards\/landing-page\/set-personal\/\d+$/,
      'E2E stub landing set',
      () => (landing = dash.id)
    );
    const removeSeen = await stubLanding(
      page,
      /\/api\/dashboards\/landing-page\/remove-personal$/,
      'E2E stub landing removed',
      () => (landing = null)
    );
    const orgSeen = await stubLanding(
      page,
      /\/api\/dashboards\/landing-page\/set-org-default\/\d+$/,
      'E2E stub org default'
    );

    await page.goto(`/dashboards/${dash.id}`);
    const trigger = page.getByTestId('dashboard-view-landing-trigger-mobile');
    await expect(trigger).toHaveText('Set Landing', { timeout: 30_000 });
    await expect(page.getByTestId('dashboard-view-landing-trigger')).toBeHidden();

    await trigger.click();
    await page.getByTestId('dashboard-view-landing-set-mobile').click();
    await expect(page.getByText('E2E stub landing set')).toBeVisible();
    await expect(trigger).toHaveText('My Landing');

    await trigger.click();
    await page.getByTestId('dashboard-view-landing-remove-mobile').click();
    await expect(page.getByText('E2E stub landing removed')).toBeVisible();
    await expect(trigger).toHaveText('Set Landing');

    await trigger.click();
    await page.getByTestId('dashboard-view-landing-org-default-mobile').click();
    await expect(page.getByText('E2E stub org default')).toBeVisible();

    expect(setSeen).toEqual([`POST /api/dashboards/landing-page/set-personal/${dash.id}`]);
    expect(removeSeen).toEqual(['DELETE /api/dashboards/landing-page/remove-personal']);
    expect(orgSeen).toEqual([`POST /api/dashboards/landing-page/set-org-default/${dash.id}`]);

    await page.getByTestId('dashboard-view-fullscreen-btn-mobile').click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
    await page.evaluate(() => document.exitFullscreen());
    await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(false);

    await page.getByTestId('dashboard-view-back-btn-mobile').click();
    await expect(page).toHaveURL('/dashboards');
  });
});

test.describe('IG-dashboards mobile builder header (390px)', () => {
  test.use({ viewport: MOBILE });
  test.afterEach(async ({ api }) => releaseBuilderLocks(api));

  test('IG-dashboards mobile builder: description Save button, redo', async ({ page, factory }) => {
    const dash = await factory.dashboard('ig-mobile-builder');
    await openBuilderAt(page, dash.id, 'dashboard-builder-add-chart-btn-mobile');

    await page.getByTestId('dashboard-description-mobile-display').click();
    await page.getByTestId('dashboard-description-mobile-input').fill('Mobile saved');
    const put = captureRequest(page, {
      method: 'PUT',
      url: new RegExp(`/api/dashboards/${dash.id}/$`),
    });
    await page.getByTestId('dashboard-description-mobile-save').click();
    const captured = await put;
    expect((captured.body as { description: string }).description).toBe('Mobile saved');
    expectBuilderPayload(captured, 'ig-d-mobile-description-save-put');
    await expect(page.getByTestId('dashboard-description-mobile-display')).toHaveText(
      'Mobile saved'
    );

    const undo = page.getByTestId('dashboard-builder-undo-btn-mobile');
    const redo = page.getByTestId('dashboard-builder-redo-btn-mobile');
    const texts = page.locator('[data-testid^="dashboard-cell-text-"]'); // TODO testid
    await page.getByTestId('dashboard-builder-add-text-btn-mobile').click();
    await expect(texts).toHaveCount(1);
    await undo.click();
    await expect(texts).toHaveCount(0);
    await expect(redo).toBeEnabled();
    await redo.click();
    await expect(texts).toHaveCount(1);
    await expect(redo).toBeDisabled();
  });
});
