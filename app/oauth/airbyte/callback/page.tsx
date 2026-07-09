'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * OAuth landing page. Variant A: Google redirects the popup to the Dalgo BACKEND
 * callback, which exchanges the code server-side and then 302s the popup here
 * carrying only a single-use `ref` (or an `error`). We relay that back to the opener
 * window (the source form / wizard) and close. The opener redeems the `ref` when it
 * creates the source; the auth code and refresh token never reach the browser.
 */
function AirbyteOAuthCallbackContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get('ref') ?? undefined;
    const error = searchParams.get('error') ?? undefined;

    if (window.opener) {
      window.opener.postMessage({ source: 'airbyte-oauth', ref, error }, window.location.origin);
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
