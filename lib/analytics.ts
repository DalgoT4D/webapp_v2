import posthog from 'posthog-js';
import type { AnalyticsEvent, Feature } from '@/constants/analytics';

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

// Breadth event for feature-adoption: one fixed event, the feature/tab vary as
// properties (keeps the PostHog event list filterable).
export function trackFeatureView(feature: Feature, opts?: { tab?: string }): void {
  posthog.capture('feature:viewed', {
    feature,
    ...(opts?.tab ? { tab: opts.tab } : {}),
  });
}

// Identify by the Django auth_user PK (non-PII, stable per human). Email is
// NEVER sent — is_internal is derived locally from the email domain. role is
// org-specific, so it is registered as a super property (rides every event and
// refreshes on org switch). No-ops if userId is falsy (e.g. backend not yet
// deployed with user_id), so analytics degrades gracefully instead of breaking.
export function identifyUser(userId: number, email: string, { role }: { role?: string }): void {
  if (!userId) return;
  posthog.identify(String(userId), { is_internal: isInternalEmail(email) });
  posthog.register({ role });
}

// Organization group — the multi-tenant analysis lens (per-NGO). subscription_plan
// (Free Trial | Dalgo | Internal) is the segmentation dimension; it subsumes the
// old is_demo boolean, which the data model never actually sets.
export function identifyOrg(
  slug: string,
  { name, plan }: { name: string; plan?: string | null }
): void {
  posthog.group('organization', slug, {
    name,
    slug,
    subscription_plan: plan ?? null,
  });
}

export function resetAnalytics(): void {
  posthog.reset();
}
