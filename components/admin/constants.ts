/**
 * Shared constants for the admin portal.
 *
 * EMAIL_RE is the portal's authoritative email check — the invite forms set
 * `noValidate` so the browser's native type=email check can't preempt our own error
 * messages, which makes this regex the only thing standing between a typo and a
 * bounced invitation.
 */
export const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
