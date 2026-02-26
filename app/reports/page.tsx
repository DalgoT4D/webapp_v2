'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Search, Calendar, Eye, Trash2, FileText, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useSnapshots, deleteSnapshot, type ReportSnapshot } from '@/hooks/api/useReports';
import { CreateSnapshotDialog } from '@/components/reports/create-snapshot-dialog';

export default function ReportsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { snapshots, isLoading, mutate } = useSnapshots(search || undefined);

  const handleDelete = async (id: number) => {
    try {
      await deleteSnapshot(id);
      mutate();
      toast.success('Snapshot deleted');
    } catch {
      toast.error('Failed to delete snapshot');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Immutable snapshots of your dashboards
          </p>
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

      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search reports..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : snapshots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No reports yet</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Create a report snapshot from any dashboard
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
        <div className="space-y-3">
          {snapshots.map((snapshot: ReportSnapshot) => (
            <Card
              key={snapshot.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => router.push(`/reports/${snapshot.id}`)}
            >
              <CardContent className="flex items-center justify-between py-4 px-5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium truncate">{snapshot.title}</h3>
                    {snapshot.status === 'generated' && (
                      <Badge variant="secondary" className="text-xs">
                        New
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(snapshot.period_start)} — {formatDate(snapshot.period_end)}
                      {snapshot.is_rolling_end && ' (till today)'}
                    </span>
                    {snapshot.dashboard_title && (
                      <span className="truncate max-w-48">From: {snapshot.dashboard_title}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/reports/${snapshot.id}`);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete snapshot?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete &quot;{snapshot.title}&quot;. This action
                          cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(snapshot.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
