/**
 * Unit tests for the free-trial feature helpers.
 *
 * Covers: client-side password rules (which stand in for Django's live validators)
 * and the backend step → display index mapping moved out of the progress page.
 */

import {
  validateTrialPassword,
  inboxUrlForEmail,
  backendStepToDisplayIndex,
  deriveCurrentIndex,
} from '../utils';
import type { TrialProgressStep } from '@/types/trial';

describe('validateTrialPassword', () => {
  it('accepts a password that clears every rule', () => {
    expect(validateTrialPassword('curious-otter-42')).toBeNull();
  });

  it('rejects a password shorter than the minimum', () => {
    expect(validateTrialPassword('short1')).toBe('Password must be at least 8 characters');
  });

  // Mirrors Django's NumericPasswordValidator, which runs server-side on activate.
  it('rejects an entirely numeric password even when it is long enough', () => {
    expect(validateTrialPassword('12345678901')).toBe('Password cannot be entirely numbers');
  });

  it('accepts a long password that merely contains digits', () => {
    expect(validateTrialPassword('otter12345')).toBeNull();
  });

  // Mirrors Django's CommonPasswordValidator. Without this the server returns a 400
  // the client cannot distinguish from an expired link.
  it('rejects a common password', () => {
    expect(validateTrialPassword('password1')).toBe(
      'This password is too common. Please choose a different one'
    );
  });

  it('matches common passwords case-insensitively', () => {
    expect(validateTrialPassword('PassWord1')).toBe(
      'This password is too common. Please choose a different one'
    );
  });

  it('only rejects common entries that would otherwise pass the other rules', () => {
    // "sunshine" is 8 chars and not numeric, so it reaches the common-password check.
    expect(validateTrialPassword('sunshine')).not.toBeNull();
  });
});

describe('inboxUrlForEmail', () => {
  it('resolves a known webmail domain', () => {
    expect(inboxUrlForEmail('jane@gmail.com')).toBe('https://mail.google.com/mail/u/0/#inbox');
  });

  it('matches the domain case-insensitively', () => {
    expect(inboxUrlForEmail('Jane@GMAIL.com')).toBe('https://mail.google.com/mail/u/0/#inbox');
  });

  // Most NGO users are on a custom domain — the caller hides the button rather than
  // guessing a provider they don't use.
  it('returns null for an unknown domain', () => {
    expect(inboxUrlForEmail('jane@some-ngo.org')).toBeNull();
  });

  it('returns null for a null or malformed address', () => {
    expect(inboxUrlForEmail(null)).toBeNull();
    expect(inboxUrlForEmail('not-an-email')).toBeNull();
  });
});

describe('backendStepToDisplayIndex', () => {
  it('maps the backend 1-based step onto the 0-based label index', () => {
    expect(backendStepToDisplayIndex(1)).toBe(0);
    expect(backendStepToDisplayIndex(7)).toBe(6);
  });

  it('returns null for a step outside the known range', () => {
    expect(backendStepToDisplayIndex(99)).toBeNull();
  });
});

describe('deriveCurrentIndex', () => {
  it('returns 0 for an empty or missing history', () => {
    expect(deriveCurrentIndex(undefined)).toBe(0);
    expect(deriveCurrentIndex([])).toBe(0);
  });

  it('uses the latest numeric step', () => {
    const progress: TrialProgressStep[] = [
      { step: 1, message: 'Creating workspace', status: 'running' },
      { step: 3, message: 'Connecting sources', status: 'running' },
    ];
    expect(deriveCurrentIndex(progress)).toBe(2);
  });

  // A single drifted label must not roll the bar back to zero.
  it('walks backwards past an unrecognised event to the nearest known step', () => {
    const progress: TrialProgressStep[] = [
      { step: 2, message: 'Setting up warehouse', status: 'running' },
      { message: 'some unrecognised message', status: 'running' },
    ];
    expect(deriveCurrentIndex(progress)).toBe(1);
  });

  it('falls back to matching the message against the known labels', () => {
    const progress: TrialProgressStep[] = [{ message: 'Building pipelines', status: 'running' }];
    expect(deriveCurrentIndex(progress)).toBe(3);
  });

  // Regression: a freshly queued or just-retried clone rendered every step as done.
  it('returns the FIRST step when the history holds only non-step markers', () => {
    const progress: TrialProgressStep[] = [{ message: 'queued', status: 'queued' }];
    expect(deriveCurrentIndex(progress)).toBe(0);
  });
});
