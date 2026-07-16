'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { OAUTH_RESULT_STORAGE_KEY } from '@/components/connectors/oauth-popup';

/**
 * OAuth landing page. Variant A: Google redirects the popup to the Dalgo BACKEND
 * callback, which exchanges the code server-side and then 302s the popup here carrying
 * only a single-use `ref` (or an `error`). The opener redeems the `ref` when it creates
 * the source; the auth code and refresh token never reach the browser.
 *
 * The popup arrived here after navigating cross-origin through Google, whose pages send
 * Cross-Origin-Opener-Policy and sever `window.opener`. So we hand the result back by
 * writing it to localStorage (shared across all same-origin contexts, immune to COOP);
 * the opener polls for it. Then we close.
 */
function AirbyteOAuthCallbackContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get('ref') ?? undefined;
    const error = searchParams.get('error') ?? undefined;

    try {
      localStorage.setItem(OAUTH_RESULT_STORAGE_KEY, JSON.stringify({ ref, error }));
    } catch {
      // ignore
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
