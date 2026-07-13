import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccessManagement from '../AccessManagement';
import { useOrgPreferences, updateSharingPreferences } from '@/hooks/api/useNotifications';
import { trackEvent } from '@/lib/analytics';

jest.mock('@/hooks/api/useNotifications', () => ({
  ...jest.requireActual('@/hooks/api/useNotifications'),
  useOrgPreferences: jest.fn(),
  updateSharingPreferences: jest.fn(),
}));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/toast', () => ({
  toastSuccess: { generic: jest.fn() },
  toastError: { api: jest.fn() },
}));

const mockUseOrgPreferences = useOrgPreferences as jest.Mock;
const mockUpdateSharingPreferences = updateSharingPreferences as jest.Mock;

const baseOrgPreferences = {
  enable_discord_notifications: false,
  discord_webhook: '',
  allow_public_sharing: true,
  default_general_audience: 'all_users' as const,
  default_general_level: 'view' as const,
};

function setup(overrides: Partial<typeof baseOrgPreferences> = {}) {
  const mutate = jest.fn();
  mockUseOrgPreferences.mockReturnValue({
    orgPreferences: { ...baseOrgPreferences, ...overrides },
    isLoading: false,
    error: undefined,
    mutate,
  });
  return { mutate };
}

describe('AccessManagement settings page', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the three controls reflecting GET data', () => {
    setup({
      allow_public_sharing: true,
      default_general_audience: 'admins',
      default_general_level: 'edit',
    });
    render(<AccessManagement />);

    const toggle = screen.getByTestId('access-mgmt-public-sharing-toggle');
    expect(toggle).toHaveAttribute('data-state', 'checked');
    expect(screen.getByTestId('access-mgmt-default-audience')).toHaveTextContent('Admins only');
    expect(screen.getByTestId('access-mgmt-default-level')).toHaveTextContent('Edit');
  });

  it('shows a loading state while preferences are being fetched', () => {
    mockUseOrgPreferences.mockReturnValue({
      orgPreferences: undefined,
      isLoading: true,
      error: undefined,
      mutate: jest.fn(),
    });
    render(<AccessManagement />);
    expect(screen.getByTestId('access-management-loading')).toBeInTheDocument();
  });

  it('toggling the public-sharing switch PUTs allow_public_sharing and revalidates', async () => {
    const user = userEvent.setup();
    const { mutate } = setup({ allow_public_sharing: true });
    mockUpdateSharingPreferences.mockResolvedValue({
      ...baseOrgPreferences,
      allow_public_sharing: false,
    });

    render(<AccessManagement />);
    await user.click(screen.getByTestId('access-mgmt-public-sharing-toggle'));

    await waitFor(() => {
      expect(mockUpdateSharingPreferences).toHaveBeenCalledWith({ allow_public_sharing: false });
      expect(mutate).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith(
        'settings:sharing_settings_updated',
        expect.objectContaining({ setting: 'allow_public_sharing', value: false })
      );
    });
  });

  it('changing the default audience PUTs default_general_audience', async () => {
    const user = userEvent.setup();
    setup();
    mockUpdateSharingPreferences.mockResolvedValue({
      ...baseOrgPreferences,
      default_general_audience: 'private',
    });

    render(<AccessManagement />);
    await user.click(screen.getByTestId('access-mgmt-default-audience'));
    await user.click(screen.getByRole('option', { name: /Restricted/ }));

    await waitFor(() => {
      expect(mockUpdateSharingPreferences).toHaveBeenCalledWith({
        default_general_audience: 'private',
      });
    });
  });

  it('changing the default level PUTs default_general_level', async () => {
    const user = userEvent.setup();
    setup();
    mockUpdateSharingPreferences.mockResolvedValue({
      ...baseOrgPreferences,
      default_general_level: 'edit',
    });

    render(<AccessManagement />);
    await user.click(screen.getByTestId('access-mgmt-default-level'));
    await user.click(screen.getByRole('option', { name: 'Editor' }));

    await waitFor(() => {
      expect(mockUpdateSharingPreferences).toHaveBeenCalledWith({ default_general_level: 'edit' });
    });
  });

  it('shows a toast error and does not crash when the PUT fails', async () => {
    const user = userEvent.setup();
    setup();
    mockUpdateSharingPreferences.mockRejectedValue(new Error('nope'));

    render(<AccessManagement />);
    await user.click(screen.getByTestId('access-mgmt-public-sharing-toggle'));

    const { toastError } = jest.requireMock('@/lib/toast');
    await waitFor(() => {
      expect(toastError.api).toHaveBeenCalled();
    });
  });
});
