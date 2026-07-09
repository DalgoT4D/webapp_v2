'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { OAUTH_BROADCAST_CHANNEL } from '@/components/connectors/oauth-popup';

/**
 * OAuth landing page. Variant A: Google redirects the popup to the Dalgo BACKEND
 * callback, which exchanges the code server-side and then 302s the popup here carrying
 * only a single-use `ref` (or an `error`). We hand that back to the opener window (the
 * source form / wizard) and close. The opener redeems the `ref` when it creates the
 * source; the auth code and refresh token never reach the browser.
 *
 * The popup arrived here after navigating cross-origin through Google, whose pages send
 * Cross-Origin-Opener-Policy and sever `window.opener`. So the primary handoff is a
 * same-origin BroadcastChannel (both windows are our origin); postMessage is a fallback.
 */
function AirbyteOAuthCallbackContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get('ref') ?? undefined;
    const error = searchParams.get('error') ?? undefined;
    const message = { source: 'airbyte-oauth', ref, error };

    // Primary: BroadcastChannel — reaches the opener even when COOP severed window.opener.
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(OAUTH_BROADCAST_CHANNEL);
      channel.postMessage(message);
      channel.close();
    }

    // Fallback: direct postMessage when the opener link is still intact.
    if (window.opener) {
      window.opener.postMessage(message, window.location.origin);
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
