// jest.setup.ts globally auto-mocks '@/lib/api' (jest.fn() no-ops) for every
// test file so components never hit the network by accident — this suite
// tests apiFetch's OWN implementation, so it must opt back into the real
// module.
jest.unmock('@/lib/api');
import { apiPut } from '@/lib/api';

function mockJsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'status text',
    headers: { get: () => 'application/json' },
    json: async () => body,
  } as unknown as Response;
}

describe('apiFetch error body plumbing', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('stamps the parsed JSON body onto the thrown error for a non-2xx response', async () => {
    const body = {
      requires_confirmation: true,
      under_covering_charts: [{ chart_id: 42, title: 'Salary Breakdown' }],
      detail: 'Confirmation required: newly added charts under-cover this dashboard',
    };
    global.fetch = jest.fn().mockResolvedValue(mockJsonResponse(409, body));

    let caught: unknown;
    try {
      await apiPut('/api/dashboards/1/', { tabs: [] });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as { status?: number }).status).toBe(409);
    expect((caught as { body?: unknown }).body).toEqual(body);
  });

  it('still resolves normally for a 2xx response (no error, nothing stamped)', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockJsonResponse(200, { ok: true }));
    const result = await apiPut('/api/dashboards/1/', {});
    expect(result).toEqual({ ok: true });
  });
});
