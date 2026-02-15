import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationsPage from '@/app/notifications/page';
import * as notificationHooks from '@/hooks/api/useNotifications';
import * as authStore from '@/stores/authStore';

// Mock the hooks
jest.mock('@/hooks/api/useNotifications');
jest.mock('@/stores/authStore');

const mockNotifications = [
  {
    id: 1,
    urgent: false,
    author: 'System',
    message: 'First notification',
    read_status: false,
    timestamp: new Date().toISOString(),
  },
  {
    id: 2,
    urgent: true,
    author: 'Admin',
    message: 'Second notification',
    read_status: true,
    timestamp: new Date().toISOString(),
  },
];

const mockMutate = jest.fn();
const mockMarkAsRead = jest.fn();
const mockMarkAllAsRead = jest.fn();
const mockUpdateUserPreferences = jest.fn();
const mockUpdateOrgPreferences = jest.fn();

describe('Notifications Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock useNotifications
    (notificationHooks.useNotifications as jest.Mock).mockReturnValue({
      notifications: mockNotifications,
      totalCount: 2,
      isLoading: false,
      error: null,
      mutate: mockMutate,
    });

    // Mock useUnreadCount
    (notificationHooks.useUnreadCount as jest.Mock).mockReturnValue({
      unreadCount: 1,
      isLoading: false,
      error: null,
      mutate: mockMutate,
    });

    // Mock useNotificationActions
    (notificationHooks.useNotificationActions as jest.Mock).mockReturnValue({
      markAsRead: mockMarkAsRead.mockResolvedValue(true),
      markAllAsRead: mockMarkAllAsRead.mockResolvedValue(true),
    });

    // Mock useUserPreferences
    (notificationHooks.useUserPreferences as jest.Mock).mockReturnValue({
      preferences: { enable_email_notifications: true },
      isLoading: false,
      error: null,
      mutate: mockMutate,
    });

    // Mock useOrgPreferences
    (notificationHooks.useOrgPreferences as jest.Mock).mockReturnValue({
      orgPreferences: {
        enable_discord_notifications: false,
        discord_webhook: '',
      },
      isLoading: false,
      error: null,
      mutate: mockMutate,
    });

    // Mock usePreferenceActions
    (notificationHooks.usePreferenceActions as jest.Mock).mockReturnValue({
      updateUserPreferences: mockUpdateUserPreferences.mockResolvedValue(true),
      updateOrgPreferences: mockUpdateOrgPreferences.mockResolvedValue(true),
    });

    // Mock useAuthStore
    (authStore.useAuthStore as unknown as jest.Mock).mockReturnValue({
      getCurrentOrgUser: () => ({
        permissions: [{ slug: 'can_edit_org_notification_settings' }],
      }),
    });
  });

  it('loads notifications on page mount', () => {
    render(<NotificationsPage />);

    expect(screen.getByText('First notification')).toBeInTheDocument();
    expect(screen.getByText('Second notification')).toBeInTheDocument();
  });

  it('displays unread count badge', () => {
    render(<NotificationsPage />);

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders tab navigation', () => {
    render(<NotificationsPage />);

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Read')).toBeInTheDocument();
    expect(screen.getByText('Unread')).toBeInTheDocument();
  });

  it('marks notifications as read', async () => {
    render(<NotificationsPage />);

    // Select first notification
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // First notification checkbox

    // Click "Mark as read" button
    const markAsReadButton = screen.getByRole('button', {
      name: /^mark as read$/i,
    });
    fireEvent.click(markAsReadButton);

    await waitFor(() => {
      expect(mockMarkAsRead).toHaveBeenCalledWith([1], true);
      expect(mockMutate).toHaveBeenCalled();
    });
  });

  it('marks all as read', async () => {
    render(<NotificationsPage />);

    const markAllButton = screen.getByRole('button', {
      name: /mark all as read/i,
    });
    fireEvent.click(markAllButton);

    await waitFor(() => {
      expect(mockMarkAllAsRead).toHaveBeenCalled();
      expect(mockMutate).toHaveBeenCalled();
    });
  });

  it('updates unread count after actions', async () => {
    render(<NotificationsPage />);

    // Select and mark as read
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    const markAsReadButton = screen.getByRole('button', {
      name: /^mark as read$/i,
    });
    fireEvent.click(markAsReadButton);

    await waitFor(() => {
      // Verify mutate was called to refresh unread count
      expect(mockMutate).toHaveBeenCalled();
    });
  });

  it('opens preferences dialog', async () => {
    render(<NotificationsPage />);

    const settingsButton = screen.getByRole('button', {
      name: /manage preferences/i,
    });
    fireEvent.click(settingsButton);

    await waitFor(() => {
      expect(screen.getByText('Manage Preferences')).toBeInTheDocument();
    });
  });

  it('updates preferences successfully', async () => {
    render(<NotificationsPage />);

    // Open preferences dialog
    const settingsButton = screen.getByRole('button', {
      name: /manage preferences/i,
    });
    fireEvent.click(settingsButton);

    await waitFor(() => {
      expect(screen.getByText('Manage Preferences')).toBeInTheDocument();
    });

    // Toggle email notifications
    const emailSwitch = screen.getByRole('switch', {
      name: /email notifications/i,
    });
    fireEvent.click(emailSwitch);

    // Submit
    const updateButton = screen.getByText('Update Preferences');
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(mockUpdateUserPreferences).toHaveBeenCalledWith({
        enable_email_notifications: false,
      });
    });
  });

  it('disables buttons correctly based on state', () => {
    render(<NotificationsPage />);

    const markAsReadButton = screen.getByRole('button', {
      name: /^mark as read$/i,
    });
    const markAsUnreadButton = screen.getByRole('button', {
      name: /mark as unread/i,
    });

    // Buttons should be disabled when no selection
    expect(markAsReadButton).toBeDisabled();
    expect(markAsUnreadButton).toBeDisabled();

    // Select a notification
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    // "Mark as read" should be enabled, "Mark as unread" should be enabled
    expect(markAsReadButton).not.toBeDisabled();
    expect(markAsUnreadButton).not.toBeDisabled();
  });

  it('has mark as read button disabled by default', () => {
    render(<NotificationsPage />);

    const markAsReadButton = screen.getByRole('button', {
      name: /^mark as read$/i,
    });
    const markAsUnreadButton = screen.getByRole('button', {
      name: /mark as unread/i,
    });

    // Buttons should be disabled when no selection
    expect(markAsReadButton).toBeDisabled();
    expect(markAsUnreadButton).toBeDisabled();
  });

  it('handles empty notification list', () => {
    (notificationHooks.useNotifications as jest.Mock).mockReturnValue({
      notifications: [],
      totalCount: 0,
      isLoading: false,
      error: null,
      mutate: mockMutate,
    });

    render(<NotificationsPage />);

    expect(screen.getByText('No notifications to display')).toBeInTheDocument();
  });

  it('allows changing page size', async () => {
    render(<NotificationsPage />);

    // Open page size selector
    const pageSizeSelect = screen.getByRole('combobox');
    fireEvent.click(pageSizeSelect);

    // Select 20 items per page
    await waitFor(() => {
      expect(screen.getByText('20')).toBeInTheDocument();
    });

    const option20 = screen.getByText('20');
    fireEvent.click(option20);

    // Verify the select updated (by checking it closed)
    await waitFor(() => {
      expect(screen.queryByRole('option')).not.toBeInTheDocument();
    });
  });
});
