/**
 * Opens the Google consent screen in a popup and resolves with the OAuth
 * { code, state } once our callback page (app/oauth/airbyte/callback) posts them
 * back. The callback page runs on the same origin, so we only trust messages from
 * our own origin and our own marker — never a cross-origin sender.
 */

/** Message our OAuth callback page posts back to the opener window */
export interface OAuthCallbackMessage {
  source: 'airbyte-oauth';
  code?: string;
  state?: string;
  error?: string;
}

const OAUTH_POPUP_WIDTH = 600;
const OAUTH_POPUP_HEIGHT = 700;
// how often to check whether the user closed the popup manually
const POPUP_CLOSE_POLL_MS = 500;

export function openOAuthPopup(consentUrl: string): Promise<{ code: string; state: string }> {
  return new Promise((resolve, reject) => {
    const left = window.screenX + (window.outerWidth - OAUTH_POPUP_WIDTH) / 2;
    const top = window.screenY + (window.outerHeight - OAUTH_POPUP_HEIGHT) / 2;
    const popup = window.open(
      consentUrl,
      'airbyte-google-oauth',
      `width=${OAUTH_POPUP_WIDTH},height=${OAUTH_POPUP_HEIGHT},left=${left},top=${top}`
    );

    if (!popup) {
      reject(new Error('Popup was blocked. Please allow popups and try again.'));
      return;
    }

    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      clearInterval(closeTimer);
    };

    const onMessage = (event: MessageEvent) => {
      // trust only our own origin and our own callback marker
      if (event.origin !== window.location.origin) return;
      const data = event.data as OAuthCallbackMessage;
      if (!data || data.source !== 'airbyte-oauth') return;

      settled = true;
      cleanup();
      popup.close();

      if (data.error || !data.code) {
        reject(new Error(data.error || 'Google sign-in was cancelled'));
      } else {
        resolve({ code: data.code, state: data.state ?? '' });
      }
    };

    const closeTimer = setInterval(() => {
      if (popup.closed && !settled) {
        cleanup();
        reject(new Error('Google sign-in was cancelled'));
      }
    }, POPUP_CLOSE_POLL_MS);

    window.addEventListener('message', onMessage);
  });
}
