import posthog from 'posthog-js';
import {
  ANALYTICS_EVENTS,
  VALUE_ACTION_EVENTS,
  type AnalyticsEvent,
  type Feature,
} from '@/constants/analytics';

// Team email domains. Users on these are tagged is_internal so they can be
// filtered out of PostHog dashboards (they are NOT excluded from capture).
const INTERNAL_EMAIL_DOMAINS = ['projecttech4dev.org', 'dalgo.org'];

export function isInternalEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return INTERNAL_EMAIL_DOMAINS.some((domain) => lower.endsWith(`@${domain}`));
}

export function trackEvent(
  event: AnalyticsEvent,
  properties?: Record<string, unknown>,
  // `sendInstantly` flushes this one event immediately instead of batching it.
  // Use it right before a full-page navigation/reload (e.g. org switch) where a
  // queued event would otherwise be dropped when the page unloads.
  options?: { sendInstantly?: boolean }
): void {
  // Auto-stamp `is_value_action: true` on the North Star events (spec §2.1) so
  // the metric is one PostHog filter, not a hand-maintained event-name list.
  // Membership is defined once in VALUE_ACTION_EVENTS — call sites don't repeat it.
  const props = VALUE_ACTION_EVENTS.has(event)
    ? { ...properties, is_value_action: true }
    : properties;
  // Only pass a third argument when there is one — posthog treats an explicit
  // `undefined` fine, but omitting it keeps the common call two arguments wide.
  if (options?.sendInstantly) {
    posthog.capture(event, props, { send_instantly: true });
    return;
  }
  posthog.capture(event, props);
}

// Breadth event for feature-adoption: one fixed event, the feature/tab vary as
// properties (keeps the PostHog event list filterable).
export function trackFeatureView(feature: Feature, opts?: { tab?: string }): void {
  trackEvent(ANALYTICS_EVENTS.FEATURE_VIEWED, {
    feature,
    ...(opts?.tab ? { tab: opts.tab } : {}),
  });
}

// Identify by the Django auth_user PK (non-PII, stable per human). Email is
// NEVER sent — is_internal is derived locally from the email domain.
// role is sent two ways: as a super property (rides EVERY event, so it stays
// accurate per-event even when a multi-org user switches orgs) AND as a
// current_role person property (latest value, for visibility on the profile).
// No-ops if userId is falsy (e.g. backend not yet deployed with user_id), so
// analytics degrades gracefully instead of breaking.
export function identifyUser(
  userId: number,
  email: string,
  { role, workDomain }: { role?: string; workDomain?: string | null }
): void {
  if (!userId) return;
  // Migrate users still on the old email-based identity (from a previous build)
  // onto user_id. posthog.identify() won't override an already-identified
  // distinct_id, so we reset first when the current id looks like an email.
  const current = posthog.get_distinct_id?.();
  if (current && current.includes('@')) {
    posthog.reset();
  }
  posthog.identify(String(userId), {
    is_internal: isInternalEmail(email),
    current_role: role,
    // The user's work FUNCTION at the NGO (M&E / program / data-tech / leadership /
    // field), self-selected at signup. This is the spec's `function` segmentation
    // lens — answers "value for whom". Categorical enum, not PII.
    work_domain: workDomain ?? null,
  });
  posthog.register({ role });
}

// Organization context — the multi-tenant analysis lens (per-NGO). subscription_plan
// (Free Trial | Dalgo | Internal) is the segmentation dimension; it subsumes the
// old is_demo boolean, which the data model never actually sets.
//
// Sent three ways, each with a different job — do NOT drop any of them:
//  - the `organization` GROUP is the CANONICAL org dimension. It puts $group_0 on every
//    event, and the existing org metrics are built on it (unique_group aggregation, group
//    property filters on subscription_plan, and HogQL joins to `groups`). New org metrics
//    belong here too, or they stop being comparable with those.
//  - org_slug/org_name/org_plan as SUPER PROPERTIES — a convenience layer, not a second
//    source of truth. They ride every event as plain properties, which makes a quick
//    per-org or trial-only filter a one-liner with no group join. Re-registered on every
//    org switch (synchronously, unlike setPersonProperties), so a multi-org user's events
//    carry the org that was selected when they fired.
//  - current_org_* PERSON properties — profile visibility, and the only org signal on
//    events captured before the super properties existed. They show the user's LATEST org,
//    so prefer the group or the super properties for per-event questions.
export function identifyOrg(
  slug: string,
  {
    name,
    plan,
    onboardedDate,
  }: { name: string; plan?: string | null; onboardedDate?: string | null }
): void {
  posthog.group('organization', slug, {
    name,
    slug,
    subscription_plan: plan ?? null,
    // ISO 8601 onboarding date. client_tenure (new <90d / existing) is derived from
    // this in PostHog (a cohort/filter), NOT stored — so it never goes stale.
    onboarded_date: onboardedDate ?? null,
  });
  posthog.register({
    org_slug: slug,
    org_name: name,
    // Explicitly null (never omitted) — register() persists, so a missing key would leave
    // the previously selected org's plan riding every event after a switch.
    org_plan: plan ?? null,
  });
  posthog.setPersonProperties({
    current_org_slug: slug,
    current_org_name: name,
    current_subscription_plan: plan ?? null,
  });
}

export function resetAnalytics(): void {
  posthog.reset();
}
