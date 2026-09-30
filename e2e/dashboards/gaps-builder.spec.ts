import { test, expect } from '../support/fixtures';
import { e2eTitle } from '../support/env';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import {
  addText,
  captureNextPut,
  cell,
  cellsOfKind,
  dashboardUrl,
  expectBuilderPayload,
  openBuilder,
  releaseBuilderLocks,
  saveAndCapture,
} from './helpers-builder';
import {
  FORCED_ERROR,
  apiPath,
  failRequests,
  holdRequests,
  openBuilderAt,
  withoutPermissions,
} from './helpers-gaps-builder';

// Undo/redo holds autosave back for 1s (dashboard-builder-v2 undo/redo setTimeout 1000)
const UNDO_HOLD_MS = 1_000;
// Slack for the gap between the click event (timer start) and our clock start
const UNDO_HOLD_SLACK_MS = 200;
// Autosave debounce is 5s; a PUT well before that is not the debounced autosave
const AUTOSAVE_MIN_DELAY_MS = 4_000;
// Undo history depth (useUndoRedo(…, 20) in dashboard-builder-v2)
const UNDO_HISTORY = 20;
// The error status clears itself after 5s (builder saveDashboard catch)
const SAVE_ERROR_VISIBLE_MS = 5_000;
// Viewports around the Tailwind `xl` (1280px) breakpoint of the save status text
const BELOW_XL = { width: 1200, height: 900 };
const XL = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };
const TABLET = { width: 820, height: 1180 };

test.describe('dashboard builder gaps', () => {
  test.afterEach(async ({ api }) => releaseBuilderLocks(api));

  test('GAP-D create: "Access Denied" without the create-dashboards permission', async ({
    page,
  }) => {
    await withoutPermissions(page, ['can_create_dashboards']);
    const posts: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/api\/dashboards\/$/.test(r.url())) posts.push(r.url());
    });
    const userLoaded = page.waitForResponse((r) => /\/api\/currentuserv2/.test(r.url()));
    await page.goto('/dashboards/create');
    await userLoaded;
    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    await expect(page.getByText("You don't have permission to create dashboards.")).toBeVisible();
    expect(posts).toEqual([]);

    await page.getByTestId('dashboard-create-access-denied-back-btn').click();
    await expect(page).toHaveURL('/dashboards');
    expect(posts).toEqual([]);
  });

  test('GAP-D create: a create failure shows a toast and returns to /dashboards', async ({
    page,
  }) => {
    await failRequests(page, apiPath('/api/dashboards/'), { method: 'POST' });
    const post = captureRequest(page, { method: 'POST', url: /\/api\/dashboards\/$/ });
    await page.goto('/dashboards/create');
    expectPayloadSnapshot(await post, 'gap-d-create-failure-post');
    await expect(page.getByText(FORCED_ERROR)).toBeVisible();
    await expect(page).toHaveURL('/dashboards');
  });

  test('GAP-D description: clicking outside throws the edit away', async ({ page, factory }) => {
    const dash = await factory.dashboard('desc-outside');
    await openBuilder(page, dash.id);
    const display = page.getByTestId('dashboard-description-display');
    const input = page.getByTestId('dashboard-description-input');

    await display.click();
    await input.fill('thrown away by an outside click');
    // Empty canvas area, well away from the popover and the header controls
    const tabBar = (await page.getByTestId('dashboard-tab-bar').boundingBox())!;
    await page.mouse.click(tabBar.x + tabBar.width / 2, tabBar.y + tabBar.height + 300);
    await expect(input).toBeHidden();
    await expect(display).toHaveText('+ Add description');

    const captured = await saveAndCapture(page, dash.id);
    expect((captured.body as { description: string }).description).toBe('');
    expectBuilderPayload(captured, 'gap-d-description-outside-put');
  });

  test('GAP-D save error: the failure message shows next to Save, then clears', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('save-error');
    await openBuilder(page, dash.id);
    await failRequests(page, dashboardUrl(dash.id), { method: 'PUT' });

    const put = captureNextPut(page, dash.id);
    await page.getByTestId('dashboard-save-btn').click();
    expectBuilderPayload(await put, 'gap-d-save-error-put');
    const status = page.getByTestId('dashboard-save-status-error');
    await expect(status).toHaveText(FORCED_ERROR);
    await expect(page.getByTestId('dashboard-save-status-saved')).toHaveCount(0);
    await expect(status).toBeHidden({ timeout: SAVE_ERROR_VISIBLE_MS * 2 });
  });

  test('GAP-D autosave is held back ~1s after Undo / Redo, then saves the new state', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('undo-autosave');
    await openBuilder(page, dash.id);
    let put = captureNextPut(page, dash.id);
    const textId = await addText(page);
    await put; // the 5s autosave of the add — history is now idle

    // Undo: the autosave effect is blocked while the flag is up and fires when it drops
    put = captureNextPut(page, dash.id);
    await page.getByTestId('dashboard-builder-undo-btn').click();
    let started = Date.now();
    let captured = await put;
    let elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(UNDO_HOLD_MS - UNDO_HOLD_SLACK_MS);
    expect(elapsed).toBeLessThan(AUTOSAVE_MIN_DELAY_MS);
    await expect(cell(page, textId)).toHaveCount(0);
    expectBuilderPayload(captured, 'gap-d-undo-autosave-put');

    // Let the debounced autosave of the undo pass before measuring redo
    await captureNextPut(page, dash.id);

    put = captureNextPut(page, dash.id);
    await page.getByTestId('dashboard-builder-redo-btn').click();
    started = Date.now();
    captured = await put;
    elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(UNDO_HOLD_MS - UNDO_HOLD_SLACK_MS);
    expect(elapsed).toBeLessThan(AUTOSAVE_MIN_DELAY_MS);
    await expect(cell(page, textId)).toBeVisible();
    expectBuilderPayload(captured, 'gap-d-redo-autosave-put');
  });

  test('GAP-D undo history keeps 20 steps', async ({ page, factory }) => {
    test.slow(); // 21 widget inserts + 20 undos against the live builder
    const dash = await factory.dashboard('undo-depth');
    await openBuilder(page, dash.id);
    const undo = page.getByTestId('dashboard-builder-undo-btn');
    const texts = cellsOfKind(page, 'text');

    const steps = UNDO_HISTORY + 1;
    for (let i = 0; i < steps; i++) await addText(page);
    await expect(texts).toHaveCount(steps);

    for (let i = 1; i <= UNDO_HISTORY; i++) {
      await expect(undo).toBeEnabled();
      await undo.click();
      await expect(texts).toHaveCount(steps - i);
    }
    // The oldest change fell out of the 20-entry history
    await expect(undo).toBeDisabled();
    await expect(texts).toHaveCount(1);
    expectBuilderPayload(await saveAndCapture(page, dash.id), 'gap-d-undo-depth-put');
  });

  test('GAP-D View shows "Saving and opening view..." while it saves', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('view-transient');
    await openBuilder(page, dash.id);
    const hold = await holdRequests(page, dashboardUrl(dash.id), 'PUT');

    const put = captureNextPut(page, dash.id);
    const preview = page.getByTestId('dashboard-preview-btn');
    await preview.click();
    const captured = await put;
    await expect(preview).toHaveText('Saving and opening view...');
    await expect(preview).toBeDisabled();
    await expect(preview).toHaveAttribute('aria-label', 'Saving and opening dashboard view');
    hold.release();
    expectBuilderPayload(captured, 'gap-d-view-transient-put');
    await expect(page).toHaveURL(`/dashboards/${dash.id}`);
  });

  test.describe('viewport 1200px', () => {
    test.use({ viewport: BELOW_XL });

    test('GAP-D save status text only shows at 1280px and wider', async ({ page, factory }) => {
      const dash = await factory.dashboard('status-xl');
      await openBuilder(page, dash.id);

      await saveAndCapture(page, dash.id);
      const saved = page.getByTestId('dashboard-save-status-saved');
      await expect(saved).toBeVisible();
      await expect(saved.getByText('Saved')).toBeHidden();
      await expect(saved).toBeHidden(); // clears after 3s

      await page.setViewportSize(XL);
      await saveAndCapture(page, dash.id);
      await expect(saved.getByText('Saved')).toBeVisible();
    });
  });

  test.describe('mobile header (390px)', () => {
    test.use({ viewport: MOBILE });

    test('GAP-D mobile header: title, description, Chart / KPI / Text, undo, status, View', async ({
      page,
      factory,
    }) => {
      const dash = await factory.dashboard('mobile-header');
      await openBuilderAt(page, dash.id, 'dashboard-builder-add-chart-btn-mobile');
      await expect(page.getByTestId('add-chart-btn')).toBeHidden();
      await expect(page.getByTestId('dashboard-save-btn')).toBeHidden();

      // Title
      const titleDisplay = page.getByTestId('dashboard-title-display-mobile');
      await expect(titleDisplay).toHaveText(dash.title);
      await titleDisplay.click();
      const titleInput = page.getByTestId('dashboard-title-input-mobile');
      await expect(titleInput).toBeFocused();
      let put = captureNextPut(page, dash.id);
      const saved = page.waitForResponse(
        (r) => r.request().method() === 'PUT' && dashboardUrl(dash.id).test(r.url())
      );
      await titleInput.fill(e2eTitle('mobile-renamed'));
      await titleInput.press('Enter');
      expectBuilderPayload(await put, 'gap-d-mobile-title-put');
      expect((await saved).ok()).toBe(true);
      await expect(titleDisplay).toHaveText(e2eTitle('mobile-renamed'));
      await expect(page.getByTestId('dashboard-save-status-saved-mobile')).toHaveText('Saved');

      // Description
      const descDisplay = page.getByTestId('dashboard-description-mobile-display');
      await expect(descDisplay).toHaveText('+ Add description');
      await descDisplay.click();
      put = captureNextPut(page, dash.id);
      await page.getByTestId('dashboard-description-mobile-input').fill('Mobile notes');
      await page.getByTestId('dashboard-description-mobile-input').press('ControlOrMeta+Enter');
      expectBuilderPayload(await put, 'gap-d-mobile-description-put');
      await expect(descDisplay).toHaveText('Mobile notes');

      // Chart / KPI open their pickers; Text adds a widget and enables undo
      await page.getByTestId('dashboard-builder-add-chart-btn-mobile').click();
      await expect(page.getByTestId('dashboard-chart-selector-modal')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('dashboard-chart-selector-modal')).toBeHidden();
      await page.getByTestId('dashboard-builder-add-kpi-btn-mobile').click();
      await expect(page.getByTestId('dashboard-kpi-selector-modal')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('dashboard-kpi-selector-modal')).toBeHidden();

      const undo = page.getByTestId('dashboard-builder-undo-btn-mobile');
      await expect(undo).toBeDisabled();
      await page.getByTestId('dashboard-builder-add-text-btn-mobile').click();
      await expect(cellsOfKind(page, 'text')).toHaveCount(1);
      await expect(undo).toBeEnabled();
      await undo.click();
      await expect(cellsOfKind(page, 'text')).toHaveCount(0);
      await expect(page.getByTestId('dashboard-builder-redo-btn-mobile')).toBeEnabled();

      // View saves and opens the view page
      put = captureNextPut(page, dash.id);
      await page.getByTestId('view-dashboard-mobile-btn').click();
      expectBuilderPayload(await put, 'gap-d-mobile-view-put');
      await expect(page).toHaveURL(`/dashboards/${dash.id}`);
    });
  });

  test.describe('tablet header (820px)', () => {
    test.use({ viewport: TABLET });

    test('GAP-D tablet uses the compact header too', async ({ page, factory }) => {
      const dash = await factory.dashboard('tablet-header');
      await openBuilderAt(page, dash.id, 'dashboard-builder-add-chart-btn-mobile');
      await expect(page.getByTestId('add-chart-btn')).toBeHidden();
      await expect(page.getByTestId('dashboard-title-display-mobile')).toHaveText(dash.title);
      await expect(page.getByTestId('dashboard-title-display')).toBeHidden();
      await expect(page.getByTestId('view-dashboard-mobile-btn')).toBeVisible();

      await page.getByTestId('dashboard-builder-add-text-btn-mobile').click();
      await expect(cellsOfKind(page, 'text')).toHaveCount(1);
      expectBuilderPayload(await saveViaTitle(page, dash.id), 'gap-d-tablet-text-put');
    });
  });
});

/** The compact header has no Save button; committing the title is the way to save explicitly. */
async function saveViaTitle(page: import('@playwright/test').Page, id: number) {
  const put = captureNextPut(page, id);
  await page.getByTestId('dashboard-title-display-mobile').click();
  await page.getByTestId('dashboard-title-input-mobile').press('Enter');
  return put;
}
