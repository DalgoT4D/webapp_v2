/**
 * AdminGuard tests — the client-side access-control gate for /admin.
 *
 * Covers the loading edge case explicitly (decision #2): while the admin session is
 * still resolving, show loading and do NOT redirect or flash the shell.
 *
 * Identity comes from useAdminSession, which fetches through lib/api — so these tests
 * drive the guard via the global apiGet mock inside TestWrapper (fresh SWR cache per
 * test), rather than mocking the swr module.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet } from '@/test-utils/api';

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const renderGuard = () =>
  render(
    <TestWrapper>
      <AdminGuard>
        <div>admin shell</div>
      </AdminGuard>
    </TestWrapper>
  );

// TestWrapper hands every test a fresh cache. Production does the opposite: ONE cache
// that outlives soft navigation, which is what makes the post-sign-in remount below
// read a pre-sign-in error. Share a cache across the two renders to reproduce it.
const renderGuardWithSharedCache = (cache: Map<string, any>) =>
  render(
    <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>
      <AdminGuard>
        <div>admin shell</div>
      </AdminGuard>
    </SWRConfig>
  );

describe('AdminGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading and does not redirect while the admin session is resolving', () => {
    mockApiGet.mockReturnValue(new Promise(() => {})); // never settles

    renderGuard();

    expect(screen.queryByText('admin shell')).not.toBeInTheDocument();
    expect(screen.getByText('Checking access...')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('reads identity from the admin session endpoint', async () => {
    mockApiGet.mockResolvedValue({ email: 'admin@dalgo.org', is_platform_admin: true });

    renderGuard();

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/api/v1/admin/currentuser'));
  });

  it('redirects a non-admin to the admin login and never renders the shell', async () => {
    mockApiGet.mockResolvedValue({ email: 'ops@dalgo.org', is_platform_admin: false });

    renderGuard();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/admin/login'));
    expect(screen.queryByText('admin shell')).not.toBeInTheDocument();
  });

  it('redirects to the admin login when there is no admin session (401)', async () => {
    mockApiGet.mockRejectedValue(new Error('401'));

    renderGuard();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/admin/login'));
    expect(screen.queryByText('admin shell')).not.toBeInTheDocument();
  });

  // Regression: signing in appeared to fail the first time and work the second.
  // Getting bounced off /admin leaves a 401 in the SWR cache; that cache survives the
  // soft navigation to /admin/login, and SWR reports a CACHED error as settled
  // (isLoading false, no data) while it refetches. The guard read that as "not an
  // admin" and replaced straight back to /admin/login before the fresh 200 landed.
  it('does not bounce back to the login while a stale error is being revalidated', async () => {
    const cache = new Map<string, any>();

    mockApiGet.mockRejectedValue(new Error('Authentication failed. Please log in again.'));
    const signedOut = renderGuardWithSharedCache(cache);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/admin/login'));

    // Soft navigation to /admin/login unmounts the guard but keeps the cache.
    signedOut.unmount();
    mockReplace.mockClear();

    // Sign-in succeeds, router.replace('/admin') remounts the guard.
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue({ email: 'admin@dalgo.org', is_platform_admin: true });
    renderGuardWithSharedCache(cache);

    expect(await screen.findByText('admin shell')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('still redirects once the revalidation confirms there is no admin session', async () => {
    const cache = new Map<string, any>();

    mockApiGet.mockRejectedValue(new Error('Authentication failed. Please log in again.'));
    const first = renderGuardWithSharedCache(cache);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/admin/login'));

    first.unmount();
    mockReplace.mockClear();
    renderGuardWithSharedCache(cache);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/admin/login'));
    expect(screen.queryByText('admin shell')).not.toBeInTheDocument();
  });

  // Fail closed: SWR hands back the last good `data` alongside the new `error` when a
  // revalidation fails, so a guard that reads only `data` keeps the admin shell up after
  // the session is gone (permission revoked, session expired, backend down).
  it('stops trusting a cached admin session once a revalidation fails', async () => {
    const cache = new Map<string, any>();

    mockApiGet.mockResolvedValue({ email: 'admin@dalgo.org', is_platform_admin: true });
    const signedIn = renderGuardWithSharedCache(cache);
    expect(await screen.findByText('admin shell')).toBeInTheDocument();

    // Remount (soft navigation within /admin) — this time the identity read fails.
    signedIn.unmount();
    mockReplace.mockClear();
    mockApiGet.mockReset();
    mockApiGet.mockRejectedValue(new Error('Authentication failed. Please log in again.'));
    renderGuardWithSharedCache(cache);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/admin/login'));
    expect(screen.queryByText('admin shell')).not.toBeInTheDocument();
  });

  it('renders the shell for a platform admin', async () => {
    mockApiGet.mockResolvedValue({ email: 'admin@dalgo.org', is_platform_admin: true });

    renderGuard();

    expect(await screen.findByText('admin shell')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
