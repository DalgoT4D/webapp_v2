import { type APIRequestContext, request } from '@playwright/test';
import { AUTH_STATE_PATH, BACKEND_URL, E2E_PREFIX, ORG_SLUG } from './env';
import { EMAIL_ALLOWED, EmailGuardError, emailTrigger } from './email-guard';

/**
 * Thin backend client for fast test setup/teardown.
 * Use it when a test is NOT about the creation flow itself
 * (e.g. "delete a chart from the list" needs a chart to exist, not a UI walk-through).
 */

// Backend's "access token expired — refresh me" status (see lib/api.ts)
const TOKEN_EXPIRED_STATUS = 498;

// Backend silently falls back to 10 when page_size > 100
const MAX_PAGE_SIZE = 100;

export type Resource = 'charts' | 'dashboards' | 'kpis' | 'metrics' | 'reports';

interface Titled {
  id: number;
  title?: string;
  name?: string;
}

export class ApiClient {
  constructor(private readonly ctx: APIRequestContext) {}

  static async create(storageStatePath: string = AUTH_STATE_PATH): Promise<ApiClient> {
    const ctx = await request.newContext({
      baseURL: BACKEND_URL,
      storageState: storageStatePath,
      extraHTTPHeaders: { 'x-dalgo-org': ORG_SLUG },
    });
    return new ApiClient(ctx);
  }

  async dispose() {
    await this.ctx.dispose();
  }

  private refreshing: Promise<void> | null = null;

  /** Same as lib/api.ts: the access token lives 30 min, a full run can outlast it. */
  private refreshAccessToken(): Promise<void> {
    this.refreshing ??= this.ctx
      .post('/api/v2/token/refresh')
      .then((res) => {
        if (!res.ok()) throw new Error(`token refresh → ${res.status()}`);
      })
      .finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }

  private async call<T>(method: string, path: string, data?: unknown): Promise<T> {
    const emailLabel = EMAIL_ALLOWED
      ? null
      : emailTrigger(method, new URL(path, BACKEND_URL).pathname, data);
    if (emailLabel) throw new EmailGuardError(method, path, emailLabel);
    let res = await this.ctx.fetch(path, { method, data });
    if (res.status() === TOKEN_EXPIRED_STATUS) {
      await this.refreshAccessToken();
      res = await this.ctx.fetch(path, { method, data });
    }
    if (!res.ok()) {
      throw new Error(`${method} ${path} → ${res.status()} ${await res.text()}`);
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  get<T>(path: string) {
    return this.call<T>('GET', path);
  }
  post<T>(path: string, data?: unknown) {
    return this.call<T>('POST', path, data);
  }
  put<T>(path: string, data?: unknown) {
    return this.call<T>('PUT', path, data);
  }
  patch<T>(path: string, data?: unknown) {
    return this.call<T>('PATCH', path, data);
  }
  delete(path: string) {
    return this.call<void>('DELETE', path);
  }

  /** List every item of a resource, following pagination where the endpoint paginates. */
  async list(resource: Resource): Promise<Titled[]> {
    const items: Titled[] = [];
    for (let page = 1; ; page++) {
      const body = await this.get<unknown>(
        `/api/${resource}/?page=${page}&page_size=${MAX_PAGE_SIZE}`
      );
      items.push(...extractItems(body));
      const totalPages = (body as { total_pages?: number })?.total_pages;
      if (!totalPages || page >= totalPages) return items;
    }
  }

  deleteResource(resource: Resource, id: number) {
    return this.delete(`/api/${resource}/${id}/`);
  }

  /** Delete every object of a resource whose title passes `shouldDelete`. Returns count. */
  async sweep(
    resource: Resource,
    shouldDelete: (title: string) => boolean = (t) => t.startsWith(E2E_PREFIX)
  ): Promise<number> {
    const items = await this.list(resource);
    const stale = items.filter((i) => shouldDelete(i.title ?? i.name ?? ''));
    for (const item of stale) {
      await this.deleteResource(resource, item.id).catch((e) =>
        console.warn(`[sweep] ${resource}/${item.id}: ${e.message}`)
      );
    }
    return stale.length;
  }
}

function extractItems(body: unknown): Titled[] {
  if (Array.isArray(body)) return body as Titled[];
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    for (const key of ['data', 'items', 'results', 'charts', 'dashboards', 'kpis', 'metrics']) {
      const v = obj[key];
      if (Array.isArray(v)) return v as Titled[];
      if (v && typeof v === 'object') {
        const nested = extractItems(v);
        if (nested.length) return nested;
      }
    }
  }
  return [];
}
