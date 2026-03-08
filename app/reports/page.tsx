'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow, format, isThisYear } from 'date-fns';
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
import { FileText, MoreVertical, Plus, Share2, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';
import { useSnapshots, deleteSnapshot, type ReportSnapshot } from '@/hooks/api/useReports';
import { CreateSnapshotDialog } from '@/components/reports/create-snapshot-dialog';

export default function ReportsPage() {
  const router = useRouter();
  const { snapshots, isLoading, mutate } = useSnapshots();
  const [deleteTarget, setDeleteTarget] = useState<ReportSnapshot | null>(null);

  const handleDelete = async (id: number) => {
    try {
      await deleteSnapshot(id);
      mutate();
      setDeleteTarget(null);
      toast.success('Report deleted');
    } catch {
      toast.error('Failed to delete report');
    }
  };

  const formatCreatedOn = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    // Within last 7 days: relative time
    if (diffDays < 7) {
      return formatDistanceToNow(date, { addSuffix: true });
    }

    // This year: "12 Feb"
    if (isThisYear(date)) {
      return format(date, 'd MMM');
    }

    // Older: "20 Dec 2025"
    return format(date, 'd MMM yyyy');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground mt-1">Create And Manage Your Reports</p>
        </div>
        <CreateSnapshotDialog
          onCreated={() => mutate()}
          trigger={
            <Button>
              <Plus className="h-4 w-4 mr-1" /> Create Report
            </Button>
          }
        />
      </div>

      {/* Table */}
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
              <Button variant="outline">
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
                      <Button variant="ghost" size="icon" title="Share">
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/reports/${snapshot.id}`)}>
                            <FileText className="h-4 w-4 mr-2" />
                            Related Reports
                          </DropdownMenuItem>
                          <DropdownMenuItem
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

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete report?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteTarget?.title}&quot;. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && handleDelete(deleteTarget.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
