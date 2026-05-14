'use client';

import * as Sentry from '@sentry/nextjs';

export default function SentryTestPage() {
  const throwSyncError = () => {
    throw new Error(`Sentry sync test ${Date.now()}`);
  };

  const throwAsyncError = () => {
    setTimeout(() => {
      throw new Error(`Sentry async test ${Date.now()}`);
    }, 0);
  };

  const rejectPromise = () => {
    Promise.reject(new Error(`Sentry promise rejection test ${Date.now()}`));
  };

  const manualCapture = () => {
    Sentry.captureException(new Error(`Sentry manual capture test ${Date.now()}`));
  };

  return (
    <div className="p-8 space-y-4 max-w-md">
      <h1 className="text-2xl font-bold">Sentry Test Page</h1>
      <p className="text-sm text-muted-foreground">
        Each button triggers a different error type. Watch the Network tab (filter "sentry") and
        your Sentry dashboard.
      </p>

      <div className="flex flex-col gap-2">
        <button
          onClick={throwSyncError}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          data-testid="sentry-throw-sync-btn"
        >
          Throw sync error (event handler)
        </button>

        <button
          onClick={throwAsyncError}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          data-testid="sentry-throw-async-btn"
        >
          Throw async error (setTimeout)
        </button>

        <button
          onClick={rejectPromise}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          data-testid="sentry-reject-promise-btn"
        >
          Unhandled promise rejection
        </button>

        <button
          onClick={manualCapture}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          data-testid="sentry-manual-capture-btn"
        >
          Manual Sentry.captureException
        </button>
      </div>
    </div>
  );
}
