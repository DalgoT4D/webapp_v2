---
description: Testing strategy, file conventions, mocks, and the no-fake-tests rule.
paths:
  - "**/__tests__/**"
  - "e2e/**"
  - "test-utils/**"
  - "jest.setup.ts"
  - "jest.config.ts"
---

# Testing Strategy

## Critical Principles

- **NEVER fake tests to pass.** Do not change expected values or assertions just to make a test green. A failing test is a signal — we debug it together. If a test fails ~4-5 times, stop and explain why.
- **Tests reflect real behavior** — assertions match actual expected behavior, not adjusted to match wrong output.
- **Failing tests are valuable** — they reveal bugs or misunderstandings.
- **Explain untestable code** — if something can't be tested or covered, state the specific reason; a human decides what to do.
- **No blind fixes** — if unclear, ask.

## File Conventions

- **Location**: tests live in `__tests__/` **inside** the component directory (`components/pipeline/__tests__/`, `components/notifications/__tests__/`). No separate `__tests__/integration/` or `__tests__/components/` folders — integration tests go in the component's own `__tests__/` (e.g. `notifications.integration.test.tsx`).
- **Mock data factories**: a `*-mock-data.ts` file in `__tests__/` with factory functions (`createMockPipeline()`, `createMockNotification()`) — see `components/pipeline/__tests__/pipeline-mock-data.ts`.
- **Global API mocks**: API is mocked globally in `jest.setup.ts`; use `mockApiGet`/`mockApiPut` from `test-utils/api.ts` for typed references.
- **Test wrappers**: use `TestWrapper` from `test-utils/render.tsx` for SWR isolation (fresh cache, no dedupe, no polling).
- **Permissions**: mock `useUserPermissions` from `@/hooks/api/usePermissions` — never mock `useAuthStore` directly for permission checks.
- **Imports**: relative paths for siblings (`../ComponentName`), mock data from `./*-mock-data`.

## What to Test

- **Unit**: utility functions and hooks in isolation; mock API via SWR utilities; focus on logic and edge cases.
- **Component**: React Testing Library, user-centric; test behavior and interactions; mock heavy deps like chart libraries.
- **E2E**: Playwright, in `/e2e/`. Authenticated tests need `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`.

```
components/charts/
├── ChartBuilder.tsx
└── __tests__/
    ├── ChartBuilder.test.tsx
    └── charts-mock-data.ts
```
