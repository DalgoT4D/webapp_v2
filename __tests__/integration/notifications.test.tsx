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
    message: 'Second notification with a link: https://example.com/test',
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
    expect(screen.getByText(/Second notification with a link:/)).toBeInTheDocument();
  });

  it('displays unread count badge', () => {
    render(<NotificationsPage />);

    // Badge shows just the number
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders tab navigation', () => {
    render(<NotificationsPage />);

    expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Read' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Unread' })).toBeInTheDocument();
  });

  it('renders action buttons in header', () => {
    render(<NotificationsPage />);

    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark as read' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark as unread' })).toBeInTheDocument();
  });

  it('disables mark as read/unread buttons when no selection', () => {
    render(<NotificationsPage />);

    expect(screen.getByRole('button', { name: 'Mark as read' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mark as unread' })).toBeDisabled();
  });

  it('enables mark as read/unread buttons when items selected', async () => {
    render(<NotificationsPage />);

    // Select first notification
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // First notification checkbox

    // Buttons should be enabled
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mark as read' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Mark as unread' })).not.toBeDisabled();
    });
  });

  it('marks notifications as read when button clicked', async () => {
    render(<NotificationsPage />);

    // Select first notification
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    // Click "Mark as read" button
    const markAsReadButton = screen.getByRole('button', { name: 'Mark as read' });
    fireEvent.click(markAsReadButton);

    await waitFor(() => {
      expect(mockMarkAsRead).toHaveBeenCalledWith([1], true);
      expect(mockMutate).toHaveBeenCalled();
    });
  });

  it('marks all as read', async () => {
    render(<NotificationsPage />);

    const markAllButton = screen.getByRole('button', { name: 'Mark all as read' });
    fireEvent.click(markAllButton);

    // Confirm in the confirmation dialog
    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to mark all/)).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /MARK ALL AS READ/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockMarkAllAsRead).toHaveBeenCalled();
      expect(mockMutate).toHaveBeenCalled();
    });
  });

  it('shows selection count when items selected', async () => {
    render(<NotificationsPage />);

    // Select first notification
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    // Selection info should appear
    await waitFor(() => {
      expect(screen.getByText(/1 selected/)).toBeInTheDocument();
    });
  });

  it('clears selection when X button clicked', async () => {
    render(<NotificationsPage />);

    // Select first notification
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    await waitFor(() => {
      expect(screen.getByText(/1 selected/)).toBeInTheDocument();
    });

    // Click clear selection button
    const clearButton = screen.getByLabelText('Clear selection');
    fireEvent.click(clearButton);

    // Selection info should disappear
    await waitFor(() => {
      expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    });
  });

  it('opens preferences dialog', async () => {
    render(<NotificationsPage />);

    const settingsButton = screen.getByRole('button', { name: '' });
    fireEvent.click(settingsButton);

    await waitFor(() => {
      expect(screen.getByText('Manage Preferences')).toBeInTheDocument();
    });
  });

  it('updates preferences successfully', async () => {
    render(<NotificationsPage />);

    // Open preferences dialog
    const settingsButton = screen.getByRole('button', { name: '' });
    fireEvent.click(settingsButton);

    await waitFor(() => {
      expect(screen.getByText('Manage Preferences')).toBeInTheDocument();
    });

    // Toggle email notifications
    const emailSwitch = screen.getByRole('switch', { name: /email notifications/i });
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

  it('handles empty notification list', () => {
    (notificationHooks.useNotifications as jest.Mock).mockReturnValue({
      notifications: [],
      totalCount: 0,
      isLoading: false,
      error: null,
      mutate: mockMutate,
    });

    render(<NotificationsPage />);

    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });

  it('renders links in notifications as clickable', () => {
    render(<NotificationsPage />);

    const link = screen.getByRole('link', { name: 'https://example.com/test' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com/test');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('shows mark all as read button only when there are unread notifications', () => {
    render(<NotificationsPage />);
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeInTheDocument();
  });

  it('hides mark all as read when no unread notifications', () => {
    (notificationHooks.useUnreadCount as jest.Mock).mockReturnValue({
      unreadCount: 0,
      isLoading: false,
      error: null,
      mutate: mockMutate,
    });

    render(<NotificationsPage />);
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument();
  });

  it('switches between tabs', async () => {
    render(<NotificationsPage />);

    // Click on "Read" tab
    const readTab = screen.getByRole('tab', { name: 'Read' });
    fireEvent.click(readTab);

    // Hook should be called with updated filters
    await waitFor(() => {
      expect(notificationHooks.useNotifications).toHaveBeenCalled();
    });
  });

  it('allows changing page size', async () => {
    render(<NotificationsPage />);

    // Open page size selector
    const pageSizeSelect = screen.getByRole('combobox');
    fireEvent.click(pageSizeSelect);

    // Select 20 items per page
    await waitFor(() => {
      expect(screen.getByRole('option', { name: '20' })).toBeInTheDocument();
    });

    const option20 = screen.getByRole('option', { name: '20' });
    fireEvent.click(option20);

    // Verify the select updated
    await waitFor(() => {
      expect(screen.queryByRole('option')).not.toBeInTheDocument();
    });
  });
});
