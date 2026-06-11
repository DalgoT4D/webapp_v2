---
description: PostHog analytics instrumentation rules — event naming, where to fire, what not to send.
paths:
  - "lib/analytics.ts"
  - "constants/analytics.ts"
---

# Analytics & Feature Tracking (PostHog)

**Instrument every new feature** — breadth (a feature is visited) and depth (key actions). Skipping analytics on a new feature is a review-blocker.

- **Event names live in `constants/analytics.ts`** — fixed strings in `category:object_action` snake_case. Never interpolate variables into a name; pass them as properties. Add new events to `ANALYTICS_EVENTS`.
- **Fire via `trackEvent(ANALYTICS_EVENTS.X, { props })`** from `lib/analytics.ts`, in the **success path** (after the API call resolves), **fire-and-forget** — never `await` it, never let it throw into the handler.
- **New page/route/tab** → add to the `FEATURES` map + `PATHNAME_TO_FEATURE` in `constants/analytics.ts`; `feature:viewed` then fires automatically on navigation. Tabs (local/query state) need an explicit `trackFeatureView(FEATURES.X, { tab })` in the tab `onChange`.
- **Don't add user/org/role to event properties** — PostHog auto-attaches the person (`user_id`, `is_internal`) and the `organization` group via `identify`/`group`. Only add properties that segment *within* an event (e.g. `chart_type`, `format`, `is_public`).
- **Create events guard to the create branch** — in shared create/edit forms, fire `*_created` only on create, not update.
- **Never send PII** — identify by backend `user_id`, never email. Email is used only locally to compute the `is_internal` boolean; the email string is never sent.
- **Adoption-focused depth** — instrument view + create + primary-use (run/sync/deploy) + share/export + invite. Skip low-signal noise (sort, filter, resize, favorite, delete).
