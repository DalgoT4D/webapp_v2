/**
 * Opens the Google consent screen in a popup and resolves with an opaque OAuth
 * `ref` once our callback page (app/oauth/airbyte/callback) hands it back.
 *
 * Variant A: Google redirects the popup to the Dalgo BACKEND callback, which exchanges
 * the code server-side and 302s the popup to our frontend callback page carrying only a
 * single-use `ref` (never the auth code or the refresh token).
 *
 * Handoff channel: the popup navigates cross-origin through Google, whose pages send
 * Cross-Origin-Opener-Policy, which SEVERS `window.opener` — so a popup→opener
 * postMessage can't be relied on. We use a same-origin BroadcastChannel as the primary
 * channel (both windows are our own origin, so it's still same-origin-only and safe), and
 * keep postMessage as a fallback for flows where the opener link survives.
 */

/** Message our OAuth callback page hands back to the opener */
export interface OAuthCallbackMessage {
  source: 'airbyte-oauth';
  ref?: string;
  error?: string;
}

/** Same-origin channel name shared by the popup callback and this opener */
export const OAUTH_BROADCAST_CHANNEL = 'airbyte-oauth';

const OAUTH_POPUP_WIDTH = 600;
const OAUTH_POPUP_HEIGHT = 700;
// how often to check whether the user closed the popup manually
const POPUP_CLOSE_POLL_MS = 500;

export function openOAuthPopup(authUrl: string): Promise<{ ref: string }> {
  return new Promise((resolve, reject) => {
    const left = window.screenX + (window.outerWidth - OAUTH_POPUP_WIDTH) / 2;
    const top = window.screenY + (window.outerHeight - OAUTH_POPUP_HEIGHT) / 2;
    const popup = window.open(
      authUrl,
      'airbyte-google-oauth',
      `width=${OAUTH_POPUP_WIDTH},height=${OAUTH_POPUP_HEIGHT},left=${left},top=${top}`
    );

    if (!popup) {
      reject(new Error('Popup was blocked. Please allow popups and try again.'));
      return;
    }

    let settled = false;
    const channel =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel(OAUTH_BROADCAST_CHANNEL)
        : null;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      channel?.close();
      clearInterval(closeTimer);
    };

    const handle = (data: OAuthCallbackMessage | undefined) => {
      // our own marker guards against unrelated channel/message traffic
      if (settled || !data || data.source !== 'airbyte-oauth') return;

      settled = true;
      cleanup();
      try {
        popup.close();
      } catch {
        // opener may have lost access to the popup after the cross-origin hops; the
        // callback page closes itself, so this is best-effort only
      }

      if (data.error || !data.ref) {
        reject(new Error(data.error || 'Google sign-in was cancelled'));
      } else {
        resolve({ ref: data.ref });
      }
    };

    // Primary: BroadcastChannel — reaches us even when COOP severed window.opener.
    if (channel) {
      channel.onmessage = (event) => handle(event.data as OAuthCallbackMessage);
    }

    // Fallback: direct postMessage when the opener link survives (still origin-checked).
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      handle(event.data as OAuthCallbackMessage);
    };
    window.addEventListener('message', onMessage);

    const closeTimer = setInterval(() => {
      if (popup.closed && !settled) {
        cleanup();
        reject(new Error('Google sign-in was cancelled'));
      }
    }, POPUP_CLOSE_POLL_MS);
  });
}
