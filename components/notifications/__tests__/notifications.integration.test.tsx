/**
 * Notifications Page - Integration Tests
 *
 * Tests the full NotificationsPage component with all child components.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationsPage from '@/app/notifications/page';
import * as notificationHooks from '@/hooks/api/useNotifications';
import * as permissionsHook from '@/hooks/api/usePermissions';
import {
  mockNotifications,
  mockUserPreferences,
  mockOrgPreferences,
  createMockNotificationHooks,
  createMockPermissions,
} from './notification-mock-data';

jest.mock('@/hooks/api/useNotifications');
jest.mock('@/hooks/api/usePermissions');

describe('Notifications Page Integration', () => {
  let mocks: ReturnType<typeof createMockNotificationHooks>;

  beforeEach(() => {
    jest.clearAllMocks();
    mocks = createMockNotificationHooks();

    (notificationHooks.useNotifications as jest.Mock).mockReturnValue({
      notifications: mockNotifications,
      totalCount: 2,
      isLoading: false,
      error: null,
      mutate: mocks.mutate,
    });

    (notificationHooks.useUnreadCount as jest.Mock).mockReturnValue({
      unreadCount: 1,
      isLoading: false,
      error: null,
      mutate: mocks.mutate,
    });

    (notificationHooks.useNotificationActions as jest.Mock).mockReturnValue({
      markAsRead: mocks.mockMarkAsRead,
      markAllAsRead: mocks.mockMarkAllAsRead,
    });

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

  it('loads notifications on page mount', () => {
    render(<NotificationsPage />);

    expect(screen.getByText('First notification')).toBeInTheDocument();
    expect(screen.getByText(/Second notification with a link:/)).toBeInTheDocument();
  });

  it('displays unread count badge', () => {
    render(<NotificationsPage />);

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

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mark as read' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Mark as unread' })).not.toBeDisabled();
    });
  });

  it('marks notifications as read when button clicked', async () => {
    render(<NotificationsPage />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    const markAsReadButton = screen.getByRole('button', { name: 'Mark as read' });
    fireEvent.click(markAsReadButton);

    await waitFor(() => {
      expect(mocks.mockMarkAsRead).toHaveBeenCalledWith([1], true);
      expect(mocks.mutate).toHaveBeenCalled();
    });
  });

  it('marks all as read', async () => {
    render(<NotificationsPage />);

    const markAllButton = screen.getByRole('button', { name: 'Mark all as read' });
    fireEvent.click(markAllButton);

    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to mark all/)).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /MARK ALL AS READ/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mocks.mockMarkAllAsRead).toHaveBeenCalled();
      expect(mocks.mutate).toHaveBeenCalled();
    });
  });

  it('shows selection count when items selected', async () => {
    render(<NotificationsPage />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    await waitFor(() => {
      expect(screen.getByText(/1 selected/)).toBeInTheDocument();
    });
  });

  it('clears selection when X button clicked', async () => {
    render(<NotificationsPage />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    await waitFor(() => {
      expect(screen.getByText(/1 selected/)).toBeInTheDocument();
    });

    const clearButton = screen.getByLabelText('Clear selection');
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    });
  });

  it('opens preferences dialog', async () => {
    render(<NotificationsPage />);

    const settingsButton = screen.getByRole('button', { name: /manage notification preferences/i });
    fireEvent.click(settingsButton);

    await waitFor(() => {
      expect(screen.getByText('Manage Preferences')).toBeInTheDocument();
    });
  });

  it('updates preferences successfully', async () => {
    render(<NotificationsPage />);

    const settingsButton = screen.getByRole('button', { name: /manage notification preferences/i });
    fireEvent.click(settingsButton);

    await waitFor(() => {
      expect(screen.getByText('Manage Preferences')).toBeInTheDocument();
    });

    const emailSwitch = screen.getByRole('switch', { name: /email notifications/i });
    fireEvent.click(emailSwitch);

    const updateButton = screen.getByText('Update Preferences');
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(mocks.mockUpdateUserPreferences).toHaveBeenCalledWith({
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
      mutate: mocks.mutate,
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
      mutate: mocks.mutate,
    });

    render(<NotificationsPage />);
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument();
  });

  it('switches between tabs', async () => {
    render(<NotificationsPage />);

    const readTab = screen.getByRole('tab', { name: 'Read' });
    fireEvent.click(readTab);

    await waitFor(() => {
      expect(notificationHooks.useNotifications).toHaveBeenCalled();
    });
  });

  it('allows changing page size', async () => {
    render(<NotificationsPage />);

    const pageSizeSelect = screen.getByRole('combobox');
    fireEvent.click(pageSizeSelect);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: '20' })).toBeInTheDocument();
    });

    const option20 = screen.getByRole('option', { name: '20' });
    fireEvent.click(option20);

    await waitFor(() => {
      expect(screen.queryByRole('option')).not.toBeInTheDocument();
    });
  });
});
