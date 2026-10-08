import { type Locator, type Page, type Request, type Route, expect } from '@playwright/test';
import { cell, gridItem } from './helpers-builder';
import { fetchForRewrite } from '../support/routes';

/**
 * Helpers for the dashboards gaps-*.spec.ts / list-gaps.spec.ts files
 * (FEATURES.md "Not covered — gap list" › Dashboards).
 *
 * Role probe on staging (GET /api/currentuserv2 with each role's session, 2026-09-27):
 *   admin   → every dashboard permission incl. can_manage_org_default_dashboard
 *   member  → can_view/create/edit/delete/share_dashboards (no org-default)
 *   analyst → can_view/create/edit/delete/share_dashboards (no org-default)
 * No real role lacks create/delete, so permission-gated UI is exercised by trimming the permission
 * list of the real /api/currentuserv2 response — the app reads RBAC only from it
 * (components/auth-guard.tsx → authStore → lib/rbac.tsx useRbac).
 */

const CURRENT_USER_URL = /\/api\/currentuserv2(\?.*)?$/;

interface OrgUserLike {
  permissions?: Array<{ slug: string }>;
}

/** Serve the real current-user response with `slugs` removed from every org user's permissions. */
export async function withoutPermissions(page: Page, slugs: string[]) {
  const drop = new Set(slugs);
  await page.route(CURRENT_USER_URL, async (route: Route) => {
    const res = await fetchForRewrite(route);
    if (!res) return;
    const body = (await res.json()) as OrgUserLike[];
    const trimmed = Array.isArray(body)
      ? body.map((ou) => ({
          ...ou,
          permissions: (ou.permissions ?? []).filter((p) => !drop.has(p.slug)),
        }))
      : body;
    await route.fulfill({ response: res, json: trimmed });
  });
}

/** Matches a backend API URL by exact pathname; `withQuery` false (default) = no query string. */
export function apiPath(pathname: string | RegExp, withQuery = false) {
  return (url: URL) => {
    if (!withQuery && url.search) return false;
    return typeof pathname === 'string' ? url.pathname === pathname : pathname.test(url.pathname);
  };
}

export const FORCED_ERROR = 'e2e forced failure';

/** Fail matching requests with `status` and a Django-Ninja-style `{detail}` body. */
export async function failRequests(
  page: Page,
  url: string | RegExp | ((url: URL) => boolean),
  opts: { method?: string; status?: number; detail?: string } = {}
) {
  const { method, status = 500, detail = FORCED_ERROR } = opts;
  const seen: Request[] = [];
  await page.route(url, (route) => {
    if (method && route.request().method() !== method.toUpperCase()) return route.fallback();
    seen.push(route.request());
    return route.fulfill({ status, json: { detail } });
  });
  return seen;
}

/**
 * Hold matching requests until `release()` — makes transient loading states observable without
 * sleeping. Held requests continue to the real backend once released.
 */
export async function holdRequests(
  page: Page,
  url: string | RegExp | ((url: URL) => boolean),
  method?: string
): Promise<{ release: () => void; held: () => number }> {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let count = 0;
  await page.route(url, async (route) => {
    if (method && route.request().method() !== method.toUpperCase()) return route.fallback();
    count++;
    await gate;
    await route.fallback().catch(() => {
      /* page closed while held */
    });
  });
  return { release, held: () => count };
}

/** Serve the real response of matching GETs after passing its JSON through `edit`. */
export async function editResponse<T>(
  page: Page,
  url: string | RegExp | ((url: URL) => boolean),
  edit: (body: T) => unknown
) {
  await page.route(url, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const res = await fetchForRewrite(route);
    if (!res) return;
    const body = (await res.json()) as T;
    await route.fulfill({ response: res, json: edit(body) });
  });
}

// Upper bound for the builder's lock + mount-time autosave against staging
const BUILDER_READY_TIMEOUT_MS = 30_000;

/**
 * `openBuilder` for layouts where the desktop toolbar (`add-chart-btn`) is hidden (below 1024px):
 * waits for the lock POST, the mount-time autosave PUT and `readyTestId`.
 */
export async function openBuilderAt(page: Page, id: number, readyTestId: string) {
  const lock = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().endsWith(`/api/dashboards/${id}/lock/`),
    { timeout: BUILDER_READY_TIMEOUT_MS }
  );
  const mountSave = page.waitForResponse(
    (r) => r.request().method() === 'PUT' && r.url().endsWith(`/api/dashboards/${id}/`),
    { timeout: BUILDER_READY_TIMEOUT_MS }
  );
  await page.goto(`/dashboards/${id}/edit`);
  await lock;
  await mountSave;
  await expect(page.getByTestId(readyTestId)).toBeVisible({ timeout: BUILDER_READY_TIMEOUT_MS });
}

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Drag one of RGL's 8 resize handles by (dx, dy). */
export async function resizeFrom(
  page: Page,
  componentId: string,
  handle: ResizeHandle,
  dx: number,
  dy: number
) {
  const STEPS = 12;
  const item = gridItem(page, componentId);
  await item.hover();
  // TODO testid: RGL resize handles are identified by class only
  const box = (await item.locator(`.react-resizable-handle-${handle}`).boundingBox())!;
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 2, from.y + 2);
  await page.mouse.move(from.x + dx, from.y + dy, { steps: STEPS });
  await page.mouse.up();
}

/**
 * scrollTop of the builder canvas (the scrolling container around the grid).
 * TODO testid: the canvas div (dashboard-builder-v2 `canvasRef`) has no testid or id.
 */
export function canvasScrollTop(anyCell: Locator): Promise<number> {
  return anyCell.evaluate((el) => {
    let node: HTMLElement | null = el.parentElement;
    while (node && getComputedStyle(node).overflowY !== 'auto') node = node.parentElement;
    return node ? node.scrollTop : -1;
  });
}

/** Viewport rect of the builder canvas (see `canvasScrollTop` for the TODO testid). */
export function canvasRect(
  anyCell: Locator
): Promise<{ top: number; bottom: number; left: number; right: number }> {
  return anyCell.evaluate((el) => {
    let node: HTMLElement | null = el.parentElement;
    while (node && getComputedStyle(node).overflowY !== 'auto') node = node.parentElement;
    const r = (node ?? document.body).getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  });
}

/** Click into a text widget so the floating rich-text toolbar appears and the editor is live. */
export async function startEditingText(page: Page, textId: string) {
  const c = cell(page, textId);
  const image = c.getByTestId('dashboard-text-image');
  if (await image.count()) await image.click();
  else await c.getByTestId('dashboard-rich-text-editor').click();
  await expect(page.getByTestId('rich-text-style')).toBeVisible();
  const ed = c.getByTestId('dashboard-rich-text-editor');
  await expect(ed).toHaveAttribute('contenteditable', 'true');
  if (!(await image.count())) await expect(ed).toBeFocused();
}

/** Ids of the tabs in the tab bar, in order. */
export async function tabIdsOf(page: Page): Promise<string[]> {
  // TODO testid: per-tab testids only; match the prefix to enumerate tabs in order
  const testIds = await page
    .getByTestId('dashboard-tab-bar')
    .locator('[data-testid^="tab-item-"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid') || ''));
  return testIds.map((t) => t.replace('tab-item-', ''));
}
