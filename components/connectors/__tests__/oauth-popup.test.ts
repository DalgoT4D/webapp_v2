/**
 * Tests for openOAuthPopup — the popup + localStorage handshake used by the
 * "Connect with Google" flow (Variant A). The popup navigates cross-origin through
 * Google (COOP severs window.opener), so the callback hands the ref back via localStorage
 * and this opener polls for it.
 */

import { openOAuthPopup, OAUTH_RESULT_STORAGE_KEY } from '../oauth-popup';

// One poll interval (see POPUP_POLL_MS in oauth-popup.ts). Kept local so the tests
// can drive the fake clock one tick at a time.
const POLL_MS = 500;

describe('openOAuthPopup', () => {
  let fakePopup: { closed: boolean; close: jest.Mock };

  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    fakePopup = { closed: false, close: jest.fn() };
    jest.spyOn(window, 'open').mockReturnValue(fakePopup as unknown as Window);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    localStorage.clear();
  });

  it('rejects when the popup is blocked', async () => {
    (window.open as jest.Mock).mockReturnValueOnce(null);
    await expect(openOAuthPopup('https://accounts.google.com/x')).rejects.toThrow(
      /popup was blocked/i
    );
  });

  it('resolves with the ref once the callback stores the result', async () => {
    const promise = openOAuthPopup('https://accounts.google.com/x');

    // the callback page writes the result to localStorage after Google redirects it back
    localStorage.setItem(OAUTH_RESULT_STORAGE_KEY, JSON.stringify({ ref: 'ref-abc' }));
    await jest.advanceTimersByTimeAsync(POLL_MS);

    await expect(promise).resolves.toEqual({ ref: 'ref-abc' });
    expect(fakePopup.close).toHaveBeenCalled();
    // the result is consumed (single-use)
    expect(localStorage.getItem(OAUTH_RESULT_STORAGE_KEY)).toBeNull();
  });

  it('rejects when the callback stores an error', async () => {
    const promise = openOAuthPopup('https://accounts.google.com/x');
    // attach the rejection handler before advancing the clock so the reject that
    // fires inside the timer is not flagged as an unhandled rejection
    const settled = expect(promise).rejects.toThrow(/access_denied/i);

    localStorage.setItem(OAUTH_RESULT_STORAGE_KEY, JSON.stringify({ error: 'access_denied' }));
    await jest.advanceTimersByTimeAsync(POLL_MS);

    await settled;
  });

  it('clears a stale result from a previous flow at start', async () => {
    // a leftover result must NOT be picked up as this flow's outcome
    localStorage.setItem(OAUTH_RESULT_STORAGE_KEY, JSON.stringify({ ref: 'stale-ref' }));

    const promise = openOAuthPopup('https://accounts.google.com/x');
    const settled = expect(promise).rejects.toThrow(/google sign-in was cancelled/i);
    fakePopup.closed = true; // user closes without a fresh result

    // grace window must elapse before a close counts as a cancel
    await jest.advanceTimersByTimeAsync(POLL_MS * 10);

    await settled;
  });

  it('rejects when the user closes the popup without finishing', async () => {
    const promise = openOAuthPopup('https://accounts.google.com/x');
    const settled = expect(promise).rejects.toThrow(/google sign-in was cancelled/i);

    fakePopup.closed = true;
    await jest.advanceTimersByTimeAsync(POLL_MS * 10);

    await settled;
  });

  it('resolves when a COOP-severed popup reads as closed but the result lands within the grace window', async () => {
    // Google's COOP headers can make the opener observe popup.closed === true while the
    // popup is still alive and the user is mid-consent. The real ref lands a few polls
    // later. A single closed reading must NOT cancel — the late result wins.
    const promise = openOAuthPopup('https://accounts.google.com/x');
    fakePopup.closed = true;

    // two polls where the popup already reads closed and no result exists yet
    await jest.advanceTimersByTimeAsync(POLL_MS);
    await jest.advanceTimersByTimeAsync(POLL_MS);

    // the callback finally writes the real ref
    localStorage.setItem(OAUTH_RESULT_STORAGE_KEY, JSON.stringify({ ref: 'late-ref' }));
    await jest.advanceTimersByTimeAsync(POLL_MS);

    await expect(promise).resolves.toEqual({ ref: 'late-ref' });
  });
});
