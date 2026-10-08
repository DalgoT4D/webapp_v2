import path from 'path';
import type { Page, Request } from '@playwright/test';
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

const FIXTURES = path.join(__dirname, 'fixtures');
const PNG_FIXTURE = path.join(FIXTURES, 'widget-image.png');
const ALT_PNG_FIXTURE = path.join(FIXTURES, 'widget-image-alt.png');
const TXT_FIXTURE = path.join(FIXTURES, 'not-an-image.txt');

// Client-side cap in text-element-unified.tsx (MAX_WIDGET_IMAGE_SIZE_BYTES)
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// The image upload goes to object storage and returns a signed (per-run) URL, so it is mocked:
// the request itself is asserted, the response is a stable URL served from the fixture file.
const IMAGE_HOST = 'https://e2e-fixtures.invalid';
const UPLOADED_URL = `${IMAGE_HOST}/uploaded/widget-image.png`;
const LINKED_URL = `${IMAGE_HOST}/linked/widget-image-alt.png`;
const UPLOADED_KEY = 'e2e/widget-image.png';

async function mockImageBackend(page: Page): Promise<Request[]> {
  const uploads: Request[] = [];
  await page.route('**/api/dashboards/images/', async (route) => {
    uploads.push(route.request());
    await route.fulfill({ json: { image_url: UPLOADED_URL, image_key: UPLOADED_KEY } });
  });
  await page.route(`${IMAGE_HOST}/**`, (route) =>
    route.fulfill({
      path: route.request().url().includes('/linked/') ? ALT_PNG_FIXTURE : PNG_FIXTURE,
      contentType: 'image/png',
    })
  );
  return uploads;
}

/** Click into a text widget so the floating toolbar appears. */
async function startEditing(page: Page, textId: string) {
  const c = cell(page, textId);
  const image = c.getByTestId('dashboard-text-image');
  if (await image.count()) await image.click();
  else await c.getByTestId('dashboard-rich-text-editor').click();
  await expect(page.getByTestId('rich-text-style')).toBeVisible();
  // The toolbar appears before the editor turns editable/focused; typing earlier drops keystrokes
  const ed = c.getByTestId('dashboard-rich-text-editor');
  await expect(ed).toHaveAttribute('contenteditable', 'true');
  if (!(await image.count())) await expect(ed).toBeFocused();
}

function editor(page: Page, textId: string) {
  return cell(page, textId).getByTestId('dashboard-rich-text-editor');
}

/** Extend the selection `n` characters to the left of the caret. */
async function selectBackwards(page: Page, n: number) {
  for (let i = 0; i < n; i++) await page.keyboard.press('Shift+ArrowLeft');
  // The DOM selection updates immediately, but ProseMirror syncs it on async selectionchange —
  // a toolbar click before that applies formatting to a partial selection. Wait on the editor's
  // own state (Tiptap exposes the instance on its DOM node).
  await expect
    .poll(() =>
      page.evaluate(() => {
        const dom = document.activeElement as
          | (HTMLElement & {
              editor?: { state: { selection: { from: number; to: number } } };
            })
          | null;
        const sel = dom?.editor?.state.selection;
        return sel ? sel.to - sel.from : -1;
      })
    )
    .toBe(n);
}

async function pickImageFile(
  page: Page,
  files: string | { name: string; mimeType: string; buffer: Buffer }
) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('rich-text-image-upload-btn').click();
  await (await chooser).setFiles(files);
}

test.describe('dashboard builder — text widget', () => {
  test.afterEach(async ({ api }) => releaseBuilderLocks(api));

  test.describe('D-B7 rich text', () => {
    test('heading levels, normal text and font size', async ({ page, factory }) => {
      const dash = await factory.dashboard('rt-heading');
      await openBuilder(page, dash.id);
      const textId = await addText(page);
      await startEditing(page, textId);

      await page.keyboard.type('Programme overview');
      const style = page.getByTestId('rich-text-style');
      for (const level of [1, 3, 2] as const) {
        await style.click();
        await page.getByTestId(`rich-text-heading-${level}`).click();
        await expect(style).toContainText(`H${level}`);
        await expect(editor(page, textId).locator(`h${level}`)).toHaveText('Programme overview');
      }

      // Second line: back to normal text, then a custom size on just that line
      await page.keyboard.press('Enter');
      await style.click();
      await page.getByTestId('rich-text-paragraph').click();
      await expect(style).toContainText('T');
      await expect(editor(page, textId)).toBeFocused();
      await page.keyboard.type('Reach by state');
      // Triple-click selects the whole line in one ProseMirror transaction; a run of Shift+Arrow
      // keystrokes syncs into ProseMirror asynchronously and could lose the head of the selection
      await editor(page, textId)
        .locator('p', { hasText: 'Reach by state' })
        .click({ clickCount: 3 });
      await expect
        .poll(() => page.evaluate(() => window.getSelection()?.toString().trim()))
        .toBe('Reach by state');
      await page.getByTestId('rich-text-font-size').selectOption('24');
      await expect(page.getByTestId('rich-text-font-size')).toHaveValue('24');
      await expect(editor(page, textId).locator('p span')).toHaveCSS('font-size', '24px');

      expectBuilderPayload(await saveAndCapture(page, dash.id), 'd-b7-heading-size-put');
      await expect(page.getByTestId('rich-text-style')).toBeHidden();
      await expect(editor(page, textId).locator('h2')).toHaveText('Programme overview');
    });

    test('bold, italic, underline and alignment', async ({ page, factory }) => {
      const dash = await factory.dashboard('rt-marks');
      await openBuilder(page, dash.id);
      const textId = await addText(page);
      await startEditing(page, textId);

      await page.keyboard.type('Key findings');
      await page.keyboard.press('ControlOrMeta+a');
      for (const mark of ['bold', 'italic', 'underline']) {
        const btn = page.getByTestId(`rich-text-${mark}`);
        await btn.click();
        await expect(btn).toHaveAttribute('aria-pressed', 'true');
      }
      const ed = editor(page, textId);
      await expect(ed.locator('strong em u')).toHaveText('Key findings');

      for (const align of ['center', 'right', 'center'] as const) {
        await page.getByTestId('rich-text-align').click();
        await page.getByTestId(`rich-text-align-${align}`).click();
        await expect(ed.locator('p')).toHaveCSS('text-align', align);
      }

      // Toggle bold off again → mixed state is not possible on a full selection
      await page.getByTestId('rich-text-bold').click();
      await expect(page.getByTestId('rich-text-bold')).toHaveAttribute('aria-pressed', 'false');

      expectBuilderPayload(await saveAndCapture(page, dash.id), 'd-b7-marks-align-put');
    });

    test('text colour preset, custom hex (cancel + OK) and background colour', async ({
      page,
      factory,
    }) => {
      const dash = await factory.dashboard('rt-colour');
      await openBuilder(page, dash.id);
      const textId = await addText(page);
      await startEditing(page, textId);

      await page.keyboard.type('Red');
      await selectBackwards(page, 'Red'.length);
      await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Red');
      await page.getByTestId('rich-text-color-picker').click();
      await page.getByTestId('rich-text-color-ef4444').click();
      const ed = editor(page, textId);
      await expect(ed.locator('span', { hasText: 'Red' })).toHaveCSS('color', 'rgb(239, 68, 68)');

      // Collapse the selection to its end (macOS has no Home/End caret moves) and append.
      // The preset click refocuses the editor asynchronously — wait for it before typing.
      await expect(ed).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.type(' Custom');
      await expect(ed).toHaveText('Red Custom');
      await selectBackwards(page, 'Custom'.length);
      await expect
        .poll(() => page.evaluate(() => window.getSelection()?.toString()))
        .toBe('Custom');

      // Custom → Cancel returns to the presets without applying
      await page.getByTestId('rich-text-color-picker').click();
      await page.getByTestId('rich-text-custom-color-toggle').click();
      await page.getByTestId('rich-text-custom-color-cancel').click();
      await expect(page.getByTestId('rich-text-color-ef4444')).toBeVisible();

      await page.getByTestId('rich-text-custom-color-toggle').click();
      await page.getByTestId('rich-text-custom-color-hex').fill('#1D4ED8');
      await page.getByTestId('rich-text-custom-color-ok').click();
      await expect(page.getByTestId('rich-text-custom-color-hex')).toBeHidden();
      await expect(ed.locator('span', { hasText: 'Custom' })).toHaveCSS(
        'color',
        'rgb(29, 78, 216)'
      );

      await page.getByTestId('rich-text-bg-color-picker').click();
      await page.getByTestId('rich-text-bg-color-f59e0b').click();
      // TODO testid: the widget background lives on the editor's container div
      await expect(ed.locator('xpath=ancestor::div[contains(@style,"background")][1]')).toHaveCSS(
        'background-color',
        'rgb(245, 158, 11)'
      );

      expectBuilderPayload(await saveAndCapture(page, dash.id), 'd-b7-colours-put');
    });

    test('Esc discards the edit; Cmd/Ctrl+Enter commits it', async ({ page, factory }) => {
      const dash = await factory.dashboard('rt-esc');
      await openBuilder(page, dash.id);
      const textId = await addText(page);

      await startEditing(page, textId);
      await page.keyboard.type('thrown away');
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('rich-text-style')).toBeHidden();
      await expect(editor(page, textId)).toHaveText('');

      await startEditing(page, textId);
      await page.keyboard.type('kept text');
      await page.keyboard.press('ControlOrMeta+Enter');
      await expect(page.getByTestId('rich-text-style')).toBeHidden();
      await expect(editor(page, textId)).toHaveText('kept text');

      expectBuilderPayload(await saveAndCapture(page, dash.id), 'd-b7-commit-put');
    });
  });

  test.describe('D-B8 image', () => {
    test('upload: wrong type and >5MB rejected client-side, valid PNG uploads', async ({
      page,
      factory,
    }) => {
      const uploads = await mockImageBackend(page);
      const dash = await factory.dashboard('img-upload');
      await openBuilder(page, dash.id);
      const textId = await addText(page);
      await startEditing(page, textId);

      await page.getByTestId('rich-text-image').click();
      await expect(page.getByTestId('rich-text-image-tab-upload')).toBeVisible();

      await pickImageFile(page, TXT_FIXTURE);
      await expect(
        page.getByText('Please upload a JPEG, PNG, GIF, WEBP, or SVG image.')
      ).toBeVisible();

      await pickImageFile(page, {
        name: 'too-big.png',
        mimeType: 'image/png',
        buffer: Buffer.alloc(MAX_IMAGE_BYTES + 1),
      });
      await expect(page.getByText('Image must be smaller than 5MB.')).toBeVisible();
      expect(uploads).toHaveLength(0);

      const uploadDone = page.waitForResponse('**/api/dashboards/images/');
      await pickImageFile(page, PNG_FIXTURE);
      await uploadDone;
      expect(uploads).toHaveLength(1);
      expect(uploads[0].method()).toBe('PUT');
      expect(uploads[0].postDataBuffer()?.toString('latin1')).toContain(
        'name="file"; filename="widget-image.png"'
      );

      const img = cell(page, textId).getByTestId('dashboard-text-image').locator('img');
      await expect(img).toHaveAttribute('src', UPLOADED_URL);
      await expect(img).toHaveAttribute('alt', 'widget-image.png');
      // Default fit is "fill" → object-cover
      await expect(img).toHaveCSS('object-fit', 'cover');

      expectBuilderPayload(await saveAndCapture(page, dash.id), 'd-b8-upload-put');
    });

    test('link, fit modes, caption text and alignment', async ({ page, factory }) => {
      await mockImageBackend(page);
      const dash = await factory.dashboard('img-link');
      await openBuilder(page, dash.id);
      const textId = await addText(page);
      await startEditing(page, textId);

      await page.getByTestId('rich-text-image').click();
      await page.getByTestId('rich-text-image-tab-link').click();
      await expect(page.getByTestId('rich-text-image-link-confirm')).toBeDisabled();
      await page.getByTestId('rich-text-image-link-input').fill(LINKED_URL);
      await page.getByTestId('rich-text-image-link-input').press('Enter');
      const img = cell(page, textId).getByTestId('dashboard-text-image').locator('img');
      await expect(img).toHaveAttribute('src', LINKED_URL);

      await page.getByTestId('rich-text-image').click();
      await expect(page.getByText('widget-image-alt.png')).toBeVisible();
      const fits = { fit: 'contain', stretch: 'fill', fill: 'cover' } as const;
      for (const [option, objectFit] of Object.entries(fits)) {
        await page.getByTestId(`rich-text-image-size-${option}`).click();
        await expect(img).toHaveCSS('object-fit', objectFit);
      }
      await page.getByTestId('rich-text-image-size-fit').click();
      await page.getByTestId('rich-text-caption-align-center').click();

      const captionDisplay = cell(page, textId).getByTestId('rich-text-caption-display');
      await expect(captionDisplay).toHaveText('Add caption…');
      await captionDisplay.click();
      const captionInput = cell(page, textId).getByTestId('rich-text-caption-input');
      await captionInput.fill('Photo: school visit');
      await captionInput.press('Enter');
      await expect(captionDisplay).toHaveText('Photo: school visit');
      await expect(captionDisplay.locator('..')).toHaveCSS('text-align', 'center');

      expectBuilderPayload(await saveAndCapture(page, dash.id), 'd-b8-link-fit-caption-put');
    });

    test('[pinned] Esc in the caption input commits the caption instead of cancelling', async ({
      page,
      factory,
      api,
    }) => {
      // text-element-unified:529 — Enter and Escape both call commitCaption
      await mockImageBackend(page);
      const dash = await factory.dashboard('img-caption-esc');
      await putTabs(api, dash, [imageTab(LINKED_URL)]);
      await openBuilder(page, dash.id);

      const captionDisplay = cell(page, FIXED_IDS.text1).getByTestId('rich-text-caption-display');
      await captionDisplay.click();
      const input = cell(page, FIXED_IDS.text1).getByTestId('rich-text-caption-input');
      await input.fill('escaped but kept');
      await input.press('Escape');
      await expect(captionDisplay).toHaveText('escaped but kept');
    });

    test('replace (Back keeps image, link replaces it) and remove clears image + caption', async ({
      page,
      factory,
      api,
    }) => {
      await mockImageBackend(page);
      const dash = await factory.dashboard('img-replace');
      await putTabs(api, dash, [imageTab(UPLOADED_URL)]);
      await openBuilder(page, dash.id);
      const textId = FIXED_IDS.text1;
      const img = cell(page, textId).getByTestId('dashboard-text-image').locator('img');
      await expect(img).toHaveAttribute('src', UPLOADED_URL);
      await expect(cell(page, textId).getByTestId('rich-text-caption-display')).toHaveText(
        'Seeded caption'
      );

      await startEditing(page, textId);
      await page.getByTestId('rich-text-image').click();
      await expect(page.getByText('widget-image.png')).toBeVisible();

      // Replace → Back leaves the current image alone
      await page.getByTestId('rich-text-image-reload').click();
      await expect(page.getByTestId('rich-text-image-tab-upload')).toBeVisible();
      await page.getByTestId('rich-text-image-cancel-replace').click();
      await expect(page.getByTestId('rich-text-image-remove')).toBeVisible();
      await expect(img).toHaveAttribute('src', UPLOADED_URL);

      // Replace via link
      await page.getByTestId('rich-text-image-reload').click();
      await page.getByTestId('rich-text-image-tab-link').click();
      await page.getByTestId('rich-text-image-link-input').fill(LINKED_URL);
      await page.getByTestId('rich-text-image-link-confirm').click();
      await expect(img).toHaveAttribute('src', LINKED_URL);
      expectBuilderPayload(await saveAndCapture(page, dash.id), 'd-b8-replaced-put');

      // Remove → back to a plain text widget, caption gone
      await startEditing(page, textId);
      await page.getByTestId('rich-text-image').click();
      await page.getByTestId('rich-text-image-remove').click();
      await expect(cell(page, textId).getByTestId('dashboard-text-image')).toHaveCount(0);
      await expect(cell(page, textId).getByTestId('rich-text-caption-display')).toHaveCount(0);
      // Background colour is only offered once there is no image
      await expect(page.getByTestId('rich-text-bg-color-picker')).toBeVisible();
      expectBuilderPayload(await saveAndCapture(page, dash.id), 'd-b8-removed-put');
    });
  });
});

function imageTab(imageUrl: string) {
  const text = textComponent(FIXED_IDS.text1, '');
  return {
    id: FIXED_IDS.tab1,
    title: 'Tab',
    layout_config: [{ i: FIXED_IDS.text1, x: 0, y: 0, w: 6, h: 14 }],
    components: {
      [FIXED_IDS.text1]: {
        ...text,
        config: {
          ...text.config,
          imageUrl,
          imageKey: UPLOADED_KEY,
          imageName: imageUrl.split('/').pop(),
          imageSize: 'fit',
          caption: 'Seeded caption',
          captionAlign: 'right',
        },
      },
    },
  };
}
