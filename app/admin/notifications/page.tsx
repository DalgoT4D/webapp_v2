'use client';

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BroadcastComposer } from '@/components/admin/BroadcastComposer';
import { BroadcastHistory } from '@/components/admin/BroadcastHistory';
import { useAdminNotifications } from '@/hooks/api/useAdminPortal';
import { DEFAULT_PAGE_SIZE } from '@/constants/notifications';
import { trackFeatureView } from '@/lib/analytics';
import { FEATURES } from '@/constants/analytics';

type NotificationsTab = 'create' | 'history';

/**
 * Admin notifications: compose a broadcast, or review the ones already sent.
 *
 * Page state (page/pageSize) and the fetch live here, with BroadcastHistory
 * presentational below — the same split as app/notifications/page.tsx and
 * NotificationsList.
 */
export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<NotificationsTab>('create');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  const {
    notifications,
    totalCount,
    isLoading: historyLoading,
    mutate: mutateHistory,
  } = useAdminNotifications(page, pageSize);

  // A smaller page size can leave the current page past the end; go back to the
  // first page rather than landing on a clamped one (same as app/notifications).
  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  const handleTabChange = (value: string) => {
    setActiveTab(value as NotificationsTab);
    trackFeatureView(FEATURES.ADMIN_NOTIFICATIONS, { tab: value });
  };

  // A new broadcast is the newest row, which shifts every page — go back to page 1
  // and refetch rather than refreshing whichever page happens to be open.
  const handleSent = () => {
    setPage(1);
    mutateHistory();
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Send a broadcast to the whole platform, one org, or several orgs at once.
        </p>
      </div>

      {/* Tabs are local state, so feature:viewed does not fire on switch the way it
          does on navigation — instrument it explicitly (rules/analytics.md). */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="create" data-testid="notifications-tab-create">
            Create notification
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="notifications-tab-history">
            View history
          </TabsTrigger>
        </TabsList>

        {/* forceMount keeps a half-written broadcast alive while the admin peeks at
            history. It does NOT hide the panel on its own: Radix sets
            hidden={!present} and forceMount pins present true, leaving the inactive
            panel visible, focusable and exposed as a second role="tabpanel". The
            explicit `hidden` below is what hides it (Radix spreads our props after
            its own, so ours wins). */}
        <TabsContent value="create" className="mt-6" forceMount hidden={activeTab !== 'create'}>
          <BroadcastComposer onSent={handleSent} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <BroadcastHistory
            notifications={notifications}
            totalCount={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            isLoading={historyLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
