'use client';

import { Loader2 } from 'lucide-react';
import { useElementaryStatus } from '@/hooks/api/useElementaryStatus';
import { DbtNotConfigured } from './dbt-not-configured';
import { ElementarySetup } from './elementary-setup';
import { ElementaryReport } from './elementary-report';

export function DataQuality() {
  const { status, isLoading, isError, mutate } = useElementaryStatus();

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full" data-testid="data-quality-loader">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (isError) {
      const errorMessage =
        isError?.message === 'dbt is not configured for this client'
          ? isError.message
          : 'Failed to check Elementary status. Please try again.';
      return <DbtNotConfigured message={errorMessage} />;
    }

    if (status === 'not-set-up') {
      return <ElementarySetup onSetupComplete={() => mutate()} />;
    }

    if (status === 'set-up') {
      return <ElementaryReport />;
    }

    return null;
  };

  return (
    <div id="data-quality-container" className="h-full flex flex-col">
      {/* Fixed Header */}
      <div id="data-quality-header" className="flex-shrink-0 border-b bg-background">
        <div className="flex items-center justify-between mb-6 p-6 pb-0">
          <div>
            <h1 className="text-3xl font-bold">Data Quality</h1>
            <p className="text-muted-foreground mt-1">
              Monitor and manage your data quality with Elementary
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6 mt-6">
        <div className="h-full overflow-y-auto">{renderContent()}</div>
      </div>
    </div>
  );
}
