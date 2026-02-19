'use client';

import { Loader2 } from 'lucide-react';
import { useElementaryStatus } from '@/hooks/api/useElementaryStatus';
import { DbtNotConfigured } from './dbt-not-configured';
import { ElementarySetup } from './elementary-setup';
import { ElementaryReport } from './elementary-report';

export function DataQuality() {
  const { status, isLoading, error, mutate } = useElementaryStatus();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="data-quality-loader">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // DBT not configured — API returns an error with this specific message
  if (error) {
    const errorMessage =
      error?.message === 'dbt is not configured for this client'
        ? error.message
        : 'Failed to check Elementary status. Please try again.';
    return (
      <div className="p-6">
        <DbtNotConfigured message={errorMessage} />
      </div>
    );
  }

  if (status === 'not-set-up') {
    return (
      <div className="p-6">
        <ElementarySetup onSetupComplete={() => mutate()} />
      </div>
    );
  }

  if (status === 'set-up') {
    return (
      <div className="p-6 h-full">
        <ElementaryReport />
      </div>
    );
  }

  return null;
}
