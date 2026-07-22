/**
 * AdminGuard tests — the client-side access-control gate for /admin.
 *
 * Covers the loading edge case explicitly (decision #2): while /currentuserv2 is
 * still resolving, show loading and do NOT redirect or flash the shell.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { AdminGuard } from '@/components/admin/AdminGuard';
import useSWR from 'swr';

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedUseSWR = useSWR as unknown as jest.Mock;

describe('AdminGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading and does not redirect while /currentuserv2 is resolving', () => {
    mockedUseSWR.mockReturnValue({ data: undefined, isLoading: true });

    render(
      <AdminGuard>
        <div>admin shell</div>
      </AdminGuard>
    );

    expect(screen.queryByText('admin shell')).not.toBeInTheDocument();
    expect(screen.getByText('Checking access...')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('reads identity from the admin session endpoint', () => {
    mockedUseSWR.mockReturnValue({ data: { is_platform_admin: true }, isLoading: false });
    render(
      <AdminGuard>
        <div>admin shell</div>
      </AdminGuard>
    );
    expect(mockedUseSWR).toHaveBeenCalledWith('/api/v1/admin/currentuser');
  });

  it('redirects a non-admin to the admin login and never renders the shell', () => {
    mockedUseSWR.mockReturnValue({ data: { is_platform_admin: false }, isLoading: false });

    render(
      <AdminGuard>
        <div>admin shell</div>
      </AdminGuard>
    );

    expect(mockReplace).toHaveBeenCalledWith('/admin/login');
    expect(screen.queryByText('admin shell')).not.toBeInTheDocument();
  });

  it('redirects to the admin login when there is no admin session (401)', () => {
    mockedUseSWR.mockReturnValue({ data: undefined, error: new Error('401'), isLoading: false });

    render(
      <AdminGuard>
        <div>admin shell</div>
      </AdminGuard>
    );

    expect(mockReplace).toHaveBeenCalledWith('/admin/login');
    expect(screen.queryByText('admin shell')).not.toBeInTheDocument();
  });

  it('renders the shell for a platform admin', () => {
    mockedUseSWR.mockReturnValue({ data: { is_platform_admin: true }, isLoading: false });

    render(
      <AdminGuard>
        <div>admin shell</div>
      </AdminGuard>
    );

    expect(screen.getByText('admin shell')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
