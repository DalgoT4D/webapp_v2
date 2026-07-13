// Core notification interface
export interface Notification {
  id: number;
  urgent: boolean;
  author: string;
  message: string;
  read_status: boolean;
  timestamp: string; // ISO 8601 format from backend
}

// API response for paginated notifications
export interface NotificationsResponse {
  total_notifications: number;
  res: Notification[];
}

// Unread count API response
export interface UnreadCountResponse {
  res: number;
}

// User preferences
export interface UserPreferences {
  enable_email_notifications: boolean;
  last_visited_transform_tab?: 'ui' | 'github' | null;
}

// Organization preferences — GET /api/orgpreferences/ returns Discord
// notification settings AND the sharing settings (task-11f) in the same
// envelope, so both live on one interface rather than being split.
import type { AccessAudience, AccessLevel } from '@/hooks/api/useResourceAccess';

export interface OrgPreferences {
  enable_discord_notifications: boolean;
  discord_webhook: string;
  allow_public_sharing: boolean;
  default_general_audience: AccessAudience;
  default_general_level: AccessLevel;
}

// API response wrappers
export interface UserPreferencesResponse {
  res: UserPreferences;
}

export interface OrgPreferencesResponse {
  res: OrgPreferences;
}

// Form data for preferences
export interface NotificationPreferencesForm {
  enable_email_notifications: boolean;
  enable_discord_notifications: boolean;
  discord_webhook: string;
}

// Bulk action payloads
export interface MarkAsReadPayload {
  notification_ids: number[];
  read_status: boolean;
}

// Tab types
export type NotificationTab = 'all' | 'read' | 'unread';

import { ReadStatus } from '@/constants/notifications';

// Filter parameters
export interface NotificationFilters {
  limit: number;
  page: number;
  read_status?: ReadStatus; // undefined = all
}
