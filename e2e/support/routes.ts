import type { APIResponse, Route } from '@playwright/test';

/**
 * For `page.route` handlers that let a request through to the real backend and then REWRITE its
 * JSON (drop a permission, age a row, inject a setting…).
 *
 * If the backend answers with an error — most importantly 498 "Token expired", which any run
 * longer than the 30-min access token hits — the original response is passed straight to the app
 * and `null` is returned. The app then refreshes its token and retries; the retry comes back
 * through the same handler with real data. Rewriting an error body instead crashes the page
 * (`orgUsers.map is not a function`).
 *
 *   await page.route('**\/api/currentuserv2', async (route) => {
 *     const res = await fetchForRewrite(route);
 *     if (!res) return;
 *     await route.fulfill({ response: res, json: rewrite(await res.json()) });
 *   });
 */
export async function fetchForRewrite(route: Route): Promise<APIResponse | null> {
  const res = await route.fetch();
  if (res.ok()) return res;
  await route.fulfill({ response: res });
  return null;
}
