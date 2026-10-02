import { inflateSync, deflateSync } from 'zlib';
import { readFile } from 'fs/promises';
import type { Page, Route } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { ROLE_USERS } from '../support/env';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import { waitForChartData, waitForEChart } from '../support/render';
import { gotoChartDetail, gotoChartEdit, openMenu, redactIds } from './helpers-core';
import { failRequests, holdRequests, withoutPermissions } from './helpers-gaps';
import { fetchForRewrite } from '../support/routes';

/**
 * FEATURES.md gap list › Charts — edit page, detail page and chart sharing.
 * Every chart here is an e2e-* chart created through the factory (never a seed chart).
 */

const chartPath = (id: number) => new RegExp(`/api/charts/${id}/$`);
// POST /api/charts/ exactly (save-as-new) — not chart-data/ etc.
const CHART_CREATE_URL = /\/api\/charts\/$/;

// ---------------------------------------------------------------------------------------------
// Edit page
// ---------------------------------------------------------------------------------------------

test.describe('charts edit — gaps', () => {
  test('GAP-C edit loading skeleton while the chart loads', async ({ page, factory }) => {
    const chart = await factory.barChart('gap-edit-skeleton');
    const gate = await holdRequests(page, chartPath(chart.id), 'GET');
    await page.goto(`/charts/${chart.id}/edit`);

    // Header bar + 30/70 split skeleton (edit/page.tsx chartLoading branch); form not rendered yet
    const skeletons = page.locator('[data-slot="skeleton"]');
    await expect(skeletons).toHaveCount(3);
    await expect(skeletons.first()).toBeVisible();
    await expect(page.getByTestId('chart-name-input')).toHaveCount(0);
    expect(gate.held()).toBeGreaterThan(0);

    gate.release();
    await expect(page.getByTestId('chart-name-input')).toHaveValue(chart.title);
    await expect(skeletons).toHaveCount(0);
  });

  test('[pinned] GAP-C edit update failure shows the backend error toast and stays on edit', async ({
    page,
    factory,
  }) => {
    const chart = await factory.barChart('gap-edit-update-fail');
    await gotoChartEdit(page, chart);
    await failRequests(page, chartPath(chart.id), {
      method: 'PUT',
      detail: 'e2e update refused',
    });
    await page.getByTestId('chart-name-input').fill(`${chart.title}-renamed`);
    await page.getByTestId('chart-edit-save-button').click();
    const req = captureRequest(page, { method: 'PUT', url: chartPath(chart.id) });
    await page.getByTestId('chart-save-update-existing-btn').click();
    expectPayloadSnapshot(await req, 'gap-edit-update-fail-put');

    // lib/api.ts always throws an Error carrying the backend detail, so toastError.update's
    // fallback "Failed to update chart. Please try again." is never what the user sees
    await expect(page.getByText('e2e update refused')).toBeVisible();
    await expect(page.getByText('Chart updated')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/charts/${chart.id}/edit$`));
  });

  test('[pinned] GAP-C edit save-as-new failure shows the backend error toast and stays on edit', async ({
    page,
    factory,
  }) => {
    const chart = await factory.barChart('gap-edit-create-fail');
    await gotoChartEdit(page, chart);
    await failRequests(page, CHART_CREATE_URL, { method: 'POST', detail: 'e2e create refused' });
    await page.getByTestId('chart-edit-save-button').click();
    await page.getByTestId('chart-save-as-new-btn').click();
    await page.getByTestId('chart-save-new-title-input').fill(`${chart.title}-copy`);
    const req = captureRequest(page, { method: 'POST', url: CHART_CREATE_URL });
    await page.getByTestId('chart-save-new-confirm-btn').click();
    expectPayloadSnapshot(await req, 'gap-edit-create-fail-post');

    // Same as update: the backend detail wins over toastError.create's fallback text
    await expect(page.getByText('e2e create refused')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/charts/${chart.id}/edit$`));
  });
});

// ---------------------------------------------------------------------------------------------
// Detail page
// ---------------------------------------------------------------------------------------------

const REQUEST_ACCESS_URL = /\/api\/access\/chart\/\d+\/request-access$/;
const CURRENT_USER_URL = /\/api\/currentuserv2(\?.*)?$/;
const ORG_LOGO_URL = /\/api\/org\/logo\/$/;

test.describe('charts detail — gaps', () => {
  test('GAP-C detail Access Denied without the view-charts permission', async ({
    page,
    factory,
  }) => {
    const chart = await factory.barChart('gap-detail-denied');
    await withoutPermissions(page, ['can_view_charts']);
    const chartGets: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'GET' && new URL(r.url()).pathname === `/api/charts/${chart.id}/`)
        chartGets.push(r.url());
    });
    const user = page.waitForResponse((r) => CURRENT_USER_URL.test(r.url()));
    await page.goto(`/charts/${chart.id}`);
    await user;

    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    await expect(page.getByText("You don't have permission to view charts.")).toBeVisible();
    await waitForChartData(page);
    // useChart(canViewCharts ? chartId : null) — the chart record is never requested
    expect(chartGets).toEqual([]);
    await expect(page.getByTestId('chart-export-trigger')).toHaveCount(0);

    await page.getByTestId('chart-detail-access-denied-back-btn').click();
    await expect(page).toHaveURL(/\/charts$/);
  });

  test('GAP-C detail Request Edit sends the request and shows the sent state', async ({
    factory,
    pageAs,
  }) => {
    const chart = await factory.barChart('gap-detail-request-edit');
    const member = await pageAs('member');
    await gotoChartDetail(member, chart.id);

    // Intercepted: a real request notifies the chart owner
    await member.route(REQUEST_ACCESS_URL, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 200, json: { success: true } })
        : route.fallback()
    );
    const pill = member.getByTestId('request-edit-pill');
    await expect(pill).toHaveText('Request Edit');
    await pill.click();
    await expect(member.getByTestId('request-access-dialog')).toBeVisible();
    await expect(member.getByTestId('request-access-level')).toBeDisabled();
    await expect(member.getByTestId('request-access-level')).toHaveText('Edit');
    await member.getByTestId('request-access-note').fill('Need to change the metric');
    const req = captureRequest(member, { method: 'POST', url: REQUEST_ACCESS_URL });
    await member.getByTestId('request-access-send-btn').click();
    expectPayloadSnapshot(redactIds(await req, { chart: chart.id }), 'gap-detail-request-edit');
    await expect(member.getByTestId('request-access-dialog')).toBeHidden();
    await expect(pill).toHaveText('Request Edit sent');
    await expect(pill).toBeDisabled();
  });

  test('GAP-C detail exported PDF carries the org logo', async ({ page, factory }) => {
    const chart = await factory.barChart('gap-detail-pdf-logo');
    // Branding only draws a logo when the org has logo_url (ChartExportDropdown → currentOrg.logo_url);
    // the bytes come from GET /api/org/logo/ — serve a solid red square there
    await setOrgLogoUrl(page, 'https://e2e.invalid/logo.png');
    const logoReqs: string[] = [];
    await page.route(ORG_LOGO_URL, (route: Route) => {
      logoReqs.push(route.request().url());
      return route.fulfill({ status: 200, contentType: 'image/png', body: solidPng(LOGO_PX, RED) });
    });

    await gotoChartDetail(page, chart.id);
    await waitForEChart(page.locator('body'));
    await openMenu(page.getByTestId('chart-export-trigger'), page.getByTestId('chart-export-pdf'));
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('chart-export-pdf').click(),
    ]);
    await expect(page.getByText('Chart exported as PDF')).toBeVisible();
    expect(logoReqs).toHaveLength(1);

    const pdf = await readFile((await download.path())!);
    const image = extractPdfImage(pdf);
    // compositeWithBranding (lib/chart-export.ts): logo top-left at PAD_X=32, vertically centred
    // in the 112px header; a 64px logo (= LOGO_MAX_H, unscaled) spans x 32–96, y 24–88
    expect(image.pixel(64, 56)).toEqual(RED);
    // left padding stays white
    expect(image.pixel(8, 56)).toEqual(WHITE);
  });

  test('GAP-C detail export failure shows "Export Failed"', async ({ page, factory }) => {
    const chart = await factory.barChart('gap-detail-export-fail');
    await gotoChartDetail(page, chart.id);
    await waitForEChart(page.locator('body'));
    await failRequests(page, /\/api\/charts\/download-csv\/$/, { method: 'POST' });
    await openMenu(page.getByTestId('chart-export-trigger'), page.getByTestId('chart-export-csv'));
    const req = captureRequest(page, { method: 'POST', url: '/api/charts/download-csv/' });
    await page.getByTestId('chart-export-csv').click();
    expectPayloadSnapshot(await req, 'gap-detail-export-fail-csv');

    await expect(page.getByText('Export Failed')).toBeVisible();
    // apiPostBinary throws "API error: <status> <statusText>" → toast description
    await expect(page.getByText(/^API error: 500/)).toBeVisible();
    await expect(page.getByText('CSV downloaded successfully')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------------------------

async function openChartShare(page: Page, chartId: number) {
  await gotoChartDetail(page, chartId);
  await page.getByTestId('chart-detail-share-button').click();
  const modal = page.getByTestId('share-modal');
  await expect(modal).toBeVisible();
  await expect(page.getByTestId('general-access-select')).toBeVisible();
  return modal;
}

async function chooseMode(page: Page, chartId: number, option: 'internal' | 'private' | 'public') {
  const req = captureRequest(page, {
    method: 'PATCH',
    url: `/api/access/chart/${chartId}/general-access`,
  });
  await page.getByTestId('general-access-select').click();
  await page.getByTestId(`general-access-option-${option}`).click();
  return req;
}

test.describe('charts share — gaps', () => {
  test('[pinned] GAP-C chart general access Default → Private → Default (no Public for charts)', async ({
    page,
    factory,
  }) => {
    const chart = await factory.barChart('gap-share-general');
    await openChartShare(page, chart.id);

    const select = page.getByTestId('general-access-select');
    const description = page.getByTestId('general-access-description');
    await expect(select).toHaveText('Default');
    await expect(description).toHaveText(
      'Users can access this resource based on their role permissions'
    );
    await expect(page.getByTestId('copy-link-btn')).toHaveCount(0);

    // Backend reports supports_public=false for charts → share-modal.tsx omits the Public option
    await select.click();
    await expect(page.getByTestId('general-access-option-private')).toBeVisible();
    await expect(page.getByTestId('general-access-option-internal')).toBeVisible();
    await expect(page.getByTestId('general-access-option-public')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(select).toHaveAttribute('data-state', 'closed');

    expectPayloadSnapshot(await chooseMode(page, chart.id, 'private'), 'gap-chart-access-private');
    await expect(select).toHaveText('Private');
    await expect(description).toHaveText('Only direct shares can access this resource');

    expectPayloadSnapshot(
      await chooseMode(page, chart.id, 'internal'),
      'gap-chart-access-internal'
    );
    await expect(select).toHaveText('Default');
    await expect(description).toHaveText(
      'Users can access this resource based on their role permissions'
    );
  });

  test('GAP-C chart people grant: member gets view access, then revoke @sends-email', async ({
    page,
    pageAs,
    factory,
  }) => {
    const member = await pageAs('member');
    const memberEmail = ROLE_USERS.member.email!.toLowerCase();
    const chart = await factory.barChart('gap-share-people');

    const modal = await openChartShare(page, chart.id);
    // Private first, so the member's only way in is the direct grant
    await chooseMode(page, chart.id, 'private');
    await expect(page.getByTestId('general-access-select')).toHaveText('Private');

    const input = page.getByTestId('share-chip-input');
    await input.fill(memberEmail);
    await input.press('Enter');
    await expect(modal.getByText(memberEmail)).toBeVisible();
    const grant = captureRequest(page, {
      method: 'POST',
      url: `/api/access/chart/${chart.id}/grants`,
    });
    await page.getByTestId('share-submit-btn').click();
    const granted = await grant;
    const principals = (granted.body as { principals: Array<{ principal_id: number }> }).principals;
    expect(principals).toHaveLength(1);
    expectPayloadSnapshot(
      redactIds(granted, { member: principals[0].principal_id }),
      'gap-chart-grant-member-view'
    );

    await gotoChartDetail(member, chart.id);
    await expect(member.getByRole('heading', { name: chart.title })).toBeVisible();
    await expect(member.getByTestId('request-edit-pill')).toBeVisible();
    await expect(member.getByTestId('chart-detail-edit-link')).toHaveCount(0);

    await openChartShare(page, chart.id);
    const row = page.locator('[data-testid^="share-grant-row-"]').filter({ hasText: memberEmail });
    await expect(row).toBeVisible();
    const revoke = captureRequest(page, {
      method: 'DELETE',
      url: `/api/access/chart/${chart.id}/grants`,
    });
    await row.locator('[data-testid^="share-grant-remove-"]').click();
    expectPayloadSnapshot(await revoke, 'gap-chart-revoke-member');
    await expect(row).toHaveCount(0);

    await member.goto(`/charts/${chart.id}`);
    await expect(
      member.getByText("Chart isn't ready yet. Please check your settings or try again later.")
    ).toBeVisible({ timeout: 30_000 });
  });
});

// ---------------------------------------------------------------------------------------------
// Logo / PDF helpers
// ---------------------------------------------------------------------------------------------

type Rgb = [number, number, number];
const RED: Rgb = [255, 0, 0];
const WHITE: Rgb = [255, 255, 255];
// = LOGO_MAX_H in lib/chart-export.ts (32 × BRAND_SCALE 2) → drawn unscaled
const LOGO_PX = 64;

/** Serve the real current-user response with `org.logo_url` set on every org user. */
async function setOrgLogoUrl(page: Page, logoUrl: string) {
  await page.route(CURRENT_USER_URL, async (route) => {
    const res = await fetchForRewrite(route);
    if (!res) return;
    const body = (await res.json()) as Array<{ org: Record<string, unknown> }>;
    await route.fulfill({
      response: res,
      json: body.map((ou) => ({ ...ou, org: { ...ou.org, logo_url: logoUrl } })),
    });
  });
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** Minimal RGB PNG of one colour. */
function solidPng(size: number, [r, g, b]: Rgb): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(size).fill([r, g, b]).flat())]);
  const raw = Buffer.concat(Array(size).fill(row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * The (only) RGB image XObject jsPDF wrote into the PDF, decoded to pixels.
 * jsPDF 3 writes this PNG as a raw (unfiltered) RGB stream; FlateDecode + PNG row predictors
 * (Predictor ≥ 10) are handled too in case compression gets switched on.
 */
function extractPdfImage(pdf: Buffer) {
  const text = pdf.toString('latin1');
  const dictRe = /<<([^<>]*?\/Subtype\s*\/Image[^<>]*?)>>\s*stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = dictRe.exec(text))) {
    const dict = m[1];
    if (!/\/ColorSpace\s*\/DeviceRGB/.test(dict)) continue; // skip the SMask (alpha) image
    const num = (key: string) => Number(new RegExp(`/${key}\\s+(\\d+)`).exec(dict)?.[1]);
    const width = num('Width');
    const height = num('Height');
    const length = num('Length');
    const start = m.index + m[0].length;
    const stream = pdf.subarray(start, start + length);
    const data = /\/Filter\s*\/FlateDecode/.test(dict) ? inflateSync(stream) : stream;
    const predictor = num('Predictor') || 1;
    const bpp = 3;
    const stride = width * bpp;
    let pixels: Buffer;
    if (predictor >= 10) {
      pixels = Buffer.alloc(stride * height);
      for (let y = 0; y < height; y++) {
        const filter = data[y * (stride + 1)];
        const src = data.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        for (let x = 0; x < stride; x++) {
          const a = x >= bpp ? pixels[y * stride + x - bpp] : 0;
          const b = y > 0 ? pixels[(y - 1) * stride + x] : 0;
          const c = x >= bpp && y > 0 ? pixels[(y - 1) * stride + x - bpp] : 0;
          let v = src[x];
          if (filter === 1) v += a;
          else if (filter === 2) v += b;
          else if (filter === 3) v += Math.floor((a + b) / 2);
          else if (filter === 4) {
            const p = a + b - c;
            const pa = Math.abs(p - a);
            const pb = Math.abs(p - b);
            const pc = Math.abs(p - c);
            v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          }
          pixels[y * stride + x] = v & 0xff;
        }
      }
    } else {
      pixels = data;
    }
    return {
      width,
      height,
      pixel: (x: number, y: number): Rgb => {
        const i = y * stride + x * bpp;
        return [pixels[i], pixels[i + 1], pixels[i + 2]];
      },
    };
  }
  throw new Error('no RGB image in exported PDF');
}
