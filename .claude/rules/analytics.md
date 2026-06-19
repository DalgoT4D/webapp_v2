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
- **Full CRUD per feature** — every feature fires `*_created`, `*_updated`, and `*_deleted` on the success path. In shared create/edit forms, guard so `*_created` fires only on the create branch and `*_updated` only on the update branch. Fire `*_deleted` after the delete API resolves (in the confirm handler). Charts/dashboards keep `*_saved` as their update event (don't add a parallel `*_updated`); still add `*_deleted`.
- **Long-running actions: fire on start, not outcome** — for async work (sync, pipeline run, dbt run) fire `*_triggered` once the request is accepted. Do **not** add success/failure/duration/rows-synced events to PostHog. By design those live elsewhere: **errors/failures → Sentry; operational outcomes & volume → internal dashboards** (sourced from the warehouse/backend). PostHog is scoped to product/feature-adoption only.
- **Never send PII or customer data** — identify by backend `user_id`, never email (email is used only locally to compute `is_internal`). Also **never send warehouse-data-derived strings**: no `schema_name`, `table_name`, column names, source/connection *instance* names, file names, or recipient emails. Safe properties are categorical types/enums (`chart_type`, `warehouse_type`, `source_type` = connector type, `aggregation`, `filter_type`), counts, booleans, and opaque internal IDs.
- **No purposeful action-button missed** — every button/control that calls an API, mutates state, or triggers work gets an event (view + full CRUD + primary-use run/sync/deploy/publish + share/export/download + invite/role/account actions). The test: "does clicking this *do* something?" → log it. Only skip pure UI mechanics with no analytic value: sort, filter, paginate, panel resize/minimize/fullscreen, a plain reload/refresh, back/nav buttons (destination is already covered by `feature:viewed`), and opening a form (the form's save is what fires).
