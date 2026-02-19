import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationPreferencesDialog } from '../NotificationPreferencesDialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import * as notificationHooks from '@/hooks/api/useNotifications';
import * as permissionsHook from '@/hooks/api/usePermissions';
import {
  mockUserPreferences,
  mockOrgPreferences,
  createMockNotificationHooks,
  createMockPermissions,
} from './notification-mock-data';

jest.mock('@/hooks/api/useNotifications');
jest.mock('@/hooks/api/usePermissions');

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <TooltipProvider>{children}</TooltipProvider>
);

describe('NotificationPreferencesDialog', () => {
  let mocks: ReturnType<typeof createMockNotificationHooks>;

  beforeEach(() => {
    jest.clearAllMocks();
    mocks = createMockNotificationHooks();

    (notificationHooks.useUserPreferences as jest.Mock).mockReturnValue({
      preferences: mockUserPreferences,
      isLoading: false,
      error: null,
      mutate: mocks.mutate,
    });

    (notificationHooks.useOrgPreferences as jest.Mock).mockReturnValue({
      orgPreferences: mockOrgPreferences,
      isLoading: false,
      error: null,
      mutate: mocks.mutate,
    });

    (notificationHooks.usePreferenceActions as jest.Mock).mockReturnValue({
      updateUserPreferences: mocks.mockUpdateUserPreferences,
      updateOrgPreferences: mocks.mockUpdateOrgPreferences,
    });

    (permissionsHook.useUserPermissions as jest.Mock).mockReturnValue(createMockPermissions(true));
  });

  it('loads existing preferences when dialog opens', async () => {
    render(<NotificationPreferencesDialog open={true} onOpenChange={jest.fn()} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      const emailSwitch = screen.getByRole('switch', { name: /email notifications/i });
      expect(emailSwitch).toBeChecked();
    });
  });

  it('disables Discord fields without permission', async () => {
    (permissionsHook.useUserPermissions as jest.Mock).mockReturnValue(createMockPermissions(false));

    render(<NotificationPreferencesDialog open={true} onOpenChange={jest.fn()} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      const discordSwitch = screen.getByRole('switch', { name: /discord notifications/i });
      expect(discordSwitch).toBeDisabled();
    });
  });

  it('enables Discord fields with permission', async () => {
    render(<NotificationPreferencesDialog open={true} onOpenChange={jest.fn()} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      const discordSwitch = screen.getByRole('switch', { name: /discord notifications/i });
      expect(discordSwitch).toBeInTheDocument();
    });
  });

  it('shows Discord webhook input when Discord is enabled', async () => {
    (notificationHooks.useOrgPreferences as jest.Mock).mockReturnValue({
      orgPreferences: {
        enable_discord_notifications: true,
        discord_webhook: 'https://discord.com/api/webhooks/test',
      },
      isLoading: false,
      error: null,
      mutate: mocks.mutate,
    });

    render(<NotificationPreferencesDialog open={true} onOpenChange={jest.fn()} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/discord webhook url/i)).toBeInTheDocument();
    });
  });

  it('shows form title and description', async () => {
    render(<NotificationPreferencesDialog open={true} onOpenChange={jest.fn()} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(screen.getByText('Manage Preferences')).toBeInTheDocument();
      expect(screen.getByText('Configure your notification preferences')).toBeInTheDocument();
    });
  });

  it('submits form successfully', async () => {
    const onOpenChange = jest.fn();

    render(<NotificationPreferencesDialog open={true} onOpenChange={onOpenChange} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /email notifications/i })).toBeInTheDocument();
    });

    const emailSwitch = screen.getByRole('switch', { name: /email notifications/i });
    fireEvent.click(emailSwitch);

    const submitButton = screen.getByText('Update Preferences');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.mockUpdateUserPreferences).toHaveBeenCalledWith({
        enable_email_notifications: false,
      });
      expect(mocks.mutate).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('does not close dialog on failed save', async () => {
    mocks.mockUpdateUserPreferences.mockResolvedValue(false);
    const onOpenChange = jest.fn();

    render(<NotificationPreferencesDialog open={true} onOpenChange={onOpenChange} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /email notifications/i })).toBeInTheDocument();
    });

    // Toggle email to trigger a change
    const emailSwitch = screen.getByRole('switch', { name: /email notifications/i });
    fireEvent.click(emailSwitch);

    const submitButton = screen.getByText('Update Preferences');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.mockUpdateUserPreferences).toHaveBeenCalled();
    });

    // Dialog should still be open since save failed
    await waitFor(() => {
      expect(screen.getByText('Update Preferences')).toBeInTheDocument();
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('shows loading state during submission', async () => {
    let resolveUpdate: (value: boolean) => void;
    const updatePromise = new Promise<boolean>((resolve) => {
      resolveUpdate = resolve;
    });
    mocks.mockUpdateUserPreferences.mockReturnValue(updatePromise);

    render(<NotificationPreferencesDialog open={true} onOpenChange={jest.fn()} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /email notifications/i })).toBeInTheDocument();
    });

    // Toggle email to trigger a change
    const emailSwitch = screen.getByRole('switch', { name: /email notifications/i });
    fireEvent.click(emailSwitch);

    const submitButton = screen.getByText('Update Preferences');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Updating...')).toBeInTheDocument();
    });

    resolveUpdate!(true);

    await waitFor(() => {
      expect(screen.queryByText('Updating...')).not.toBeInTheDocument();
    });
  });

  it('renders all form fields correctly', async () => {
    render(<NotificationPreferencesDialog open={true} onOpenChange={jest.fn()} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /email notifications/i })).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: /discord notifications/i })).toBeInTheDocument();
      expect(screen.getByText('Update Preferences')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  it('handles cancel button', async () => {
    const onOpenChange = jest.fn();

    render(<NotificationPreferencesDialog open={true} onOpenChange={onOpenChange} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('validates Discord webhook URL is required when enabled', async () => {
    (notificationHooks.useOrgPreferences as jest.Mock).mockReturnValue({
      orgPreferences: { enable_discord_notifications: true, discord_webhook: '' },
      isLoading: false,
      error: null,
      mutate: mocks.mutate,
    });

    render(<NotificationPreferencesDialog open={true} onOpenChange={jest.fn()} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/discord webhook url/i)).toBeInTheDocument();
    });

    const submitButton = screen.getByText('Update Preferences');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Discord webhook URL is required')).toBeInTheDocument();
    });

    expect(mocks.mockUpdateUserPreferences).not.toHaveBeenCalled();
  });

  it('updates org preferences when user has the correct permission slug', async () => {
    const onOpenChange = jest.fn();

    // Start with Discord disabled
    (notificationHooks.useOrgPreferences as jest.Mock).mockReturnValue({
      orgPreferences: {
        enable_discord_notifications: false,
        discord_webhook: '',
      },
      isLoading: false,
      error: null,
      mutate: mocks.mutate,
    });

    render(<NotificationPreferencesDialog open={true} onOpenChange={onOpenChange} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /discord notifications/i })).toBeInTheDocument();
    });

    // Toggle Discord on
    const discordSwitch = screen.getByRole('switch', { name: /discord notifications/i });
    fireEvent.click(discordSwitch);

    await waitFor(() => {
      expect(screen.getByLabelText(/discord webhook url/i)).toBeInTheDocument();
    });

    // Enter webhook URL
    const webhookInput = screen.getByLabelText(/discord webhook url/i);
    fireEvent.change(webhookInput, {
      target: { value: 'https://discord.com/api/webhooks/test' },
    });

    const submitButton = screen.getByText('Update Preferences');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.mockUpdateOrgPreferences).toHaveBeenCalledWith({
        enable_discord_notifications: true,
        discord_webhook: 'https://discord.com/api/webhooks/test',
      });
    });

    // Email API should NOT be called since email wasn't changed
    expect(mocks.mockUpdateUserPreferences).not.toHaveBeenCalled();
  });

  it('does not update org preferences when user lacks the required permission', async () => {
    const onOpenChange = jest.fn();
    (permissionsHook.useUserPermissions as jest.Mock).mockReturnValue(createMockPermissions(false));

    render(<NotificationPreferencesDialog open={true} onOpenChange={onOpenChange} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /email notifications/i })).toBeInTheDocument();
    });

    // Toggle email to trigger a change
    const emailSwitch = screen.getByRole('switch', { name: /email notifications/i });
    fireEvent.click(emailSwitch);

    const submitButton = screen.getByText('Update Preferences');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.mockUpdateUserPreferences).toHaveBeenCalled();
    });

    // Org preferences should NOT be updated (no permission)
    expect(mocks.mockUpdateOrgPreferences).not.toHaveBeenCalled();
  });

  it('resets validation errors when dialog is closed', async () => {
    const onOpenChange = jest.fn();

    (notificationHooks.useOrgPreferences as jest.Mock).mockReturnValue({
      orgPreferences: { enable_discord_notifications: true, discord_webhook: '' },
      isLoading: false,
      error: null,
      mutate: mocks.mutate,
    });

    render(<NotificationPreferencesDialog open={true} onOpenChange={onOpenChange} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/discord webhook url/i)).toBeInTheDocument();
    });

    const submitButton = screen.getByText('Update Preferences');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Discord webhook URL is required')).toBeInTheDocument();
    });

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('allows toggling Discord notifications on and off', async () => {
    render(<NotificationPreferencesDialog open={true} onOpenChange={jest.fn()} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /discord notifications/i })).toBeInTheDocument();
    });

    const discordSwitch = screen.getByRole('switch', { name: /discord notifications/i });
    expect(discordSwitch).not.toBeChecked();

    fireEvent.click(discordSwitch);

    await waitFor(() => {
      expect(discordSwitch).toBeChecked();
      expect(screen.getByLabelText(/discord webhook url/i)).toBeInTheDocument();
    });

    fireEvent.click(discordSwitch);

    await waitFor(() => {
      expect(discordSwitch).not.toBeChecked();
      expect(screen.queryByLabelText(/discord webhook url/i)).not.toBeInTheDocument();
    });
  });

  it('allows entering Discord webhook URL', async () => {
    (notificationHooks.useOrgPreferences as jest.Mock).mockReturnValue({
      orgPreferences: { enable_discord_notifications: true, discord_webhook: '' },
      isLoading: false,
      error: null,
      mutate: mocks.mutate,
    });

    const onOpenChange = jest.fn();

    render(<NotificationPreferencesDialog open={true} onOpenChange={onOpenChange} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/discord webhook url/i)).toBeInTheDocument();
    });

    const webhookInput = screen.getByLabelText(/discord webhook url/i);
    fireEvent.change(webhookInput, {
      target: { value: 'https://discord.com/api/webhooks/12345/abcdef' },
    });

    expect(webhookInput).toHaveValue('https://discord.com/api/webhooks/12345/abcdef');

    const submitButton = screen.getByText('Update Preferences');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.mockUpdateOrgPreferences).toHaveBeenCalledWith({
        enable_discord_notifications: true,
        discord_webhook: 'https://discord.com/api/webhooks/12345/abcdef',
      });
    });
  });

  it('handles no permissions gracefully', async () => {
    (permissionsHook.useUserPermissions as jest.Mock).mockReturnValue(createMockPermissions(false));

    render(<NotificationPreferencesDialog open={true} onOpenChange={jest.fn()} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      const discordSwitch = screen.getByRole('switch', { name: /discord notifications/i });
      expect(discordSwitch).toBeDisabled();
    });
  });

  it('does not update form data when preferences are not yet loaded', async () => {
    (notificationHooks.useUserPreferences as jest.Mock).mockReturnValue({
      preferences: null,
      isLoading: true,
      error: null,
      mutate: mocks.mutate,
    });

    (notificationHooks.useOrgPreferences as jest.Mock).mockReturnValue({
      orgPreferences: null,
      isLoading: true,
      error: null,
      mutate: mocks.mutate,
    });

    render(<NotificationPreferencesDialog open={true} onOpenChange={jest.fn()} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      const emailSwitch = screen.getByRole('switch', { name: /email notifications/i });
      expect(emailSwitch).not.toBeChecked();
    });
  });
});
