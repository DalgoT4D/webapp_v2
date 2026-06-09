---
description: SWR data-fetching hook conventions, mutation functions, caching, and API error handling.
paths:
  - "hooks/api/**"
---

# API Hooks (SWR) Conventions

All server data flows through SWR read hooks + standalone async mutation functions in `hooks/api/`. All network calls go through `lib/api.ts` (`apiGet`/`apiPost`/`apiPut`/`apiDelete`) — never `fetch` directly.

## Conventions

- **File naming**: plural — `useCharts.ts`, `usePipelines.ts`.
- **Hook naming**: `useFeatures` (list), `useFeature` (single), `useCreateFeature` (mutation hook).
- **Read hooks return** `{ data, isLoading, isError, mutate }`.
- **Conditional fetching**: pass `null` as the SWR key when data isn't ready — `id ? \`/api/charts/${id}/\` : null`.
- **Mutations**: standalone async functions (not hooks) that call the API and let callers `mutate()` the cache.

```ts
export async function triggerAction(id: string): Promise<void> {
  return apiPost(`/api/features/${id}/action/`, {});
}
```

- **Types**: define interfaces in the hook file or import from `types/`.
- **Smart polling**: use a `refreshInterval` callback for dynamic polling (see `usePipelines` for the pattern: poll faster while locked/running, stop when idle).
- **SWR options**: `revalidateOnFocus: false` for data that rarely changes.

**Reference hooks**: `useCharts.ts` (read), `useChart.ts` (reads + mutation fns), `usePipelines.ts` (polling).

## Caching

SWR caches and deduplicates automatically. After a mutation, call `mutate` to refresh. Use unique, stable SWR keys. To force-invalidate a cache entry (e.g. before an edit form remounts): `useSWRConfig().mutate(key, undefined, { revalidate: false })`.

## API Error Handling

`lib/api.ts` handles auth errors and token refresh automatically and throws `Error` objects with meaningful messages. In components, wrap calls in try/catch and surface failures via `toastError` (from `lib/toast.ts`).
