# Charts V2 Architecture Design

## Problem

The current charts codebase is messy and hard to navigate:

- **3 copies of the chart builder logic** (`app/charts/new/configure/page.tsx` at 1,267 lines, `app/charts/[id]/edit/page.tsx` at 1,851 lines, `components/charts/ChartBuilder.tsx` at 1,027 lines)
- **4 copies of `getDefaultCustomizations`** scattered across files
- **`hooks/api/useChart.ts`** bundles 4 unrelated concerns (CRUD, chart data, warehouse schema, map/geo data) in 435 lines
- **2 conflicting `ChartType` types** (`types/charts.ts` vs `constants/chart-types.ts`)
- **2 conflicting `Chart` interfaces** (`types/charts.ts` vs `hooks/api/useCharts.ts`)
- **`AGGREGATE_FUNCTIONS`** duplicated in 3 files
- **Page files contain full component logic** (`app/charts/page.tsx` is 1,384 lines)
- Adding a new chart type requires touching many files across different directories with no clear guide

## Goal

A **registry-based, plugin-style architecture** where:

1. Each chart type is a self-contained folder
2. Adding a new chart type = create a folder + register it
3. Shared layers (rendering, data config, customizations controls) are opt-in imports
4. The folder structure tells you where to go for any task
5. No `if (chartType === 'bar')` outside of chart-type-specific folders

## Migration Strategy

**Approach B: New components + routes, shared data layer.**

- New route `app/charts-v2/` and components in `components/charts-v2/`
- Feature-flagged sidebar item — both old and new charts coexist
- Hooks are split into focused files; both old and new code import from the same split hooks
- Old `hooks/api/useChart.ts` becomes a re-export shim so old imports don't break
- When satisfied, delete old `app/charts/`, `components/charts/`, and the re-export shim

---

## Architecture

### 1. Feature Flag and Routes

**Feature flag**: Add `CHARTS_V2 = 'CHARTS_V2'` to `FeatureFlagKeys` enum in `hooks/api/useFeatureFlags.ts`. Backend needs the flag created as a DB entry.

**Sidebar item** in `components/main-layout.tsx`, inside `getNavItems()` after the existing Charts item:

```typescript
{
  title: 'Charts V2',
  href: '/charts-v2',
  icon: ChartBarBig,
  isActive: currentPath.startsWith('/charts-v2'),
  hide: !isFeatureFlagEnabled(FeatureFlagKeys.CHARTS_V2),
},
```

**Routes** — every page is a thin wrapper (under 30 lines):

```
app/charts-v2/
├── page.tsx                          ← <ChartList />
├── new/
│   ├── page.tsx                      ← <ChartTypeSelector /> (step 1 wizard)
│   └── configure/page.tsx            ← <ChartBuilderShell mode="create" />
└── [id]/
    ├── page.tsx                      ← <ChartDetailView />
    └── edit/page.tsx                 ← <ChartBuilderShell mode="edit" chartId={id} />
```

Auto-collapse sidebar for builder/detail routes (add to the existing list in `main-layout.tsx` lines 657-677):
- `/charts-v2/new/configure`
- `/charts-v2/[id]/edit`
- `/charts-v2/[id]`

---

### 2. The Registry

**File**: `components/charts-v2/registry.ts`

The registry is a `Map<string, ChartTypeDefinition>` that maps chart type keys to their full definition. The rest of the system queries the registry — never imports from a specific chart type folder directly.

```typescript
export interface ChartRendererProps {
  config: EChartsOption | Record<string, unknown>;
  data: unknown[];
  customizations: Record<string, unknown>;
  width?: number;
  height?: number;
  onDrillDown?: (params: DrillDownParams) => void;  // DrillDownParams defined in types/map/map-drill-down.ts
}

export interface CustomizationProps {
  formData: ChartBuilderFormData;
  onChange: (key: string, value: unknown) => void;
  columns?: string[];
  numericColumns?: string[];
}

export interface DataConfigProps {
  formData: ChartBuilderFormData;
  onChange: (key: string, value: unknown) => void;
  columns?: string[];
}

export interface ChartTypeDefinition {
  meta: {
    key: string;              // 'bar', 'line', etc.
    label: string;            // 'Bar Chart'
    icon: ComponentType;
    color: string;
    description: string;
  };
  renderer: ComponentType<ChartRendererProps>;
  customizations: ComponentType<CustomizationProps>;
  defaults: () => Record<string, unknown>;
  formatting?: (config: EChartsOption, customizations: Record<string, unknown>) => EChartsOption;
  dataConfigOverride?: {
    component: ComponentType<DataConfigProps>;
  };
  dataConfigFields: {
    dimension: boolean;
    extraDimension: boolean;
    metrics: boolean;
    maxMetrics?: number;       // undefined = unlimited
    filters: boolean;
    sort: boolean;
    pagination: boolean;
    timeGrain: boolean;
    tableDimensions: boolean;
  };
}
```

Functions:
- `registerChartType(def: ChartTypeDefinition): void`
- `getChartDefinition(type: string): ChartTypeDefinition` (throws if unknown)
- `getAllChartTypes(): ChartTypeDefinition[]`

---

### 3. Per-Chart-Type Folders

Each chart type is a self-contained folder under `components/charts-v2/types/`. Standard structure:

```
types/<chart-type>/
├── <type>-renderer.tsx          ← renders the chart (ECharts or custom)
├── <type>-customizations.tsx    ← styling form panel
├── <type>-defaults.ts           ← default customization values
├── <type>-formatting.ts         ← ECharts post-processing (if applicable)
└── index.ts                     ← wires into ChartTypeDefinition + calls registerChartType()
```

#### Bar Chart (`types/bar/`)

**Renderer**: Uses `shared/echarts-base.tsx` for ECharts init/resize/cleanup. Receives backend-returned ECharts config, applies bar-specific formatting, renders.

**Customizations** (imports from shared):
- `shared/axis-controls.tsx` — X/Y axis title, rotation, number format
- `shared/legend-controls.tsx` — show/hide, position, display mode
- `shared/data-label-controls.tsx` — show/hide, position (top, inside, insideBottom)
- `shared/tooltip-controls.tsx` — show/hide toggle
- Bar-specific: orientation toggle (vertical/horizontal), stacked toggle

**Defaults**:
```typescript
{
  orientation: 'vertical', stacked: false,
  showTooltip: true, showLegend: true, legendDisplay: 'paginated', legendPosition: 'top',
  showDataLabels: false, dataLabelPosition: 'top',
  xAxisTitle: '', yAxisTitle: '',
  xAxisLabelRotation: 'horizontal', yAxisLabelRotation: 'horizontal',
}
```

**Formatting**: Extracted from current `lib/chart-formatting-utils.ts` `applyLineBarChartFormatting` + `lib/stacked-bar-utils.ts` `applyStackedBarLabels`. Handles axis label formatting and stacked bar total labels.

**dataConfigFields**: `{ dimension: true, extraDimension: true, metrics: true, filters: true, sort: true, pagination: true, timeGrain: true, tableDimensions: false }`

#### Line Chart (`types/line/`)

**Renderer**: Same ECharts base as bar.

**Customizations** (shared imports same as bar, minus stacked/orientation):
- `shared/axis-controls.tsx`, `shared/legend-controls.tsx`, `shared/data-label-controls.tsx`, `shared/tooltip-controls.tsx`
- Line-specific: line style toggle (smooth/straight), show data points toggle
- Data label positions: top, bottom, left, right (different from bar)

**Defaults**:
```typescript
{
  lineStyle: 'smooth', showDataPoints: true,
  showTooltip: true, showLegend: true, legendDisplay: 'paginated', legendPosition: 'top',
  showDataLabels: false, dataLabelPosition: 'top',
  xAxisTitle: '', yAxisTitle: '',
  xAxisLabelRotation: 'horizontal', yAxisLabelRotation: 'horizontal',
}
```

**Formatting**: Extracted from `applyLineBarChartFormatting` (same as bar, minus stacked labels).

**dataConfigFields**: Same as bar.

#### Pie Chart (`types/pie/`)

**Renderer**: ECharts base. No axes — strips `grid`, `xAxis`, `yAxis` from config.

**Customizations**:
- `shared/legend-controls.tsx`, `shared/data-label-controls.tsx`, `shared/tooltip-controls.tsx`, `shared/number-format-section.tsx`
- Pie-specific: chart style (donut/full), slice limit (all/3/5/10), label format (percentage/value/name+percentage/name+value)
- Data label positions: outside, inside (different from bar/line)

**Defaults**:
```typescript
{
  chartStyle: 'donut', labelFormat: 'percentage',
  showTooltip: true, showLegend: true, legendDisplay: 'paginated', legendPosition: 'top',
  showDataLabels: true, dataLabelPosition: 'outside',
}
```

**Formatting**: Extracted from `applyPieChartFormatting`. Handles label formatter (4 modes), dimension name formatting, legend data alignment.

**dataConfigFields**: `{ dimension: true, extraDimension: true, metrics: true, maxMetrics: 1, filters: true, sort: true, pagination: true, timeGrain: false, tableDimensions: false }`

#### Number Chart (`types/number/`)

**Renderer**: ECharts base (gauge series). Strips `grid`, `xAxis`, `yAxis` from config.

**Customizations**:
- `shared/number-format-section.tsx`
- Number-specific: number size (small/medium/large), subtitle text, prefix, suffix

**Defaults**:
```typescript
{
  numberSize: 'medium', subtitle: '', numberFormat: 'default',
  decimalPlaces: 0, numberPrefix: '', numberSuffix: '',
}
```

**Formatting**: Extracted from `applyNumberChartFormatting`. Injects `detail.formatter` into gauge series for prefix/suffix/format.

**dataConfigFields**: `{ dimension: false, extraDimension: false, metrics: true, maxMetrics: 1, filters: true, sort: false, pagination: false, timeGrain: false, tableDimensions: false }`

#### Table Chart (`types/table/`)

**Renderer**: Custom HTML table component (no ECharts). Handles column sorting, URL auto-detection in cells, pagination (client-side and server-side), and per-column formatting (currency, percentage, date, number, text).

**Customizations**:
- `shared/number-format-section.tsx` (used per-column)
- Table-specific: per-column number formatting with expandable accordion per numeric column

**Defaults**: `{}` (empty object)

**No formatting file** — not ECharts-based.

**dataConfigFields**: `{ dimension: false, extraDimension: false, metrics: true, filters: true, sort: true, pagination: true, timeGrain: false, tableDimensions: true }`

#### Map Chart (`types/map/`)

Map is the most complex chart type. It builds its ECharts config entirely on the client side (no backend-returned config), uses `echarts.registerMap()` for GeoJSON boundaries, and has a multi-level drill-down system.

**Files**:
```
types/map/
├── map-renderer.tsx              ← ECharts map with client-built config, zoom controls, drill-down breadcrumbs
├── map-customizations.tsx        ← color scheme, borders, region labels, animation
├── map-defaults.ts               ← { colorScheme: 'Blues', nullValueLabel: 'No Data', ... }
├── map-data-config.tsx           ← geographic hierarchy, layers (replaces shared data config)
├── map-drill-down.ts             ← drill-down state machine (extracted from current 964-line MapPreview)
├── layer-configuration.tsx       ← multi-layer GeoJSON management
├── dynamic-level-config.tsx      ← geographic hierarchy level setup wizard
├── multi-select-layer-card.tsx   ← region multi-select for layer cards
└── index.ts                      ← sets dataConfigOverride to map-data-config
```

**Renderer**: Uses `shared/echarts-base.tsx` for init/cleanup, but builds the full ECharts config in-component: `type: 'map'` series, `visualMap` (continuous color scale), `roam: 'move'`, per-region `areaColor` with computed opacity. Includes zoom controls, breadcrumb navigation, touch event handling.

**Customizations**:
- `shared/tooltip-controls.tsx`, `shared/legend-controls.tsx`
- Map-specific: color scheme (Blues/Reds/Greens/Purples/Oranges/Greys), enable selection toggle, "label for no data", show region names, border width, border color, animation toggle
- Legend positions are corner-based (top-left, top-right, bottom-left, bottom-right) — different from other charts' edge-based positions

**Defaults**:
```typescript
{
  colorScheme: 'Blues', nullValueLabel: 'No Data', showLabels: false,
  showTooltip: true, showLegend: true, legendPosition: 'bottom-left',
}
```

**Data config override**: Map has its own data configuration panel (`map-data-config.tsx`) because:
- Uses `useChartDataPreview` for value fetching (not `useColumnValues`)
- Has `DynamicLevelConfig` for geographic hierarchy (country/state/district levels)
- Has layer management UI
- Initializes `country_code: 'IND'`, `drill_down_enabled: false` on dataset reset
- No sort, pagination, or per-column configuration

**dataConfigFields**: Not used (overridden by `dataConfigOverride`), but set for documentation:
`{ dimension: false, extraDimension: false, metrics: true, maxMetrics: 1, filters: false, sort: false, pagination: false, timeGrain: false, tableDimensions: false }`

**Drill-down state machine** (`map-drill-down.ts`): Extracted from the current `MapPreview.tsx`. Manages the drill-down path (which level the user has drilled into), breadcrumb state, GeoJSON property key resolution, and navigation between levels. Pure logic — no rendering.

---

### 4. Shared Layer

**Directory**: `components/charts-v2/shared/`

Shared components are **opt-in** (chart types import what they need), **pure UI controls** (receive value + onChange, no hooks or API calls), and the dependency direction is always **chart type -> shared** (never the reverse).

| File | Purpose | Used by |
|---|---|---|
| `echarts-base.tsx` | ECharts init, resize, cleanup, theme, font injection | bar, line, pie, number, map |
| `axis-controls.tsx` | Axis title, rotation, number format form section | bar, line |
| `legend-controls.tsx` | Show/hide, position, display mode | bar, line, pie, map |
| `data-label-controls.tsx` | Show/hide, position | bar, line, pie |
| `tooltip-controls.tsx` | Show/hide tooltip toggle | bar, line, pie, map |
| `number-format-section.tsx` | Prefix/suffix/decimal/format form block | pie, number, table (per-column), bar/line (per-axis) |
| `constants.ts` | `AGGREGATE_FUNCTIONS`, `FILTER_OPERATORS` (ONE copy each) | all types as needed |

**`echarts-base.tsx`** provides a hook:
```typescript
const { chartRef, chartInstance } = useEChartsBase({ config, theme });
return <div ref={chartRef} style={{ width: '100%', height: '100%' }} />;
```

Handles: `echarts.init()`, `setOption()`, `ResizeObserver`, `dispose()` on unmount, font family injection. Replaces the current situation where `ChartPreview`, `MiniChart`, and `MapPreview` all have separate ECharts bootstrap paths.

---

### 5. Builder Shell

**File**: `components/charts-v2/builder/chart-builder-shell.tsx`

One component for both create and edit flows. Replaces the 3 current duplicated implementations.

```typescript
interface ChartBuilderShellProps {
  mode: 'create' | 'edit';
  chartId?: string;  // required when mode='edit'
}
```

**Responsibilities:**
- Manages form state (`ChartBuilderFormData`)
- On `mode='edit'`: fetches existing chart via `useChart()`, populates form
- On chart type change: calls `registry.getChartDefinition(type).defaults()` to reset customizations, with `preserveCustomizationsOnTypeChange()` to keep shared values
- Tracks unsaved changes via deep equality comparison
- Handles save (delegates payload building to `chart-builder-utils.ts`)

**Layout** — 3-panel:

| Left Panel | Center Panel | Right Panel |
|---|---|---|
| Data configuration | Chart preview | Customizations |
| If map: `def.dataConfigOverride.component` | `def.renderer` with `def.formatting` applied | `def.customizations` |
| Else: shared `ChartDataConfiguration` with `def.dataConfigFields` controlling visibility | + Data preview tab below | |

**`chart-builder-utils.ts`** contains:
- `getDefaultCustomizations(type: string)` — delegates to `registry.getChartDefinition(type).defaults()`
- `buildSavePayload(formData: ChartBuilderFormData)` — converts form state to `ChartCreate`/`ChartUpdate` API shape
- `buildDataPayload(formData: ChartBuilderFormData)` — converts form state to `ChartDataPayload` for preview fetching
- `preserveCustomizationsOnTypeChange(oldType: string, newType: string, current: Record<string, unknown>)` — keeps shared values (tooltip, legend) when switching chart types, resets type-specific values

**Data config panel** (`builder/data-config/chart-data-configuration.tsx`) reads `dataConfigFields` from the registry:
```typescript
const def = getChartDefinition(chartType);
const fields = def.dataConfigFields;

// Render only the fields this chart type needs:
// fields.dimension → DimensionSelector
// fields.extraDimension → ExtraDimensionSelector
// fields.tableDimensions → TableDimensionsSelector
// fields.metrics → MetricsSelector (with maxMetrics)
// fields.timeGrain → TimeGrainSelector
// fields.filters → ChartFiltersConfiguration
// fields.sort → ChartSortConfiguration
// fields.pagination → ChartPaginationConfiguration
```

Sub-components in `builder/data-config/`:
- `metrics-selector.tsx` — multi-metric row builder with aggregate function selection
- `dataset-selector.tsx` — schema + table combobox
- `chart-type-selector.tsx` — chart type button strip (reads `getAllChartTypes()` from registry)
- `time-grain-selector.tsx` — date granularity dropdown
- `table-dimensions-selector.tsx` — drag-and-drop dimension ordering with drill-down toggles
- `simple-table-configuration.tsx` — column checkbox toggle list for raw table mode
- `chart-filters-configuration.tsx` — filter builder (add/remove filter rows)
- `chart-sort-configuration.tsx` — sort configuration panel
- `chart-pagination-configuration.tsx` — pagination toggle + page size selector

---

### 6. Preview Layer

**Directory**: `components/charts-v2/preview/`

| File | Purpose |
|---|---|
| `chart-preview.tsx` | Generic container. Gets renderer from registry, applies formatting if present, delegates rendering. Handles the preview container chrome (loading state, error state, tabs for chart vs data preview). |
| `data-preview.tsx` | Raw data table with pagination. Shows the underlying data the chart is built from. |
| `mini-chart.tsx` | Compact ECharts renderer for dashboard card thumbnails. Uses `shared/echarts-base.tsx`. |
| `static-chart-preview.tsx` | CSS/SVG fake chart placeholders for chart type selector cards. |

`chart-preview.tsx` logic:
```typescript
const def = getChartDefinition(chartType);
const Renderer = def.renderer;
const processedConfig = def.formatting ? def.formatting(config, customizations) : config;
return <Renderer config={processedConfig} data={data} customizations={customizations} />;
```

---

### 7. List Page

**Directory**: `components/charts-v2/list/`

Extracted from the current 1,384-line `app/charts/page.tsx` into focused components:

| File | Purpose |
|---|---|
| `chart-list.tsx` | Main list component. Table with sorting, pagination. Uses `useCharts()` hook. |
| `chart-list-filters.tsx` | Filter bar — chart type filter, owner filter, search, date range. |
| `chart-list-actions.tsx` | Row-level actions (delete, export, duplicate) + bulk actions + `ChartDeleteDialog`. |

---

### 8. Detail Page

**Directory**: `components/charts-v2/detail/`

| File | Purpose |
|---|---|
| `chart-detail-view.tsx` | Chart view page. Fetches chart data, renders preview, handles drill-down state for map, table pagination. Uses registry's renderer. |
| `chart-delete-dialog.tsx` | Delete confirmation that shows dashboard usage via `useChartDashboards`. |

---

### 9. Export

**Directory**: `components/charts-v2/export/`

| File | Purpose |
|---|---|
| `chart-export.tsx` | Full dialog-based export UI (PNG/PDF/CSV). |
| `chart-export-dropdown.tsx` | Dropdown variant used on chart detail page. |
| `chart-export-dropdown-for-list.tsx` | Submenu variant for list page row actions. |

All export components use `toastSuccess`/`toastError` from `lib/toast.ts` (fixing current convention violation).

---

### 10. Data Layer — Split Hooks

Split `hooks/api/useChart.ts` (435 lines, 4 concerns) into focused files. Both old charts code and new charts-v2 code import from these.

**New files:**

| File | Contents | Source |
|---|---|---|
| `hooks/api/useChartMutations.ts` | `useCreateChart`, `useUpdateChart`, `useDeleteChart`, `useBulkDeleteCharts`, `useChartExport` | Extracted from `useChart.ts` |
| `hooks/api/useChartData.ts` | `useChartData`, `useChartDataPreview`, `useChartDataPreviewTotalRows` | Extracted from `useChart.ts` |
| `hooks/api/useWarehouse.ts` | `useSchemas`, `useTables`, `useColumns`, `useColumnValues`, `useAllSchemaTables`, `useRawTableData`, `useTableCount` | Extracted from `useChart.ts` |
| `hooks/api/useMapData.ts` | `useAvailableGeoJSONs`, `useGeoJSONData`, `useRegions`, `useChildRegions`, `useRegionGeoJSONs`, `useRegionHierarchy`, `useMapData`, `useMapDataOverlay`, `useAvailableRegionTypes`, `useNextLayerType`, `useAvailableLayers` | Extracted from `useChart.ts` |

**Backward compatibility shim** — `hooks/api/useChart.ts` becomes a re-export file (~20 lines):
```typescript
export { useCreateChart, useUpdateChart, useDeleteChart, useBulkDeleteCharts } from './useChartMutations';
export { useChartData, useChartDataPreview, useChartDataPreviewTotalRows } from './useChartData';
export { useSchemas, useTables, useColumns, useColumnValues, useAllSchemaTables, useRawTableData, useTableCount } from './useWarehouse';
// ... etc
```

Old code imports are unchanged. New charts-v2 code imports from the specific files.

**Also fix:**
- Remove duplicate `Chart` interface from `hooks/api/useCharts.ts` — import from `types/charts.ts` instead
- Consolidate `ChartType` — remove the duplicate from `constants/chart-types.ts`, use `types/charts.ts` as canonical

---

### 11. Convention Fixes Applied in New Code

Issues in the current codebase that are fixed in charts-v2:

| Issue | Current | Charts V2 |
|---|---|---|
| `toast()` from sonner directly | `ChartExportDropdown`, `ChartDetailClient` | Always use `toastSuccess`/`toastError` from `lib/toast.ts` |
| `any` types | `MapCustomizations formData: any`, `ChartFilter.value: any` | Properly typed |
| Magic numbers | Inline constants | Named constants in `shared/constants.ts` or type-specific files |
| `console.log` left in code | `ChartPreview.tsx` line 258 | None |
| Dead code | `WorkInProgress.tsx` ("Map Charts Coming Soon") | Not carried over |
| `data-testid` missing | Various | Required on all interactive elements per CLAUDE.md |

---

## Adding a New Chart Type — Step by Step

Example: adding a **Scatter Plot**.

1. Create `components/charts-v2/types/scatter/`
2. Create `scatter-defaults.ts`:
   ```typescript
   export const SCATTER_DEFAULTS = {
     showTooltip: true, showLegend: true, legendDisplay: 'paginated', legendPosition: 'top',
     showDataLabels: false, dataLabelPosition: 'top',
     xAxisTitle: '', yAxisTitle: '',
     // scatter-specific:
     pointSize: 'medium',
   };
   ```
3. Create `scatter-customizations.tsx` — import shared controls + add scatter-specific ones
4. Create `scatter-renderer.tsx` — use `shared/echarts-base.tsx`, render ECharts scatter series
5. Create `scatter-formatting.ts` — any post-processing on the backend-returned config
6. Create `index.ts` — wire into `ChartTypeDefinition`, call `registerChartType()`
7. No other files need changes. The builder, preview, data config, list, and detail pages all read from the registry.

---

## Quick Reference: Where to Go

| Task | Location |
|---|---|
| Add a new chart type | `components/charts-v2/types/<new-type>/` + register |
| Fix rendering for a specific chart type | `types/<type>/<type>-renderer.tsx` |
| Fix ECharts post-processing for a type | `types/<type>/<type>-formatting.ts` |
| Change customization options for a type | `types/<type>/<type>-customizations.tsx` |
| Change default values for a type | `types/<type>/<type>-defaults.ts` |
| Fix sort/filter/pagination for ALL charts | `builder/data-config/chart-*-configuration.tsx` |
| Change legend UI for all charts that have it | `shared/legend-controls.tsx` |
| Change builder layout (3 panels) | `builder/chart-builder-shell.tsx` |
| Fix chart data fetching | `hooks/api/useChartData.ts` |
| Fix warehouse schema hooks | `hooks/api/useWarehouse.ts` |
| Fix map geographic data hooks | `hooks/api/useMapData.ts` |
| Change chart list page | `list/chart-list.tsx` |
| Change chart detail/view page | `detail/chart-detail-view.tsx` |
| Add a new export format | `export/chart-export.tsx` |
| Change ECharts init/cleanup/resize | `shared/echarts-base.tsx` |

---

## Cleanup Plan (After Validation)

Once Charts V2 is validated and the feature flag is enabled for all users:

1. Remove `app/charts/` directory (old routes)
2. Remove `components/charts/` directory (old components)
3. Remove `hooks/api/useChart.ts` re-export shim
4. Remove `CHARTS_V2` feature flag and old "Charts" sidebar item
5. Rename `app/charts-v2/` to `app/charts/` and `components/charts-v2/` to `components/charts/`
6. Update all internal links/references
7. Remove dead code: `WorkInProgress.tsx`, duplicate `ChartType` in `constants/chart-types.ts`
