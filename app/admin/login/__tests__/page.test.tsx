import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminLoginPage from '@/app/admin/login/page';
import { apiPost } from '@/lib/api';

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockApiPost = apiPost as jest.Mock;

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
});
