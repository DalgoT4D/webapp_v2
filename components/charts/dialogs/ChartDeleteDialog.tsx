'use client';

import { useChartDashboards } from '@/hooks/api/useCharts';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface ChartDeleteDialogProps {
  chartId: number;
  chartTitle: string;
  onConfirm: () => void;
  isDeleting: boolean;
  children: React.ReactNode; // The trigger element
}

export function ChartDeleteDialog({
  chartId,
  chartTitle,
  onConfirm,
  isDeleting,
  children,
}: ChartDeleteDialogProps) {
  const { data: dashboards, isLoading: loadingDashboards } = useChartDashboards(chartId);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Chart</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <div>
              Are you sure you want to delete <strong>"{chartTitle}"</strong>? This action cannot be
              undone.
            </div>

            {/* Dashboard Usage Information */}
            <div className="border-t pt-3">
              <div className="text-sm font-medium text-gray-900 mb-2">Dashboard Usage</div>

              {loadingDashboards ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (
                <div>
                  {dashboards.length === 0 ? (
                    <p className="text-sm text-green-600">
                      ✓ This chart is not used in any dashboards
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-amber-600">
                        ⚠️ This chart is used in {dashboards.length} dashboard
                        {dashboards.length > 1 ? 's' : ''}:
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
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>CANCEL</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium uppercase"
          >
            {isDeleting ? 'DELETING...' : 'DELETE CHART'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
