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
npm run test             # Run Jest tests
npm run test -- path/to/file.test.tsx  # Run specific test
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

## Architecture

### State Management

- **Zustand** (`stores/authStore.ts`): Global auth state, organization context, user data
- **SWR** (`hooks/api/`): Server state with automatic caching and revalidation
- **React Hook Form**: Complex form handling

### API Layer

All API calls go through `lib/api.ts` which handles:
- Automatic cookie-based authentication
- Token refresh with retry logic (401 → refresh → retry)
- Organization context via `x-dalgo-org` header
- Auth redirect (except for `/share/dashboard/` and `/public/dashboard/` routes)

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
import { Button } from '@/components/ui/button';
import { useCharts } from '@/hooks/api/useCharts';
import { apiGet } from '@/lib/api';
```

### Client Components

Use `'use client'` directive for components that need browser APIs, hooks, or interactivity.

### Test File Locations

Tests can be placed in:
- `__tests__/` at root level
- `components/**/__tests__/`
- `hooks/**/__tests__/`
- `lib/**/__tests__/`

## Environment Variables

- `NEXT_PUBLIC_BACKEND_URL`: Django API URL (default: `http://localhost:8002`)

## Build Notes

- TypeScript and ESLint errors are ignored during build (`next.config.ts`)
- Coverage thresholds set to 1% minimum
- Node.js >= 18.17.0 required
