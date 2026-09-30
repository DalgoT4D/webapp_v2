import type { Page, Route } from '@playwright/test';

/**
 * Email guard — the test users are aliases of one real inbox, so any backend call that sends a
 * notification email lands there. Unless `E2E_ALLOW_EMAIL=on`, these calls are BLOCKED (never
 * reach the backend → no email) and the test is failed with a clear message.
 *
 * Tests that genuinely need them are tagged `@sends-email` in their title and excluded by default
 * (see `grepInvert` in playwright.config.ts). A test that intercepts the call itself with its own
 * `page.route(...).fulfill()` is unaffected: its handler runs first and nothing reaches the backend.
 *
 * Email triggers (DDP_backend: api/access_api.py, core/notifications/triggers/*):
 */
const EMAIL_TRIGGERS: Array<{ method: string; path: RegExp; label: string }> = [
  { method: 'POST', path: /\/api\/access\/\w+\/\d+\/grants\/?$/, label: 'share grant' },
  {
    method: 'PATCH',
    path: /\/api\/access\/\w+\/\d+\/grants\/\d+\/?$/,
    label: 'grant level change',
  },
  { method: 'POST', path: /\/api\/access\/\w+\/\d+\/request-access\/?$/, label: 'access request' },
  {
    method: 'POST',
    path: /\/api\/access\/\w+\/\d+\/request-access\/\d+\/respond\/?$/,
    label: 'access request response',
  },
  { method: 'POST', path: /\/api\/reports\/\d+\/share\/email\/?$/, label: 'report email' },
  { method: 'POST', path: /\/api\/v1\/organizations\/users\/invite\/?$/, label: 'user invite' },
];

// Comment create/update notifies every mentioned org user
// example.com/.net/.org and *.test / *.invalid can never receive mail
const RESERVED_EMAIL_DOMAIN =
  /@([a-z0-9-]+\.)*(example\.(com|net|org)|[a-z0-9-]+\.(test|invalid))$/i;
const COMMENT_PATH = /\/api\/reports\/\d+\/comments\/(\d+\/)?$/;

export const EMAIL_ALLOWED = process.env.E2E_ALLOW_EMAIL === 'on';
export const SENDS_EMAIL_TAG = '@sends-email';

/** Label of the email this request would trigger, or null. */
export function emailTrigger(method: string, pathname: string, body: unknown): string | null {
  const m = method.toUpperCase();
  const hit = EMAIL_TRIGGERS.find((t) => t.method === m && t.path.test(pathname));
  if (hit) return hit.label;
  if ((m === 'POST' || m === 'PUT') && COMMENT_PATH.test(pathname)) {
    // Backend only emails mentioned ORG users; reserved test domains can never be one (RFC 2606)
    const mentions = (body as { mentioned_emails?: unknown } | null)?.mentioned_emails;
    if (Array.isArray(mentions) && mentions.some((e) => !RESERVED_EMAIL_DOMAIN.test(String(e)))) {
      return 'comment @mention';
    }
  }
  return null;
}

export class EmailGuardError extends Error {
  constructor(method: string, path: string, label: string) {
    super(
      `EMAIL GUARD: blocked ${method} ${path} (${label}) — this would send a real email. ` +
        `Intercept it with page.route, or tag the test "${SENDS_EMAIL_TAG}" (runs only with E2E_ALLOW_EMAIL=on).`
    );
  }
}

/** Browser side: abort email-triggering requests and remember them for the fixture to report. */
export async function installEmailGuard(page: Page, blocked: string[]) {
  if (EMAIL_ALLOWED) return;
  await page.route('**/api/**', async (route: Route) => {
    const req = route.request();
    const { pathname } = new URL(req.url());
    let body: unknown = null;
    try {
      body = req.postDataJSON();
    } catch {
      /* non-JSON body */
    }
    const label = emailTrigger(req.method(), pathname, body);
    if (!label) return route.fallback();
    blocked.push(`${req.method()} ${pathname} (${label})`);
    return route.abort('blockedbyclient');
  });
}
