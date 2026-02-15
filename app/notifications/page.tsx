'use client';

import { useState, useEffect } from 'react';
import { Settings, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationsList } from '@/components/notifications/NotificationsList';
import { NotificationPreferencesDialog } from '@/components/notifications/NotificationPreferencesDialog';
import {
  useNotifications,
  useNotificationActions,
  useUnreadCount,
} from '@/hooks/api/useNotifications';
import { buildFilters } from '@/lib/notifications';
import { NotificationTab } from '@/types/notifications';
import { NOTIFICATION_TABS, DEFAULT_PAGE_SIZE } from '@/constants/notifications';

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<NotificationTab>('all');
  const [showPreferences, setShowPreferences] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectionMode, setSelectionMode] = useState(false);

  const { unreadCount, mutate: mutateUnreadCount } = useUnreadCount();
  const filters = buildFilters(activeTab, page, pageSize);
  const { notifications, totalCount, mutate, isLoading } = useNotifications(filters);
  const { markAsRead, markAllAsRead } = useNotificationActions();

  // Reset selection and page when tab changes
  useEffect(() => {
    setSelectedIds([]);
    setSelectionMode(false);
    setPage(1);
  }, [activeTab]);

  // Reset page when page size changes
  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  const handleMarkAsRead = async () => {
    if (selectedIds.length === 0) return;

    const success = await markAsRead(selectedIds, true);
    if (success) {
      await mutate();
      await mutateUnreadCount();
      setSelectedIds([]);
      setSelectionMode(false);
    }
  };

  const handleMarkAsUnread = async () => {
    if (selectedIds.length === 0) return;

    const success = await markAsRead(selectedIds, false);
    if (success) {
      await mutate();
      await mutateUnreadCount();
      setSelectedIds([]);
      setSelectionMode(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    const success = await markAllAsRead();
    if (success) {
      await mutate();
      await mutateUnreadCount();
      setSelectedIds([]);
    }
  };

  const handleSelectAll = () => {
    setSelectedIds(notifications.map((n) => n.id));
  };

  const handleDeselectAll = () => {
    setSelectedIds([]);
  };

  const handleExitSelection = () => {
    setSelectedIds([]);
    setSelectionMode(false);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setSelectedIds([]);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setSelectedIds([]);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Fixed Header */}
      <div className="border-b bg-background">
        <div className="flex h-16 items-center justify-between px-6">
          <div>
            <h1 className="text-3xl font-bold">Notifications</h1>
            <p className="text-muted-foreground mt-1">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                : 'All caught up'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!selectionMode && activeTab === 'all' && unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={isLoading}
                className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
              >
                Mark all as read
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowPreferences(true)}
              className="h-8 w-8"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pb-4">
          {NOTIFICATION_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.value
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Selection Bar */}
        {selectionMode && selectedIds.length > 0 && (
          <div className="bg-blue-50 border-t border-b border-blue-200 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={handleExitSelection} className="p-1 hover:bg-blue-100 rounded">
                  <X className="h-4 w-4 text-blue-600" />
                </button>
                <span className="text-sm font-medium text-blue-900">
                  {selectedIds.length} of {notifications.length} selected
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={selectedIds.length === notifications.length}
                  className="h-8 text-blue-900 hover:bg-blue-100"
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeselectAll}
                  className="h-8 text-blue-900 hover:bg-blue-100"
                >
                  Deselect All
                </Button>
                {activeTab !== 'read' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAsRead}
                    className="h-8 text-blue-900 hover:bg-blue-100"
                  >
                    Mark as Read
                  </Button>
                )}
                {activeTab !== 'unread' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAsUnread}
                    className="h-8 text-blue-900 hover:bg-blue-100"
                  >
                    Mark as Unread
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-hidden">
        <NotificationsList
          notifications={notifications}
          totalCount={totalCount}
          selectedIds={selectedIds}
          onSelectionChange={(ids) => {
            setSelectedIds(ids);
            if (ids.length > 0 && !selectionMode) {
              setSelectionMode(true);
            }
          }}
          page={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          isLoading={isLoading}
          selectionMode={selectionMode}
          onEnterSelectionMode={() => setSelectionMode(true)}
        />
      </div>

      {/* Preferences Dialog */}
      <NotificationPreferencesDialog open={showPreferences} onOpenChange={setShowPreferences} />
    </div>
  );
}
