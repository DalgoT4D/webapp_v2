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
- **State Management**: Zustand for global state, SWR for server state
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
│   ├── data/                # Data management features
│   ├── ingest/              # Data ingestion workflows
│   ├── orchestrate/         # Orchestration management
│   └── transform/           # Data transformation tools
├── components/
│   ├── ui/                  # Reusable Radix-based UI components (GLOBAL)
│   ├── charts/              # Chart-specific components
│   └── dashboard/           # Dashboard builder components
├── hooks/
│   ├── api/                 # SWR-based API hooks
│   └── [custom hooks]       # Utility hooks (toast, mobile, etc.)
├── stores/                  # Zustand stores (currently just authStore)
├── lib/                     # Global utilities (API client, SWR config, utils)
└── constants/               # Application constants (GLOBAL)
```

### Key Architectural Patterns

#### 1. **Authentication & API Integration**
- **Token-based Authentication**: JWT access tokens with refresh token flow
- **Automatic Token Refresh**: Implemented in `lib/api.ts` with retry logic
- **Organization Context**: Multi-tenant with `x-dalgo-org` header
- **Centralized API Client**: All API calls go through `lib/api.ts` with automatic auth injection

```typescript
// API calls automatically include auth headers and handle token refresh
import { apiGet, apiPost } from '@/lib/api';
const data = await apiGet('/api/charts');
```

#### 2. **State Management Strategy**
- **Global State**: Zustand stores for authentication and app-wide state
- **Server State**: SWR for data fetching with built-in caching and revalidation
- **Form State**: React Hook Form for complex form handling
- **Local State**: React useState for component-specific state

```typescript
// Authentication state with persistence
const { token, selectedOrgSlug, setSelectedOrg } = useAuthStore();

// Server state with automatic caching
const { data: charts, error, mutate } = useCharts();
```

#### 3. **Component Architecture**
- **Composition Pattern**: Building UIs from small, composable components
- **Headless UI**: Radix UI for accessible, unstyled primitives
- **Variant-based Styling**: Using CVA (Class Variance Authority) for component variants
- **Client/Server Split**: Clear separation with 'use client' directives

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
- **Local Storage**: Used for auth tokens and organization selection
- **CORS**: Handled by backend, frontend makes direct API calls

---

## Development Guidelines

### Custom Hooks vs Utility Functions

**Custom Hooks (`hooks/`):**
- Use when you need React features: state, effects, context, or other hooks
- Use for data fetching with SWR
- Use when the logic needs to re-render the component
- Always prefix with `use` (e.g., `useCharts`, `useMobile`, `useToast`)

**Utility Functions (`lib/`):**
- Use for pure functions that transform data
- Use for helpers that don't need React lifecycle
- Use for calculations, formatting, validation logic

```typescript
// Hook - needs React state/effects
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => { /* ... */ }, [value, delay]);
  return debouncedValue;
}

// Utility - pure function
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}
```

### Utility and Constants Organization

**Global utilities and constants** (used across multiple features):
- `lib/utils.ts` - General utility functions
- `lib/api.ts` - API client functions
- `constants/` - Application-wide constants

**Feature-specific utilities** (used only within one feature/component):
- Keep them in the same file as the component if small
- Create a `utils.ts` file in the feature folder if larger

```
components/
├── charts/
│   ├── ChartBuilder.tsx
│   ├── utils.ts              # Chart-specific utilities
│   └── constants.ts          # Chart-specific constants
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

- **`React.memo`**: Wrap components that receive the same props frequently
- **`useMemo`**: Memoize expensive calculations or object/array creation
- **`useCallback`**: Wrap functions passed as props to prevent child re-renders

```typescript
// Wrap prop functions in useCallback
const handleFavorite = useCallback((chartId: number) => {
  // API call or state update
}, [dependencies]);

// Memoize expensive computations
const sortedCharts = useMemo(() => {
  return [...charts].sort((a, b) => a.title.localeCompare(b.title));
}, [charts]);

// Wrap component if it receives stable props often
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

1. Check if an existing component in `components/ui/` can be used
2. Check if an existing component can be extended with variants
3. Check if the logic can be added to an existing component

**Make components reusable:**
- Accept customization via props
- Use composition over configuration
- Avoid hardcoding values that might change

### Folder Structure for New Features

When adding a new feature (e.g., a new page like "pipeline"):

```
app/
├── pipeline/
│   └── page.tsx              # Main page component

components/
├── pipeline/                  # Feature-specific components
│   ├── PipelineList.tsx      # Large component - separate file
│   ├── PipelineHistory.tsx   # Large component - separate file
│   ├── PipelineCard.tsx      # Can be in same file if small and just receives props
│   └── utils.ts              # Feature-specific utilities

hooks/
├── api/
│   └── usePipelines.ts       # SWR hook for pipeline data
```

**Guidelines for component files:**
- **Separate file**: If the component is large, has its own state, or has complex logic
- **Same file**: If the component is small, mostly receives props, and is tightly coupled to the parent
- **Always separate**: If the component is reused in multiple places

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

> **TODO**: Update this section after orchestrate branch is merged.

Currently using Sonner for toast notifications. Patterns will be documented here.

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

- Add comments only for complex logic that isn't self-explanatory
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

### CI/CD Awareness

When making changes that affect the build or deployment:
- **New environment variables**: Add to CI/CD scripts AND GitHub environments
- **New dependencies**: Ensure they work in the CI environment
- **Build script changes**: Test locally with `npm run build` before pushing

Don't change existing CI/CD functionality - only add new values/configurations as needed.

---

## Development Patterns to Follow

### Creating New Features
1. **Start with the API hook** in `hooks/api/` using SWR
2. **Build UI components** in appropriate feature directory under `components/`
3. **Create pages** in `app/` directory following App Router conventions
4. **Use existing UI components** from `components/ui/` for consistency

### State Management Guidelines
- Use **Zustand** for global application state that persists across routes
- Use **SWR hooks** for server data that needs caching and revalidation
- Use **React Hook Form** for complex forms with validation
- Use **local useState** for simple component-specific state

### Styling Approach
- **Tailwind-first**: Use utility classes for styling
- **Component variants**: Use CVA for consistent component styling variations
- **Class merging**: Use `cn()` utility (tailwind-merge) for safe class combinations
- **Responsive design**: Mobile-first approach with responsive breakpoints

### API Integration
- **Use centralized API helpers**: `apiGet`, `apiPost`, `apiPut`, `apiDelete` from `lib/api.ts`
- **Handle auth automatically**: API client manages tokens and organization context
- **Error handling**: API errors are thrown as Error objects with meaningful messages
- **Type safety**: Define TypeScript interfaces for API responses

### Chart Implementation
- **Use ECharts**: All charts are implemented using ECharts library
- **Use existing patterns**: Follow established chart component patterns in `components/charts/`
- **Handle data formatting**: Transform API data to chart-compatible formats
- **Export capabilities**: Implement PNG/PDF export using existing utilities

---

## Testing Strategy

### Philosophy
- **Quality over quantity**: Focus on getting good coverage of functions and lines, not just writing many small tests
- **Merge related tests**: Combine small, repetitive tests into single comprehensive tests
- **Bug fix = test**: Whenever a bug is fixed, write a test to verify the fix
- **New feature = tests**: New features should have accompanying tests

### Human Intervention Required
- **Don't fake passing tests**: If a test fails 4-5 times, don't add wrong parameters just to make it pass. Let it fail and explain why.
- **Explain untestable code**: If a component or function can't be tested, or certain lines can't be covered, explain the specific reason why. Human intervention will decide what to do.
- **No blind fixes**: Don't guess at solutions. If unclear, ask.

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