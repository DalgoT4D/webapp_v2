// jest.setup.ts globally mocks '@/lib/api' (stubbing apiGet/Post/…). These helpers are
// pure, so pull the REAL implementations past the mock.
const { adminAwareLoginPath } = jest.requireActual('@/lib/api');

// The admin portal shares the normal session, so refresh is no longer admin-aware —
// everything goes through /api/v2/token/refresh. What must stay admin-aware is the
// destination on unrecoverable auth failure: an /api/v1/admin/* route lands on
// /admin/login, never the product login.
describe('admin-aware auth routing', () => {
  it('sends admin auth failures to the admin login', () => {
    expect(adminAwareLoginPath('/api/v1/admin/orgs')).toBe('/admin/login');
  });

  it('sends normal auth failures to the normal login', () => {
    expect(adminAwareLoginPath('/api/currentuserv2')).toBe('/login');
  });
});
