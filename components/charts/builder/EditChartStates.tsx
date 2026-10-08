'use client';

import { Lock, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

/** The chart loaded but the caller lacks edit access to it. */
export function EditChartAccessDenied({ onBack }: { onBack: () => void }) {
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-6 h-6 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-4">You don&apos;t have edit access to this chart.</p>
        <Button variant="outline" onClick={onBack} data-testid="chart-edit-access-denied-back-btn">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Charts
        </Button>
      </div>
    </div>
  );
}

/** Skeleton while the saved chart loads. */
export function EditChartLoading() {
  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="flex-1 flex overflow-hidden p-8">
        <div className="flex w-full h-full bg-white rounded-lg shadow-sm border overflow-hidden">
          <Skeleton className="w-[30%] h-full" />
          <Skeleton className="w-[70%] h-full" />
        </div>
      </div>
    </div>
  );
}

/** The chart request failed (`hasError`) or returned nothing. */
export function EditChartNotFound({ hasError }: { hasError: boolean }) {
  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <h1 className="text-xl font-semibold">Edit Chart</h1>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <Alert className="max-w-2xl">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {hasError ? 'Chart needs attention' : 'Chart not found'}
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
