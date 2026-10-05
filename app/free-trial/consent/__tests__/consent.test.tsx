/**
 * Tests for the /free-trial/consent screen — the step that actually calls /trial/activate.
 *
 * The interesting part is error triage: activate 400s for two unrelated reasons (a dead token
 * and a password Django rejected), and telling a user their link expired when their password
 * was the problem sends them off to request a link they already have.
 */

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockApiPublicPost = jest.fn();
jest.mock('@/lib/api', () => ({
  apiPublicPost: (...args: unknown[]) => mockApiPublicPost(...args),
}));

const mockToastInfoGeneric = jest.fn();
const mockToastErrorApi = jest.fn();
jest.mock('@/lib/toast', () => ({
  toastInfo: { generic: (...args: unknown[]) => mockToastInfoGeneric(...args) },
  toastError: { api: (...args: unknown[]) => mockToastErrorApi(...args) },
}));

const mockTrackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  trackFeatureView: jest.fn(),
}));

const mockAssign = jest.fn();
jest.mock('@/lib/navigation', () => ({
  hardNavigate: (...args: unknown[]) => mockAssign(...args),
}));

const mockReplace = jest.fn();
const mockRouter = { push: jest.fn(), replace: mockReplace };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/free-trial/consent',
  useSearchParams: () => ({ get: (_key: string): string | null => null }),
}));

jest.mock('next/link', () => {
  function MockLink({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }
  return MockLink;
});

jest.mock('@/components/ui/animated-background-simple', () => ({
  AnimatedBackgroundSimple: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import TrialConsentPage from '@/app/free-trial/consent/page';

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  sessionStorage.setItem(
    'dalgo_trial_pending_activation',
    JSON.stringify({ token: 'good-token', password: 'super-secret-1' })
  );
});

async function accept() {
  fireEvent.click(await screen.findByTestId('trial-consent-checkbox'));
  fireEvent.click(screen.getByTestId('trial-consent-accept-button'));
}

describe('TrialConsentPage', () => {
  it('shows the requested data-handling copy', async () => {
    render(<TrialConsentPage />);

    const card = await screen.findByTestId('trial-consent-card');
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'A few things to know before we setup your trial workspace',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Data deletion')).toBeInTheDocument();
    expect(screen.getByText('Data Storage')).toBeInTheDocument();
    expect(screen.getByText('Data privacy and protection')).toBeInTheDocument();
    expect(card).toHaveTextContent(
      'By creating this trial account, you consent to the collection, processing, and regulatory-compliant use of your personal and sensitive information.'
    );
    expect(card).toHaveTextContent(
      'I have read and accept the Privacy Policy and terms of data collection and use.'
    );

    const privacyLink = screen.getByRole('link', { name: 'Privacy Policy' });
    expect(privacyLink).toHaveAttribute('href', 'https://dalgo.org/privacy');
    expect(privacyLink).toHaveAttribute('target', '_blank');

    const consentCheckbox = screen.getByTestId('trial-consent-checkbox');
    expect(consentCheckbox).toHaveClass(
      'size-5',
      'border-2',
      'border-foreground/70',
      'bg-background'
    );
    expect(screen.getByTestId('trial-consent-accept-button')).toBeDisabled();

    fireEvent.click(consentCheckbox);
    expect(screen.getByTestId('trial-consent-accept-button')).toBeEnabled();
  });

  it('activates with the stashed token + password and routes to the progress screen', async () => {
    mockApiPublicPost.mockResolvedValueOnce({ task_id: 'task-123', email: 'jane@example.org' });
    render(<TrialConsentPage />);

    await accept();

    await waitFor(() => {
      expect(mockApiPublicPost).toHaveBeenCalledWith('/api/v1/public/trial/activate', {
        token: 'good-token',
        password: 'super-secret-1',
      });
    });
    expect(JSON.parse(sessionStorage.getItem('dalgo_trial_creds') || '{}')).toEqual({
      email: 'jane@example.org',
      password: 'super-secret-1',
    });
    expect(mockTrackEvent).toHaveBeenCalledWith('trial_onboarding:trial_activated');
    expect(mockAssign).toHaveBeenCalledWith('/free-trial/progress?task_id=task-123');
  });

  it('treats a 400 with no password detail as an expired link', async () => {
    mockApiPublicPost.mockRejectedValueOnce(
      new Error('Public API error: 400 Bad Request - invalid or expired link')
    );
    render(<TrialConsentPage />);

    await accept();

    await waitFor(() => {
      expect(mockToastErrorApi).toHaveBeenCalledWith(
        expect.any(Error),
        'This link is invalid or has expired.'
      );
    });
    expect(screen.queryByTestId('trial-consent-password-rejected')).not.toBeInTheDocument();
  });

  it('names the password — not the link — when that is what the backend rejected, and keeps the link usable', async () => {
    mockApiPublicPost.mockRejectedValueOnce(
      new Error(
        'Public API error: 400 Bad Request - password does not meet requirements: This password is too common.'
      )
    );
    render(<TrialConsentPage />);

    await accept();

    const banner = await screen.findByTestId('trial-consent-password-rejected');
    // Django's own reason, so the user knows which rule they broke.
    expect(banner).toHaveTextContent('This password is too common.');
    // ...and a way back to the form with the SAME token, which the backend did not consume.
    expect(screen.getByTestId('trial-consent-change-password-link')).toHaveAttribute(
      'href',
      '/free-trial/activate?token=good-token'
    );
    expect(mockAssign).not.toHaveBeenCalled();
  });

  it('shows an info toast on a 409 (account exists / already provisioning)', async () => {
    mockApiPublicPost.mockRejectedValueOnce(new Error('Public API error: 409 Conflict'));
    render(<TrialConsentPage />);

    await accept();

    await waitFor(() => {
      expect(mockToastInfoGeneric).toHaveBeenCalledWith(
        'This account already exists or is already being set up.'
      );
    });
    expect(mockAssign).not.toHaveBeenCalled();
  });

  it('sends the user back to the start when there is no pending activation', () => {
    sessionStorage.clear();
    render(<TrialConsentPage />);

    expect(mockReplace).toHaveBeenCalledWith('/free-trial');
    expect(mockApiPublicPost).not.toHaveBeenCalled();
  });
});
