import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminLoginPage from '@/app/admin/login/page';
import { mockApiPost } from '@/test-utils/api';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/lib/analytics', () => ({
  trackEvent: jest.fn(),
}));

const mockTrackEvent = trackEvent as jest.Mock;

describe('AdminLoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('signs in via the shared v2 login endpoint and redirects to /admin', async () => {
    mockApiPost.mockResolvedValueOnce({ email: 'admin@dalgo.org', is_platform_admin: true });
    render(<AdminLoginPage />);

    fireEvent.change(screen.getByTestId('admin-login-username'), {
      target: { value: 'admin@dalgo.org' },
    });
    fireEvent.change(screen.getByTestId('admin-login-password'), {
      target: { value: 'Secret@123' },
    });
    fireEvent.click(screen.getByTestId('admin-login-submit'));

    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith('/api/v2/login/', {
        username: 'admin@dalgo.org',
        password: 'Secret@123',
      })
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/admin'));
  });

  it('refuses a valid non-platform-admin sign-in and does not navigate', async () => {
    // v2 login SUCCEEDS for a non-admin — the page must refuse on is_platform_admin
    mockApiPost.mockResolvedValueOnce({ email: 'ops@dalgo.org', is_platform_admin: false });
    render(<AdminLoginPage />);

    fireEvent.change(screen.getByTestId('admin-login-username'), {
      target: { value: 'ops@dalgo.org' },
    });
    fireEvent.change(screen.getByTestId('admin-login-password'), {
      target: { value: 'Secret@123' },
    });
    fireEvent.click(screen.getByTestId('admin-login-submit'));

    expect(await screen.findByTestId('admin-login-error')).toHaveTextContent(
      'not a Dalgo platform admin'
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('tracks a successful admin sign-in', async () => {
    mockApiPost.mockResolvedValueOnce({ email: 'admin@dalgo.org', is_platform_admin: true });
    render(<AdminLoginPage />);

    fireEvent.change(screen.getByTestId('admin-login-username'), {
      target: { value: 'admin@dalgo.org' },
    });
    fireEvent.change(screen.getByTestId('admin-login-password'), {
      target: { value: 'Secret@123' },
    });
    fireEvent.click(screen.getByTestId('admin-login-submit'));

    await waitFor(() =>
      expect(mockTrackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.ADMIN_LOGGED_IN)
    );
  });

  it('tracks a refused sign-in with a coarse reason and no PII', async () => {
    mockApiPost.mockResolvedValueOnce({ email: 'ops@dalgo.org', is_platform_admin: false });
    render(<AdminLoginPage />);

    fireEvent.change(screen.getByTestId('admin-login-username'), {
      target: { value: 'ops@dalgo.org' },
    });
    fireEvent.change(screen.getByTestId('admin-login-password'), {
      target: { value: 'Secret@123' },
    });
    fireEvent.click(screen.getByTestId('admin-login-submit'));

    await waitFor(() =>
      expect(mockTrackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.ADMIN_LOGIN_FAILED, {
        reason: 'not_platform_admin',
      })
    );
    // the email must never reach analytics
    const sentProps = JSON.stringify(mockTrackEvent.mock.calls);
    expect(sentProps).not.toContain('ops@dalgo.org');
  });
});
