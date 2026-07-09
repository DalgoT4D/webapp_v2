/**
 * Tests for openOAuthPopup — the popup + postMessage handshake used by the
 * "Connect with Google" flow (Variant A). Focus: it resolves with the opaque `ref`
 * on a valid same-origin message and ignores messages from a different origin or with
 * the wrong marker (the security guard).
 */

import { openOAuthPopup } from '../oauth-popup';

describe('openOAuthPopup', () => {
  let fakePopup: { closed: boolean; close: jest.Mock };

  beforeEach(() => {
    fakePopup = { closed: false, close: jest.fn() };
    jest.spyOn(window, 'open').mockReturnValue(fakePopup as unknown as Window);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects when the popup is blocked', async () => {
    (window.open as jest.Mock).mockReturnValueOnce(null);
    await expect(openOAuthPopup('https://accounts.google.com/x')).rejects.toThrow(
      /popup was blocked/i
    );
  });

  it('resolves with the ref from a valid same-origin message', async () => {
    const promise = openOAuthPopup('https://accounts.google.com/x');

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { source: 'airbyte-oauth', ref: 'ref-abc' },
      })
    );

    await expect(promise).resolves.toEqual({ ref: 'ref-abc' });
    expect(fakePopup.close).toHaveBeenCalled();
  });

  it('ignores messages from a different origin', async () => {
    const promise = openOAuthPopup('https://accounts.google.com/x');

    // a forged message from another origin must be ignored
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://evil.example.com',
        data: { source: 'airbyte-oauth', ref: 'attacker-ref' },
      })
    );

    let settled = false;
    promise.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      }
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(settled).toBe(false);

    // a real same-origin message still resolves it
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { source: 'airbyte-oauth', ref: 'real-ref' },
      })
    );
    await expect(promise).resolves.toEqual({ ref: 'real-ref' });
  });

  it('ignores a same-origin message with the wrong marker (defense-in-depth)', async () => {
    const promise = openOAuthPopup('https://accounts.google.com/x');

    // right origin, but not our callback marker — must be ignored
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { source: 'evil', ref: 'attacker-ref' },
      })
    );

    let settled = false;
    promise.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      }
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(settled).toBe(false);

    // a real same-origin airbyte-oauth message still resolves it
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { source: 'airbyte-oauth', ref: 'real-ref' },
      })
    );
    await expect(promise).resolves.toEqual({ ref: 'real-ref' });
  });

  it('rejects when the user closes the popup manually', async () => {
    const promise = openOAuthPopup('https://accounts.google.com/x');

    // simulate the user closing the popup so the close-poll interval detects it
    fakePopup.closed = true;

    await expect(promise).rejects.toThrow(/google sign-in was cancelled/i);
  });

  it('rejects when the callback relays an error param', async () => {
    const promise = openOAuthPopup('https://accounts.google.com/x');

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { source: 'airbyte-oauth', error: 'access_denied' },
      })
    );

    await expect(promise).rejects.toThrow(/access_denied/i);
  });
});
