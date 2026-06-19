---
description: Component architecture, performance, layout, theming, forms, and accessibility conventions for webapp_v2.
paths:
  - "components/**"
  - "app/**"
---

# Component & UI Conventions

## Component Architecture

- **Composition over configuration**: build focused, single-responsibility primitives that accept children/slots (`<Card>`, `<CardHeader>`, `<CardBody>`), then add pre-configured shortcuts for common cases (`<ChartCard title="Sales">`). Avoid components with many boolean/string props that control rendering — they become unmaintainable.
- **Headless UI**: use Radix UI primitives; preserve their accessibility props.
- **Variant styling**: use CVA (Class Variance Authority) for variants.
- **Client/Server split**: components render on the server by default. Add `'use client'` only when the file needs browser APIs, hooks (`useState`, `useEffect`), or event handlers.

```tsx
const MyComponent = ({ variant = 'default', ...props }) => (
  <Button variant={variant} className={cn('custom-styles', className)}>
    {children}
  </Button>
);
```

## UI Components vs Functional Components

**UI components (`components/ui/`)** — pure presentation: receive data + callbacks via props, no API calls or business logic. Examples: `Button`, `Card`, `Input`, `Dialog`, `Select`.

**Functional/feature components** (`components/charts/`, `components/dashboard/`, …) — own business logic, state, and API calls; compose UI components for rendering.

```tsx
// UI component — pure presentation
function Card({ title, children, className }: CardProps) {
  return (
    <div className={cn('rounded-lg border p-4', className)}>
      {title && <h3 className="font-semibold">{title}</h3>}
      {children}
    </div>
  );
}

// Functional component — logic + API calls
function ChartCard({ chartId }: { chartId: number }) {
  const { data: chart, mutate } = useChart(chartId);
  const handleFavorite = useCallback(async () => {
    await apiPost(`/api/charts/${chartId}/favorite`);
    mutate();
  }, [chartId, mutate]);
  return (
    <Card title={chart?.title}>
      <button onClick={handleFavorite}><StarIcon filled={chart?.isFavorite} /></button>
    </Card>
  );
}
```

**Exception** — some UI components have intrinsic functionality (e.g. a favorite star that must call an API). Keep that behavior in the component and document the side effect.

## Component Reusability

Before creating a new component: (1) check if a `components/ui/` component works as-is, (2) check if it can be extended with variants/props, (3) check if the logic can be added to an existing component. **Enhance existing components rather than building parallel ones** (need a filterable table? add filtering to the existing table). **Never modify shared/base components — especially `components/ui/` — without informing the user first** and explaining the change.

## Memoization & Performance

Every component should have `id`, stable `key` (never array index), and `data-testid`.

- **`React.memo`** — wrap components that re-render on unrelated parent updates.
- **`useMemo`** — memoize array transforms (sorting/filtering).
- **`useCallback`** — wrap functions passed as props to memoized children.

```tsx
const handleFavorite = useCallback((chartId: number) => { /* ... */ }, [deps]);
const sortedCharts = useMemo(() => [...charts].sort((a, b) => a.title.localeCompare(b.title)), [charts]);
const ChartCard = memo(function ChartCard({ chart, onFavorite }: ChartCardProps) { /* ... */ });
```

## Feature File Organization

- **Separate file** if the component has its own `useState`/`useEffect`/API calls/handlers, or is used by more than one parent.
- **Same file as parent** if it only renders props (no state/effects/API) and is used only by that parent.
- Each feature owns a `utils.ts` (feature-specific helpers — never inline in components) and `constants.ts`. Global helpers go in `lib/utils.ts`; global constants in `constants/`.
- **Reference implementation: the `pipeline` feature** — thin page → `components/pipeline/*` (each stateful piece its own file) → `hooks/api/usePipelines.ts` → `types/pipeline.ts` → `constants/pipeline.ts`, with co-located `__tests__/`.

## Page Layout Pattern

All list/index pages share: a fixed header (border-bottom, `bg-background`) with title + subheading + optional top-right action button, then a scrollable content area.

```tsx
<div className="h-full flex flex-col">
  <div className="flex-shrink-0 border-b bg-background">
    <div className="flex items-center justify-between mb-6 p-6 pb-0">
      <div>
        <h1 className="text-3xl font-bold">Page Title</h1>
        <p className="text-muted-foreground mt-1">Page description</p>
      </div>
      <Button variant="primary" data-testid="action-btn">
        <Plus className="h-4 w-4 mr-2" />ACTION
      </Button>
    </div>
  </div>
  <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6 mt-6">
    <div className="h-full overflow-y-auto">{/* content */}</div>
  </div>
</div>
```

Real examples: `app/charts/page.tsx`, `components/pipeline/pipeline-list.tsx`.

## Color & Theme

- **Font**: Anek Latin, set globally via `var(--font-anek-latin)` in `app/globals.css`. Never set font-family per component.
- **Brand teal**: CSS var `--primary: #00897B`. Use `text-primary` / `bg-primary`. **Never hardcode hex** like `#00897B` — always the CSS variable.
- **CTA buttons**: use `<Button variant="primary">` (bakes in `bg-primary text-white shadow-xs hover:opacity-90`). The old inline-recipe (`variant="ghost"` + inline `backgroundColor`) is deprecated.
- Theme classes: `text-muted-foreground` (subtext), `text-destructive` (delete/error), `text-primary` (links/active), `bg-background`, `text-foreground`.

| Class | Used for |
|---|---|
| `text-3xl font-bold` | Page headings |
| `text-xl font-semibold` | Section/card/modal titles |
| `text-base` | Form labels, body text |
| `text-sm` | Table cells, hints |
| `text-xs` | Badges, timestamps, chart metadata |

## Form Patterns

- **Complex forms** (multiple fields + validation): React Hook Form (uncontrolled), with a TS interface schema and built-in validation: `const { register, handleSubmit, formState: { errors } } = useForm<FormData>();`
- **Simple inputs** (single field): controlled `useState`.

## Accessibility

Preserve Radix accessibility props · `aria-label` on icon-only buttons · keyboard nav (Tab/Enter/Escape) · semantic HTML (`button`, `nav`, `main`, `section`) · sufficient contrast.

## Containers & Scrolling

Preserve scrolling on overflow; don't let items spill outside bounds. Use `overflow-y-auto` / `overflow-x-hidden` and `max-h-[value]` for scrollable areas. If unsure where scrolling belongs (parent vs child), ask.

## Frontend Error Handling

Use `?.` for nested access, `??` for defaults, bounds-check arrays, and Error Boundaries for component-level catching.

```tsx
const userName = user?.profile?.name ?? 'Anonymous';
const firstChart = charts?.[0] ?? null;
{chart?.data && <ChartRenderer data={chart.data} />}
```

## NPM Packages

Check `package.json` before adding anything. Prefer small, well-maintained, TypeScript-friendly packages. Already installed for complex needs: `react-day-picker` (dates), `@dnd-kit` (drag/drop), `react-grid-layout` (grids), ECharts (charts).

## Comments

Comment only non-obvious algorithms, workarounds, or business rules. Use `// TODO:` with context for future work.
