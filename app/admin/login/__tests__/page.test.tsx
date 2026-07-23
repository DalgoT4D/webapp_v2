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

  it('signs in via the admin login endpoint and redirects to /admin', async () => {
    mockApiPost.mockResolvedValueOnce({ success: 1 });
    render(<AdminLoginPage />);

    fireEvent.change(screen.getByTestId('admin-login-username'), {
      target: { value: 'admin@dalgo.org' },
    });
    fireEvent.change(screen.getByTestId('admin-login-password'), {
      target: { value: 'Secret@123' },
    });
    fireEvent.click(screen.getByTestId('admin-login-submit'));

    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith('/api/v1/admin/login/', {
        username: 'admin@dalgo.org',
        password: 'Secret@123',
      })
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/admin'));
  });

  it('shows an error when sign-in is refused', async () => {
    mockApiPost.mockRejectedValueOnce(new Error('not a platform admin'));
    render(<AdminLoginPage />);

    fireEvent.change(screen.getByTestId('admin-login-username'), {
      target: { value: 'ops@dalgo.org' },
    });
    fireEvent.change(screen.getByTestId('admin-login-password'), {
      target: { value: 'Secret@123' },
    });
    fireEvent.click(screen.getByTestId('admin-login-submit'));

    expect(await screen.findByTestId('admin-login-error')).toHaveTextContent(
      'not a platform admin'
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('tracks a successful admin sign-in', async () => {
    mockApiPost.mockResolvedValueOnce({ success: 1 });
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
    mockApiPost.mockRejectedValueOnce(new Error('not a platform admin'));
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
