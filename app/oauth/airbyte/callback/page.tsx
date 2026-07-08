'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * OAuth landing page. Google redirects the popup here after the user consents.
 * We relay the code/state back to the opener window (the source form) and close.
 * The opener validates the state and completes the flow with the backend.
 */
function AirbyteOAuthCallbackContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code') ?? undefined;
    const state = searchParams.get('state') ?? undefined;
    const error = searchParams.get('error') ?? undefined;

    if (window.opener) {
      window.opener.postMessage(
        { source: 'airbyte-oauth', code, state, error },
        window.location.origin
      );
    }
    window.close();
  }, [searchParams]);

  return (
    <div
      className="flex min-h-screen items-center justify-center text-sm text-muted-foreground"
      data-testid="airbyte-oauth-callback"
    >
      Completing Google sign-in… you can close this window.
    </div>
  );
}

export default function AirbyteOAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <AirbyteOAuthCallbackContent />
    </Suspense>
  );
}
