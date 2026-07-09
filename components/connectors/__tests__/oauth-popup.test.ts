/**
 * Tests for openOAuthPopup — the popup + localStorage handshake used by the
 * "Connect with Google" flow (Variant A). The popup navigates cross-origin through
 * Google (COOP severs window.opener), so the callback hands the ref back via localStorage
 * and this opener polls for it.
 */

import { openOAuthPopup, OAUTH_RESULT_STORAGE_KEY } from '../oauth-popup';

describe('openOAuthPopup', () => {
  let fakePopup: { closed: boolean; close: jest.Mock };

  beforeEach(() => {
    localStorage.clear();
    fakePopup = { closed: false, close: jest.fn() };
    jest.spyOn(window, 'open').mockReturnValue(fakePopup as unknown as Window);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

    await expect(promise).resolves.toEqual({ ref: 'ref-abc' });
    expect(fakePopup.close).toHaveBeenCalled();
    // the result is consumed (single-use)
    expect(localStorage.getItem(OAUTH_RESULT_STORAGE_KEY)).toBeNull();
  });

  it('rejects when the callback stores an error', async () => {
    const promise = openOAuthPopup('https://accounts.google.com/x');

    localStorage.setItem(OAUTH_RESULT_STORAGE_KEY, JSON.stringify({ error: 'access_denied' }));

    await expect(promise).rejects.toThrow(/access_denied/i);
  });

  it('clears a stale result from a previous flow at start', async () => {
    // a leftover result must NOT be picked up as this flow's outcome
    localStorage.setItem(OAUTH_RESULT_STORAGE_KEY, JSON.stringify({ ref: 'stale-ref' }));

    const promise = openOAuthPopup('https://accounts.google.com/x');
    fakePopup.closed = true; // user closes without a fresh result

    await expect(promise).rejects.toThrow(/google sign-in was cancelled/i);
  });

  it('rejects when the user closes the popup without finishing', async () => {
    const promise = openOAuthPopup('https://accounts.google.com/x');

    fakePopup.closed = true;

    await expect(promise).rejects.toThrow(/google sign-in was cancelled/i);
  });
});
