'use client';

import { useState } from 'react';
import { Inbox, X } from 'lucide-react';
import type { Notification } from '@/types/notifications';
import { NotificationRow } from './NotificationRow';
import { TablePagination } from './TablePagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface NotificationsListProps {
  notifications: Notification[];
  totalCount: number;
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  onClearSelection: () => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  isLoading?: boolean;
}

export function NotificationsList({
  notifications,
  totalCount,
  selectedIds,
  onSelectionChange,
  onClearSelection,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
}: NotificationsListProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const currentPageIds = new Set(notifications.map((n) => n.id));
  const selectedOnPage = selectedIds.filter((id) => currentPageIds.has(id));
  const allSelected = notifications.length > 0 && selectedOnPage.length === notifications.length;
  const someSelected = selectedOnPage.length > 0 && selectedOnPage.length < notifications.length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(notifications.map((n) => n.id));
    } else {
      onSelectionChange([]);
    }
  };

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

  const hasSelection = selectedIds.length > 0;

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-auto px-6 pt-4">
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-4 space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-4">
                  <Skeleton className="h-4 w-4 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                  <Skeleton className="h-4 w-4 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 pt-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <Inbox className="h-8 w-8 text-gray-400" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-gray-900 text-lg">No notifications</h3>
          <p className="text-sm text-gray-500 mt-1">
            You&apos;re all caught up! Check back later for new notifications.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Table Container */}
      <div className="flex-1 overflow-hidden px-6 pt-4">
        <div className="h-full flex flex-col bg-white rounded-lg border shadow-sm">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={handleSelectAll}
                aria-label="Select all notifications"
              />
              <span className="text-sm text-gray-700 font-medium">
                Select all
                <span className="text-gray-500 mx-2">|</span>
                Showing {notifications.length} of {totalCount} notifications
              </span>
            </div>
            {hasSelection && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-blue-900">
                  {selectedIds.length} selected
                </span>
                <button
                  onClick={onClearSelection}
                  className="p-1 hover:bg-blue-100 rounded cursor-pointer"
                  aria-label="Clear selection"
                >
                  <X className="h-4 w-4 text-blue-600" />
                </button>
              </div>
            )}
          </div>

          {/* Scrollable Table */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <Table>
              <TableHeader className="sr-only">
                <TableRow>
                  <TableHead>Select</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Urgent</TableHead>
                  <TableHead>Expand</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    isSelected={selectedIds.includes(notification.id)}
                    isExpanded={expandedRow === notification.id}
                    onSelect={handleSelectRow}
                    onToggleExpand={toggleExpand}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Footer */}
          {totalCount > 0 && (
            <div className="flex-shrink-0">
              <TablePagination
                count={totalCount}
                page={page}
                pageSize={pageSize}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
