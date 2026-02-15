import useSWR from 'swr';
import { toast } from 'sonner';
import { apiGet, apiPut } from '@/lib/api';
import {
  NotificationsResponse,
  UnreadCountResponse,
  UserPreferencesResponse,
  OrgPreferencesResponse,
  NotificationFilters,
} from '@/types/notifications';
import { buildQueryString } from '@/lib/notifications';
import { UNREAD_COUNT_REFRESH_INTERVAL } from '@/constants/notifications';

/**
 * Hook to fetch notifications with pagination and filtering
 */
export function useNotifications(filters: NotificationFilters) {
  const queryString = buildQueryString(filters);
  const { data, error, isLoading, mutate } = useSWR<NotificationsResponse>(
    `/api/notifications/v1${queryString}`,
    apiGet
  );

  return {
    notifications: data?.res || [],
    totalCount: data?.total_notifications || 0,
    isLoading,
    error,
    mutate,
  };
}

/**
 * Hook to fetch unread notification count (polls every 30 seconds)
 */
export function useUnreadCount() {
  const { data, error, isLoading, mutate } = useSWR<UnreadCountResponse>(
    '/api/notifications/unread_count',
    apiGet,
    { refreshInterval: UNREAD_COUNT_REFRESH_INTERVAL }
  );

  return {
    unreadCount: data?.res || 0,
    isLoading,
    error,
    mutate,
  };
}

/**
 * Hook to fetch user notification preferences
 */
export function useUserPreferences() {
  const { data, error, isLoading, mutate } = useSWR<UserPreferencesResponse>(
    '/api/userpreferences/',
    apiGet
  );

  return {
    preferences: data?.res,
    isLoading,
    error,
    mutate,
  };
}

/**
 * Hook to fetch organization notification preferences
 */
export function useOrgPreferences() {
  const { data, error, isLoading, mutate } = useSWR<OrgPreferencesResponse>(
    '/api/orgpreferences/',
    apiGet
  );

  return {
    orgPreferences: data?.res,
    isLoading,
    error,
    mutate,
  };
}

/**
 * Hook for notification actions (mark as read/unread, mark all as read)
 */
export function useNotificationActions() {
  const markAsRead = async (notificationIds: number[], readStatus: boolean) => {
    try {
      await apiPut('/api/notifications/v1', {
        notification_ids: notificationIds,
        read_status: readStatus,
      });
      toast.success(readStatus ? 'Marked as read' : 'Marked as unread');
      return true;
    } catch (error) {
      toast.error('Failed to update notifications');
      return false;
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiPut('/api/notifications/mark_all_as_read', {});
      toast.success('All notifications marked as read');
      return true;
    } catch (error) {
      toast.error('Failed to mark all as read');
      return false;
    }
  };

  return { markAsRead, markAllAsRead };
}

/**
 * Hook for preference actions (update user/org preferences)
 */
export function usePreferenceActions() {
  const updateUserPreferences = async (data: { enable_email_notifications: boolean }) => {
    try {
      await apiPut('/api/userpreferences/', data);
      toast.success('Email preferences updated');
      return true;
    } catch (error) {
      toast.error('Failed to update email preferences');
      return false;
    }
  };

  const updateOrgPreferences = async (data: {
    enable_discord_notifications: boolean;
    discord_webhook: string;
  }) => {
    try {
      await apiPut('/api/orgpreferences/enable-discord-notifications', data);
      toast.success('Discord preferences updated');
      return true;
    } catch (error) {
      toast.error('Failed to update Discord preferences');
      return false;
    }
  };

  return { updateUserPreferences, updateOrgPreferences };
}
