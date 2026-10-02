import type { Page, Route } from '@playwright/test';
import { fetchForRewrite } from '../support/routes';

/**
 * Shared helpers for the gaps-*.spec.ts files (FEATURES.md "Not covered — gap list" › Charts).
 *
 * Role probe on staging (GET /api/currentuserv2 via each role's session, 2026-09-27):
 *   admin   → can_view/create/edit/delete/share_charts
 *   member  → can_view/create/edit/delete_charts   (per-chart access_level 'view' on others' charts)
 *   analyst → can_view/create/edit/delete/share_charts
 * No real role lacks a chart permission, so permission-gated UI is exercised by trimming the
 * permission list of the real /api/currentuserv2 response (the app reads RBAC only from it:
 * components/auth-guard.tsx → authStore → lib/rbac.tsx useRbac).
 */

const CURRENT_USER_URL = /\/api\/currentuserv2(\?.*)?$/;

interface PermissionLike {
  slug: string;
}
interface OrgUserLike {
  permissions?: PermissionLike[];
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

/**
 * Hold matching requests until `release()` is called — makes transient loading states observable
 * without sleeping. Requests are continued (sent to the real backend) once released.
 */
export async function holdRequests(
  page: Page,
  url: string | RegExp,
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

/** Fail matching requests with `status` (JSON `{detail}` body like the Django Ninja errors). */
export async function failRequests(
  page: Page,
  url: string | RegExp,
  opts: { method?: string; status?: number; detail?: string } = {}
) {
  const { method, status = 500, detail = 'e2e forced failure' } = opts;
  await page.route(url, (route) => {
    if (method && route.request().method() !== method.toUpperCase()) return route.fallback();
    return route.fulfill({ status, json: { detail } });
  });
}
