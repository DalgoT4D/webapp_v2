// jest.setup.ts globally mocks '@/lib/api' (stubbing apiGet/Post/…). These helpers are
// pure, so pull the REAL implementations past the mock.
const { adminAwareLoginPath, isAuthEndpoint } = jest.requireActual('@/lib/api');

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

// The admin portal signs in through the SHARED /api/v2/login/, which is not an
// /api/v1/admin/* path — so the request path alone used to send a failed admin sign-in
// to the product /login, away from the form that was about to show the error.
describe('admin-aware auth routing follows the browser path', () => {
  it('keeps a failed admin sign-in on the admin login', () => {
    expect(adminAwareLoginPath('/api/v2/login/', '/admin/login')).toBe('/admin/login');
  });

  it('keeps any failure inside /admin on the admin login', () => {
    expect(adminAwareLoginPath('/api/currentuserv2', '/admin/organizations/1')).toBe(
      '/admin/login'
    );
    expect(adminAwareLoginPath('/api/currentuserv2', '/admin')).toBe('/admin/login');
  });

  it('does not treat a lookalike path as the admin portal', () => {
    expect(adminAwareLoginPath('/api/currentuserv2', '/administration')).toBe('/login');
  });

  it('still falls back to the request path outside the admin UI', () => {
    expect(adminAwareLoginPath('/api/v1/admin/orgs', '/dashboards')).toBe('/admin/login');
    expect(adminAwareLoginPath('/api/currentuserv2', '/dashboards')).toBe('/login');
  });
});

// A 401 from sign-in answers "wrong credentials"; it is not an expired session, so the
// refresh/logout/redirect recovery must not run and swallow the form's error.
describe('sign-in endpoints are exempt from the auth-failure recovery', () => {
  it('recognises the login and refresh endpoints', () => {
    expect(isAuthEndpoint('/api/v2/login/')).toBe(true);
    expect(isAuthEndpoint('/api/v2/token/refresh')).toBe(true);
  });

  it('does not exempt ordinary endpoints', () => {
    expect(isAuthEndpoint('/api/currentuserv2')).toBe(false);
    expect(isAuthEndpoint('/api/v1/admin/currentuser')).toBe(false);
  });
});
