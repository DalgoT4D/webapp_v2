/**
 * Opens the Google consent screen in a popup and resolves with an opaque OAuth `ref`.
 *
 * Variant A: Google redirects the popup to the Dalgo BACKEND callback, which exchanges
 * the code server-side and 302s the popup to our frontend callback page carrying only a
 * single-use `ref` (never the auth code or the refresh token).
 *
 * Handoff: the popup navigates cross-origin through Google, whose pages send
 * Cross-Origin-Opener-Policy, which severs `window.opener` — so postMessage can't be used.
 * Instead the callback page writes the result to localStorage (shared across all
 * same-origin contexts, unaffected by COOP) and this opener polls for it.
 */

/** Result the callback page writes to localStorage for the opener to pick up */
export interface OAuthResult {
  ref?: string;
  error?: string;
}

/** localStorage key the popup callback and this opener agree on (same-origin only) */
export const OAUTH_RESULT_STORAGE_KEY = 'airbyte-oauth-result';

const OAUTH_POPUP_WIDTH = 600;
const OAUTH_POPUP_HEIGHT = 700;
// how often to poll for the stored result / a manually-closed popup
const POPUP_POLL_MS = 500;
// Google's COOP headers can trigger a browsing-context-group swap that makes the
// opener observe `popup.closed === true` while the popup is actually alive and the
// user is still on the consent screen. A single closed reading is therefore not a
// reliable cancel signal. Only treat the popup as cancelled after it reads closed for
// this many consecutive polls with no result — by then a real redirect would have
// written its result to localStorage (which the poll checks first and wins on).
const POPUP_CLOSE_GRACE_POLLS = 4;

export function openOAuthPopup(authUrl: string): Promise<{ ref: string }> {
  return new Promise((resolve, reject) => {
    // drop any stale result from a previous attempt before we start
    try {
      localStorage.removeItem(OAUTH_RESULT_STORAGE_KEY);
    } catch {
      // ignore
    }

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

    let closedPolls = 0;
    const timer = setInterval(() => {
      // 1. did the callback store a result?
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(OAUTH_RESULT_STORAGE_KEY);
      } catch {
        // ignore
      }

      if (raw) {
        clearInterval(timer);
        try {
          localStorage.removeItem(OAUTH_RESULT_STORAGE_KEY);
        } catch {
          // ignore
        }
        try {
          popup.close();
        } catch {
          // best-effort; the callback page closes itself too
        }

        let result: OAuthResult;
        try {
          result = JSON.parse(raw);
        } catch {
          reject(new Error('Google sign-in failed'));
          return;
        }
        if (result.error || !result.ref) {
          reject(new Error(result.error || 'Google sign-in was cancelled'));
        } else {
          resolve({ ref: result.ref });
        }
        return;
      }

      // 2. user closed the popup without finishing — but tolerate a transient
      // COOP false-close (see POPUP_CLOSE_GRACE_POLLS). Only cancel once the popup
      // has read closed for several consecutive polls with no result arriving.
      if (popup.closed) {
        closedPolls += 1;
        if (closedPolls >= POPUP_CLOSE_GRACE_POLLS) {
          clearInterval(timer);
          reject(new Error('Google sign-in was cancelled'));
        }
      } else {
        closedPolls = 0;
      }
    }, POPUP_POLL_MS);
  });
}
