'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  Plus,
  Trash2,
  Pencil,
  Eye,
  MoreHorizontal,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useAlerts, updateAlert, deleteAlert } from '@/hooks/api/useAlerts';
import { toastSuccess, toastError } from '@/lib/toast';
import { cronToString } from '@/components/pipeline/utils';
import type { Alert } from '@/types/alert';

const DEFAULT_PAGE_SIZE = 10;

export function AlertList() {
  const router = useRouter();
  const { confirm, DialogComponent: DeleteDialog } = useConfirmationDialog();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { alerts, total, isLoading, mutate } = useAlerts(currentPage, pageSize);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const startIndex = (currentPage - 1) * pageSize;

  const handleDelete = useCallback(
    async (alert: Alert) => {
      const confirmed = await confirm({
        title: 'Delete alert?',
        description: `This will permanently delete "${alert.name}" and all its evaluation history. This action cannot be undone.`,
        confirmText: 'Delete',
        type: 'warning',
      });
      if (!confirmed) return;
      try {
        await deleteAlert(alert.id);
        toastSuccess.deleted('Alert');
        await mutate();
      } catch (error: unknown) {
        toastError.delete(error, 'Alert');
      }
    },
    [mutate, confirm]
  );

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0 border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-3xl font-bold">Alerts</h1>
            <p className="text-muted-foreground mt-1">
              Set Up Automated Checks On Your Data And Get Notified
            </p>
          </div>
          <Button
            variant="ghost"
            className="text-white hover:opacity-90 shadow-xs"
            style={{ backgroundColor: 'var(--primary)' }}
            onClick={() => router.push('/alerts/new')}
            data-testid="create-alert-btn"
          >
            <Plus className="h-4 w-4 mr-2" />
            CREATE ALERT
          </Button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-hidden px-6">
        <div className="h-full overflow-y-auto">
          {isLoading ? (
            <div className="py-6">
              <div className="border rounded-lg bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-[30%]">
                        <Skeleton className="h-4 w-16" />
                      </TableHead>
                      <TableHead className="w-[20%]">
                        <Skeleton className="h-4 w-20" />
                      </TableHead>
                      <TableHead className="w-[20%]">
                        <Skeleton className="h-4 w-20" />
                      </TableHead>
                      <TableHead className="w-[20%]">
                        <Skeleton className="h-4 w-20" />
                      </TableHead>
                      <TableHead className="w-[10%]">
                        <Skeleton className="h-4 w-16" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...Array(5)].map((_, i) => (
                      <TableRow key={`skeleton-${i}`}>
                        <TableCell className="py-4">
                          <Skeleton className="h-4 w-40" />
                        </TableCell>
                        <TableCell className="py-4">
                          <Skeleton className="h-4 w-28" />
                        </TableCell>
                        <TableCell className="py-4">
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell className="py-4">
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell className="py-4">
                          <Skeleton className="h-8 w-8" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <AlertTriangle className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No alerts configured yet</p>
              <Button
                variant="ghost"
                className="text-white hover:opacity-90 shadow-xs"
                style={{ backgroundColor: 'var(--primary)' }}
                onClick={() => router.push('/alerts/new')}
                data-testid="create-first-alert-btn"
              >
                <Plus className="h-4 w-4 mr-2" />
                CREATE YOUR FIRST ALERT
              </Button>
            </div>
          ) : (
            <div className="py-6">
              <div className="border rounded-lg bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-[30%] font-medium text-base">Name</TableHead>
                      <TableHead className="w-[20%] font-medium text-base">Schedule</TableHead>
                      <TableHead className="w-[20%] font-medium text-base">Last Checked</TableHead>
                      <TableHead className="w-[20%] font-medium text-base">Last Fired</TableHead>
                      <TableHead className="w-[10%] font-medium text-base">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map((alert) => (
                      <TableRow
                        key={alert.id}
                        data-testid={`alert-row-${alert.id}`}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/alerts/${alert.id}`)}
                      >
                        <TableCell className="py-4">
                          <div>
                            <span className="font-medium text-lg text-gray-900">{alert.name}</span>
                            {!alert.is_active && (
                              <span className="ml-2 text-xs text-muted-foreground bg-gray-100 px-1.5 py-0.5 rounded">
                                Paused
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 text-base text-gray-600">
                          {cronToString(alert.cron)}
                        </TableCell>
                        <TableCell className="py-4 text-base text-gray-600">
                          {alert.last_evaluated_at
                            ? formatDistanceToNow(new Date(alert.last_evaluated_at), {
                                addSuffix: true,
                              })
                            : '—'}
                        </TableCell>
                        <TableCell className="py-4 text-base text-gray-600">
                          {alert.last_fired_at
                            ? formatDistanceToNow(new Date(alert.last_fired_at), {
                                addSuffix: true,
                              })
                            : '—'}
                        </TableCell>
                        <TableCell className="py-4">
                          <div
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  data-testid={`alert-actions-${alert.id}`}
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 p-0 hover:bg-gray-100"
                                  aria-label="Alert actions"
                                >
                                  <MoreHorizontal className="w-4 h-4 text-gray-600" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  data-testid={`alert-view-${alert.id}`}
                                  onClick={() => router.push(`/alerts/${alert.id}`)}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  data-testid={`alert-edit-${alert.id}`}
                                  onClick={() => router.push(`/alerts/${alert.id}/edit`)}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  data-testid={`alert-delete-${alert.id}`}
                                  onClick={() => handleDelete(alert)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pagination Footer */}
      {!isLoading && alerts.length > 0 && (
        <div className="flex-shrink-0 border-t border-gray-100 bg-gray-50/30 py-3 px-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {total === 0
                ? '0–0 of 0'
                : `${startIndex + 1}–${Math.min(startIndex + pageSize, total)} of ${total}`}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Show</span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                    setPageSize(parseInt(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger
                    className="h-7 text-sm border-gray-200 bg-white"
                    style={{ width: '70px' }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="h-7 px-2 hover:bg-gray-100 disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-600 px-3 py-1">
                  {currentPage} of {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="h-7 px-2 hover:bg-gray-100 disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DeleteDialog />
    </div>
  );
}
