import { getApiErrorBody, getApiErrorStatus } from '@/lib/utils';

describe('getApiErrorBody', () => {
  it('reads the parsed JSON body stamped on an apiFetch error', () => {
    const error = Object.assign(new Error('Confirmation required'), {
      status: 409,
      body: { requires_confirmation: true, under_covering_charts: [{ chart_id: 1 }] },
    });
    expect(getApiErrorBody(error)).toEqual({
      requires_confirmation: true,
      under_covering_charts: [{ chart_id: 1 }],
    });
  });

  it('returns undefined when the error carries no body (e.g. a network error)', () => {
    expect(getApiErrorBody(new Error('network down'))).toBeUndefined();
  });

  it('returns undefined for non-object / nullish input', () => {
    expect(getApiErrorBody(null)).toBeUndefined();
    expect(getApiErrorBody('oops')).toBeUndefined();
  });

  it('coexists with getApiErrorStatus on the same error', () => {
    const error = Object.assign(new Error('boom'), { status: 403, body: { detail: 'nope' } });
    expect(getApiErrorStatus(error)).toBe(403);
    expect(getApiErrorBody(error)).toEqual({ detail: 'nope' });
  });
});
