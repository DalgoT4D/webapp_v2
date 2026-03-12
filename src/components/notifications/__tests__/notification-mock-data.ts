/**
 * Mock Data Factories for Notification Tests
 *
 * Following the same pattern as pipeline-mock-data.ts
 */

import type { Notification } from '@/types/notifications';

// ============ Mock Data Factories ============

export const createMockNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 1,
  urgent: false,
  author: 'System',
  message: 'Test notification message',
  read_status: false,
  timestamp: new Date().toISOString(),
  ...overrides,
});

// ============ Default Mock Data ============

export const mockNotifications: Notification[] = [
  createMockNotification({
    id: 1,
    author: 'System',
    message: 'First notification',
    read_status: false,
  }),
  createMockNotification({
    id: 2,
    urgent: true,
    author: 'Admin',
    message: 'Second notification with a link: https://example.com/test',
    read_status: true,
  }),
];

export const mockUserPreferences = {
  enable_email_notifications: true,
};

export const mockOrgPreferences = {
  enable_discord_notifications: false,
  discord_webhook: '',
};

// Must exceed 300 characters to trigger truncation
export const longMessage =
  'This is a very long notification message that exceeds the truncation limit of 300 characters. It should be truncated and show an expand button for the user to see the full message content. This message needs to be really long to trigger the truncation behavior, so we are adding more text here to make sure it exceeds the threshold that was set in the constants file.';

// ============ Mock Hook Helpers ============

export const createMockMutate = () => jest.fn();

export const createMockNotificationHooks = (mutate = jest.fn()) => {
  const mockMarkAsRead = jest.fn().mockResolvedValue(true);
  const mockMarkAllAsRead = jest.fn().mockResolvedValue(true);
  const mockUpdateUserPreferences = jest.fn().mockResolvedValue(true);
  const mockUpdateOrgPreferences = jest.fn().mockResolvedValue(true);

  return {
    mutate,
    mockMarkAsRead,
    mockMarkAllAsRead,
    mockUpdateUserPreferences,
    mockUpdateOrgPreferences,
  };
};

export const createMockPermissions = (hasDiscord = true) => ({
  permissions: hasDiscord ? [{ slug: 'can_edit_org_notification_settings' }] : [],
  hasPermission: hasDiscord
    ? (slug: string) => slug === 'can_edit_org_notification_settings'
    : () => false,
  hasAnyPermission: () => hasDiscord,
  hasAllPermissions: () => hasDiscord,
  isLoading: false,
});
