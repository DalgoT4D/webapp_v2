'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';

/** Skeleton shown while the dashboard loads. */
export function DashboardViewLoading() {
  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-12 gap-4">
          <Skeleton className="col-span-6 h-64" />
          <Skeleton className="col-span-6 h-64" />
          <Skeleton className="col-span-4 h-48" />
          <Skeleton className="col-span-8 h-48" />
        </div>
      </div>
    </div>
  );
}

/** "Dashboard Not Found" card with a way back to the list. */
export function DashboardViewNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6">
          <div className="text-center">
            <h2 className="text-lg font-semibold mb-2">Dashboard Not Found</h2>
            <p className="text-sm text-muted-foreground mb-4">
              The dashboard you're looking for doesn't exist or you don't have access to it.
            </p>
            <Button onClick={onBack} data-testid="dashboard-view-not-found-back-btn">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboards
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
