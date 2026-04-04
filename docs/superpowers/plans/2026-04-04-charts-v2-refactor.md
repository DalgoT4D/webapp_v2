# Charts V2 Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the charts feature into a registry-based, plugin-style architecture where each chart type is a self-contained folder, with a feature-flagged parallel route (`/charts-v2`) alongside the existing `/charts`.

**Architecture:** A central registry maps chart type keys to their definition (renderer, customizations, defaults, formatting). The builder shell, preview, and data config panels query the registry — they never import from a specific chart type folder. Shared UI controls (legend, axis, tooltip) are opt-in imports. Hooks are split by concern (CRUD, chart data, warehouse, map) and shared between old and new code via a re-export shim.

**Tech Stack:** Next.js 15, React 19, TypeScript, ECharts, SWR, Zustand, Radix UI, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-04-04-charts-v2-architecture-design.md`

---

## File Structure

### New files to create

```
components/charts-v2/
├── registry.ts
├── types/
│   ├── bar/
│   │   ├── bar-renderer.tsx
│   │   ├── bar-customizations.tsx
│   │   ├── bar-defaults.ts
│   │   ├── bar-formatting.ts
│   │   └── index.ts
│   ├── line/
│   │   ├── line-renderer.tsx
│   │   ├── line-customizations.tsx
│   │   ├── line-defaults.ts
│   │   ├── line-formatting.ts
│   │   └── index.ts
│   ├── pie/
│   │   ├── pie-renderer.tsx
│   │   ├── pie-customizations.tsx
│   │   ├── pie-defaults.ts
│   │   ├── pie-formatting.ts
│   │   └── index.ts
│   ├── number/
│   │   ├── number-renderer.tsx
│   │   ├── number-customizations.tsx
│   │   ├── number-defaults.ts
│   │   ├── number-formatting.ts
│   │   └── index.ts
│   ├── table/
│   │   ├── table-renderer.tsx
│   │   ├── table-customizations.tsx
│   │   ├── table-defaults.ts
│   │   └── index.ts
│   └── map/
│       ├── map-renderer.tsx
│       ├── map-customizations.tsx
│       ├── map-defaults.ts
│       ├── map-data-config.tsx
│       ├── map-drill-down.ts
│       ├── layer-configuration.tsx
│       ├── dynamic-level-config.tsx
│       ├── multi-select-layer-card.tsx
│       └── index.ts
├── shared/
│   ├── echarts-base.tsx
│   ├── axis-controls.tsx
│   ├── legend-controls.tsx
│   ├── data-label-controls.tsx
│   ├── tooltip-controls.tsx
│   ├── number-format-section.tsx
│   └── constants.ts
├── builder/
│   ├── chart-builder-shell.tsx
│   ├── chart-builder-utils.ts
│   ├── data-config/
│   │   ├── chart-data-configuration.tsx
│   │   ├── metrics-selector.tsx
│   │   ├── dataset-selector.tsx
│   │   ├── chart-type-selector.tsx
│   │   ├── time-grain-selector.tsx
│   │   ├── table-dimensions-selector.tsx
│   │   ├── simple-table-configuration.tsx
│   │   ├── chart-filters-configuration.tsx
│   │   ├── chart-sort-configuration.tsx
│   │   └── chart-pagination-configuration.tsx
│   └── dialogs/
│       ├── save-options-dialog.tsx
│       └── unsaved-changes-dialog.tsx
├── preview/
│   ├── chart-preview.tsx
│   ├── data-preview.tsx
│   ├── mini-chart.tsx
│   └── static-chart-preview.tsx
├── list/
│   ├── chart-list.tsx
│   ├── chart-list-filters.tsx
│   └── chart-list-actions.tsx
├── detail/
│   ├── chart-detail-view.tsx
│   └── chart-delete-dialog.tsx
├── export/
│   ├── chart-export.tsx
│   ├── chart-export-dropdown.tsx
│   └── chart-export-dropdown-for-list.tsx
├── utils.ts
├── constants.ts
└── __tests__/
    ├── registry.test.ts
    └── chart-builder-utils.test.ts

app/charts-v2/
├── page.tsx
├── new/
│   ├── page.tsx
│   └── configure/page.tsx
└── [id]/
    ├── page.tsx
    └── edit/page.tsx

hooks/api/
├── useChartMutations.ts          (new)
├── useChartData.ts               (new)
├── useWarehouse.ts               (new)
├── useMapData.ts                 (new)
└── useChart.ts                   (modified → re-export shim)
```

### Files to modify

```
hooks/api/useFeatureFlags.ts      (add CHARTS_V2 to enum)
hooks/api/useCharts.ts            (remove duplicate Chart interface)
components/main-layout.tsx        (add Charts V2 sidebar item + auto-collapse routes)
```

---

## Task 1: Split `useChart.ts` into focused hook files

This is the foundation. Both old and new code will import from these split files. Old code continues working via a re-export shim.

**Files:**
- Create: `hooks/api/useChartMutations.ts`
- Create: `hooks/api/useChartData.ts`
- Create: `hooks/api/useWarehouse.ts`
- Create: `hooks/api/useMapData.ts`
- Modify: `hooks/api/useChart.ts` (replace with re-export shim)
- Modify: `hooks/api/useCharts.ts` (remove duplicate `Chart` interface)

- [ ] **Step 1: Create `hooks/api/useChartMutations.ts`**

Extract CRUD mutations and export hook from `useChart.ts`. This file contains lines 22-56 (mutation functions) and line 130-135 (export hook).

```typescript
import useSWRMutation from 'swr/mutation';
import { apiPost, apiPut, apiDelete } from '@/lib/api';
import type { ChartCreate, ChartUpdate } from '@/types/charts';

const createChart = (url: string, { arg }: { arg: ChartCreate }) => apiPost(url, arg);

const updateChart = (url: string, { arg }: { arg: { id: number; data: ChartUpdate } }) =>
  apiPut(`${url}${arg.id}/`, arg.data);

const deleteChart = (url: string, { arg }: { arg: number }) => apiDelete(`${url}${arg}/`);

const bulkDeleteCharts = (url: string, { arg }: { arg: number[] }) =>
  apiPost(`${url}bulk-delete/`, { chart_ids: arg });

export function useCreateChart() {
  return useSWRMutation('/api/charts/', createChart);
}

export function useUpdateChart() {
  return useSWRMutation('/api/charts/', updateChart);
}

export function useDeleteChart() {
  return useSWRMutation('/api/charts/', deleteChart);
}

export function useBulkDeleteCharts() {
  return useSWRMutation('/api/charts/', bulkDeleteCharts);
}

export function useChartExport() {
  return useSWRMutation(
    '/api/charts/export/',
    (url: string, { arg }: { arg: { chart_id: number; format: string } }) => apiPost(url, arg)
  );
}

// Alias for backward compatibility
export const useChartSave = useCreateChart;
```

- [ ] **Step 2: Create `hooks/api/useChartData.ts`**

Extract chart data fetching hooks from `useChart.ts` lines 58-127.

```typescript
import useSWR from 'swr';
import { apiPost } from '@/lib/api';
import type { ChartDataPayload } from '@/types/charts';

export function useChartData(payload: ChartDataPayload | null) {
  return useSWR(
    payload ? ['/api/charts/chart-data/', payload] : null,
    ([url, data]: [string, ChartDataPayload]) => apiPost(url, data),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 2000,
    }
  );
}

export function useChartDataPreview(
  payload: ChartDataPayload | null,
  page: number = 1,
  pageSize: number = 50,
  dashboardFilters: Record<string, any> = {}
) {
  const filterHash =
    Object.keys(dashboardFilters).length > 0 ? JSON.stringify(dashboardFilters) : '';
  const swrKey = payload
    ? [`/api/charts/chart-data-preview/`, payload, page, pageSize, filterHash]
    : null;

  return useSWR(
    swrKey,
    async ([url, data, pageNum, limit, filters]: [
      string,
      ChartDataPayload,
      number,
      number,
      string,
    ]) => {
      const queryParams = new URLSearchParams({
        page: (pageNum - 1).toString(),
        limit: limit.toString(),
      });

      if (filters && Object.keys(dashboardFilters).length > 0) {
        queryParams.append('dashboard_filters', JSON.stringify(dashboardFilters));
      }

      return apiPost(`${url}?${queryParams}`, data);
    }
  );
}

export function useChartDataPreviewTotalRows(
  payload: ChartDataPayload | null,
  dashboardFilters: Record<string, any> = {}
) {
  const filterHash =
    Object.keys(dashboardFilters).length > 0 ? JSON.stringify(dashboardFilters) : '';
  const swrKey = payload
    ? ['/api/charts/chart-data-preview/total-rows/', payload, filterHash]
    : null;

  return useSWR(swrKey, ([url, data, filters]: [string, ChartDataPayload, string]) => {
    const queryParams = new URLSearchParams();
    if (filters && Object.keys(dashboardFilters).length > 0) {
      queryParams.append('dashboard_filters', JSON.stringify(dashboardFilters));
    }

    return apiPost(`${url}${queryParams.toString() ? `?${queryParams}` : ''}`, data);
  });
}
```

- [ ] **Step 3: Create `hooks/api/useWarehouse.ts`**

Extract warehouse/schema hooks from `useChart.ts` lines 137-221.

```typescript
import React from 'react';
import useSWR from 'swr';
import { apiGet } from '@/lib/api';

export function useSchemas() {
  return useSWR<string[]>('/api/warehouse/schemas', apiGet);
}

export function useTables(schema: string | null) {
  return useSWR<any[]>(schema ? `/api/warehouse/tables/${schema}` : null, apiGet);
}

export function useAllSchemaTables() {
  const {
    data: syncTablesData,
    isLoading,
    error,
  } = useSWR('/api/warehouse/sync_tables?fresh=1', apiGet, {
    dedupingInterval: 30000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    revalidateOnMount: true,
  });

  const allTables = React.useMemo(() => {
    if (!syncTablesData || !Array.isArray(syncTablesData)) {
      return [];
    }

    return syncTablesData.map((item: any) => ({
      schema_name: item.schema,
      table_name: item.name,
      full_name: `${item.schema}.${item.name}`,
    }));
  }, [syncTablesData]);

  return {
    data: allTables,
    isLoading,
    error,
  };
}

export function useColumns(schema: string | null, table: string | null) {
  return useSWR<any[]>(
    schema && table ? `/api/warehouse/table_columns/${schema}/${table}` : null,
    apiGet
  );
}

export function useColumnValues(
  schema: string | null,
  table: string | null,
  column: string | null
) {
  return useSWR<string[]>(
    schema && table && column ? `/api/warehouse/column-values/${schema}/${table}/${column}` : null,
    apiGet,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000,
    }
  );
}

export function useRawTableData(
  schema: string | null,
  table: string | null,
  page: number = 1,
  pageSize: number = 50
) {
  const swrKey =
    schema && table
      ? `/api/warehouse/table_data/${schema}/${table}?page=${page}&limit=${pageSize}`
      : null;

  return useSWR(swrKey, apiGet, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });
}

export function useTableCount(schema: string | null, table: string | null) {
  return useSWR(schema && table ? `/api/warehouse/table_count/${schema}/${table}` : null, apiGet);
}
```

- [ ] **Step 4: Create `hooks/api/useMapData.ts`**

Extract all map/geo hooks from `useChart.ts` lines 229-435. Copy the full content including interfaces (`GeoJSONListItem`, `GeoJSONDetail`, `Region`, `RegionGeoJSON`, `LayerOption`) and all `use*` functions from `useAvailableGeoJSONs` through `useMapDataOverlay`.

Copy lines 229-435 from the current `hooks/api/useChart.ts` verbatim, adding the necessary imports at the top:

```typescript
import useSWR from 'swr';
import { apiGet, apiPost } from '@/lib/api';
import type { ChartDataPayload } from '@/types/charts';
```

- [ ] **Step 5: Replace `hooks/api/useChart.ts` with re-export shim**

Replace the entire file content with re-exports:

```typescript
// Re-export shim for backward compatibility
// Old chart code imports from here; new charts-v2 code imports from split files directly.
// Delete this file when old charts code is removed.

export { useCreateChart, useUpdateChart, useDeleteChart, useBulkDeleteCharts, useChartExport, useChartSave } from './useChartMutations';
export { useChartData, useChartDataPreview, useChartDataPreviewTotalRows } from './useChartData';
export { useSchemas, useTables, useAllSchemaTables, useColumns, useColumnValues, useRawTableData, useTableCount } from './useWarehouse';
export { useAvailableGeoJSONs, useGeoJSONData, useRegions, useChildRegions, useRegionGeoJSONs, useRegionHierarchy, useMapData, useMapDataOverlay, useAvailableLayers, useAvailableRegionTypes, useNextLayerType } from './useMapData';
export type { GeoJSONListItem, GeoJSONDetail, Region, RegionGeoJSON, LayerOption } from './useMapData';

// Re-export chart read hooks that live in useCharts.ts (some old code imports useChart from here)
export { useCharts, useChart } from './useCharts';

// Re-export types
export type { ChartDataPayload, ChartCreate as ChartCreatePayload } from '@/types/charts';
```

- [ ] **Step 6: Fix `hooks/api/useCharts.ts` — remove duplicate `Chart` interface**

Replace the local `Chart` interface (lines 4-16) with an import from `types/charts.ts`:

```typescript
import useSWR from 'swr';
import { apiGet } from '@/lib/api';
import type { Chart } from '@/types/charts';

export type { Chart };

export interface ChartListResponse {
  data: Chart[];
  // ... rest unchanged
```

Note: The `Chart` interface in `types/charts.ts` has `chart_type: ChartType` (typed) while the duplicate in `useCharts.ts` has `chart_type: string` (loose). The typed version is correct. Also `types/charts.ts` has `echarts_config` and `is_favorite` fields that the duplicate was missing, and the duplicate had `description?` and `render_config?` that the canonical doesn't have. If old code uses `description` or `render_config`, add those fields to the canonical `Chart` interface in `types/charts.ts` as optional fields.

- [ ] **Step 7: Verify old code still works**

Run: `npm run build`

Expected: Build succeeds. All old chart imports from `@/hooks/api/useChart` resolve through the re-export shim. No runtime changes.

- [ ] **Step 8: Commit**

```bash
git add hooks/api/useChartMutations.ts hooks/api/useChartData.ts hooks/api/useWarehouse.ts hooks/api/useMapData.ts hooks/api/useChart.ts hooks/api/useCharts.ts
git commit -m "refactor: split useChart.ts into focused hook files (CRUD, data, warehouse, map)"
```

---

## Task 2: Create the registry and shared constants

**Files:**
- Create: `components/charts-v2/registry.ts`
- Create: `components/charts-v2/constants.ts`
- Create: `components/charts-v2/shared/constants.ts`
- Create: `components/charts-v2/__tests__/registry.test.ts`

- [ ] **Step 1: Create `components/charts-v2/registry.ts`**

```typescript
import type { ComponentType } from 'react';
import type { EChartsOption } from 'echarts';
import type { ChartBuilderFormData } from '@/types/charts';

export interface ChartRendererProps {
  config: EChartsOption | Record<string, unknown>;
  data: unknown[];
  customizations: Record<string, unknown>;
  width?: number;
  height?: number;
  onDrillDown?: (params: DrillDownParams) => void;
}

export interface DrillDownParams {
  level: number;
  name: string;
  geographic_column: string;
  parent_selections: Array<{ column: string; value: string }>;
}

export interface CustomizationProps {
  formData: ChartBuilderFormData;
  onChange: (key: string, value: unknown) => void;
  columns?: string[];
  numericColumns?: string[];
}

export interface DataConfigProps {
  formData: ChartBuilderFormData;
  onChange: (updates: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
}

export interface DataConfigFields {
  dimension: boolean;
  extraDimension: boolean;
  metrics: boolean;
  maxMetrics?: number;
  filters: boolean;
  sort: boolean;
  pagination: boolean;
  timeGrain: boolean;
  tableDimensions: boolean;
}

export interface ChartTypeMeta {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  description: string;
}

export interface ChartTypeDefinition {
  meta: ChartTypeMeta;
  renderer: ComponentType<ChartRendererProps>;
  customizations: ComponentType<CustomizationProps>;
  defaults: () => Record<string, unknown>;
  formatting?: (config: EChartsOption, customizations: Record<string, unknown>) => EChartsOption;
  dataConfigOverride?: {
    component: ComponentType<DataConfigProps>;
  };
  dataConfigFields: DataConfigFields;
}

const CHART_REGISTRY = new Map<string, ChartTypeDefinition>();

export function registerChartType(def: ChartTypeDefinition): void {
  CHART_REGISTRY.set(def.meta.key, def);
}

export function getChartDefinition(type: string): ChartTypeDefinition {
  const def = CHART_REGISTRY.get(type);
  if (!def) {
    throw new Error(`Unknown chart type: "${type}". Registered types: ${Array.from(CHART_REGISTRY.keys()).join(', ')}`);
  }
  return def;
}

export function getAllChartTypes(): ChartTypeDefinition[] {
  return Array.from(CHART_REGISTRY.values());
}

export function isRegisteredChartType(type: string): boolean {
  return CHART_REGISTRY.has(type);
}
```

- [ ] **Step 2: Create `components/charts-v2/shared/constants.ts`**

Consolidate duplicated constants into one file:

```typescript
// Aggregate functions — was duplicated in ChartDataConfigurationV3.tsx,
// MetricsSelector.tsx, and MapDataConfigurationV3.tsx
export const AGGREGATE_FUNCTIONS = [
  { value: 'sum', label: 'Sum' },
  { value: 'count', label: 'Count' },
  { value: 'avg', label: 'Average' },
  { value: 'max', label: 'Max' },
  { value: 'min', label: 'Min' },
  { value: 'count_distinct', label: 'Count Distinct' },
] as const;

// Filter operators — was in ChartFiltersConfiguration.tsx
export const FILTER_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'greater_than_equal', label: 'Greater Than or Equal' },
  { value: 'less_than_equal', label: 'Less Than or Equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Not Contains' },
  { value: 'in', label: 'In' },
  { value: 'not_in', label: 'Not In' },
  { value: 'is_null', label: 'Is Null' },
  { value: 'is_not_null', label: 'Is Not Null' },
] as const;

// Page size options for pagination — was in ChartPaginationConfiguration.tsx
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
```

- [ ] **Step 3: Create `components/charts-v2/constants.ts`**

Chart type metadata (colors, descriptions) for the type selector UI:

```typescript
// Chart type colors for badges and UI elements
// Consolidates constants/chart-types.ts CHART_TYPE_COLORS
export const CHART_TYPE_COLORS: Record<string, string> = {
  bar: '#4F46E5',
  line: '#0EA5E9',
  pie: '#F59E0B',
  number: '#10B981',
  table: '#6366F1',
  map: '#EC4899',
};

export function getChartTypeColor(type: string): string {
  return CHART_TYPE_COLORS[type] || '#6B7280';
}
```

- [ ] **Step 4: Write registry tests**

Create `components/charts-v2/__tests__/registry.test.ts`:

```typescript
import { registerChartType, getChartDefinition, getAllChartTypes, isRegisteredChartType } from '../registry';
import type { ChartTypeDefinition } from '../registry';

// Minimal mock chart type for testing
const mockChartType: ChartTypeDefinition = {
  meta: {
    key: 'test-chart',
    label: 'Test Chart',
    icon: () => null,
    color: '#000',
    description: 'A test chart',
  },
  renderer: () => null,
  customizations: () => null,
  defaults: () => ({ showTooltip: true }),
  dataConfigFields: {
    dimension: true,
    extraDimension: false,
    metrics: true,
    filters: true,
    sort: true,
    pagination: true,
    timeGrain: false,
    tableDimensions: false,
  },
};

describe('Chart Registry', () => {
  test('registerChartType and getChartDefinition round-trip', () => {
    registerChartType(mockChartType);
    const result = getChartDefinition('test-chart');
    expect(result.meta.key).toBe('test-chart');
    expect(result.defaults()).toEqual({ showTooltip: true });
  });

  test('getChartDefinition throws for unknown type', () => {
    expect(() => getChartDefinition('nonexistent')).toThrow('Unknown chart type: "nonexistent"');
  });

  test('getAllChartTypes returns all registered types', () => {
    const all = getAllChartTypes();
    expect(all.length).toBeGreaterThanOrEqual(1);
    expect(all.some((t) => t.meta.key === 'test-chart')).toBe(true);
  });

  test('isRegisteredChartType returns correct boolean', () => {
    expect(isRegisteredChartType('test-chart')).toBe(true);
    expect(isRegisteredChartType('nonexistent')).toBe(false);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm run test -- components/charts-v2/__tests__/registry.test.ts`

Expected: All 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/charts-v2/registry.ts components/charts-v2/constants.ts components/charts-v2/shared/constants.ts components/charts-v2/__tests__/registry.test.ts
git commit -m "feat: add chart registry and shared constants for charts-v2"
```

---

## Task 3: Create the shared ECharts base and UI controls

**Files:**
- Create: `components/charts-v2/shared/echarts-base.tsx`
- Create: `components/charts-v2/shared/tooltip-controls.tsx`
- Create: `components/charts-v2/shared/legend-controls.tsx`
- Create: `components/charts-v2/shared/data-label-controls.tsx`
- Create: `components/charts-v2/shared/axis-controls.tsx`
- Create: `components/charts-v2/shared/number-format-section.tsx`

- [ ] **Step 1: Create `components/charts-v2/shared/echarts-base.tsx`**

Extract the common ECharts initialization pattern used by `ChartPreview.tsx` (line 91), `MiniChart.tsx` (line 78), and `MapPreview.tsx`. Provide a single hook:

```typescript
'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

interface UseEChartsBaseOptions {
  config: EChartsOption | null;
  theme?: string;
  notMerge?: boolean;
}

export function useEChartsBase({ config, theme, notMerge = true }: UseEChartsBaseOptions) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // Initialize ECharts instance
  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, theme);
    }

    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, [theme]);

  // Update chart when config changes
  useEffect(() => {
    if (!chartInstance.current || !config) return;

    // Inject font family on all series labels
    const configWithFont = injectFontFamily(config);
    chartInstance.current.setOption(configWithFont, notMerge);
  }, [config, notMerge]);

  // Handle resize
  useEffect(() => {
    if (!chartRef.current || !chartInstance.current) return;

    const observer = new ResizeObserver(() => {
      chartInstance.current?.resize();
    });

    observer.observe(chartRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  const getChartInstance = useCallback(() => chartInstance.current, []);

  return { chartRef, chartInstance: chartInstance.current, getChartInstance };
}

// Inject the app's font family into all series labels
// Extracted from ChartPreview.tsx line 113
function injectFontFamily(config: EChartsOption): EChartsOption {
  const fontFamily = 'var(--font-anek-latin), sans-serif';

  if (config.series && Array.isArray(config.series)) {
    config.series = config.series.map((series: any) => ({
      ...series,
      label: {
        ...series.label,
        fontFamily,
      },
    }));
  }

  return config;
}
```

- [ ] **Step 2: Create shared customization controls**

Create each control as a pure UI component (value + onChange props, no hooks).

**`components/charts-v2/shared/tooltip-controls.tsx`** — Extract the tooltip toggle pattern used in bar/line/pie/map customizations:

```typescript
'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface TooltipControlsProps {
  showTooltip: boolean;
  onChange: (key: string, value: boolean) => void;
}

export function TooltipControls({ showTooltip, onChange }: TooltipControlsProps) {
  return (
    <div className="flex items-center justify-between" data-testid="tooltip-controls">
      <Label htmlFor="show-tooltip">Show Tooltip</Label>
      <Switch
        id="show-tooltip"
        data-testid="show-tooltip-switch"
        checked={showTooltip}
        onCheckedChange={(checked) => onChange('showTooltip', checked)}
      />
    </div>
  );
}
```

**`components/charts-v2/shared/legend-controls.tsx`** — Extract legend controls from bar/line/pie/map customizations. Accepts `positionOptions` prop to support both edge-based (bar/line/pie: top/bottom/left/right) and corner-based (map: top-left/top-right/bottom-left/bottom-right) positions:

```typescript
'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EDGE_POSITIONS = [
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

const CORNER_POSITIONS = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
];

const DISPLAY_OPTIONS = [
  { value: 'paginated', label: 'Paginated' },
  { value: 'scroll', label: 'Scroll' },
];

interface LegendControlsProps {
  showLegend: boolean;
  legendPosition?: string;
  legendDisplay?: string;
  onChange: (key: string, value: unknown) => void;
  positionType?: 'edge' | 'corner';
  showDisplayOption?: boolean;
}

export function LegendControls({
  showLegend,
  legendPosition = 'top',
  legendDisplay = 'paginated',
  onChange,
  positionType = 'edge',
  showDisplayOption = true,
}: LegendControlsProps) {
  const positions = positionType === 'corner' ? CORNER_POSITIONS : EDGE_POSITIONS;

  return (
    <div className="space-y-3" data-testid="legend-controls">
      <div className="flex items-center justify-between">
        <Label htmlFor="show-legend">Show Legend</Label>
        <Switch
          id="show-legend"
          data-testid="show-legend-switch"
          checked={showLegend}
          onCheckedChange={(checked) => onChange('showLegend', checked)}
        />
      </div>

      {showLegend && (
        <>
          <div className="space-y-1">
            <Label htmlFor="legend-position">Legend Position</Label>
            <Select
              value={legendPosition}
              onValueChange={(v) => onChange('legendPosition', v)}
            >
              <SelectTrigger id="legend-position" data-testid="legend-position-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {positions.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showDisplayOption && (
            <div className="space-y-1">
              <Label htmlFor="legend-display">Legend Display</Label>
              <Select
                value={legendDisplay}
                onValueChange={(v) => onChange('legendDisplay', v)}
              >
                <SelectTrigger id="legend-display" data-testid="legend-display-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISPLAY_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

**`components/charts-v2/shared/data-label-controls.tsx`** — Extract data label controls. Accepts `positionOptions` for type-specific positions:

```typescript
'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PositionOption {
  value: string;
  label: string;
}

interface DataLabelControlsProps {
  showDataLabels: boolean;
  dataLabelPosition?: string;
  onChange: (key: string, value: unknown) => void;
  positionOptions: PositionOption[];
}

export function DataLabelControls({
  showDataLabels,
  dataLabelPosition = 'top',
  onChange,
  positionOptions,
}: DataLabelControlsProps) {
  return (
    <div className="space-y-3" data-testid="data-label-controls">
      <div className="flex items-center justify-between">
        <Label htmlFor="show-data-labels">Show Data Labels</Label>
        <Switch
          id="show-data-labels"
          data-testid="show-data-labels-switch"
          checked={showDataLabels}
          onCheckedChange={(checked) => onChange('showDataLabels', checked)}
        />
      </div>

      {showDataLabels && (
        <div className="space-y-1">
          <Label htmlFor="data-label-position">Label Position</Label>
          <Select
            value={dataLabelPosition}
            onValueChange={(v) => onChange('dataLabelPosition', v)}
          >
            <SelectTrigger id="data-label-position" data-testid="data-label-position-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {positionOptions.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
```

**`components/charts-v2/shared/axis-controls.tsx`** — Extract axis title/rotation/number-format from bar and line customizations:

```typescript
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NumberFormatSection } from './number-format-section';

const ROTATION_OPTIONS = [
  { value: 'horizontal', label: 'Horizontal' },
  { value: '45', label: '45°' },
  { value: 'vertical', label: 'Vertical' },
];

interface AxisControlsProps {
  axis: 'x' | 'y';
  title: string;
  labelRotation: string;
  onChange: (key: string, value: unknown) => void;
  showNumberFormat?: boolean;
  numberFormatValue?: string;
  decimalPlacesValue?: number;
  idPrefix: string;
}

export function AxisControls({
  axis,
  title,
  labelRotation,
  onChange,
  showNumberFormat = false,
  numberFormatValue,
  decimalPlacesValue,
  idPrefix,
}: AxisControlsProps) {
  const axisLabel = axis === 'x' ? 'X-Axis' : 'Y-Axis';
  const titleKey = `${axis}AxisTitle`;
  const rotationKey = `${axis}AxisLabelRotation`;

  return (
    <div className="space-y-3" data-testid={`${axis}-axis-controls`}>
      <p className="text-sm font-medium">{axisLabel}</p>

      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-${axis}-axis-title`}>Title</Label>
        <Input
          id={`${idPrefix}-${axis}-axis-title`}
          data-testid={`${axis}-axis-title-input`}
          value={title}
          onChange={(e) => onChange(titleKey, e.target.value)}
          placeholder={`${axisLabel} title`}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-${axis}-axis-rotation`}>Label Rotation</Label>
        <Select value={labelRotation} onValueChange={(v) => onChange(rotationKey, v)}>
          <SelectTrigger id={`${idPrefix}-${axis}-axis-rotation`} data-testid={`${axis}-axis-rotation-select`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROTATION_OPTIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showNumberFormat && (
        <NumberFormatSection
          idPrefix={`${idPrefix}-${axis}-axis`}
          numberFormat={numberFormatValue || 'default'}
          decimalPlaces={decimalPlacesValue || 0}
          onNumberFormatChange={(v) => onChange(`${axis}AxisNumberFormat`, v)}
          onDecimalPlacesChange={(v) => onChange(`${axis}AxisDecimalPlaces`, v)}
        />
      )}
    </div>
  );
}
```

**`components/charts-v2/shared/number-format-section.tsx`** — Extract from `components/charts/types/shared/NumberFormatSection.tsx`. Read the existing file and adapt it with proper typing. Key change: accept `excludeFormats` prop for table charts that exclude percentage/currency:

```typescript
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const FORMAT_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'adaptive_indian', label: 'Adaptive Indian (L, Cr)' },
  { value: 'adaptive_international', label: 'Adaptive International (K, M, B)' },
  { value: 'indian', label: 'Indian (1,23,456)' },
  { value: 'international', label: 'International (123,456)' },
  { value: 'european', label: 'European (123.456)' },
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'currency', label: 'Currency' },
] as const;

interface NumberFormatSectionProps {
  idPrefix: string;
  numberFormat: string;
  decimalPlaces: number;
  onNumberFormatChange: (value: string) => void;
  onDecimalPlacesChange: (value: number) => void;
  excludeFormats?: string[];
  showDescription?: boolean;
}

export function NumberFormatSection({
  idPrefix,
  numberFormat,
  decimalPlaces,
  onNumberFormatChange,
  onDecimalPlacesChange,
  excludeFormats = [],
  showDescription = false,
}: NumberFormatSectionProps) {
  const filteredFormats = FORMAT_OPTIONS.filter((f) => !excludeFormats.includes(f.value));

  return (
    <div className="space-y-2" data-testid={`${idPrefix}-number-format`}>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-format`}>Number Format</Label>
        {showDescription && (
          <p className="text-xs text-muted-foreground">How numbers are displayed</p>
        )}
        <Select value={numberFormat} onValueChange={onNumberFormatChange}>
          <SelectTrigger id={`${idPrefix}-format`} data-testid={`${idPrefix}-format-select`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {filteredFormats.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-decimals`}>Decimal Places</Label>
        <Input
          id={`${idPrefix}-decimals`}
          data-testid={`${idPrefix}-decimals-input`}
          type="number"
          min={0}
          max={10}
          value={decimalPlaces}
          onChange={(e) => onDecimalPlacesChange(parseInt(e.target.value, 10) || 0)}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

Expected: Build succeeds. These are new files with no consumers yet.

- [ ] **Step 4: Commit**

```bash
git add components/charts-v2/shared/
git commit -m "feat: add shared echarts-base hook and UI controls for charts-v2"
```

---

## Task 4: Create bar chart type (reference implementation)

This is the first full chart type plugin. It serves as the template for all others.

**Files:**
- Create: `components/charts-v2/types/bar/bar-defaults.ts`
- Create: `components/charts-v2/types/bar/bar-formatting.ts`
- Create: `components/charts-v2/types/bar/bar-customizations.tsx`
- Create: `components/charts-v2/types/bar/bar-renderer.tsx`
- Create: `components/charts-v2/types/bar/index.ts`

- [ ] **Step 1: Create `bar-defaults.ts`**

Source: `components/charts/ChartBuilder.tsx` lines 48-63 (bar case in `getDefaultCustomizations`).

```typescript
export const BAR_DEFAULTS: Record<string, unknown> = {
  orientation: 'vertical',
  stacked: false,
  showTooltip: true,
  showLegend: true,
  legendDisplay: 'paginated',
  legendPosition: 'top',
  showDataLabels: false,
  dataLabelPosition: 'top',
  xAxisTitle: '',
  yAxisTitle: '',
  xAxisLabelRotation: 'horizontal',
  yAxisLabelRotation: 'horizontal',
};
```

- [ ] **Step 2: Create `bar-formatting.ts`**

Extract `applyLineBarChartFormatting` from `lib/chart-formatting-utils.ts` (line 299) and `applyStackedBarLabels` from `lib/stacked-bar-utils.ts` (line 38). Combine into one function:

```typescript
import type { EChartsOption } from 'echarts';
import { applyLineBarChartFormatting } from '@/lib/chart-formatting-utils';
import { applyStackedBarLabels } from '@/lib/stacked-bar-utils';
import { applyLegendPosition } from '@/lib/chart-legend-utils';

export function applyBarFormatting(
  config: EChartsOption,
  customizations: Record<string, unknown>
): EChartsOption {
  let processed = { ...config };

  // Apply legend positioning
  processed = applyLegendPosition(processed, customizations);

  // Apply axis label and data label formatting (shared with line)
  processed = applyLineBarChartFormatting(processed, customizations);

  // Apply stacked bar total labels (bar-only)
  processed = applyStackedBarLabels(processed, customizations);

  return processed;
}
```

Note: We import from the existing `lib/` utils. This is intentional — the formatting functions are pure and well-tested. The new code reuses them rather than duplicating. When old charts are deleted, these `lib/` files stay (they're used by the new code).

- [ ] **Step 3: Create `bar-customizations.tsx`**

Adapt from `components/charts/types/bar/BarChartCustomizations.tsx`. Key change: use shared controls instead of inline UI:

```typescript
'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TooltipControls } from '../../shared/tooltip-controls';
import { LegendControls } from '../../shared/legend-controls';
import { DataLabelControls } from '../../shared/data-label-controls';
import { AxisControls } from '../../shared/axis-controls';
import type { CustomizationProps } from '../../registry';

const BAR_LABEL_POSITIONS = [
  { value: 'top', label: 'Top' },
  { value: 'inside', label: 'Inside' },
  { value: 'insideBottom', label: 'Bottom' },
];

export function BarCustomizations({ formData, onChange, numericColumns }: CustomizationProps) {
  const customizations = formData.customizations || {};
  const hasExtraDimension = !!formData.extra_dimension_column;
  const hasNumericXAxis = numericColumns && numericColumns.length > 0;

  return (
    <div className="space-y-6 p-4" data-testid="bar-customizations">
      {/* Bar-specific: Orientation */}
      <div className="space-y-1">
        <Label htmlFor="bar-orientation">Orientation</Label>
        <Select
          value={(customizations.orientation as string) || 'vertical'}
          onValueChange={(v) => onChange('orientation', v)}
        >
          <SelectTrigger id="bar-orientation" data-testid="bar-orientation-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vertical">Vertical</SelectItem>
            <SelectItem value="horizontal">Horizontal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bar-specific: Stacked (only when extra dimension exists) */}
      {hasExtraDimension && (
        <div className="flex items-center justify-between">
          <Label htmlFor="bar-stacked">Stacked Bars</Label>
          <Switch
            id="bar-stacked"
            data-testid="bar-stacked-switch"
            checked={!!customizations.stacked}
            onCheckedChange={(checked) => onChange('stacked', checked)}
          />
        </div>
      )}

      {/* Shared controls */}
      <TooltipControls
        showTooltip={customizations.showTooltip as boolean ?? true}
        onChange={onChange}
      />

      <LegendControls
        showLegend={customizations.showLegend as boolean ?? true}
        legendPosition={customizations.legendPosition as string}
        legendDisplay={customizations.legendDisplay as string}
        onChange={onChange}
      />

      <DataLabelControls
        showDataLabels={customizations.showDataLabels as boolean ?? false}
        dataLabelPosition={customizations.dataLabelPosition as string}
        onChange={onChange}
        positionOptions={BAR_LABEL_POSITIONS}
      />

      <AxisControls
        axis="x"
        title={(customizations.xAxisTitle as string) || ''}
        labelRotation={(customizations.xAxisLabelRotation as string) || 'horizontal'}
        onChange={onChange}
        showNumberFormat={!!hasNumericXAxis}
        numberFormatValue={customizations.xAxisNumberFormat as string}
        decimalPlacesValue={customizations.xAxisDecimalPlaces as number}
        idPrefix="bar"
      />

      <AxisControls
        axis="y"
        title={(customizations.yAxisTitle as string) || ''}
        labelRotation={(customizations.yAxisLabelRotation as string) || 'horizontal'}
        onChange={onChange}
        showNumberFormat
        numberFormatValue={customizations.yAxisNumberFormat as string}
        decimalPlacesValue={customizations.yAxisDecimalPlaces as number}
        idPrefix="bar"
      />
    </div>
  );
}
```

- [ ] **Step 4: Create `bar-renderer.tsx`**

```typescript
'use client';

import { useEChartsBase } from '../../shared/echarts-base';
import type { ChartRendererProps } from '../../registry';

export function BarRenderer({ config, customizations }: ChartRendererProps) {
  const { chartRef } = useEChartsBase({
    config: config as import('echarts').EChartsOption,
  });

  return (
    <div
      ref={chartRef}
      data-testid="bar-chart-renderer"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
```

- [ ] **Step 5: Create `index.ts`**

```typescript
import { registerChartType } from '../../registry';
import { BarRenderer } from './bar-renderer';
import { BarCustomizations } from './bar-customizations';
import { BAR_DEFAULTS } from './bar-defaults';
import { applyBarFormatting } from './bar-formatting';
import { BarChart3 } from 'lucide-react';

export const barChartDefinition = {
  meta: {
    key: 'bar',
    label: 'Bar Chart',
    icon: BarChart3,
    color: '#4F46E5',
    description: 'Compare values across categories',
  },
  renderer: BarRenderer,
  customizations: BarCustomizations,
  defaults: () => ({ ...BAR_DEFAULTS }),
  formatting: applyBarFormatting,
  dataConfigFields: {
    dimension: true,
    extraDimension: true,
    metrics: true,
    filters: true,
    sort: true,
    pagination: true,
    timeGrain: true,
    tableDimensions: false,
  },
};

registerChartType(barChartDefinition);
```

- [ ] **Step 6: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add components/charts-v2/types/bar/
git commit -m "feat: add bar chart type plugin for charts-v2"
```

---

## Task 5: Create remaining ECharts chart types (line, pie, number)

Follow the same pattern as Task 4. Each chart type gets its own folder with defaults, formatting, customizations, renderer, and index.

**Files:**
- Create: `components/charts-v2/types/line/` (5 files)
- Create: `components/charts-v2/types/pie/` (5 files)
- Create: `components/charts-v2/types/number/` (5 files)

- [ ] **Step 1: Create line chart type**

**`line-defaults.ts`** — Source: `ChartBuilder.tsx` lines 72-85:
```typescript
export const LINE_DEFAULTS: Record<string, unknown> = {
  lineStyle: 'smooth',
  showDataPoints: true,
  showTooltip: true,
  showLegend: true,
  legendDisplay: 'paginated',
  legendPosition: 'top',
  showDataLabels: false,
  dataLabelPosition: 'top',
  xAxisTitle: '',
  yAxisTitle: '',
  xAxisLabelRotation: 'horizontal',
  yAxisLabelRotation: 'horizontal',
};
```

**`line-formatting.ts`** — Same as bar but without stacked labels:
```typescript
import type { EChartsOption } from 'echarts';
import { applyLineBarChartFormatting } from '@/lib/chart-formatting-utils';
import { applyLegendPosition } from '@/lib/chart-legend-utils';

export function applyLineFormatting(
  config: EChartsOption,
  customizations: Record<string, unknown>
): EChartsOption {
  let processed = { ...config };
  processed = applyLegendPosition(processed, customizations);
  processed = applyLineBarChartFormatting(processed, customizations);
  return processed;
}
```

**`line-customizations.tsx`** — Same shared controls as bar, but replace orientation/stacked with line-specific: line style (smooth/straight) and show data points toggle. Data label positions: top, bottom, left, right. Adapt from `components/charts/types/line/LineChartCustomizations.tsx`.

**`line-renderer.tsx`** — Same pattern as bar-renderer.

**`index.ts`** — Register with `key: 'line'`, `icon: LineChart` from lucide-react, `color: '#0EA5E9'`. Same `dataConfigFields` as bar.

- [ ] **Step 2: Create pie chart type**

**`pie-defaults.ts`** — Source: `ChartBuilder.tsx` lines 65-72:
```typescript
export const PIE_DEFAULTS: Record<string, unknown> = {
  chartStyle: 'donut',
  labelFormat: 'percentage',
  showTooltip: true,
  showLegend: true,
  legendDisplay: 'paginated',
  legendPosition: 'top',
  showDataLabels: true,
  dataLabelPosition: 'outside',
};
```

**`pie-formatting.ts`**:
```typescript
import type { EChartsOption } from 'echarts';
import { applyPieChartFormatting } from '@/lib/chart-formatting-utils';
import { applyLegendPosition } from '@/lib/chart-legend-utils';

export function applyPieFormatting(
  config: EChartsOption,
  customizations: Record<string, unknown>
): EChartsOption {
  let processed = { ...config };
  // Strip axes (pie has no axes)
  processed = { ...processed, grid: undefined, xAxis: undefined, yAxis: undefined };
  processed = applyLegendPosition(processed, customizations);
  processed = applyPieChartFormatting(processed, customizations);
  return processed;
}
```

**`pie-customizations.tsx`** — Shared: `TooltipControls`, `LegendControls`, `DataLabelControls` (positions: outside/inside), `NumberFormatSection`. Pie-specific: chart style (donut/full), slice limit (all/3/5/10), label format (percentage/value/name+percentage/name+value). Adapt from `components/charts/types/pie/PieChartCustomizations.tsx`.

**`pie-renderer.tsx`** — Same ECharts base pattern.

**`index.ts`** — Register with `key: 'pie'`, `icon: PieChart`, `color: '#F59E0B'`. `dataConfigFields`: `{ dimension: true, extraDimension: true, metrics: true, maxMetrics: 1, filters: true, sort: true, pagination: true, timeGrain: false, tableDimensions: false }`.

- [ ] **Step 3: Create number chart type**

**`number-defaults.ts`** — Source: `ChartBuilder.tsx` lines 86-93:
```typescript
export const NUMBER_DEFAULTS: Record<string, unknown> = {
  numberSize: 'medium',
  subtitle: '',
  numberFormat: 'default',
  decimalPlaces: 0,
  numberPrefix: '',
  numberSuffix: '',
};
```

**`number-formatting.ts`**:
```typescript
import type { EChartsOption } from 'echarts';
import { applyNumberChartFormatting } from '@/lib/chart-formatting-utils';

export function applyNumberFormatting(
  config: EChartsOption,
  customizations: Record<string, unknown>
): EChartsOption {
  let processed = { ...config };
  processed = { ...processed, grid: undefined, xAxis: undefined, yAxis: undefined };
  processed = applyNumberChartFormatting(processed, customizations);
  return processed;
}
```

**`number-customizations.tsx`** — Shared: `NumberFormatSection`. Number-specific: number size (small/medium/large radio), subtitle input, prefix input, suffix input. Adapt from `components/charts/types/number/NumberChartCustomizations.tsx`.

**`number-renderer.tsx`** — Same ECharts base pattern.

**`index.ts`** — Register with `key: 'number'`, `icon: Hash`, `color: '#10B981'`. `dataConfigFields`: `{ dimension: false, extraDimension: false, metrics: true, maxMetrics: 1, filters: true, sort: false, pagination: false, timeGrain: false, tableDimensions: false }`.

- [ ] **Step 4: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add components/charts-v2/types/line/ components/charts-v2/types/pie/ components/charts-v2/types/number/
git commit -m "feat: add line, pie, and number chart type plugins for charts-v2"
```

---

## Task 6: Create table chart type

**Files:**
- Create: `components/charts-v2/types/table/` (4 files: defaults, customizations, renderer, index)

- [ ] **Step 1: Create table chart type files**

**`table-defaults.ts`**:
```typescript
export const TABLE_DEFAULTS: Record<string, unknown> = {};
```

**`table-customizations.tsx`** — Adapt from `components/charts/types/table/TableChartCustomizations.tsx`. Uses `NumberFormatSection` with `excludeFormats={['percentage', 'currency']}` for per-column formatting. Receives `columns` prop (numeric columns) and renders an expandable accordion for each.

**`table-renderer.tsx`** — Adapt from `components/charts/TableChart.tsx`. This is the HTML table renderer with sorting, pagination, URL detection, and column formatting. This is a larger component (~500 lines) — copy the logic from `TableChart.tsx` and adapt the props to match `ChartRendererProps`. The `data` prop maps to the table rows, and `customizations` provides `columnFormatting`.

**`index.ts`** — Register with `key: 'table'`, `icon: Table2` from lucide-react, `color: '#6366F1'`. No `formatting` function. `dataConfigFields`: `{ dimension: false, extraDimension: false, metrics: true, filters: true, sort: true, pagination: true, timeGrain: false, tableDimensions: true }`.

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add components/charts-v2/types/table/
git commit -m "feat: add table chart type plugin for charts-v2"
```

---

## Task 7: Create map chart type

Map is the most complex chart type. It has its own data config, drill-down state machine, and several sub-components.

**Files:**
- Create: `components/charts-v2/types/map/` (9 files)

- [ ] **Step 1: Create `map-defaults.ts`**

Source: `ChartBuilder.tsx` lines 94-102:
```typescript
export const MAP_DEFAULTS: Record<string, unknown> = {
  colorScheme: 'Blues',
  showTooltip: true,
  showLegend: true,
  legendPosition: 'bottom-left',
  nullValueLabel: 'No Data',
  title: '',
  showLabels: false,
};
```

- [ ] **Step 2: Create `map-drill-down.ts`**

Extract the drill-down state machine logic from `components/charts/map/MapPreview.tsx`. This is the `DrillDownLevel` interface and the state management logic for navigating between geographic levels:

```typescript
export interface DrillDownLevel {
  level: number;
  name: string;
  geographic_column: string;
  parent_selections: Array<{ column: string; value: string }>;
}

export interface DrillDownState {
  path: DrillDownLevel[];
  currentLevel: number;
}

export function createInitialDrillDownState(): DrillDownState {
  return { path: [], currentLevel: 0 };
}

export function drillDown(state: DrillDownState, level: DrillDownLevel): DrillDownState {
  return {
    path: [...state.path, level],
    currentLevel: state.currentLevel + 1,
  };
}

export function drillUp(state: DrillDownState, toLevel: number): DrillDownState {
  return {
    path: state.path.slice(0, toLevel),
    currentLevel: toLevel,
  };
}

export function drillHome(): DrillDownState {
  return createInitialDrillDownState();
}
```

- [ ] **Step 3: Create map sub-components**

Copy and adapt from existing components, updating imports to use split hooks:

- **`map-data-config.tsx`** — Adapt from `components/charts/map/MapDataConfigurationV3.tsx` (426 lines). Change imports: `useColumns` from `@/hooks/api/useWarehouse`, `useChartDataPreview` from `@/hooks/api/useChartData`. Use `AGGREGATE_FUNCTIONS` from `../../shared/constants`.
- **`map-customizations.tsx`** — Adapt from `components/charts/types/map/MapChartCustomizations.tsx` (239 lines). Use `TooltipControls` and `LegendControls` (with `positionType="corner"`) from shared. Fix `formData: any` to proper typing using `CustomizationProps`.
- **`layer-configuration.tsx`** — Copy from `components/charts/map/LayerConfiguration.tsx` (323 lines). Update hook imports.
- **`dynamic-level-config.tsx`** — Copy from `components/charts/map/DynamicLevelConfig.tsx` (465 lines). Update imports: `useAvailableRegionTypes`, `useRegions`, `useRegionGeoJSONs` from `@/hooks/api/useMapData`.
- **`multi-select-layer-card.tsx`** — Copy from `components/charts/map/MultiSelectLayerCard.tsx` (472 lines). Update imports: `useChildRegions`, `useRegionGeoJSONs`, `useRegionHierarchy` from `@/hooks/api/useMapData`.

- [ ] **Step 4: Create `map-renderer.tsx`**

Adapt from `components/charts/map/MapPreview.tsx` (964 lines). This component builds ECharts config client-side, uses `echarts.registerMap()`, and renders the map with zoom controls and breadcrumbs. Key changes:
- Use `useEChartsBase` from `../../shared/echarts-base` for init/cleanup
- Import drill-down logic from `./map-drill-down`
- Use `DrillDownParams` from registry types for the `onDrillDown` callback

- [ ] **Step 5: Create `index.ts`**

```typescript
import { registerChartType } from '../../registry';
import { MapRenderer } from './map-renderer';
import { MapCustomizations } from './map-customizations';
import { MAP_DEFAULTS } from './map-defaults';
import { MapDataConfig } from './map-data-config';
import { MapPin } from 'lucide-react';

export const mapChartDefinition = {
  meta: {
    key: 'map',
    label: 'Map Chart',
    icon: MapPin,
    color: '#EC4899',
    description: 'Visualize data on geographic maps',
  },
  renderer: MapRenderer,
  customizations: MapCustomizations,
  defaults: () => ({ ...MAP_DEFAULTS }),
  dataConfigOverride: {
    component: MapDataConfig,
  },
  dataConfigFields: {
    dimension: false,
    extraDimension: false,
    metrics: true,
    maxMetrics: 1,
    filters: false,
    sort: false,
    pagination: false,
    timeGrain: false,
    tableDimensions: false,
  },
};

registerChartType(mapChartDefinition);
```

- [ ] **Step 6: Verify build**

Run: `npm run build`

- [ ] **Step 7: Commit**

```bash
git add components/charts-v2/types/map/
git commit -m "feat: add map chart type plugin for charts-v2"
```

---

## Task 8: Create builder shell and data config panel

**Files:**
- Create: `components/charts-v2/builder/chart-builder-utils.ts`
- Create: `components/charts-v2/builder/chart-builder-shell.tsx`
- Create: `components/charts-v2/builder/data-config/chart-data-configuration.tsx`
- Create: `components/charts-v2/builder/data-config/` (remaining sub-components)
- Create: `components/charts-v2/builder/dialogs/save-options-dialog.tsx`
- Create: `components/charts-v2/builder/dialogs/unsaved-changes-dialog.tsx`
- Create: `components/charts-v2/__tests__/chart-builder-utils.test.ts`

- [ ] **Step 1: Create `chart-builder-utils.ts`**

```typescript
import { getChartDefinition, getAllChartTypes } from '../registry';
import type { ChartBuilderFormData, ChartCreate, ChartUpdate, ChartDataPayload } from '@/types/charts';
import { getApiCustomizations } from '@/lib/chart-payload-utils';

export function getDefaultCustomizations(chartType: string): Record<string, unknown> {
  return getChartDefinition(chartType).defaults();
}

export function preserveCustomizationsOnTypeChange(
  oldType: string,
  newType: string,
  current: Record<string, unknown>
): Record<string, unknown> {
  const newDefaults = getDefaultCustomizations(newType);
  const oldDefaults = getDefaultCustomizations(oldType);

  // Preserve shared keys that exist in both old and new defaults
  const preserved: Record<string, unknown> = { ...newDefaults };

  const sharedKeys = ['showTooltip', 'showLegend', 'showDataLabels'];
  for (const key of sharedKeys) {
    if (key in oldDefaults && key in newDefaults && key in current) {
      preserved[key] = current[key];
    }
  }

  // Preserve user-entered text values
  const textKeys = ['xAxisTitle', 'yAxisTitle', 'subtitle'];
  for (const key of textKeys) {
    if (key in newDefaults && key in current && current[key]) {
      preserved[key] = current[key];
    }
  }

  return preserved;
}

export function buildSavePayload(formData: ChartBuilderFormData): ChartCreate {
  const customizations = formData.customizations || {};
  const apiCustomizations = getApiCustomizations(customizations);

  return {
    title: formData.title || 'Untitled Chart',
    chart_type: formData.chart_type || 'bar',
    computation_type: formData.computation_type || 'aggregated',
    schema_name: formData.schema_name || '',
    table_name: formData.table_name || '',
    extra_config: {
      x_axis_column: formData.x_axis_column,
      y_axis_column: formData.y_axis_column,
      dimension_column: formData.dimension_column,
      aggregate_column: formData.aggregate_column,
      aggregate_function: formData.aggregate_function,
      extra_dimension_column: formData.extra_dimension_column,
      metrics: formData.metrics,
      time_grain: formData.time_grain,
      geographic_column: formData.geographic_column,
      value_column: formData.value_column,
      selected_geojson_id: formData.selected_geojson_id,
      layers: formData.layers,
      table_columns: formData.table_columns,
      column_formatting: formData.column_formatting,
      dimensions: formData.dimensions,
      dimension_columns: formData.dimension_columns,
      customizations: apiCustomizations,
      filters: formData.filters,
      pagination: formData.pagination,
      sort: formData.sort,
      geographic_hierarchy: formData.geographic_hierarchy,
      drill_down_enabled: formData.drill_down_enabled,
      district_column: formData.district_column,
      ward_column: formData.ward_column,
      subward_column: formData.subward_column,
    },
  };
}

export function buildDataPayload(formData: ChartBuilderFormData): ChartDataPayload | null {
  if (!formData.schema_name || !formData.table_name || !formData.chart_type) {
    return null;
  }

  return {
    chart_type: formData.chart_type,
    computation_type: formData.computation_type || 'aggregated',
    schema_name: formData.schema_name,
    table_name: formData.table_name,
    dimension_col: formData.chart_type === 'map' ? formData.geographic_column : formData.dimension_column,
    aggregate_col: formData.aggregate_column,
    aggregate_func: formData.aggregate_function,
    extra_dimension: formData.extra_dimension_column,
    metrics: formData.metrics,
    dimensions: formData.dimension_columns,
    geographic_column: formData.geographic_column,
    value_column: formData.value_column,
    selected_geojson_id: formData.selected_geojson_id,
    customizations: formData.customizations,
    extra_config: {
      time_grain: formData.time_grain,
      filters: formData.filters,
      pagination: formData.pagination,
      sort: formData.sort,
    },
  };
}
```

- [ ] **Step 2: Write tests for `chart-builder-utils.ts`**

Create `components/charts-v2/__tests__/chart-builder-utils.test.ts`:

```typescript
// Import chart types to trigger registration
import '../types/bar';
import '../types/line';
import '../types/pie';
import '../types/number';
import '../types/table';

import { getDefaultCustomizations, preserveCustomizationsOnTypeChange, buildDataPayload } from '../builder/chart-builder-utils';

describe('getDefaultCustomizations', () => {
  test('returns bar defaults', () => {
    const defaults = getDefaultCustomizations('bar');
    expect(defaults.orientation).toBe('vertical');
    expect(defaults.stacked).toBe(false);
    expect(defaults.showTooltip).toBe(true);
  });

  test('returns pie defaults', () => {
    const defaults = getDefaultCustomizations('pie');
    expect(defaults.chartStyle).toBe('donut');
    expect(defaults.showDataLabels).toBe(true);
  });

  test('returns number defaults', () => {
    const defaults = getDefaultCustomizations('number');
    expect(defaults.numberSize).toBe('medium');
    expect(defaults.numberPrefix).toBe('');
  });

  test('returns empty object for table', () => {
    const defaults = getDefaultCustomizations('table');
    expect(defaults).toEqual({});
  });
});

describe('preserveCustomizationsOnTypeChange', () => {
  test('preserves shared boolean values when switching bar → line', () => {
    const current = { showTooltip: false, showLegend: true, orientation: 'horizontal', stacked: true };
    const result = preserveCustomizationsOnTypeChange('bar', 'line', current);
    expect(result.showTooltip).toBe(false);  // preserved
    expect(result.showLegend).toBe(true);    // preserved
    expect(result).not.toHaveProperty('orientation'); // bar-only, not in line defaults
    expect(result).not.toHaveProperty('stacked');     // bar-only, not in line defaults
    expect(result.lineStyle).toBe('smooth'); // new default
  });

  test('preserves user-entered axis titles', () => {
    const current = { xAxisTitle: 'Revenue', yAxisTitle: 'Month', showTooltip: true };
    const result = preserveCustomizationsOnTypeChange('bar', 'line', current);
    expect(result.xAxisTitle).toBe('Revenue');
    expect(result.yAxisTitle).toBe('Month');
  });
});

describe('buildDataPayload', () => {
  test('returns null when required fields missing', () => {
    expect(buildDataPayload({})).toBeNull();
    expect(buildDataPayload({ schema_name: 'public' })).toBeNull();
  });

  test('builds payload for bar chart', () => {
    const payload = buildDataPayload({
      chart_type: 'bar',
      computation_type: 'aggregated',
      schema_name: 'public',
      table_name: 'sales',
      dimension_column: 'month',
      metrics: [{ column: 'revenue', aggregation: 'sum' }],
    });
    expect(payload).not.toBeNull();
    expect(payload!.chart_type).toBe('bar');
    expect(payload!.dimension_col).toBe('month');
  });

  test('sets dimension_col to geographic_column for map', () => {
    const payload = buildDataPayload({
      chart_type: 'map',
      computation_type: 'aggregated',
      schema_name: 'public',
      table_name: 'regions',
      geographic_column: 'state',
    });
    expect(payload!.dimension_col).toBe('state');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npm run test -- components/charts-v2/__tests__/chart-builder-utils.test.ts`

Expected: All tests pass.

- [ ] **Step 4: Create data config sub-components**

Copy and adapt from `components/charts/`:

- **`builder/data-config/dataset-selector.tsx`** — Copy from `components/charts/DatasetSelector.tsx`. Update import: `useAllSchemaTables` from `@/hooks/api/useWarehouse`.
- **`builder/data-config/chart-type-selector.tsx`** — Rewrite to use registry: call `getAllChartTypes()` to get type metadata instead of hardcoded list.
- **`builder/data-config/metrics-selector.tsx`** — Copy from `components/charts/MetricsSelector.tsx`. Use `AGGREGATE_FUNCTIONS` from `../../shared/constants`.
- **`builder/data-config/time-grain-selector.tsx`** — Copy from `components/charts/TimeGrainSelector.tsx`.
- **`builder/data-config/table-dimensions-selector.tsx`** — Copy from `components/charts/TableDimensionsSelector.tsx`.
- **`builder/data-config/simple-table-configuration.tsx`** — Copy from `components/charts/SimpleTableConfiguration.tsx`.
- **`builder/data-config/chart-filters-configuration.tsx`** — Copy from `components/charts/ChartFiltersConfiguration.tsx`. Use `FILTER_OPERATORS` from `../../shared/constants`.
- **`builder/data-config/chart-sort-configuration.tsx`** — Copy from `components/charts/ChartSortConfiguration.tsx`.
- **`builder/data-config/chart-pagination-configuration.tsx`** — Copy from `components/charts/ChartPaginationConfiguration.tsx`. Use `PAGE_SIZE_OPTIONS` from `../../shared/constants`.

- [ ] **Step 5: Create `builder/data-config/chart-data-configuration.tsx`**

This is the main data config panel. It reads `dataConfigFields` from the registry:

```typescript
'use client';

import { getChartDefinition } from '../../registry';
import { DatasetSelector } from './dataset-selector';
import { ChartTypeSelector } from './chart-type-selector';
import { MetricsSelector } from './metrics-selector';
import { TimeGrainSelector } from './time-grain-selector';
import { TableDimensionsSelector } from './table-dimensions-selector';
import { ChartFiltersConfiguration } from './chart-filters-configuration';
import { ChartSortConfiguration } from './chart-sort-configuration';
import { ChartPaginationConfiguration } from './chart-pagination-configuration';
import type { ChartBuilderFormData } from '@/types/charts';

// Dimension selector, extra dimension selector — inline here or separate files
// depending on complexity. For now inline since they're small.

interface ChartDataConfigurationProps {
  formData: ChartBuilderFormData;
  onChange: (updates: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
}

export function ChartDataConfiguration({ formData, onChange, disabled }: ChartDataConfigurationProps) {
  const chartType = formData.chart_type || 'bar';
  const def = getChartDefinition(chartType);
  const fields = def.dataConfigFields;

  return (
    <div className="space-y-6 p-4" data-testid="chart-data-configuration">
      <DatasetSelector
        schemaName={formData.schema_name || ''}
        tableName={formData.table_name || ''}
        onChange={onChange}
        disabled={disabled}
      />

      <ChartTypeSelector
        value={chartType}
        onChange={(type) => onChange({ chart_type: type as any })}
      />

      {fields.dimension && (
        {/* Dimension/X-Axis selector — adapt from ChartDataConfigurationV3 lines 427-449 */}
      )}

      {fields.tableDimensions && (
        <TableDimensionsSelector
          formData={formData}
          onChange={onChange}
        />
      )}

      <MetricsSelector
        formData={formData}
        onChange={onChange}
        maxMetrics={fields.maxMetrics}
      />

      {fields.timeGrain && (
        <TimeGrainSelector
          formData={formData}
          onChange={onChange}
        />
      )}

      {fields.filters && (
        <ChartFiltersConfiguration
          formData={formData}
          onChange={onChange}
        />
      )}

      {fields.sort && (
        <ChartSortConfiguration
          formData={formData}
          onChange={onChange}
        />
      )}

      {fields.pagination && (
        <ChartPaginationConfiguration
          formData={formData}
          onChange={onChange}
        />
      )}
    </div>
  );
}
```

Note: The dimension selector and extra dimension selector are small enough to be inline in this file, or extracted as `dimension-selector.tsx` and `extra-dimension-selector.tsx` if they grow. Adapt the rendering logic from `ChartDataConfigurationV3.tsx` lines 426-605.

- [ ] **Step 6: Create dialog components**

- **`builder/dialogs/save-options-dialog.tsx`** — Copy from `components/charts/SaveOptionsDialog.tsx`.
- **`builder/dialogs/unsaved-changes-dialog.tsx`** — Copy from `components/charts/UnsavedChangesExitDialog.tsx`.

- [ ] **Step 7: Create `builder/chart-builder-shell.tsx`**

This is the core component. It replaces the 3 duplicated builder implementations. Read and understand:
- `app/charts/new/configure/page.tsx` (1,267 lines) — the create flow
- `app/charts/[id]/edit/page.tsx` (1,851 lines) — the edit flow
- `components/charts/ChartBuilder.tsx` (1,027 lines) — the original builder

The shell manages form state, delegates rendering to the registry, and handles save/cancel. The 3-panel layout:

```typescript
'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getChartDefinition, getAllChartTypes } from '../registry';
import { ChartDataConfiguration } from './data-config/chart-data-configuration';
import { getDefaultCustomizations, preserveCustomizationsOnTypeChange, buildSavePayload, buildDataPayload } from './chart-builder-utils';
import { SaveOptionsDialog } from './dialogs/save-options-dialog';
import { UnsavedChangesDialog } from './dialogs/unsaved-changes-dialog';
import { useCreateChart, useUpdateChart } from '@/hooks/api/useChartMutations';
import { useChartDataPreview } from '@/hooks/api/useChartData';
import { useChart } from '@/hooks/api/useCharts';
import { toastSuccess, toastError } from '@/lib/toast';
import type { ChartBuilderFormData } from '@/types/charts';

// Import all chart types to trigger registration
import '../types/bar';
import '../types/line';
import '../types/pie';
import '../types/number';
import '../types/table';
import '../types/map';

interface ChartBuilderShellProps {
  mode: 'create' | 'edit';
  chartId?: string;
}

export function ChartBuilderShell({ mode, chartId }: ChartBuilderShellProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<ChartBuilderFormData>({});
  const { trigger: createChart } = useCreateChart();
  const { trigger: updateChart } = useUpdateChart();

  // Load existing chart for edit mode
  const { data: existingChart } = useChart(mode === 'edit' && chartId ? parseInt(chartId) : 0);

  // Populate form from existing chart
  useEffect(() => {
    if (mode === 'edit' && existingChart) {
      // Map existing chart data to form state
      setFormData({
        title: existingChart.title,
        chart_type: existingChart.chart_type,
        computation_type: existingChart.computation_type,
        schema_name: existingChart.schema_name,
        table_name: existingChart.table_name,
        ...existingChart.extra_config,
        customizations: existingChart.extra_config?.customizations || getDefaultCustomizations(existingChart.chart_type),
      });
    }
  }, [mode, existingChart]);

  // Handle form changes
  const handleChange = useCallback((updates: Partial<ChartBuilderFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  // Handle customization changes
  const handleCustomizationChange = useCallback((key: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      customizations: { ...prev.customizations, [key]: value },
    }));
  }, []);

  // Handle chart type change with customization preservation
  const handleChartTypeChange = useCallback((newType: string) => {
    setFormData((prev) => {
      const oldType = prev.chart_type || 'bar';
      const newCustomizations = preserveCustomizationsOnTypeChange(
        oldType, newType, prev.customizations || {}
      );
      return { ...prev, chart_type: newType as any, customizations: newCustomizations };
    });
  }, []);

  // Build data payload for preview
  const dataPayload = useMemo(() => buildDataPayload(formData), [formData]);

  // Fetch preview data
  const { data: previewData } = useChartDataPreview(dataPayload);

  // Get chart type definition
  const chartType = formData.chart_type || 'bar';
  const chartDef = useMemo(() => {
    try { return getChartDefinition(chartType); } catch { return null; }
  }, [chartType]);

  // Handle save
  const handleSave = useCallback(async () => {
    try {
      const payload = buildSavePayload(formData);
      if (mode === 'create') {
        await createChart(payload);
        toastSuccess('Chart created successfully');
      } else if (chartId) {
        await updateChart({ id: parseInt(chartId), data: payload });
        toastSuccess('Chart updated successfully');
      }
      router.push('/charts-v2');
    } catch (error) {
      toastError('Failed to save chart');
    }
  }, [formData, mode, chartId, createChart, updateChart, router]);

  if (!chartDef) return null;

  const Customizations = chartDef.customizations;
  const DataConfig = chartDef.dataConfigOverride?.component || ChartDataConfiguration;
  const Renderer = chartDef.renderer;

  // Apply formatting if present
  const processedConfig = useMemo(() => {
    if (!previewData?.echarts_config) return null;
    const config = previewData.echarts_config;
    return chartDef.formatting ? chartDef.formatting(config, formData.customizations || {}) : config;
  }, [previewData, chartDef, formData.customizations]);

  return (
    <div className="h-full flex flex-col" data-testid="chart-builder-shell">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background p-4 flex items-center justify-between">
        <input
          data-testid="chart-title-input"
          className="text-xl font-semibold bg-transparent border-none outline-none"
          value={formData.title || ''}
          onChange={(e) => handleChange({ title: e.target.value })}
          placeholder="Untitled Chart"
        />
        <div className="flex gap-2">
          <button
            data-testid="cancel-btn"
            className="px-4 py-2 text-sm border rounded"
            onClick={() => router.push('/charts-v2')}
          >
            Cancel
          </button>
          <button
            data-testid="save-btn"
            className="px-4 py-2 text-sm text-white rounded shadow-xs"
            style={{ backgroundColor: 'var(--primary)' }}
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>

      {/* 3-Panel Layout */}
      <div className="flex-1 min-h-0 flex">
        {/* Left: Data Config */}
        <div className="w-80 border-r overflow-y-auto" data-testid="data-config-panel">
          <DataConfig formData={formData} onChange={handleChange} />
        </div>

        {/* Center: Preview */}
        <div className="flex-1 min-w-0 p-4" data-testid="preview-panel">
          {processedConfig && (
            <Renderer
              config={processedConfig}
              data={previewData?.data || []}
              customizations={formData.customizations || {}}
            />
          )}
        </div>

        {/* Right: Customizations */}
        <div className="w-80 border-l overflow-y-auto" data-testid="customizations-panel">
          <Customizations
            formData={formData}
            onChange={handleCustomizationChange}
          />
        </div>
      </div>
    </div>
  );
}
```

This is a simplified version. The actual implementation will need to handle more edge cases from the existing code (unsaved changes detection, save-as-new dialog for edit mode, auto-prefill from `lib/chartAutoPrefill.ts`). Refer to the existing implementations for the full logic, but keep the structure clean — the shell orchestrates, the registry provides.

- [ ] **Step 8: Verify build**

Run: `npm run build`

- [ ] **Step 9: Commit**

```bash
git add components/charts-v2/builder/ components/charts-v2/__tests__/chart-builder-utils.test.ts
git commit -m "feat: add chart builder shell and data config for charts-v2"
```

---

## Task 9: Create preview, list, detail, and export components

**Files:**
- Create: `components/charts-v2/preview/` (4 files)
- Create: `components/charts-v2/list/` (3 files)
- Create: `components/charts-v2/detail/` (2 files)
- Create: `components/charts-v2/export/` (3 files)
- Create: `components/charts-v2/utils.ts`

- [ ] **Step 1: Create preview components**

- **`preview/chart-preview.tsx`** — The generic preview container. Uses the registry to get the renderer and apply formatting. Handles loading/error states and chart-vs-data tabs. Simplified version:

```typescript
'use client';

import { useMemo } from 'react';
import { getChartDefinition } from '../registry';
import type { ChartBuilderFormData } from '@/types/charts';

interface ChartPreviewProps {
  chartType: string;
  config: Record<string, any> | null;
  data: unknown[];
  customizations: Record<string, unknown>;
  isLoading?: boolean;
  error?: Error | null;
}

export function ChartPreview({ chartType, config, data, customizations, isLoading, error }: ChartPreviewProps) {
  const chartDef = useMemo(() => {
    try { return getChartDefinition(chartType); } catch { return null; }
  }, [chartType]);

  if (isLoading) return <div data-testid="chart-preview-loading" className="flex items-center justify-center h-full"><span className="animate-spin">Loading...</span></div>;
  if (error) return <div data-testid="chart-preview-error" className="text-destructive">Error loading chart data</div>;
  if (!chartDef || !config) return null;

  const Renderer = chartDef.renderer;
  const processedConfig = chartDef.formatting ? chartDef.formatting(config as any, customizations) : config;

  return (
    <div data-testid="chart-preview" className="w-full h-full">
      <Renderer config={processedConfig} data={data} customizations={customizations} />
    </div>
  );
}
```

- **`preview/data-preview.tsx`** — Adapt from `components/charts/DataPreview.tsx`.
- **`preview/mini-chart.tsx`** — Adapt from `components/charts/MiniChart.tsx`. Use `useEChartsBase` from shared.
- **`preview/static-chart-preview.tsx`** — Copy from `components/charts/StaticChartPreview.tsx`.

- [ ] **Step 2: Create list components**

Extract from `app/charts/page.tsx` (1,384 lines) into 3 focused files:

- **`list/chart-list.tsx`** — Main component. Table rendering, sorting state, pagination. Uses `useCharts()` from `@/hooks/api/useCharts`.
- **`list/chart-list-filters.tsx`** — Filter bar: search input, chart type filter, owner filter, date range. Extracted from the filter UI in the page file.
- **`list/chart-list-actions.tsx`** — Row-level dropdown menu (edit, delete, export, duplicate) + bulk selection actions. Uses `useDeleteChart`, `useBulkDeleteCharts` from `@/hooks/api/useChartMutations`. Includes `ChartDeleteDialog` inline or imported.

Important: All internal navigation links must use `/charts-v2/` prefix (e.g., "Edit" links to `/charts-v2/${id}/edit`).

- [ ] **Step 3: Create detail components**

- **`detail/chart-detail-view.tsx`** — Adapt from `app/charts/[id]/ChartDetailClient.tsx` (874 lines). Fetch chart data, render via registry's renderer with formatting applied, handle drill-down state for map, table pagination. Use `toastSuccess`/`toastError` (fix convention violation in original).
- **`detail/chart-delete-dialog.tsx`** — Copy from `components/charts/ChartDeleteDialog.tsx`. Update import: `useChartDashboards` from `@/hooks/api/useCharts`.

- [ ] **Step 4: Create export components**

- **`export/chart-export.tsx`** — Adapt from `components/charts/ChartExport.tsx`. Use `toastSuccess`/`toastError`.
- **`export/chart-export-dropdown.tsx`** — Adapt from `components/charts/ChartExportDropdown.tsx`. Fix: use `toastSuccess`/`toastError` instead of direct `toast()`.
- **`export/chart-export-dropdown-for-list.tsx`** — Copy from `components/charts/ChartExportDropdownForList.tsx`.

- [ ] **Step 5: Create `utils.ts`**

Any shared chart utilities that don't fit in the specific locations above:

```typescript
// Shared chart utilities for charts-v2

// Deep equality check for unsaved changes detection
// Used by chart-builder-shell.tsx
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);

  for (const key of keys) {
    if (!deepEqual(aObj[key], bObj[key])) return false;
  }

  return true;
}
```

- [ ] **Step 6: Verify build**

Run: `npm run build`

- [ ] **Step 7: Commit**

```bash
git add components/charts-v2/preview/ components/charts-v2/list/ components/charts-v2/detail/ components/charts-v2/export/ components/charts-v2/utils.ts
git commit -m "feat: add preview, list, detail, and export components for charts-v2"
```

---

## Task 10: Create routes and feature flag

**Files:**
- Modify: `hooks/api/useFeatureFlags.ts` (add CHARTS_V2 enum value)
- Modify: `components/main-layout.tsx` (add sidebar item + auto-collapse routes)
- Create: `app/charts-v2/page.tsx`
- Create: `app/charts-v2/new/page.tsx`
- Create: `app/charts-v2/new/configure/page.tsx`
- Create: `app/charts-v2/[id]/page.tsx`
- Create: `app/charts-v2/[id]/edit/page.tsx`

- [ ] **Step 1: Add feature flag**

In `hooks/api/useFeatureFlags.ts`, add to the enum (after line 11):

```typescript
export enum FeatureFlagKeys {
  LOG_SUMMARIZATION = 'LOG_SUMMARIZATION',
  EMBED_SUPERSET = 'EMBED_SUPERSET',
  USAGE_DASHBOARD = 'USAGE_DASHBOARD',
  DATA_QUALITY = 'DATA_QUALITY',
  AI_DATA_ANALYSIS = 'AI_DATA_ANALYSIS',
  DATA_STATISTICS = 'DATA_STATISTICS',
  REPORTS = 'REPORTS',
  CHARTS_V2 = 'CHARTS_V2',
}
```

- [ ] **Step 2: Add sidebar item**

In `components/main-layout.tsx`, inside `getNavItems()`, add after the Charts item (after line 128):

```typescript
{
  title: 'Charts V2',
  href: '/charts-v2',
  icon: ChartBarBig,
  isActive: currentPath.startsWith('/charts-v2'),
  hide: !isFeatureFlagEnabled(FeatureFlagKeys.CHARTS_V2),
},
```

- [ ] **Step 3: Add auto-collapse routes**

In `components/main-layout.tsx`, inside the `shouldAutoCollapse` condition (around line 660), add:

```typescript
pathname.match(/^\/charts-v2\/new\/configure$/) ||
pathname.match(/^\/charts-v2\/[^\/]+\/edit$/) ||
(pathname.match(/^\/charts-v2\/[^\/]+$/) && !pathname.includes('/edit') && !pathname.includes('/new')) ||
```

- [ ] **Step 4: Create thin route pages**

**`app/charts-v2/page.tsx`**:
```typescript
'use client';

import { ChartList } from '@/components/charts-v2/list/chart-list';

export default function ChartsV2Page() {
  return <ChartList />;
}
```

**`app/charts-v2/new/page.tsx`** — Chart type + dataset selection (step 1). Adapt the UI from `app/charts/new/page.tsx` (269 lines) but keep it as a thin page that delegates to a component, or inline since it's small enough. Links navigate to `/charts-v2/new/configure`.

**`app/charts-v2/new/configure/page.tsx`**:
```typescript
'use client';

import { ChartBuilderShell } from '@/components/charts-v2/builder/chart-builder-shell';

export default function ConfigurePage() {
  return <ChartBuilderShell mode="create" />;
}
```

**`app/charts-v2/[id]/page.tsx`**:
```typescript
'use client';

import { use } from 'react';
import { ChartDetailView } from '@/components/charts-v2/detail/chart-detail-view';

export default function ChartDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ChartDetailView chartId={id} />;
}
```

**`app/charts-v2/[id]/edit/page.tsx`**:
```typescript
'use client';

import { use } from 'react';
import { ChartBuilderShell } from '@/components/charts-v2/builder/chart-builder-shell';

export default function EditChartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ChartBuilderShell mode="edit" chartId={id} />;
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`

Expected: Build succeeds. The Charts V2 sidebar item is hidden by default (feature flag not enabled). When the flag is enabled in the backend, the sidebar item appears and all routes work.

- [ ] **Step 6: Run all tests**

Run: `npm run test`

Expected: All existing tests pass (old charts untouched). New registry and builder-utils tests pass.

- [ ] **Step 7: Commit**

```bash
git add hooks/api/useFeatureFlags.ts components/main-layout.tsx app/charts-v2/
git commit -m "feat: add charts-v2 routes, sidebar item, and feature flag"
```

---

## Task 11: Smoke test and final verification

- [ ] **Step 1: Run full build**

Run: `npm run build`

Expected: Clean build, no errors.

- [ ] **Step 2: Run all tests**

Run: `npm run test`

Expected: All tests pass.

- [ ] **Step 3: Run linting**

Run: `npm run lint`

Expected: No new lint errors in charts-v2 code.

- [ ] **Step 4: Manual verification checklist**

Start dev server (`npm run dev`) and verify:

1. Old Charts page (`/charts`) works exactly as before
2. Charts V2 sidebar item is hidden when feature flag is off
3. When feature flag is enabled:
   - Charts V2 sidebar item appears
   - `/charts-v2` shows the chart list
   - `/charts-v2/new` shows chart type selection
   - `/charts-v2/new/configure` shows the 3-panel builder
   - Switching chart types loads different customization panels
   - Preview renders correctly for bar/line/pie/number charts
   - Save creates a chart successfully
   - `/charts-v2/[id]` shows chart detail
   - `/charts-v2/[id]/edit` shows the edit builder with pre-populated data

- [ ] **Step 5: Final commit**

If any fixes were needed during smoke testing, commit them:

```bash
git add -A
git commit -m "fix: address smoke test issues in charts-v2"
```
