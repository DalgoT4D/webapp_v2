import { NotificationFilters, NotificationTab } from '@/types/notifications';

/**
 * Build query string from notification filters
 */
export function buildQueryString(filters: NotificationFilters): string {
  const params = new URLSearchParams();
  params.append('limit', String(filters.limit));
  params.append('page', String(filters.page));

  if (filters.read_status !== undefined) {
    params.append('read_status', String(filters.read_status));
  }

  return `?${params.toString()}`;
}

/**
 * Build filters object from tab and pagination state
 */
export function buildFilters(
  tab: NotificationTab,
  page: number,
  pageSize: number
): NotificationFilters {
  const filters: NotificationFilters = {
    limit: pageSize,
    page: page,
  };

  if (tab === 'read') filters.read_status = 1;
  if (tab === 'unread') filters.read_status = 0;

  return filters;
}
