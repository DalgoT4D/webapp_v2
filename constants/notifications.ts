import { NotificationTab } from '@/types/notifications';

// Read status values for API filtering
export const READ_STATUS = {
  UNREAD: 0,
  READ: 1,
} as const;

export type ReadStatus = (typeof READ_STATUS)[keyof typeof READ_STATUS];

export const NOTIFICATION_TABS: readonly { value: NotificationTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'read', label: 'Read' },
  { value: 'unread', label: 'Unread' },
] as const;

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 10;
export const MESSAGE_TRUNCATE_LENGTH = 300;
export const UNREAD_COUNT_REFRESH_INTERVAL = 30000; // 30 seconds

export const PERMISSIONS = {
  EDIT_ORG_NOTIFICATION_SETTINGS: 'can_edit_org_notification_settings',
} as const;
