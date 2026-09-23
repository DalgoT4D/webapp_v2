'use client';

import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
// Cross-feature import on purpose: TablePagination is presentational (no API calls,
// no notification-specific logic) and this is the same domain. Promoting it to
// components/ui/ is a call for whenever a third feature needs it.
import { TablePagination } from '@/components/notifications/TablePagination';
import { renderMessageWithLinks } from '@/lib/notificationMessage';
import type { AdminNotification } from '@/hooks/api/useAdminPortal';

interface BroadcastHistoryProps {
  notifications: AdminNotification[];
  /** Server-side total across all pages — not this page's row count. */
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  isLoading?: boolean;
}

/**
 * The sent-broadcast history — the "View history" tab. Audience (resolved to org
 * names), channels, time, and recipient count only: no read status, no recipient
 * list (plan.md §3.3, §4.3).
 *
 * Presentational, like NotificationsList: the page owns the page/pageSize state and
 * the fetch, this renders a page of it. The list is paged because one row is written
 * per broadcast and nothing prunes them, so it would otherwise grow without bound.
 */
export function BroadcastHistory({
  notifications,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
}: BroadcastHistoryProps) {
  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle>History</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {isLoading ? (
          <Skeleton
            className="mx-6 h-32 w-[calc(100%-3rem)]"
            data-testid="notification-history-loading"
          />
        ) : totalCount === 0 ? (
          <p className="px-6 text-sm text-muted-foreground">No broadcasts sent yet.</p>
        ) : (
          <>
            <div className="px-6">
              <Table data-testid="notification-history-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Message</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead>Channels</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Recipients</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.map((notification) => (
                    <TableRow
                      key={notification.id}
                      data-testid={`notification-history-row-${notification.id}`}
                    >
                      <TableCell className="max-w-xs whitespace-normal break-words">
                        {renderMessageWithLinks(notification.message)}
                        {notification.urgent && (
                          <Badge variant="destructive" className="ml-2">
                            Urgent
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {notification.target_org_names && notification.target_org_names.length > 0
                          ? notification.target_org_names.join(', ')
                          : 'Whole platform'}
                      </TableCell>
                      <TableCell>
                        {[
                          notification.send_in_app ? 'In-app' : null,
                          notification.send_email ? 'Email' : null,
                        ]
                          .filter(Boolean)
                          .join(' + ')}
                      </TableCell>
                      <TableCell>
                        {notification.sent_time
                          ? formatDistanceToNow(new Date(notification.sent_time), {
                              addSuffix: true,
                            })
                          : '—'}
                      </TableCell>
                      <TableCell>{notification.recipient_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              count={totalCount}
              page={page}
              pageSize={pageSize}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
