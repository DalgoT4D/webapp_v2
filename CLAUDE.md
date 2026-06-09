# CLAUDE.md

Guidance for Claude Code when working in **webapp_v2** — the Next.js 15 / React 19 frontend for Dalgo, a data intelligence platform (dashboards, charts, data viz, analytics).

> **How this repo's guidance is organized:** This file holds only always-applicable rules. Detailed, area-specific guidance lives in `.claude/rules/*.md` and loads automatically when you open files in that area (see the map at the bottom). Don't dump reference prose back into this file — keep it lean.

## Essential Commands

```bash
# Development
npm run dev                    # Dev server with Turbopack on port 3001
npm run build                  # Production build
npm run start                  # Production server on port 3001

# Unit tests (Jest)
npm run test                   # Run all unit tests
npm run test -- path/to/file   # Run a specific test file
npm run test -- --testNamePattern="name"  # Run tests matching a pattern
npm run test:coverage          # Coverage report

# E2E (Playwright)
npx playwright test                    # All E2E tests
npx playwright test e2e/login.spec.ts  # Specific file
# Authenticated E2E needs E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD env vars

# Quality
npm run lint                   # ESLint
npm run format:write           # Prettier (auto-stages)
```

## Tech Stack

Next.js 15 (App Router) · React 19 · TypeScript (`strict: false`, selective strict options) · Tailwind CSS v4 · **Zustand** (global state) · **SWR** (server state) · **Radix UI** (headless primitives) · **ECharts** (all charts) · **React Hook Form** · Jest + RTL (unit) · Playwright (E2E).

## Architecture Map

```
webapp_v2/
├── app/            # App Router pages (charts, dashboards, reports, pipeline, settings, …)
├── components/
│   ├── ui/         # Radix-based reusable primitives (GLOBAL — don't edit without asking)
│   ├── charts/     # Chart builder + chart-type renderers   → rules/charts.md
│   ├── dashboard/  # Dashboard builder (grid, cells, filters) → rules/dashboards.md
│   ├── dashboards/ # Dashboard list/management
│   ├── reports/    # Report snapshots + sharing             → rules/reports.md
│   ├── pipeline/   # Pipeline feature (reference implementation)
│   └── <feature>/  # Each feature owns its components + utils.ts + constants.ts
├── hooks/api/      # SWR read hooks + standalone mutation fns → rules/api-hooks.md
├── stores/         # Zustand stores (authStore)
├── lib/            # Global utils: api.ts, toast.ts, analytics.ts, utils.ts
├── constants/      # App-wide constants (analytics events, chart types, …)
└── types/          # API response interfaces (charts.ts, dashboard.ts, …)
```

## Core Conventions (always apply)

**API & auth**
- All API calls go through `lib/api.ts` (`apiGet`, `apiPost`, …) — never `fetch` directly. It injects `credentials: 'include'`, the `x-dalgo-org` header, and auto-refreshes JWT on 401 (cookies are HTTP-only; the frontend never handles tokens).

**State**
- `useState` for local UI state · **Zustand** for cross-route global state (auth, selected org) · **SWR** for server data (caching/revalidation) · **React Hook Form** for complex forms. Full decision tree → `rules/components.md`.

**Required attributes on interactive elements**
- `data-testid` on every interactive element (kebab-case; include IDs for list items: `pipeline-row-${id}`).
- `id` on form elements referenced by a `<Label htmlFor>`.
- `key` on every list item — a stable unique ID, **never the array index**.

**Toasts** — use `toastSuccess` / `toastError` / `toastInfo` / `toastPromise` from `lib/toast.ts`. **Never call `toast()` directly.**

**Analytics (review-blocker)** — instrument every new feature (view + key actions). Details and the event-naming rules → `rules/analytics.md`.

**TypeScript** — never use `any` or bare `object`/`{}`; define interfaces for API responses. If a type is genuinely unknown, ask rather than guessing. Strict mode is off, so be extra careful.

**No magic numbers** — extract to a named constant with a comment explaining the value.

**No barrel exports** — we don't use `index.ts` re-export files.

**Shared components** — **never modify `components/ui/` (or other shared/base components) without telling the user first** and explaining the change. Prefer enhancing an existing component over creating a new one.

**Tests** — **never** change expected values or assertions just to make a test pass. A failing test is a signal to investigate, not to silence. If it fails ~4-5 times, stop and explain why. Full testing rules → `rules/testing.md`.

## Naming

- Components `PascalCase.tsx` · hooks `useThing.ts` · utilities `kebab-case.ts` · constants `kebab-case.ts`.
- Hook naming: `useCharts` (list), `useChart` (single), `useCreateChart` (mutation).
- `SCREAMING_SNAKE_CASE` for true constants, `camelCase` for config objects, `PascalCase` for types/interfaces.

## Common Gotchas

- **Build errors ignored** — TS and ESLint errors don't fail the build. Rely on tests/lint during dev; don't assume a green build means type-correct.
- **Client-only APIs** — guard browser APIs with `typeof window !== 'undefined'`.
- **Org context** — multi-tenant; API calls depend on the selected org.
- **Token refresh** — a call may be delayed by an automatic refresh attempt.
- **SWR stale cache on navigation** — SWR returns cached data immediately when navigating, which makes edit forms capture stale `useMemo`/`defaultValues`. Fix: (1) invalidate with `useSWRConfig().mutate(key, undefined, { revalidate: false })` after mutations, and (2) give form components a `key` that includes critical fields so they remount when data changes.

## Where detailed rules live (auto-loaded by path)

**Cross-cutting (load on most edits):**

| Working in… | Rule that loads | Covers |
|---|---|---|
| `components/**`, `app/**` | `rules/components.md` | Component architecture, memoization, page layout, color/theme, forms, accessibility, reusability |
| `hooks/api/**` | `rules/api-hooks.md` | SWR hook conventions, mutation functions, caching, API error handling |
| `**/__tests__/**`, `e2e/**` | `rules/testing.md` | Testing strategy, file conventions, mocks |
| `lib/analytics.ts`, `constants/analytics.ts` | `rules/analytics.md` | PostHog event instrumentation |

**Per-feature domain maps (load only in that feature):**

| Feature area | Rule that loads | Nav section |
|---|---|---|
| `components/charts/**`, `app/charts/**` | `rules/charts.md` | Analytics → Charts |
| `components/dashboard*/**`, `app/dashboards/**` | `rules/dashboards.md` | Analytics → Dashboards |
| `components/reports/**`, `app/reports/**` | `rules/reports.md` | Analytics → Reports |
| `components/kpis/**`, `app/kpis/**` | `rules/kpis.md` | Analytics → KPIs |
| `components/metrics/**`, `app/metrics/**` | `rules/metrics.md` | Data → Metrics |
| `components/ingest/**`, `components/connections/**`, `components/connectors/**`, `app/ingest/**` | `rules/ingest.md` | Data → Ingest (Airbyte) |
| `components/transform/**`, `app/transform/**` | `rules/transform.md` | Data → Transform (dbt canvas) |
| `components/pipeline/**`, `app/pipeline/**`, `app/orchestrate/**` | `rules/pipeline.md` | Data → Overview / Orchestrate (Prefect) |
| `components/explore/**`, `app/explore/**` | `rules/explore.md` | Data → Explore |
| `components/data-quality/**`, `app/data-quality/**` | `rules/data-quality.md` | Data → Quality (Elementary) |
| `components/settings/**`, `app/settings/**` | `rules/settings.md` | Settings |
