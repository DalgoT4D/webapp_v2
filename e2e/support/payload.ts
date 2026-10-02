import { type Page, type Request, expect } from '@playwright/test';
import { PAYLOAD_SNAPSHOTS_ENABLED, RUN_ID } from './env';

/**
 * Payload capture — the main refactor guard.
 * A refactor that silently changes what the UI sends to the backend is the #1 regression risk,
 * so key actions snapshot their request body (normalized) and compare against the pre-refactor baseline.
 */

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

// Keys whose values differ run-to-run and must not be part of the baseline
const VOLATILE_KEYS = new Set([
  'created_at',
  'updated_at',
  'published_at',
  'lock_token',
  'timestamp',
]);

// e.g. chart-1782209775552, tab-1778766426884 — generated from Date.now()
const TIMESTAMP_ID = /\b(chart|kpi|text|tab|heading|filter)-\d{12,}\b/g;
const RUN_TITLE = new RegExp(`e2e-${RUN_ID}-`, 'g');

/** Replace run-specific values with stable placeholders so bodies can be snapshotted. */
export function normalize(value: Json, idMap = new Map<string, string>()): Json {
  if (typeof value === 'string') {
    return value.replace(RUN_TITLE, 'e2e-<run>-').replace(TIMESTAMP_ID, (m, kind: string) => {
      if (!idMap.has(m)) idMap.set(m, `${kind}-<${idMap.size + 1}>`);
      return idMap.get(m)!;
    });
  }
  if (Array.isArray(value)) return value.map((v) => normalize(v, idMap));
  if (value && typeof value === 'object') {
    const out: Record<string, Json> = {};
    for (const key of Object.keys(value).sort()) {
      const normKey = normalize(key, idMap) as string;
      out[normKey] = VOLATILE_KEYS.has(key) ? '<volatile>' : normalize(value[key], idMap);
    }
    return out;
  }
  return value;
}

export interface CaptureOptions {
  method?: string;
  /** substring or regex matched against the request URL */
  url: string | RegExp;
  timeout?: number;
}

function matches(req: Request, { method, url }: CaptureOptions) {
  if (method && req.method() !== method.toUpperCase()) return false;
  return typeof url === 'string' ? req.url().includes(url) : url.test(req.url());
}

/**
 * Start listening BEFORE the action, await AFTER:
 *   const req = captureRequest(page, { method: 'POST', url: '/api/charts/' });
 *   await saveButton.click();
 *   const body = await req;
 */
export async function captureRequest(page: Page, opts: CaptureOptions): Promise<CapturedRequest> {
  const req = await page.waitForRequest((r) => matches(r, opts), {
    timeout: opts.timeout ?? 15_000,
  });
  const raw = req.postData();
  let body: Json = null;
  if (raw) {
    try {
      body = JSON.parse(raw) as Json;
    } catch {
      body = raw;
    }
  }
  const url = new URL(req.url());
  const query: Record<string, Json> = {};
  url.searchParams.forEach((v, k) => {
    try {
      query[k] = JSON.parse(v) as Json;
    } catch {
      query[k] = v;
    }
  });
  return { method: req.method(), path: url.pathname, query, body };
}

export interface CapturedRequest {
  method: string;
  path: string;
  query: Record<string, Json>;
  body: Json;
}

/** Normalized, run-independent form of a captured request (ids in the path → <id>). */
export function stablePayload(captured: CapturedRequest): Json {
  return {
    method: captured.method,
    path: captured.path.replace(/\/\d+(?=\/|$)/g, '/<id>'),
    query: normalize(captured.query),
    body: normalize(captured.body),
  };
}

/** Snapshot a captured request (normalized). */
export function expectPayloadSnapshot(captured: CapturedRequest, name: string) {
  if (!PAYLOAD_SNAPSHOTS_ENABLED) return;
  expect(JSON.stringify(stablePayload(captured), null, 2)).toMatchSnapshot(`${name}.json`);
}
