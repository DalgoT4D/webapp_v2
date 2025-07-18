# CLAUDE.md - Dalgo Web Application Development Guide

## Overview

Dalgo is a modern data intelligence platform built with Next.js 15 and React 19, featuring a comprehensive dashboard system with data visualization, analytics, and reporting capabilities. The application follows a modular architecture with clear separation of concerns.

## Common Development Commands

```bash
# Development
npm run dev                    # Start dev server with Turbopack on port 3001
npm run build                  # Build production bundle
npm run start                  # Start production server on port 3001

# Code Quality
npm run lint                   # Run ESLint
npm run format:check           # Check code formatting
npm run format:write           # Format code with Prettier (auto-stages)

# Testing
npm run test                   # Run Jest tests
npm run test:watch            # Run tests in watch mode
npm run test:coverage         # Generate coverage report
npm run test:ci               # Run tests in CI mode with coverage
```

## High-Level Architecture

### Technology Stack

- **Frontend Framework**: Next.js 15 with App Router (React 19)
- **Language**: TypeScript (with strict mode disabled)
- **Styling**: Tailwind CSS v4 with CSS-in-JS utilities
- **State Management**: Zustand for global state
- **Data Fetching**: SWR for server state management
- **UI Components**: Radix UI (headless components) + custom components
- **Charts**: ECharts, Nivo, and Recharts for different visualization needs
- **Form Handling**: React Hook Form
- **Testing**: Jest + React Testing Library

### Directory Structure

```
webapp_v2/
├── app/                      # Next.js App Router pages
│   ├── charts/              # Chart creation and management
│   ├── dashboards/          # Dashboard CRUD operations
│   ├── data/                # Data management
│   ├── ingest/              # Data ingestion workflows
│   ├── orchestrate/         # Orchestration features
│   └── transform/           # Data transformation tools
├── components/
│   ├── ui/                  # Reusable UI components (Radix-based)
│   ├── charts/              # Chart-specific components
│   ├── dashboard/           # Dashboard builder components
│   └── [feature]/           # Feature-specific components
├── stores/                  # Zustand stores
├── hooks/                   # Custom React hooks
│   └── api/                 # API-specific hooks
├── lib/                     # Utilities and configurations
└── constants/               # Application constants
```

### Key Architectural Patterns

#### 1. **Component Architecture**
- **Headless UI Pattern**: Using Radix UI for unstyled, accessible components
- **Composition Pattern**: Building complex UIs from smaller, reusable components
- **Client/Server Components**: Clear separation with 'use client' directive
- **Error Boundaries**: Implemented for robust error handling

#### 2. **State Management Strategy**
- **Zustand**: For global application state (auth, org selection)
- **SWR**: For server state and data caching
- **React Hook Form**: For complex form state management
- **Local State**: useState for component-specific state

#### 3. **Data Flow**
```
API (Backend) → lib/api.ts → SWR/Hooks → Components → UI
                    ↓
              Zustand Store (for global state)
```

#### 4. **Authentication & Authorization**
- Token-based authentication stored in localStorage
- Auth state managed via Zustand (authStore)
- Protected routes using AuthGuard component
- Organization-based access control with x-dalgo-org header

#### 5. **API Integration**
- Centralized API configuration in `lib/api.ts`
- Automatic auth token and org header injection
- RESTful endpoints with typed responses
- Error handling with meaningful messages

#### 6. **Dashboard Builder Architecture**
- **Drag-and-Drop**: Using @dnd-kit for intuitive dashboard creation
- **Grid System**: Flexible grid-based layout for dashboard elements
- **Component Types**: Charts, text, headings with extensible architecture
- **Real-time Updates**: SWR for live data updates in dashboards

#### 7. **Chart System**
- **Multi-Library Support**: ECharts (complex), Nivo (statistical), Recharts (simple)
- **Unified Interface**: Common wrapper components for consistency
- **Dynamic Configuration**: Runtime chart type and data binding
- **Export Capabilities**: PNG/PDF export via html2canvas and jspdf

## Important Implementation Details

### Path Aliases
- Use `@/` for absolute imports (maps to project root)
- Example: `import { Button } from '@/components/ui/button'`

### Environment Variables
- `NEXT_PUBLIC_BACKEND_URL`: Backend API URL (defaults to http://localhost:8002)

### Styling Approach
- Tailwind CSS for utility classes
- Class Variance Authority (CVA) for component variants
- tailwind-merge for safe class merging
- CSS modules avoided in favor of Tailwind

### Testing Strategy
- Unit tests for utilities and hooks
- Component testing with React Testing Library
- Coverage thresholds set to 1% (minimum viable)
- Test files co-located with components

### Build Configuration
- TypeScript errors ignored during build (`ignoreBuildErrors: true`)
- ESLint errors ignored during build (`ignoreDuringBuilds: true`)
- Turbopack enabled for faster development builds

### Performance Optimizations
- SWR for intelligent data caching
- React 19's automatic batching
- Next.js 15's improved bundling
- Lazy loading for heavy chart libraries

### Security Considerations
- Bearer token authentication
- Organization-based data isolation
- CORS handled by backend
- No sensitive data in client-side code

## Development Workflow

1. **Feature Development**
   - Create feature branch from main
   - Implement components in appropriate directories
   - Use existing UI components from `components/ui/`
   - Add necessary API hooks in `hooks/api/`

2. **State Management**
   - Use Zustand for global state needs
   - Implement SWR hooks for data fetching
   - Keep component state local when possible

3. **Testing**
   - Write tests for new components
   - Ensure API mocks are realistic
   - Run `npm test` before committing

4. **Code Quality**
   - Run `npm run format:write` to format code
   - ESLint will catch basic issues
   - TypeScript provides type safety (when enabled)

## Common Patterns to Follow

### Creating a New Page
```typescript
// app/feature/page.tsx
export default function FeaturePage() {
  return (
    <div className="container mx-auto p-6">
      {/* Page content */}
    </div>
  );
}
```

### Creating an API Hook
```typescript
// hooks/api/useFeature.ts
import useSWR from 'swr';

export function useFeature(id: string) {
  return useSWR(`/api/features/${id}`);
}
```

### Adding to Zustand Store
```typescript
// stores/featureStore.ts
import { createAppStore } from '@/lib/zustand';

interface FeatureState {
  // state
  // actions
}

export const useFeatureStore = createAppStore<FeatureState>(
  (set, get) => ({
    // implementation
  }),
  { name: 'feature-store' }
);
```

### Using UI Components
```typescript
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// Use with Tailwind classes for styling
<Button className="w-full mt-4" variant="primary">
  Click me
</Button>
```

## Notes for Development

- The app uses Next.js App Router - all pages are in the `app/` directory
- Client components must have 'use client' directive
- Prefer composition over prop drilling
- Use TypeScript interfaces for better code documentation
- Follow existing patterns for consistency
- Dashboard builder is the core feature - maintain its flexibility