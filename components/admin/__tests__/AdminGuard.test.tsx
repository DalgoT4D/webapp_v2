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

  it('renders the shell for a platform admin', async () => {
    mockApiGet.mockResolvedValue({ email: 'admin@dalgo.org', is_platform_admin: true });

    renderGuard();

    expect(await screen.findByText('admin shell')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
