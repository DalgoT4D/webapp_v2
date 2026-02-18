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

# Testing
npm run test                   # Run Jest unit tests
npm run test:watch             # Run tests in watch mode
npm run test:coverage          # Generate coverage report
npm run test:ci                # Run tests in CI mode with coverage

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
- **Testing**: Jest + React Testing Library
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
│   ├── ui/                  # Reusable Radix-based UI components
│   ├── charts/              # Chart-specific components
│   └── dashboard/           # Dashboard builder components
├── hooks/
│   ├── api/                 # SWR-based API hooks
│   └── [custom hooks]       # Utility hooks (toast, mobile, etc.)
├── stores/                  # Zustand stores (currently just authStore)
├── lib/                     # Utilities (API client, SWR config, utils)
└── constants/               # Application constants
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

#### Testing Setup
- **Jest Configuration**: Custom setup with module name mapping for path aliases
- **Coverage Collection**: Includes components, app, lib, hooks, and stores directories
- **Component Testing**: React Testing Library with jsdom environment

#### Environment & API
- **Backend URL**: Configurable via `NEXT_PUBLIC_BACKEND_URL` (defaults to localhost:8002)
- **Local Storage**: Used for auth tokens and organization selection
- **CORS**: Handled by backend, frontend makes direct API calls

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

## Key Files & Their Purpose

- `lib/api.ts`: Centralized API client with auth and error handling
- `stores/authStore.ts`: Authentication state management with Zustand
- `app/layout.tsx`: Root layout with SWR provider and client layout wrapper
- `components/ui/`: Radix-based reusable UI component library
- `hooks/api/`: SWR-based hooks for server state management
- `next.config.ts`: Next.js configuration with alias setup and build settings
- `jest.config.ts`: Test configuration with path aliases and coverage settings

## Testing Strategy

### Critical Testing Principles
- **NEVER fake tests to pass** - If a test fails, leave it failing. Do not change expected values or assertions just to make tests pass. We debug failing tests together.
- **Tests must reflect real behavior** - Assertions should match actual expected behavior, not be adjusted to match incorrect output.
- **Failing tests are valuable** - They indicate bugs or misunderstandings that need investigation.

### Unit Tests
- Test utility functions and custom hooks in isolation
- Mock API calls using SWR's testing utilities
- Focus on logic and edge cases rather than implementation details

### Component Tests
- Use React Testing Library for user-centric testing
- Test component behavior and user interactions
- Mock complex dependencies like chart libraries

## Common Gotchas

- **TypeScript strict mode disabled**: Be extra careful with type checking
- **Build errors ignored**: Ensure code quality through testing and linting during development
- **Client-side only APIs**: Some browser APIs need `typeof window !== 'undefined'` checks
- **Organization context**: Remember that API calls need organization selection for multi-tenancy
- **Token refresh**: API calls may be delayed due to automatic token refresh attempts
- **SWR stale cache on navigation**: SWR returns cached data immediately when navigating between pages. This causes stale state issues in edit forms where `useMemo` or `defaultValues` capture old values. Fix by: (1) invalidating cache with `useSWRConfig().mutate(key, undefined, { revalidate: false })` after mutations, and (2) adding a `key` prop to form components that includes critical fields to force remount when data changes.