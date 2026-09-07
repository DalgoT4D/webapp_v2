'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface IngestErrorCardProps {
  /** Re-fetch the warehouse + sources that failed. */
  onRetry: () => void;
}

/**
 * Shown when the warehouse or sources fetch failed. This is deliberately NOT one of the
 * empty states: a failed call tells us nothing about what the org has, so offering
 * "set up your warehouse" here would ask people to re-create infrastructure they already
 * own. SWR retries on its own too — this is the manual escape hatch once it gives up.
 */
export function IngestErrorCard({ onRetry }: IngestErrorCardProps) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-full px-6 py-12"
      data-testid="ingest-error"
    >
      <div className="w-full max-w-md flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="mt-6 text-2xl font-bold text-foreground">Couldn&apos;t load your data</h2>
        <p className="mt-2 text-base text-muted-foreground">
          We couldn&apos;t reach the server to check your warehouse and sources. Nothing has changed
          — try again in a moment.
        </p>
        <Button
          variant="primary"
          className="uppercase mt-6"
          onClick={onRetry}
          data-testid="ingest-error-retry-btn"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    </div>
  );
}
