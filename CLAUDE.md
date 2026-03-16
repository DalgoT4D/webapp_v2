# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is webapp_v2, a modern Next.js 15 React 19 web application that serves as the frontend for Dalgo - a data intelligence platform. The application features a comprehensive dashboard system with data visualization, analytics, and reporting capabilities.

## Essential Development Commands

```bash
# Development
npm run dev                    # Start dev server with Turbopack on port 3001
npm run build                  # Production build
npm run start                  # Start production server on port 3001

# Unit Testing (Jest)
npm run test                   # Run all Jest unit tests
npm run test -- path/to/file   # Run specific test file
npm run test -- --testNamePattern="test name"  # Run tests matching pattern
npm run test:watch             # Run tests in watch mode
npm run test:coverage          # Generate coverage report
npm run test:ci                # Run tests in CI mode with coverage

# E2E Testing (Playwright)
npx playwright test                        # Run all E2E tests
npx playwright test e2e/login.spec.ts      # Run specific E2E test file
npx playwright test --project=chromium     # Run on specific browser
npx playwright test --ui                   # Run with interactive UI
# Note: E2E tests require E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD env vars for authenticated tests

# Code Quality
npm run lint                   # Run ESLint linting
npm run format:check           # Check code formatting with Prettier
npm run format:write           # Format code and auto-stage changes
```

## High-Level Architecture

### Technology Stack

- **Framework**: Next.js 15 with App Router and React 19
- **Language**: TypeScript (with relaxed strictness)
- **Styling**: Tailwind CSS v4 with utility-first approach
- **State Management**: Zustand for global state, SWR (stale-while-revalidate) for server state caching
- **UI Components**: Radix UI headless components with custom styling
- **Charts**: ECharts for interactive visualizations
- **Forms**: React Hook Form with validation
- **Testing**: Jest + React Testing Library (unit), Playwright (E2E)
- **Development**: Turbopack for fast builds, Husky for Git hooks

### Directory Structure

```
webapp_v2/
├── app/                      # Next.js App Router pages
│   ├── charts/              # Chart management and builder
│   ├── dashboards/          # Dashboard CRUD operations
│   ├── data-quality/        # Data quality management
│   ├── explore/             # Data exploration
│   ├── impact/              # Impact tracking
│   ├── ingest/              # Data ingestion workflows
│   ├── login/               # Authentication pages
│   ├── notifications/       # Notification management
│   ├── orchestrate/         # Orchestration management
│   ├── pipeline/            # Pipeline management
│   ├── settings/            # Application settings
│   ├── share/               # Shared/public dashboard views
│   └── transform/           # Data transformation tools
├── components/
│   ├── ui/                  # Reusable Radix-based UI components (GLOBAL)
│   ├── charts/              # Chart-specific components
│   ├── dashboard/           # Dashboard builder components
│   ├── dashboards/          # Dashboard list and management
│   ├── pipeline/            # Pipeline-specific components
│   └── settings/            # Settings-specific components
├── hooks/
│   ├── api/                 # SWR-based API hooks
│   └── [custom hooks]       # Utility hooks (toast, mobile, etc.)
├── stores/                  # Zustand stores (currently just authStore)
├── lib/                     # Global utilities (API client, SWR config, utils)
└── constants/               # Application constants (GLOBAL)
```

### Key Architectural Patterns

#### 1. **Authentication & API Integration**
- **Cookie-based Authentication**: Backend sets HTTP-only cookies containing JWT tokens; frontend never handles tokens directly
- **Automatic Token Refresh**: On 401 response, `lib/api.ts` calls `/api/v2/token/refresh` with `credentials: 'include'` and retries the original request
- **Organization Context**: Multi-tenant with `x-dalgo-org` header
- **Centralized API Client**: All API calls go through `lib/api.ts` which includes `credentials: 'include'` on every request

```typescript
// API calls automatically include cookies and handle token refresh
import { apiGet, apiPost } from '@/lib/api';
const data = await apiGet('/api/charts');
```

#### 2. **State Management Strategy**
- **Global State**: Zustand stores for authentication and app-wide state
- **Server State**: SWR for data fetching with built-in caching and revalidation
- **Form State**: React Hook Form for complex form handling
- **Local State**: React useState for component-specific state

```typescript
// Authentication state (cookies handled by browser, org selection in localStorage)
const { selectedOrgSlug, setSelectedOrg, isAuthenticated } = useAuthStore();

// Server state with automatic caching
const { data: charts, error, mutate } = useCharts();
```

#### 3. **Component Architecture**
- **Composition Pattern**: Building UIs from focused, single-responsibility components
- **Headless UI**: Radix UI for accessible, unstyled primitives
- **Variant-based Styling**: Using CVA (Class Variance Authority) for component variants
- **Client/Server Split**: Next.js renders components on the server by default. Add `'use client'` at the top of a file when the component needs browser APIs, hooks (useState, useEffect), or event handlers

```typescript
// Typical component pattern
const MyComponent = ({ variant = 'default', ...props }) => {
  return (
    <Button variant={variant} className={cn('custom-styles', className)}>
      {children}
    </Button>
  );
};
```

#### 4. **Data Visualization Architecture**
- **ECharts**: Primary charting library for all visualizations
- **Unified Interface**: Common wrapper components for consistent API
- **Dynamic Chart Types**: Runtime configuration for different visualization types
- **Dashboard Builder**: Drag-and-drop dashboard creation with grid layout

#### 5. **Error Handling & UX**
- **Error Boundaries**: React error boundaries for graceful failure handling
- **Toast Notifications**: Sonner for user feedback
- **Loading States**: Built into SWR hooks and components
- **Auth Redirects**: Automatic redirect to login on auth failure (except public routes)

### Important Configuration Details

#### Build & Development
- **TypeScript**: Configured with `strict: false` but selective strict options enabled
- **Build Errors Ignored**: Both TypeScript and ESLint errors ignored during build
- **Coverage Thresholds**: Set to minimal 1% for all metrics
- **Path Aliases**: `@/*` maps to project root for clean imports
- **No barrel exports**: We don't use `index.ts` barrel exports

#### Testing Setup
- **Jest Configuration**: Custom setup with module name mapping for path aliases
- **Coverage Collection**: Includes components, app, lib, hooks, and stores directories
- **Component Testing**: React Testing Library with jsdom environment
- **E2E Testing**: Playwright configured in `playwright.config.ts`, tests in `/e2e/` directory

#### Environment & API
- **Backend URL**: Configurable via `NEXT_PUBLIC_BACKEND_URL` (defaults to localhost:8002)
- **E2E Base URL**: `E2E_BASE_URL` env var to test against staging/production
- **Local Storage**: Used for organization selection (auth tokens are in HTTP-only cookies)
- **CORS**: Handled by backend, frontend makes direct API calls

## Development Patterns to Follow

### Component Attributes (Required)
Always add these attributes to interactive components for testability and debugging:

- **`data-testid`**: Required for all interactive elements (buttons, inputs, rows, etc.)
  - Use descriptive, kebab-case names: `data-testid="create-pipeline-btn"`
  - Include unique identifiers for list items: `data-testid="pipeline-row-${id}"`
- **`id`**: Required for form elements and elements referenced by labels
- **`key`**: Required for all items in lists/arrays (use unique identifiers, not array indices)

```typescript
// Example: Button with testid
<Button data-testid="submit-btn" onClick={handleSubmit}>Submit</Button>

// Example: List items with dynamic testids
{items.map((item) => (
  <div key={item.id} data-testid={`item-row-${item.id}`}>
    <button data-testid={`delete-btn-${item.id}`}>Delete</button>
  </div>
))}

// Example: Form element with id for label association
<Label htmlFor="pipeline-name">Name</Label>
<Input id="pipeline-name" data-testid="pipeline-name-input" />
```

### Component Attributes (Required)
Always add these attributes to interactive components for testability and debugging:

- **`data-testid`**: Required for all interactive elements (buttons, inputs, rows, etc.)
  - Use descriptive, kebab-case names: `data-testid="create-pipeline-btn"`
  - Include unique identifiers for list items: `data-testid="pipeline-row-${id}"`
- **`id`**: Required for form elements and elements referenced by labels
- **`key`**: Required for all items in lists/arrays (use unique identifiers, not array indices)

```typescript
export async function triggerAction(id: string): Promise<void> {
  return apiPost(`/api/features/${id}/action/`, {});
}
```

**Key conventions:**
- **File naming**: `useFeatures.ts` (plural for the hook file)
- **Hook naming**: `useFeatures` (list), `useFeature` (single), `useCreateFeature` (mutation)
- **Conditional fetching**: Pass `null` as SWR key when data isn't ready (e.g., `id ? url : null`)
- **Return shape**: Always return `{ data, isLoading, isError, mutate }` from read hooks
- **Types**: Define interfaces in the hook file or import from `types/`
- **Smart polling**: Use `refreshInterval` callback for dynamic polling (see `usePipelines` for pattern)
- **SWR options**: Use `revalidateOnFocus: false` for data that doesn't change often

**Real examples:** `hooks/api/useCharts.ts` (read), `hooks/api/useChart.ts` (mutations), `hooks/api/usePipelines.ts` (polling)

### Utility and Constants Organization

**Global utilities and constants** (used across multiple features):
- `lib/utils.ts` - General utility functions
- `lib/api.ts` - API client functions
- `constants/` - Application-wide constants

**Feature-specific utilities** (used only within one feature/component):
- Always create a `utils.ts` file in the feature folder for utility functions
- Do not keep utility functions inline in component files

```
components/
├── charts/
│   ├── ChartBuilder.tsx
│   ├── utils.ts              # Chart-specific utilities
│   └── constants.ts          # Chart-specific constants
├── pipeline/
│   ├── pipeline-list.tsx
│   ├── utils.ts              # Pipeline-specific utilities (real example)
│   └── ...
```

### Memoization and Performance

**Always add these when creating components:**

1. **`id` attribute**: For DOM identification and debugging
2. **`key` prop**: For list items (use stable, unique identifiers, NOT array index)
3. **`data-testid` attribute**: For testing and debugging via browser inspect

```typescript
// Example component with required attributes
function ChartCard({ chart, onFavorite }: ChartCardProps) {
  return (
    <div
      id={`chart-card-${chart.id}`}
      data-testid={`chart-card-${chart.id}`}
    >
      {/* content */}
    </div>
  );
}

// List rendering with proper keys
{charts.map((chart) => (
  <ChartCard
    key={chart.id}  // Use stable ID, never array index
    chart={chart}
    onFavorite={handleFavorite}
  />
))}
```

**Memoization patterns:**

- **`React.memo`**: Wrap components that re-render without prop changes (e.g., parent state updates that don't affect the child)
- **`useMemo`**: Memoize calculations that iterate over arrays or transform data (e.g., sorting, filtering lists)
- **`useCallback`**: Wrap functions passed as props to memoized child components to prevent their re-renders

```typescript
// Wrap prop functions in useCallback
const handleFavorite = useCallback((chartId: number) => {
  // API call or state update
}, [dependencies]);

// Memoize expensive computations
const sortedCharts = useMemo(() => {
  return [...charts].sort((a, b) => a.title.localeCompare(b.title));
}, [charts]);

// Wrap component when parent re-renders but this component's props don't change
const ChartCard = memo(function ChartCard({ chart, onFavorite }: ChartCardProps) {
  // ...
});
```

**SWR Caching:**
- SWR automatically caches and deduplicates requests
- Use `mutate` to update cache after mutations
- Use unique, stable keys for SWR hooks

### UI Components vs Functional Components

**UI Components (`components/ui/`):**
- Pure presentational components
- Receive data and callbacks via props
- No API calls or business logic inside
- Focus on rendering and styling
- Examples: `Button`, `Card`, `Input`, `Dialog`, `Select`

**Functional/Feature Components:**
- Contain business logic and state management
- Make API calls and handle data
- Use UI components for rendering
- Live in feature directories (`components/charts/`, `components/dashboard/`)

```typescript
// UI Component - pure presentation
function Card({ title, children, className }: CardProps) {
  return (
    <div className={cn('rounded-lg border p-4', className)}>
      {title && <h3 className="font-semibold">{title}</h3>}
      {children}
    </div>
  );
}

// Functional Component - has logic and API calls
function ChartCard({ chartId }: { chartId: number }) {
  const { data: chart, mutate } = useChart(chartId);

  const handleFavorite = useCallback(async () => {
    await apiPost(`/api/charts/${chartId}/favorite`);
    mutate();
  }, [chartId, mutate]);

  return (
    <Card title={chart?.title}>
      <button onClick={handleFavorite}>
        <StarIcon filled={chart?.isFavorite} />
      </button>
    </Card>
  );
}
```

**Exception - UI components with inherent functionality:**
Some UI components have functionality that is intrinsic to their purpose (like a favorite star that must call an API). In these cases:
- The API call defines the component's core behavior
- Keep the functionality within the component
- Document clearly that this component has side effects

### NPM Package Selection

Before adding a new package:

1. **Check existing packages first**: Review `package.json` to see if a similar package is already installed
2. **Evaluate new packages based on:**
   - Bundle size impact (check bundlephobia.com)
   - Maintenance status (regular updates, active maintainers)
   - Community adoption (npm weekly downloads, GitHub stars)
   - TypeScript support

**Prefer packages that:**
- Have smaller post-build size
- Are continuously updated (check last publish date)
- Have high download counts and good reviews
- Provide TypeScript types (built-in or @types/*)

### Component Reusability

**Don't create new components unless necessary.** Before creating a new component:

1. Check if an existing component in `components/ui/` can be used as-is
2. Check if an existing component can be extended with variants or new props
3. Check if the logic can be added to an existing component

**Enhance existing components instead of creating new ones.** If a component lacks a behavior you need, propose enhancing it rather than building a separate component. For example: need a filterable table? Add filtering to the existing table component. Need a searchable dropdown? Add search to the existing dropdown. This keeps the component library lean and avoids duplicate components that diverge over time.

**Never modify shared/base components (especially `components/ui/`) without informing the user first.** These components are used across the codebase — changing them can have unintended side effects. Always explain what you want to change, why, and let the user verify before making the edit.

**Make components reusable:**
- Accept customization via props
- **Use composition over configuration**: Build flexible primitive components that accept children/slots (e.g., `<Card>`, `<CardHeader>`, `<CardBody>`), then create pre-configured shortcut components for common use cases (e.g., `<ChartCard title="Sales">`). This way the common case stays simple, but uncommon layouts are possible without adding more props. Avoid components with many boolean/string props that control rendering — they become unmaintainable as requirements grow.
- Avoid hardcoding values that might change

### Page Layout Pattern

All list/index pages (Charts, Pipelines, Orchestrate, etc.) follow a consistent layout structure:

**Structure:**
1. **Fixed header** with border-bottom and background
2. **Title section** with heading + subheading + optional action button (top-right)
3. **Scrollable content area** below the header

**Typography & Styling:**
- **Font**: Anek Latin (`var(--font-anek-latin)`) — set globally, no need to specify per-component
- **Page heading**: `text-3xl font-bold` (~30px, bold) — e.g., "Charts", "Pipelines"
- **Page subheading**: `text-muted-foreground mt-1` (gray, 1 unit below heading) — e.g., "Create And Manage Your Visualizations"
- **Primary action button**: `variant="ghost"` with `backgroundColor: 'var(--primary)'` (Dalgo teal), white text, shadow-xs

**Template:**
```tsx
<div className="h-full flex flex-col">
  {/* Fixed Header */}
  <div className="flex-shrink-0 border-b bg-background">
    <div className="flex items-center justify-between mb-6 p-6 pb-0">
      <div>
        <h1 className="text-3xl font-bold">Page Title</h1>
        <p className="text-muted-foreground mt-1">
          Page description or subtitle
        </p>
      </div>

      {/* Optional action button (top-right) */}
      <Button
        variant="ghost"
        className="text-white hover:opacity-90 shadow-xs"
        style={{ backgroundColor: 'var(--primary)' }}
      >
        <Plus className="h-4 w-4 mr-2" />
        ACTION LABEL
      </Button>
    </div>
  </div>

  {/* Scrollable Content */}
  <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6 mt-6">
    <div className="h-full overflow-y-auto">
      {/* Page content (tables, cards, lists, etc.) */}
    </div>
  </div>
</div>
```

**Real examples:** `app/charts/page.tsx`, `components/pipeline/pipeline-list.tsx`

### Color & Theme Conventions

**Font**: Anek Latin (Google Font), set globally via `var(--font-anek-latin)` in `app/globals.css`. Never set font-family on individual components.

**Brand colors**:
- CSS variable `--primary: #00897B` — use via Tailwind classes `text-primary`, `bg-primary`
- For inline styles, reference the CSS variable: `style={{ backgroundColor: 'var(--primary)' }}`
- Never hardcode hex values like `#06887b` or `#00897B` in components — always use the CSS variable

**Tailwind theme classes used in the codebase:**
- `text-muted-foreground` — gray subtext, descriptions, subtitles
- `text-destructive` — delete buttons, error states
- `text-primary` — brand teal for links, active states
- `bg-primary` — brand teal backgrounds on badges, checkboxes, CTA buttons
- `bg-background` — page/section backgrounds
- `text-foreground` — main text color

**CTA button pattern** (used on all primary action buttons like "Create Chart", "Create Pipeline"):
```tsx
<Button
  variant="ghost"
  className="text-white hover:opacity-90 shadow-xs"
  style={{ backgroundColor: 'var(--primary)' }}
>
```
Uses `variant="ghost"` with an inline style referencing the CSS variable. The inline style ensures the background color wins over Tailwind's hover classes, and `hover:opacity-90` provides a subtle fade on hover.

**Typography used across pages:**

| Class | Where it's used |
|-------|-----------------|
| `text-3xl font-bold` | Page headings — Charts, Pipelines, Dashboards, Settings |
| `text-xl font-semibold` | Section headings, card titles, modal titles |
| `text-base` | Form labels, body text in settings/user management |
| `text-sm` | Table cells, form hints, secondary text |
| `text-xs` | Badges, timestamps, chart metadata |

### Folder Structure for New Features

When adding a new feature, follow the **pipeline feature** as the reference implementation. It demonstrates every pattern in this document.

**Pipeline structure (reference):**
```
app/
├── pipeline/
│   └── page.tsx                  # Thin page — delegates to a component

components/
├── pipeline/                      # Feature-specific components
│   ├── pipeline-list.tsx          # Separate file — has own state, effects, API calls
│   ├── pipeline-form.tsx          # Separate file — has own state, effects, API calls
│   ├── pipeline-run-history.tsx   # Separate file — has own state, effects, API calls
│   ├── task-sequence.tsx          # Separate file — has own state, effects, API calls
│   ├── utils.ts                   # Feature-specific utility functions
│   └── __tests__/                 # Co-located tests with mock data
│       ├── pipeline.test.tsx
│       ├── pipeline-utils.test.ts
│       └── pipeline-mock-data.ts

hooks/
├── api/
│   └── usePipelines.ts            # SWR read hooks + standalone mutation functions

types/
├── pipeline.ts                    # TypeScript interfaces for API responses

constants/
├── pipeline.ts                    # Named constants (polling intervals, status enums, etc.)
```

**What the pipeline does right:**
- Page is a thin wrapper, all logic lives in components
- Each component with its own state/effects/API calls is a separate file
- SWR hooks for reads (`usePipelines`, `usePipeline`) + standalone async functions for mutations (`createPipeline`, `deletePipeline`)
- Feature-specific `utils.ts` for cron parsing, time formatting, etc. — not inline in components
- Named constants (`POLLING_INTERVAL_WHEN_LOCKED`, `LockStatus`, `FlowRunStatus`) in `constants/pipeline.ts`
- Proper TypeScript types in `types/pipeline.ts`
- Uses `toastSuccess`/`toastError` from `lib/toast.ts` — never raw `toast()`
- Follows the page layout pattern (fixed header + scrollable content)
- Uses the CTA button pattern (`variant="ghost"` + `style={{ backgroundColor: 'var(--primary)' }}`)
- `data-testid` on key elements, `key` using stable IDs, `useCallback`/`useMemo` where appropriate
- Co-located `__tests__/` directory with unit tests and mock data

**Guidelines for component files:**
- **Separate file**: If the component has its own `useState`, `useEffect`, API calls, or event handler logic
- **Same file as parent**: If the component only renders props passed from the parent (no state, no effects, no API calls) and is only used by that parent
- **Always separate**: If the component is used by more than one parent

### State Management Decision Tree

| State Type | When to Use | Example |
|------------|-------------|---------|
| `useState` | Component-local, UI-only state | Modal open/close, form inputs, accordion expanded |
| Zustand | Global state needed across unrelated components, persists across routes | Auth state, selected org, user preferences |
| SWR | Server data that needs caching/revalidation | Charts list, dashboards, API data |
| URL params | State that should be shareable/bookmarkable (optional) | Pagination, filters, search query |

### Form Patterns

**Complex forms (multiple fields, validation):**
- Use React Hook Form (uncontrolled inputs)
- Define form schema with TypeScript interfaces
- Use form's built-in validation

```typescript
const { register, handleSubmit, formState: { errors } } = useForm<FormData>();
```

**Simple inputs (single field, quick interaction):**
- Use `useState` (controlled inputs)
- Suitable for search boxes, single toggles, quick filters

```typescript
const [search, setSearch] = useState('');
<Input value={search} onChange={(e) => setSearch(e.target.value)} />
```

### Naming Conventions

**Files:**
- Components: `PascalCase.tsx` (e.g., `ChartBuilder.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useCharts.ts`)
- Utilities: `kebab-case.ts` (e.g., `chart-export.ts`, `form-utils.ts`)
- Constants: `kebab-case.ts` (e.g., `chart-types.ts`)

**Code:**
- Components: `PascalCase` (e.g., `ChartCard`)
- Functions/hooks: `camelCase` (e.g., `handleSubmit`, `useCharts`)
- Constants: `SCREAMING_SNAKE_CASE` for true constants, `camelCase` for config objects
- Types/Interfaces: `PascalCase` (e.g., `ChartData`, `ApiResponse`)

### Accessibility

When building components:
- Preserve Radix UI's built-in accessibility props
- Add `aria-label` for icon-only buttons
- Ensure keyboard navigation works (Tab, Enter, Escape)
- Use semantic HTML elements (`button`, `nav`, `main`, `section`)
- Ensure sufficient color contrast

```typescript
<button
  aria-label="Add to favorites"
  onClick={handleFavorite}
>
  <StarIcon />
</button>
```

### Error Handling

**API Errors:**
- `lib/api.ts` handles auth errors and token refresh automatically
- API errors are thrown as Error objects with meaningful messages
- Use try/catch in components and show toast notifications

**Frontend Errors (graceful degradation):**
- Use optional chaining (`?.`) when accessing nested object properties
- Use nullish coalescing (`??`) for default values
- Check array bounds before accessing elements
- Use Error Boundaries for component-level error catching

```typescript
// Safe object access
const userName = user?.profile?.name ?? 'Anonymous';

// Safe array access
const firstChart = charts?.[0] ?? null;

// Defensive rendering
{chart?.data && <ChartRenderer data={chart.data} />}
```

### Toast Notifications

Uses **Sonner** via centralized semantic helpers in `lib/toast.ts`. Never call `toast()` directly — always use `toastSuccess`, `toastError`, `toastInfo`, or `toastPromise` from that file.

### No Magic Numbers

Never use unexplained numbers directly in code. Put them in constants with a comment explaining why that value was chosen.

```typescript
// BAD - magic number
if (retryCount > 3) { ... }
const timeout = 5000;

// GOOD - named constant with explanation
// Max retries before showing error to user (balances UX with server load)
const MAX_RETRY_ATTEMPTS = 3;

// Timeout for API calls in ms (matches backend gateway timeout)
const API_TIMEOUT_MS = 5000;

if (retryCount > MAX_RETRY_ATTEMPTS) { ... }
```

If you're not sure why a specific number should be used, ask the developer.

### Container and Scrolling Behavior

When developing containers and parent containers:
- **Preserve scrolling**: Ensure content can scroll when it overflows
- **Don't overflow**: Items should not spill outside their container bounds
- **Use appropriate overflow classes**: `overflow-auto`, `overflow-y-auto`, `overflow-x-hidden`
- **Consider max-height**: Use `max-h-[value]` with overflow for scrollable areas

```typescript
// Scrollable container example
<div className="max-h-[400px] overflow-y-auto">
  {items.map(item => <Item key={item.id} />)}
</div>
```

If confused about where to put scrolling (parent vs child container), ask the developer.

### Comments in Code

- Add comments only for logic involving non-obvious algorithms, workarounds, or business rules
- Developers can add comments where they feel necessary
- Use `// TODO:` for future improvements with context

```typescript
// Calculate weighted average accounting for null values
// Uses filter to exclude nulls before reducing
const weightedAvg = values
  .filter((v) => v !== null)
  .reduce((acc, val, i, arr) => acc + val / arr.length, 0);
```

### TypeScript Conventions

**100% TypeScript compliance required:**
- Never use `any` type - if you don't know the type, ask the developer
- Never use generic `object` or `{}` - define proper interfaces
- If a type is truly unknown, explicitly state it and ask for clarification
- Define interfaces for all API responses
- Use type inference where TypeScript can figure it out

```typescript
// BAD - never do this
const data: any = await apiGet('/api/charts');
const config: object = {};

// GOOD - define proper types
interface ChartResponse {
  id: number;
  title: string;
  data: ChartData;
}
const data: ChartResponse = await apiGet('/api/charts');

// If you don't know the type, ASK:
// "I'm not sure what type `extraConfig` should be. Can you provide the expected structure?"
```

### Pre-built Packages for Complex Components

For complex UI components, prefer well-maintained packages over building from scratch:
- Date pickers: `react-day-picker` (already installed)
- Drag and drop: `@dnd-kit` (already installed)
- Grid layouts: `react-grid-layout` (already installed)
- Charts: ECharts (already installed)

Check existing `package.json` before implementing complex functionality.

### Chart Implementation
- **Use ECharts**: All charts are implemented using ECharts library
- **Use existing patterns**: Follow established chart component patterns in `components/charts/`
- **Handle data formatting**: Transform API data to chart-compatible formats
- **Export capabilities**: Implement PNG/PDF export using existing utilities

### CI/CD Awareness

When making changes that affect the build or deployment:
- **New environment variables**: Add to CI/CD scripts AND GitHub environments
- **New dependencies**: Ensure they work in the CI environment
- **Build script changes**: Test locally with `npm run build` before pushing

Don't change existing CI/CD functionality - only add new values/configurations as needed.

---

## Testing Strategy

### Critical Testing Principles
- **NEVER fake tests to pass** - If a test fails, leave it failing. Do not change expected values or assertions just to make tests pass. We debug failing tests together. If a test fails 4-5 times, stop trying and explain why it's failing.
- **Tests must reflect real behavior** - Assertions should match actual expected behavior, not be adjusted to match incorrect output.
- **Failing tests are valuable** - They indicate bugs or misunderstandings that need investigation.
- **Explain untestable code** - If a component or function can't be tested, or certain lines can't be covered, explain the specific reason why. Human intervention will decide what to do.
- **No blind fixes** - Don't guess at solutions. If unclear, ask.

### Test File Conventions
- **Location**: Tests live in `__tests__/` folders **inside** the component directory (e.g., `components/pipeline/__tests__/`, `components/notifications/__tests__/`)
- **Mock data factories**: Create a `*-mock-data.ts` file in the `__tests__/` folder with factory functions (`createMockPipeline()`, `createMockNotification()`) following the pattern in `components/pipeline/__tests__/pipeline-mock-data.ts`
- **Global API mocks**: API is mocked globally in `jest.setup.ts` — use `mockApiGet`/`mockApiPut` from `test-utils/api.ts` for typed references
- **Test wrappers**: Use `TestWrapper` from `test-utils/render.tsx` for SWR isolation (fresh cache, no deduping, no polling)
- **Permissions**: Mock `useUserPermissions` from `@/hooks/api/usePermissions` — never mock `useAuthStore` directly for permission checks
- **Relative imports for siblings**: Tests import components via relative paths (`../ComponentName`), mock data from `./mock-data`
- **No `__tests__/integration/` or `__tests__/components/` folders**: All tests go in the component's own `__tests__/` directory, integration tests included (e.g., `notifications.integration.test.tsx`)

### Unit Tests
- Test utility functions and custom hooks in isolation
- Mock API calls using SWR's testing utilities
- Focus on logic and edge cases rather than implementation details

### Component Tests
- Use React Testing Library for user-centric testing
- Test component behavior and user interactions
- Mock complex dependencies like chart libraries

### Test Organization
Tests live in `__tests__` directories co-located with source code:
```
components/
├── charts/
│   ├── ChartBuilder.tsx
│   └── __tests__/
│       └── ChartBuilder.test.tsx
```

E2E tests live in `/e2e/` directory.

---

## Key Files & Their Purpose

- `lib/api.ts`: Centralized API client with auth and error handling
- `stores/authStore.ts`: Authentication state management with Zustand
- `app/layout.tsx`: Root layout with SWR provider and client layout wrapper
- `components/ui/`: Radix-based reusable UI component library
- `hooks/api/`: SWR-based hooks for server state management
- `next.config.ts`: Next.js configuration with alias setup and build settings
- `jest.config.ts`: Test configuration with path aliases and coverage settings
- `playwright.config.ts`: E2E test configuration

---

## Common Gotchas

- **TypeScript strict mode disabled**: Be extra careful with type checking
- **Build errors ignored**: Ensure code quality through testing and linting during development
- **Client-side only APIs**: Some browser APIs need `typeof window !== 'undefined'` checks
- **Organization context**: Remember that API calls need organization selection for multi-tenancy
- **Token refresh**: API calls may be delayed due to automatic token refresh attempts
- **SWR stale cache on navigation**: SWR returns cached data immediately when navigating between pages. This causes stale state issues in edit forms where `useMemo` or `defaultValues` capture old values. Fix by: (1) invalidating cache with `useSWRConfig().mutate(key, undefined, { revalidate: false })` after mutations, and (2) adding a `key` prop to form components that includes critical fields to force remount when data changes.
