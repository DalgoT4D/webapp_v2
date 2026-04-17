// Root-level error boundary with Sentry reporting.
// Catches unhandled errors at the top of the component tree (above the root layout).
// Reports them to Sentry via captureException and shows a fallback UI.
// Must include its own <html> and <body> tags because it replaces the entire page.
'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  );
}
