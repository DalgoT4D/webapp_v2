import posthog from 'posthog-js';
import type { AnalyticsEvent } from '@/constants/analytics';

// Team email domains. Users on these are tagged is_internal so they can be
// filtered out of PostHog dashboards (they are NOT excluded from capture).
const INTERNAL_EMAIL_DOMAINS = ['projecttech4dev.org', 'dalgo.org'];

export function isInternalEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return INTERNAL_EMAIL_DOMAINS.some((domain) => lower.endsWith(`@${domain}`));
}

export function trackEvent(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  posthog.capture(event, properties);
}

export function identifyUser(email: string, { role }: { role?: string }): void {
  posthog.identify(email, {
    email,
    is_internal: isInternalEmail(email),
    role,
  });
}

export function identifyOrg(slug: string, name: string): void {
  // 'organization' group type — the multi-tenant analysis lens (per-NGO).
  posthog.group('organization', slug, { name });
}

export function resetAnalytics(): void {
  posthog.reset();
}
