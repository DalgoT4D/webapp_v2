'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FileText, MoreVertical, Plus, Trash2, User } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';
import { useSnapshots, deleteSnapshot } from '@/hooks/api/useReports';
import type { ReportSnapshot } from '@/types/reports';
import { CreateSnapshotDialog } from '@/components/reports/create-snapshot-dialog';
import { formatCreatedOn } from '@/components/reports/utils';

export default function ReportsPage() {
  const router = useRouter();
  const { snapshots, isLoading, mutate } = useSnapshots();
  const [deleteTarget, setDeleteTarget] = useState<ReportSnapshot | null>(null);

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteSnapshot(id);
        mutate();
        setDeleteTarget(null);
        toastSuccess.deleted('Report');
      } catch (error) {
        toastError.delete(error, 'report');
      }
    },
    [mutate]
  );

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0 border-b bg-background">
        <div className="flex items-center justify-between mb-6 p-6 pb-0">
          <div>
            <h1 className="text-3xl font-bold">Reports</h1>
            <p className="text-muted-foreground mt-1">Create And Manage Your Reports</p>
          </div>
          <CreateSnapshotDialog
            onCreated={() => mutate()}
            trigger={
              <Button
                data-testid="create-report-btn"
                variant="ghost"
                className="text-white hover:opacity-90 shadow-xs"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <Plus className="h-4 w-4 mr-2" /> Create Report
              </Button>
            }
          />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6 mt-6">
        <div className="h-full overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No reports yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Create a report from any dashboard
              </p>
              <CreateSnapshotDialog
                onCreated={() => mutate()}
                trigger={
                  <Button data-testid="create-first-report-btn" variant="outline">
                    <Plus className="h-4 w-4 mr-1" /> Create Your First Report
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left text-sm font-semibold px-6 py-3">Title</th>
                    <th className="text-left text-sm font-semibold px-6 py-3">Dashboard Used</th>
                    <th className="text-left text-sm font-semibold px-6 py-3">Created by</th>
                    <th className="text-left text-sm font-semibold px-6 py-3">Created on</th>
                    <th className="text-right text-sm font-semibold px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((snapshot: ReportSnapshot) => (
                    <tr
                      key={snapshot.id}
                      data-testid={`report-row-${snapshot.id}`}
                      className="border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => router.push(`/reports/${snapshot.id}`)}
                    >
                      <td className="px-6 py-4 text-sm">{snapshot.title}</td>
                      <td className="px-6 py-4 text-sm">{snapshot.dashboard_title || '—'}</td>
                      <td className="px-6 py-4 text-sm">
                        {snapshot.created_by && (
                          <span className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {snapshot.created_by}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {formatCreatedOn(snapshot.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                data-testid={`report-actions-${snapshot.id}`}
                                variant="ghost"
                                size="icon"
                                aria-label="Report actions"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                data-testid={`report-view-${snapshot.id}`}
                                onClick={() => router.push(`/reports/${snapshot.id}`)}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                View Report
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                data-testid={`report-delete-${snapshot.id}`}
                                onClick={() => setDeleteTarget(snapshot)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent data-testid="delete-report-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete report?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteTarget?.title}&quot;. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-report-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="delete-report-confirm"
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
