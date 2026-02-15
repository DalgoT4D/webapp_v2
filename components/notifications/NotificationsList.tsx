import { useState } from 'react';
import { Inbox } from 'lucide-react';
import { Notification } from '@/types/notifications';
import { NotificationRow } from './NotificationRow';
import { TablePagination } from './TablePagination';
import { Skeleton } from '@/components/ui/skeleton';

interface NotificationsListProps {
  notifications: Notification[];
  totalCount: number;
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  isLoading?: boolean;
  selectionMode?: boolean;
  onEnterSelectionMode?: () => void;
}

export function NotificationsList({
  notifications,
  totalCount,
  selectedIds,
  onSelectionChange,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
  selectionMode = false,
  onEnterSelectionMode,
}: NotificationsListProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const handleSelectRow = (id: number, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-lg border bg-white">
                <Skeleton className="h-5 w-5 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-5 w-5 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <Inbox className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-gray-900">No notifications</h3>
          <p className="text-sm text-muted-foreground mt-1">
            You're all caught up! Check back later for new notifications.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Scrollable notifications */}
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-4 space-y-2">
          {notifications.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              isSelected={selectedIds.includes(notification.id)}
              isExpanded={expandedRow === notification.id}
              onSelect={handleSelectRow}
              onToggleExpand={toggleExpand}
              selectionMode={selectionMode}
              onEnterSelectionMode={onEnterSelectionMode}
            />
          ))}
        </div>
      </div>

      {/* Fixed Pagination Footer */}
      {totalCount > 0 && (
        <TablePagination
          count={totalCount}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}
