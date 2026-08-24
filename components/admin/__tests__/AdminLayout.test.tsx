/**
 * AdminLayout tests — the sidebar shell's logout action.
 *
 * The admin portal shares the normal product session, so logging out here is a FULL
 * logout: same POST /api/logout/, same useAuthStore.logout(), same USER_LOGGED_OUT event
 * as components/header.tsx. These tests pin that it reuses those rather than growing an
 * admin-specific logout, and that a failed network call still signs the user out locally.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { mockApiPost } from '@/test-utils/api';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/admin',
}));

jest.mock('@/lib/analytics', () => ({
  trackEvent: jest.fn(),
}));

const mockLogout = jest.fn();
jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ logout: mockLogout }),
}));

const mockTrackEvent = trackEvent as jest.Mock;

const renderLayout = () =>
  render(
    <AdminLayout>
      <div>admin content</div>
    </AdminLayout>
  );

describe('AdminLayout logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a logout control in the sidebar footer', () => {
    renderLayout();
    expect(screen.getByTestId('admin-logout')).toBeInTheDocument();
    // it sits alongside the existing footer link, which must survive
    expect(screen.getByText('Back to Dalgo')).toBeInTheDocument();
  });

  it('calls the SHARED logout endpoint, not an admin-specific one', async () => {
    mockApiPost.mockResolvedValueOnce({ success: true });
    renderLayout();

    fireEvent.click(screen.getByTestId('admin-logout'));

    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/api/logout/', {}));
    // regression guard: no resurrected /api/v1/admin/logout/
    expect(mockApiPost).not.toHaveBeenCalledWith(
      expect.stringContaining('/admin/logout'),
      expect.anything()
    );
  });

  it('clears the auth store, tracks the event, and lands on the admin sign-in', async () => {
    mockApiPost.mockResolvedValueOnce({ success: true });
    renderLayout();

    fireEvent.click(screen.getByTestId('admin-logout'));

    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
    expect(mockTrackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.USER_LOGGED_OUT);
    expect(mockReplace).toHaveBeenCalledWith('/admin/login');
  });

  it('still signs the user out locally when the logout request fails', async () => {
    // a network failure must not strand someone in a signed-in-looking admin shell
    mockApiPost.mockRejectedValueOnce(new Error('network down'));
    renderLayout();

    fireEvent.click(screen.getByTestId('admin-logout'));

    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith('/admin/login');
  });
});

describe('AdminLayout nav', () => {
  it('Notifications is a live link, not a disabled placeholder (Milestone 2 shipped)', () => {
    renderLayout();
    const notificationsLink = screen.getByRole('link', { name: /notifications/i });
    expect(notificationsLink).toHaveAttribute('href', '/admin/notifications');
  });
});
