'use client';

import { useKPIDashboards } from '@/hooks/api/useKPIs';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface KPIDeleteDialogProps {
  kpiId: number | null;
  kpiName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

export function KPIDeleteDialog({
  kpiId,
  kpiName,
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: KPIDeleteDialogProps) {
  const { data: dashboards, isLoading: loadingDashboards } = useKPIDashboards(open ? kpiId : null);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete KPI</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div>
                Are you sure you want to delete <strong>&quot;{kpiName}&quot;</strong>? This action
                cannot be undone.
              </div>

              <div className="border-t pt-3">
                <div className="text-sm font-medium text-gray-900 mb-2">Dashboard Usage</div>

                {loadingDashboards ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ) : dashboards.length === 0 ? (
                  <p className="text-sm text-green-600">
                    &#10003; This KPI is not used in any dashboards
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-amber-600">
                      &#9888;&#65039; This KPI is used in {dashboards.length} dashboard
                      {dashboards.length > 1 ? 's' : ''}. Remove it from these dashboards before
                      deleting.
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {dashboards.map((dashboard) => (
                        <div
                          key={dashboard.id}
                          className="flex items-center justify-between text-xs p-2 bg-amber-50 rounded border"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{dashboard.title}</div>
                            <Badge variant="outline" className="mt-1 text-xs">
                              {dashboard.dashboard_type}
                            </Badge>
                          </div>
                          <Link
                            href={`/dashboards/${dashboard.id}`}
                            className="ml-2 text-blue-600 hover:text-blue-800"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>CANCEL</AlertDialogCancel>
          {dashboards.length === 0 && (
            <AlertDialogAction
              onClick={onConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium uppercase"
              disabled={isDeleting}
            >
              {isDeleting ? 'DELETING...' : 'DELETE KPI'}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
