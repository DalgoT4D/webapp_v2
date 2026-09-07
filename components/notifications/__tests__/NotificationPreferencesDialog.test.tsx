import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationPreferencesDialog } from '../NotificationPreferencesDialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import * as notificationHooks from '@/hooks/api/useNotifications';
import * as rbac from '@/lib/rbac';
import {
  mockUserPreferences,
  createMockNotificationHooks,
  createMockPermissions,
} from './notification-mock-data';

jest.mock('@/hooks/api/useNotifications');
jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));

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

    (notificationHooks.usePreferenceActions as jest.Mock).mockReturnValue({
      updateUserPreferences: mocks.mockUpdateUserPreferences,
    });

    (rbac.useRbac as jest.Mock).mockReturnValue(createMockPermissions(true));
  });

  it('loads existing email preference when dialog opens', async () => {
    render(<NotificationPreferencesDialog open={true} onOpenChange={jest.fn()} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      const emailSwitch = screen.getByRole('switch', { name: /email notifications/i });
      expect(emailSwitch).toBeChecked();
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

  it('renders base form controls', async () => {
    render(<NotificationPreferencesDialog open={true} onOpenChange={jest.fn()} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /email notifications/i })).toBeInTheDocument();
      expect(screen.getByText('Update Preferences')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  it('submits updated email preference and closes', async () => {
    const onOpenChange = jest.fn();

    render(<NotificationPreferencesDialog open={true} onOpenChange={onOpenChange} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /email notifications/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('switch', { name: /email notifications/i }));
    fireEvent.click(screen.getByText('Update Preferences'));

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

    fireEvent.click(screen.getByRole('switch', { name: /email notifications/i }));
    fireEvent.click(screen.getByText('Update Preferences'));

    await waitFor(() => {
      expect(mocks.mockUpdateUserPreferences).toHaveBeenCalled();
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

    fireEvent.click(screen.getByRole('switch', { name: /email notifications/i }));
    fireEvent.click(screen.getByText('Update Preferences'));

    await waitFor(() => {
      expect(screen.getByText('Updating...')).toBeInTheDocument();
    });

    resolveUpdate!(true);

    await waitFor(() => {
      expect(screen.queryByText('Updating...')).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByText('Cancel'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes without a PUT when nothing changed', async () => {
    const onOpenChange = jest.fn();

    render(<NotificationPreferencesDialog open={true} onOpenChange={onOpenChange} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(screen.getByText('Update Preferences')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Update Preferences'));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(mocks.mockUpdateUserPreferences).not.toHaveBeenCalled();
  });

  it('renders the schema-change toggle for admin users', async () => {
    render(<NotificationPreferencesDialog open={true} onOpenChange={jest.fn()} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(
        screen.getByRole('switch', { name: /schema change notifications/i })
      ).toBeInTheDocument();
    });
  });

  it('hides the schema-change toggle for non-admin users', async () => {
    (rbac.useRbac as jest.Mock).mockReturnValue(createMockPermissions(false));

    render(<NotificationPreferencesDialog open={true} onOpenChange={jest.fn()} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /email notifications/i })).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('switch', { name: /schema change notifications/i })
    ).not.toBeInTheDocument();
  });

  it('submits the schema-change toggle when an admin flips it off', async () => {
    const onOpenChange = jest.fn();

    render(<NotificationPreferencesDialog open={true} onOpenChange={onOpenChange} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(
        screen.getByRole('switch', { name: /schema change notifications/i })
      ).toBeInTheDocument();
    });

    // Default is ON (server default=True). Toggling flips to OFF.
    fireEvent.click(screen.getByRole('switch', { name: /schema change notifications/i }));
    fireEvent.click(screen.getByText('Update Preferences'));

    await waitFor(() => {
      expect(mocks.mockUpdateUserPreferences).toHaveBeenCalledWith({
        enable_schema_change_notifications: false,
      });
    });
  });

  it('does not update form data when preferences are not yet loaded', async () => {
    (notificationHooks.useUserPreferences as jest.Mock).mockReturnValue({
      preferences: null,
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
