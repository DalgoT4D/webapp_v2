# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

webapp_v2 is the current frontend for Dalgo, a data intelligence platform for NGOs. Built with Next.js 15 (App Router) and React 19, it provides dashboard building, data visualization, and analytics capabilities.

## Development Commands

```bash
npm run dev              # Start dev server (port 3001, Turbopack)
npm run build            # Production build
npm run lint             # ESLint
npm run format:write     # Prettier format and auto-stage

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

## Architecture

### Technology Stack

- **Framework**: Next.js 15 with App Router and React 19
- **Language**: TypeScript (with relaxed strictness)
- **Styling**: Tailwind CSS v4 with utility-first approach
- **State Management**: Zustand for global state, SWR for server state
- **UI Components**: Radix UI headless components with custom styling
- **Charts**: Multi-library approach (ECharts, Nivo, Recharts)
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
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
```

### SWR Hooks Pattern

API hooks in `hooks/api/` follow this pattern:
```typescript
export function useCharts(params?: UseChartsParams) {
  const { data, error, mutate } = useSWR<ChartListResponse>(url, apiGet);
  return {
    data: data?.data || [],
    isLoading: !error && !data,
    isError: error,
    mutate,
  };
}
```

### UI Components

- `components/ui/`: Radix UI-based primitives (Button, Dialog, Select, etc.)
- `components/charts/`: Chart builder, configuration, and rendering components
- `components/dashboard/`: Dashboard builder with drag-and-drop grid layout

### Chart System

Multiple charting libraries for different needs:
- **ECharts** (`echarts-for-react`): Complex interactive charts
- **Recharts**: Simple composable charts
- Chart configuration stored in `extra_config` and `render_config` fields

### Dashboard Builder

- Grid-based layout using `react-grid-layout`
- Drag-and-drop with `@dnd-kit`
- Components: `dashboard-builder-v2.tsx`, `chart-element-v2.tsx`, `filter-element.tsx`

## Key Patterns

### Path Aliases

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
- **Multi-Library Strategy**: ECharts for complex charts, Nivo for statistical, Recharts for simple
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
- **Choose appropriate library**: ECharts for complex interactions, Recharts for simple charts
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