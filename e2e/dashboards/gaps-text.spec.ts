import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import {
  FIXED_IDS,
  addText,
  cell,
  expectBuilderPayload,
  openBuilder,
  putTabs,
  releaseBuilderLocks,
  saveAndCapture,
  textComponent,
} from './helpers-builder';
import { FORCED_ERROR, startEditingText } from './helpers-gaps-builder';

const PNG_FIXTURE = path.join(__dirname, 'fixtures', 'widget-image.png');
// Image URLs point at a host that never resolves; the browser gets the fixture via page.route
const IMAGE_HOST = 'https://e2e-fixtures.invalid';
const IMAGE_URL = `${IMAGE_HOST}/seeded/widget-image.png`;

async function serveFixtureImages(page: Page) {
  await page.route(`${IMAGE_HOST}/**`, (route) =>
    route.fulfill({ path: PNG_FIXTURE, contentType: 'image/png' })
  );
}

function editor(page: Page, textId: string) {
  return cell(page, textId).getByTestId('dashboard-rich-text-editor');
}

/** A point on the empty canvas, below every widget and away from the header / toolbar. */
async function emptyCanvasPoint(page: Page) {
  const bar = (await page.getByTestId('dashboard-tab-bar').boundingBox())!;
  return { x: bar.x + bar.width - 40, y: bar.y + bar.height + 500 };
}

test.describe('dashboard builder gaps — text and image widget', () => {
  test.afterEach(async ({ api }) => releaseBuilderLocks(api));

  test('GAP-D text align left after another alignment', async ({ page, factory }) => {
    const dash = await factory.dashboard('rt-align-left');
    await openBuilder(page, dash.id);
    const textId = await addText(page);
    await startEditingText(page, textId);
    await page.keyboard.type('Aligned text');
    await page.keyboard.press('ControlOrMeta+a');

    const ed = editor(page, textId);
    await page.getByTestId('rich-text-align').click();
    await page.getByTestId('rich-text-align-right').click();
    await expect(ed.locator('p')).toHaveCSS('text-align', 'right');
    await page.getByTestId('rich-text-align').click();
    await page.getByTestId('rich-text-align-left').click();
    await expect(ed.locator('p')).toHaveCSS('text-align', 'left');

    expectBuilderPayload(await saveAndCapture(page, dash.id), 'gap-d-rt-align-left-put');
  });

  test('GAP-D clicking outside the text widget keeps the edit', async ({ page, factory }) => {
    const dash = await factory.dashboard('rt-outside');
    await openBuilder(page, dash.id);
    const textId = await addText(page);
    await startEditingText(page, textId);
    await page.keyboard.type('kept by an outside click');

    const outside = await emptyCanvasPoint(page);
    await page.mouse.click(outside.x, outside.y);
    await expect(page.getByTestId('rich-text-style')).toBeHidden();
    await expect(editor(page, textId)).toHaveAttribute('contenteditable', 'false');
    await expect(editor(page, textId)).toHaveText('kept by an outside click');

    const captured = await saveAndCapture(page, dash.id);
    const config = (
      captured.body as {
        tabs: Array<{ components: Record<string, { config: { content: string } }> }>;
      }
    ).tabs[0].components[textId].config;
    expect(config.content).toBe('kept by an outside click');
    expectBuilderPayload(captured, 'gap-d-rt-outside-put');
  });

  test('GAP-D an empty text widget shows nothing in view mode', async ({ page, factory, api }) => {
    const emptyId = 'text-1700000000022';
    const dash = await factory.dashboard('rt-empty-view');
    await putTabs(api, dash, [
      {
        id: FIXED_IDS.tab1,
        title: 'Tab',
        layout_config: [
          { i: FIXED_IDS.text1, x: 0, y: 0, w: 6, h: 6 },
          { i: emptyId, x: 6, y: 0, w: 6, h: 6 },
        ],
        components: {
          [FIXED_IDS.text1]: textComponent(FIXED_IDS.text1, 'Visible notes'),
          [emptyId]: textComponent(emptyId, ''),
        },
      },
    ]);

    // Builder: both widgets render an editor
    await openBuilder(page, dash.id);
    await expect(page.getByTestId('dashboard-rich-text-editor')).toHaveCount(2);

    // View: the empty one renders nothing at all
    await page.goto(`/dashboards/${dash.id}`);
    await expect(page.getByText('Visible notes')).toBeVisible();
    await expect(page.getByTestId('dashboard-rich-text-editor')).toHaveCount(1);
    await expect(page.getByTestId('dashboard-rich-text-editor')).toHaveText('Visible notes');
  });

  test('GAP-D image upload: "Uploading…" while it runs, then the failure toast', async ({
    page,
    factory,
  }) => {
    let releaseUpload!: () => void;
    const gate = new Promise<void>((r) => (releaseUpload = r));
    const uploads: string[] = [];
    await page.route('**/api/dashboards/images/', async (route) => {
      uploads.push(route.request().method());
      await gate;
      await route.fulfill({ status: 500, json: { detail: FORCED_ERROR } });
    });
    const dash = await factory.dashboard('img-upload-fail');
    await openBuilder(page, dash.id);
    const textId = await addText(page);
    await startEditingText(page, textId);
    await page.getByTestId('rich-text-image').click();

    const uploadBtn = page.getByTestId('rich-text-image-upload-btn');
    await expect(uploadBtn).toHaveText('Upload image');
    const chooser = page.waitForEvent('filechooser');
    await uploadBtn.click();
    await (await chooser).setFiles(PNG_FIXTURE);

    await expect(uploadBtn).toHaveText('Uploading…');
    await expect(uploadBtn).toBeDisabled();
    expect(uploads).toEqual(['PUT']);
    releaseUpload();

    await expect(page.getByText(FORCED_ERROR)).toBeVisible();
    await expect(uploadBtn).toHaveText('Upload image');
    await expect(cell(page, textId).getByTestId('dashboard-text-image')).toHaveCount(0);
  });

  test('GAP-D image caption left and right alignment', async ({ page, factory, api }) => {
    await serveFixtureImages(page);
    const dash = await factory.dashboard('img-caption-align');
    const text = textComponent(FIXED_IDS.text1, '');
    await putTabs(api, dash, [
      {
        id: FIXED_IDS.tab1,
        title: 'Tab',
        layout_config: [{ i: FIXED_IDS.text1, x: 0, y: 0, w: 6, h: 14 }],
        components: {
          [FIXED_IDS.text1]: {
            ...text,
            config: {
              ...text.config,
              imageUrl: IMAGE_URL,
              imageName: 'widget-image.png',
              imageSize: 'fit',
              caption: 'Seeded caption',
              captionAlign: 'center',
            },
          },
        },
      },
    ]);
    await openBuilder(page, dash.id);
    const captionRow = cell(page, FIXED_IDS.text1)
      .getByTestId('rich-text-caption-display')
      .locator('..');
    await expect(captionRow).toHaveCSS('text-align', 'center');

    await startEditingText(page, FIXED_IDS.text1);
    await page.getByTestId('rich-text-image').click();
    await page.getByTestId('rich-text-caption-align-left').click();
    await expect(captionRow).toHaveCSS('text-align', 'left');
    expectBuilderPayload(await saveAndCapture(page, dash.id), 'gap-d-caption-left-put');

    await startEditingText(page, FIXED_IDS.text1);
    await page.getByTestId('rich-text-image').click();
    await page.getByTestId('rich-text-caption-align-right').click();
    await expect(captionRow).toHaveCSS('text-align', 'right');
    expectBuilderPayload(await saveAndCapture(page, dash.id), 'gap-d-caption-right-put');
  });
});
