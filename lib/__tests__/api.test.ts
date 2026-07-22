// jest.setup.ts globally mocks '@/lib/api' (stubbing apiGet/Post/…). These helpers are
// pure, so pull the REAL implementations past the mock.
const { adminAwareRefreshEndpoint, adminAwareLoginPath } = jest.requireActual('@/lib/api');

// The admin portal has an independent session (features/admin-portal/plan.md M1).
// A 401 on an /api/v1/admin/* route must refresh via the admin token endpoint and,
// on failure, land on /admin/login — never the normal product's refresh or /login.
describe('admin-aware auth routing', () => {
  it('refreshes admin routes via the admin token endpoint', () => {
    expect(adminAwareRefreshEndpoint('/api/v1/admin/currentuser')).toBe(
      '/api/v1/admin/token/refresh'
    );
  });

  it('refreshes normal routes via the normal token endpoint', () => {
    expect(adminAwareRefreshEndpoint('/api/currentuserv2')).toBe('/api/v2/token/refresh');
  });

  it('sends admin auth failures to the admin login', () => {
    expect(adminAwareLoginPath('/api/v1/admin/orgs')).toBe('/admin/login');
  });

  it('sends normal auth failures to the normal login', () => {
    expect(adminAwareLoginPath('/api/currentuserv2')).toBe('/login');
  });
});
