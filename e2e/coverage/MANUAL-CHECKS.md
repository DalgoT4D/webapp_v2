# Manual checks (not automated — verify by hand after the refactor)

These features are deliberately **not** covered by the E2E suite. Each has a reason. After the refactor, walk through this list on staging and tick each item.

| ✓ | Feature | Why manual | How to check |
|---|---|---|---|
| [ ] | **Set / remove org default landing dashboard** (dashboard list row menu, and view page landing dropdown) | Changes org-wide state for every user | Set an e2e dashboard as org default → `/impact` shows it → set the original back |
| [ ] | **"Congratulations, your Chart is live!"** modal after saving during onboarding | Finishing the walkthrough is saved to the user's real onboarding state | Fresh trial user → start insight walkthrough → save a chart |
| [ ] | **"Congratulations, you're officially live!"** modal when copying the public link during onboarding | Same — onboarding state | Fresh trial user → onboarding → share → copy link |
| [ ] | **Superset dashboard view** (Share, Refresh, Open in Superset) and **`/dashboards/usage`** with Superset | Test org has no Superset (`viz_url` null) | Org with Superset → open a Superset dashboard and the usage dashboard |
| [ ] | **Report PDF export — real file** (content, layout, org logo, applied filters) | Backend renderer is slow; tests intercept the request and assert its payload | Report viewer → Download PDF → open file |
| [ ] | **Report "Email PDF" — real delivery** | Tests never send real email; they intercept and assert the payload | Send to yourself → check inbox + attachment |
| [ ] | **Edit lock released on browser/tab close** | Page-close unlock uses a beacon posted to a relative URL (pinned bug); can't be observed reliably in headless | Open builder → close tab → second user can edit without waiting for lock expiry |
| [ ] | **Setting a default value for a dashboard dropdown filter** | Product gap — no UI exists (pinned) | Confirm still no UI (or, if added during refactor, write a test) |

## Opt-in: email-sending tests (`@sends-email`, 14 tests)

Excluded from the default run because they send real notification emails to the test inbox. Run occasionally (e.g. once before and once after the refactor):
`E2E_ALLOW_EMAIL=on npx playwright test --project=chromium -g "@sends-email"`
Covers: people grants (chart / dashboard / report), View↔Edit grant change, access request approve/deny, Request Edit, transfer ownership + takeover, invite-by-email as non-admin, second-author comment indicators / new-comment dot / deleted placeholders, role-gated report list, report comment moderation.

## Staging backend issues (report to backend team)

| Issue | Effect on tests |
|---|---|
| `GET /api/warehouse/column-values/…` → 500 `'PostgresClient' object has no attribute 'engine'` | Filter value dropdowns fall back to text inputs; dropdown variants are tested with a stubbed endpoint |
| `POST /api/charts/chart-data-preview/` for map filter values → 500 "At least one metric is required" | Map filter value list untestable against real data |
