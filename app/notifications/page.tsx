'use client';

import { useState, useEffect } from 'react';
import { Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NotificationsList } from '@/components/notifications/NotificationsList';
import { NotificationPreferencesDialog } from '@/components/notifications/NotificationPreferencesDialog';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
  useNotifications,
  useNotificationActions,
  useUnreadCount,
} from '@/hooks/api/useNotifications';
import { buildFilters } from '@/lib/notifications';
import type { NotificationTab } from '@/types/notifications';
import { DEFAULT_PAGE_SIZE } from '@/constants/notifications';

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<NotificationTab>('all');
  const [showPreferences, setShowPreferences] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { unreadCount, mutate: mutateUnreadCount } = useUnreadCount();
  const filters = buildFilters(activeTab, page, pageSize);
  const { notifications, totalCount, mutate, isLoading } = useNotifications(filters);
  const { markAsRead, markAllAsRead } = useNotificationActions();
  const { confirm, DialogComponent: ConfirmDialog } = useConfirmationDialog();

  // Reset selection and page when tab changes
  useEffect(() => {
    setSelectedIds([]);
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
    }
  };

  const handleMarkAsUnread = async () => {
    if (selectedIds.length === 0) return;

    const success = await markAsRead(selectedIds, false);
    if (success) {
      await mutate();
      await mutateUnreadCount();
      setSelectedIds([]);
    }
  };

  const handleMarkAllAsRead = async () => {
    const confirmed = await confirm({
      title: 'Mark all as read',
      description: `Are you sure you want to mark all ${unreadCount} notifications as read?`,
      confirmText: 'Mark all as read',
      cancelText: 'Cancel',
      type: 'info',
      onConfirm: () => {},
    });

    if (!confirmed) return;

    const success = await markAllAsRead();
    if (success) {
      await mutate();
      await mutateUnreadCount();
      setSelectedIds([]);
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setSelectedIds([]);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setSelectedIds([]);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as NotificationTab);
  };

  const hasSelection = selectedIds.length > 0;

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
            {unreadCount > 0 && (
              <Badge className="bg-teal-600 hover:bg-teal-600 text-white px-2.5 py-0.5 text-xs font-medium">
                {unreadCount}
              </Badge>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={isLoading}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                Mark all as read
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={handleMarkAsRead}
              disabled={!hasSelection || isLoading || activeTab === 'read'}
              className="bg-teal-600 hover:bg-teal-700 text-white disabled:bg-teal-600/50"
            >
              Mark as read
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAsUnread}
              disabled={!hasSelection || isLoading || activeTab === 'unread'}
            >
              Mark as unread
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPreferences(true)}
                  className="h-9 w-9 text-gray-500 hover:text-gray-700"
                  aria-label="Manage notification preferences"
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Manage Preferences</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="bg-transparent p-0 h-auto gap-4">
              <TabsTrigger
                value="all"
                className="relative bg-transparent border-0 shadow-none rounded-none px-1 py-2.5 text-sm font-medium uppercase tracking-wide text-slate-500 data-[state=active]:text-teal-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-teal-600"
              >
                All
              </TabsTrigger>
              <TabsTrigger
                value="read"
                className="relative bg-transparent border-0 shadow-none rounded-none px-1 py-2.5 text-sm font-medium uppercase tracking-wide text-slate-500 data-[state=active]:text-teal-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-teal-600"
              >
                Read
              </TabsTrigger>
              <TabsTrigger
                value="unread"
                className="relative bg-transparent border-0 shadow-none rounded-none px-1 py-2.5 text-sm font-medium uppercase tracking-wide text-slate-500 data-[state=active]:text-teal-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-teal-600"
              >
                Unread
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Selection Info Bar */}
        {hasSelection && (
          <div className="bg-blue-50 border-t border-blue-100 px-6 py-2">
            <div className="flex items-center gap-3">
              <button
                onClick={handleClearSelection}
                className="p-1 hover:bg-blue-100 rounded-md transition-colors"
                aria-label="Clear selection"
              >
                <X className="h-4 w-4 text-blue-600" />
              </button>
              <span className="text-sm font-medium text-blue-800">
                {selectedIds.length} selected
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <NotificationsList
          notifications={notifications}
          totalCount={totalCount}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          page={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          isLoading={isLoading}
        />
      </div>

      {/* Preferences Dialog */}
      <NotificationPreferencesDialog open={showPreferences} onOpenChange={setShowPreferences} />

      {/* Confirmation Dialog */}
      <ConfirmDialog />
    </div>
  );
}
