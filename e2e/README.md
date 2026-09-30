# E2E suite — charts · dashboards · reports

Pre-refactor **guard suite**. It pins what the app does **today** so a refactor can be checked row by row against [coverage/MATRIX.md](coverage/MATRIX.md).

## Run

Run against a **production build** (`npm run build && npm run start`) — the dev server is slow and can wedge under load.

```bash
npm run e2e                                             # EVERYTHING: parallel projects, then `isolated` (list-count specs) alone
npm run e2e:inventory:verify                            # fail if any recorded test was removed/renamed (run after refactor)
npm run e2e:inventory:record                            # re-lock the inventory (only when adding tests intentionally)
npx playwright test --project=chromium                  # all authenticated specs (runs setup → tests → teardown)
npx playwright test --project=chromium e2e/charts       # one area
npx playwright test --project=public                    # logged-out: login + *.public.spec.ts
npx playwright test --update-snapshots <file>           # (re)write baselines — ONLY on pre-refactor main
npx playwright show-report
```

### No real emails

The test users are aliases of one real inbox. `support/email-guard.ts` **blocks** every call that would send a notification email (share grants, grant level changes, access requests + responses, report email, invites, @mentions of real org users) and fails the test with `EMAIL GUARD: …`.
- Tests that genuinely need those calls are tagged **`@sends-email`** (14 tests) and are **excluded by default**. Run them occasionally with `E2E_ALLOW_EMAIL=on npm run e2e`.
- In a new test, either intercept the call with `page.route(...).fulfill()`, mention only `@example.com` addresses, or tag it `@sends-email`.

### Baselines are local-only

The payload JSON / journal files and PNG screenshots under `e2e/__snapshots__/` are **gitignored**. They were recorded from the **pre-refactor** code and live only on the machine that recorded them.

- Comparisons are **off by default** — anyone who pulls the repo runs the pure E2E flows (all UI/navigation/state assertions still run).
- Turn them on locally in `.env`: `E2E_PAYLOAD_SNAPSHOTS=on` and `E2E_SCREENSHOTS=on`.
- **Before starting the refactor, back them up once** — they can't be re-recorded after the code changes (re-recording would capture the new behavior as "expected"):
  `zip -r ~/Desktop/e2e-baselines-pre-refactor.zip e2e/__snapshots__` → store outside the repo.
- **Never run `git clean -fdx`** in this worktree — it deletes ignored files, including the baselines.
- A clone / other machine won't have them — copy the folder (or unzip the backup) there.
- Multi-step specs (`perm-*`) store **one journal per test** (`<test>-<hash>-journal.json`, see `support/journal.ts`) instead of one file per step.

Needs `.env` (gitignored): `NEXT_PUBLIC_BACKEND_URL=https://staging-api.dalgo.org`, `E2E_ADMIN_EMAIL/PASSWORD`, optional `E2E_MEMBER_*` / `E2E_ANALYST_*`.

## Layout

```
e2e/
  support/        env, api-client, fixtures (test/expect), payload capture, render helpers
  charts/         *.spec.ts  (+ helpers.ts for page objects of that area)
  dashboards/
  reports/
  cross/          flows spanning areas
  *.public.spec.ts  logged-out specs (public share links) — run in the `public` project
  coverage/       inventories + MATRIX.md (the checklist)
  __snapshots__/  payload JSON + screenshot baselines (committed)
```

## Rules

1. **Import from `support/fixtures`**, not `@playwright/test`: `import { test, expect } from '../support/fixtures';`
2. **Seed objects are read-only** (`SEED` in `support/env.ts`). View, filter, export them — never edit, re-share, favorite, set-landing or delete them. For anything that mutates, create your own object.
3. **Every created object is named with `e2eTitle('name')`** and either created through `factory` (auto-cleaned) or registered with `track('charts', id)` right after the UI creates it (read the id from the URL or the captured response).
4. **Selectors:** `getByTestId` first → `getByRole`/`getByLabel` → never CSS classes or DOM structure. The testid contract is in PR #384. If an element truly has no testid, use role/label and note it in the test with `// TODO testid`.
5. **Assert behavior, not implementation.** Each MATRIX row lists its assert type:
   - `UI` — visible text/state (`toBeVisible`, `toHaveText`, `toBeDisabled`, `toHaveURL`)
   - `PAY` — `captureRequest` + `expectPayloadSnapshot` on the request the action sends. **Main refactor guard — use it on every save/create/update/apply.**
   - `SHOT` — `expectChartScreenshot(locator, name)` on the chart container only (not whole page). Prefer charts **you created** on `production.mart_*` over seed charts.
   - `NAV` — `toHaveURL`
6. **Pin current behavior, including bugs.** If the app does something odd, assert what it does now and prefix the title with `[pinned]`, with a one-line comment on why. Don't "fix" by asserting the expected behavior.
7. **No fixed sleeps** except the named constants in `support/render.ts`. Wait on responses (`page.waitForResponse`), testids, or `expect.poll`.
8. **Independence:** every test sets up its own state; tests run in parallel (`fullyParallel`). No test depends on another's side effects. `test.describe.serial` only when unavoidable.
9. **Email / PDF export** hit slow backend renderers → intercept with `page.route` (assert request payload, `route.fulfill({ status: 200, … })`) or `test.skip` with reason "manual". Never send real email.
10. **Roles:** permission tests use `const p = await pageAs('member')`; they auto-skip when creds are missing.
11. **Stable = green 3× in a row.** A test that flakes is fixed or removed, never retried into green.
12. **Skips fail the run** (`coverage/skip-budget.json`, budget 0). A skipped test can't catch a regression.
13. **Specs counting org-wide lists** (totals, pagination) go in `ISOLATED_SPECS` in `playwright.config.ts` — they run alone after everything else.
14. **Naming:** file per MATRIX section (`charts/list.spec.ts`); test title starts with MATRIX id: `test('C-L6 favorite toggle persists after reload', …)`.
