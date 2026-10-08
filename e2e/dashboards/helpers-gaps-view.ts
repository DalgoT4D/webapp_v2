import { type Locator, type Page, type Route, expect, request } from '@playwright/test';
import { ApiClient } from '../support/api-client';
import { type RoleName, BACKEND_URL, ROLE_USERS, SEED } from '../support/env';
import { fetchForRewrite } from '../support/routes';

const EDUCATION_DATASET = SEED.datasets.education;

/**
 * Helpers for the GAP-D specs (gaps-filters / gaps-view / gaps-lock-share / gaps-public).
 * Read-only reuse of helpers-view.ts / helpers-builder.ts lives in the specs themselves.
 */

// ---------------------------------------------------------------------------
// Other roles' backend sessions (setup only — e.g. "analyst takes the edit lock")

/** Backend client logged in as another org role (storage state written by global.setup). */
export function roleApi(role: RoleName): Promise<ApiClient> {
  return ApiClient.create(ROLE_USERS[role].statePath);
}

interface ActiveMember {
  orguser_id: number;
  email: string;
}

/** orguser id of an org member, looked up the same way the share modal does. */
export async function orgUserId(api: ApiClient, email: string): Promise<number> {
  const members = await api.get<ActiveMember[]>('/api/v1/organizations/active-members');
  const hit = members.find((m) => m.email.toLowerCase() === email.toLowerCase());
  if (!hit) throw new Error(`${email} is not an active member of the e2e org`);
  return hit.orguser_id;
}

/** Direct grant through the access API (setup for share-row tests). */
export async function grant(
  api: ApiClient,
  dashboardId: number,
  orguserId: number,
  level: 'view' | 'edit'
) {
  await api.post(`/api/access/dashboard/${dashboardId}/grants`, {
    principals: [{ principal_type: 'user', principal_id: orguserId, access_level: level }],
  });
}

/** One anonymous hit on the public dashboard endpoint (counts as a public access). */
export async function hitPublicDashboard(token: string) {
  const anon = await request.newContext({ baseURL: BACKEND_URL });
  try {
    const res = await anon.get(`/api/v1/public/dashboards/${token}/`);
    expect(res.ok()).toBe(true);
  } finally {
    await anon.dispose();
  }
}

// ---------------------------------------------------------------------------
// Route helpers

type JsonObject = Record<string, unknown>;

/**
 * Let a GET through to the real backend, then rewrite its JSON before the page sees it.
 * Used where the state under test can't be produced on staging (org-wide settings, broken rows).
 */
export async function rewriteJson(
  page: Page,
  url: string | RegExp,
  rewrite: (json: JsonObject) => JsonObject
) {
  await page.route(url, async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const res = await fetchForRewrite(route);
    if (!res) return;
    const json = (await res.json()) as JsonObject;
    await route.fulfill({ response: res, json: rewrite(json) });
  });
}

/**
 * Hold matching requests until `release()` is called — for asserting transient loading states
 * without a fixed sleep. Returns `release` and a promise that resolves once a request is held.
 */
export async function holdRequests(page: Page, url: string | RegExp, method = 'GET') {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let markHeld!: () => void;
  const held = new Promise<void>((r) => (markHeld = r));
  await page.route(url, async (route) => {
    if (route.request().method() !== method) return route.fallback();
    markHeld();
    await gate;
    await route.fallback();
  });
  return { release, held };
}

/** Filter-options preview endpoint for one column (private or public). */
export function previewUrl(column: string): RegExp {
  return new RegExp(
    `/api/(v1/public/dashboards/[^/]+/)?filters/preview/\\?schema_name=${EDUCATION_DATASET.schema}&table_name=${EDUCATION_DATASET.table}&column_name=${column}&`
  );
}

// ---------------------------------------------------------------------------
// Chart / widget setup

/** Number chart body (same shape the builder saves — see charts/builder-number baselines). */
export function numberChartOverrides() {
  return {
    chart_type: 'number',
    extra_config: {
      aggregate_column: 'students',
      aggregate_function: 'sum',
      metrics: [{ column: 'students', aggregation: 'sum', alias: 'SUM(students)' }],
      customizations: { numberFormat: 'adaptive_indian', numberSize: 'medium', decimalPlaces: 0 },
    },
  };
}

// ---------------------------------------------------------------------------
// Toasts

/**
 * Sonner toast list. The <section aria-label="Notifications …"> only exists once the Toaster
 * mounted; toasts are its list items.
 */
export function toasts(page: Page): Locator {
  return page.getByRole('region', { name: /Notifications/ }).getByRole('listitem');
}

// ---------------------------------------------------------------------------
// Visibility simulation

/** Simulate the browser tab going to the background (Playwright pages never lose visibility). */
export async function hideTab(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

export async function showTab(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}
