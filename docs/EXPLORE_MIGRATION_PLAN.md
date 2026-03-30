# Explore Page Migration Plan: webapp → webapp_v2

> **Source**: webapp (legacy Next.js 14)
> **Target**: webapp_v2 (Next.js 15 + React 19)
> **Estimated Complexity**: High (9 API endpoints, 5 chart types, async task polling, shared components)

---

## Table of Contents

1. [Feature Inventory Checklist](#1-feature-inventory-checklist)
2. [File Mapping](#2-file-mapping)
3. [API Endpoints](#3-api-endpoints)
4. [Component Architecture](#4-component-architecture)
5. [State Management Migration](#5-state-management-migration)
6. [UI Component Mapping](#6-ui-component-mapping)
7. [Chart Migration](#7-chart-migration)
8. [Dependencies](#8-dependencies)
9. [Implementation Order](#9-implementation-order)
10. [Testing Requirements](#10-testing-requirements)
11. [Shared Component Architecture](#11-critical-shared-component-architecture)
12. [Polling & Task Mechanism](#12-critical-polling--task-mechanism-detailed)
13. [Context Providers Architecture](#13-critical-context-providers-architecture)
14. [API Helpers Deep Dive](#14-critical-api-helpers-deep-dive)
15. [Transform Page Integration](#15-transform-page-integration-details)
16. [Additional Patterns](#16-additional-patterns-to-preserve)
17. [DbtModelResponse Type](#17-dbtmodelresponse-type-complete)
18. [Migration Risks & Mitigations](#18-migration-risks--mitigations)
19. [Quick Reference Summary](#19-quick-reference-summary)

---

## 1. Feature Inventory Checklist

### Core Features
- [ ] Full-screen explore dialog/page
- [ ] Close button to exit explore (navigates to /pipeline/ingest)
- [ ] Resizable left sidebar (schemas/tables tree)
- [ ] Two-tab layout (Preview + Statistics)
- [ ] Tab visibility controlled by feature flag (DATA_STATISTICS)

### Left Sidebar (ProjectTree)
- [ ] Tree structure showing schemas as folders
- [ ] Tables as leaf nodes under schemas
- [ ] Real-time search/filter by schema or table name
- [ ] Auto-expand tree when searching
- [ ] Sync button to refresh warehouse tables
- [ ] Loading overlay during sync
- [ ] Empty state: "No data sources available"
- [ ] Permission-based opacity (can_create_dbt_model, can_sync_sources)
- [ ] Tooltips on truncated names
- [ ] Tooltip on sync button

### Preview Tab
- [ ] Display selected table name in header (format: `schema.table`)
- [ ] Download button for CSV export
- [ ] Sortable column headers (server-side sorting)
  - [ ] Sort arrow icons (up/down) on each column header
  - [ ] Click toggles: none → asc → desc → asc
  - [ ] Active column shows filled arrow, others show outline/none
  - [ ] API params: `order_by={column}&order={1 or -1}`
- [ ] Paginated data table (server-side pagination)
  - [ ] API params: `page={n}&limit={size}`
- [ ] Page sizes: 5, 10, 25, 100
- [ ] Page navigation (prev/next)
- [ ] Total rows display (e.g., "Showing 1-10 of 1,234")
- [ ] Sticky table header
- [ ] Horizontal scroll for wide tables (overflow-x: auto)
- [ ] Empty state: "Select a table from the left pane to view"
- [ ] Loading state while fetching

### Statistics Tab
- [ ] Display table name, column count, row count in header
- [ ] Refresh button to recalculate statistics
- [ ] Column list with: name, type, distinct count, null count, distribution
- [ ] Sortable by column name and type (CLIENT-SIDE sorting via useMemo)
- [ ] Row height: 180px (to fit charts)
- [ ] Skeleton loading while fetching column stats
- [ ] Empty state: "No data (0 rows) available"
- [ ] Error state: "No data available"

### Statistics - Chart Types
- [ ] **NumberInsights** (numeric columns)
  - Min, max, mean, median, mode display
  - Toggle between chart and numeric view
  - StatsChart visualization (ECharts box-whisker style)
  - Tooltip for multiple modes
- [ ] **StringInsights** (string columns)
  - Value distribution display
  - Percentage and count
  - Handles all-null and all-distinct cases
- [ ] **RangeChart** (boolean columns)
  - Horizontal stacked bar chart (ECharts)
  - Legend below chart
  - Interactive tooltips
- [ ] **DateTimeInsights** (datetime columns)
  - Date distribution bar chart (ECharts)
  - Min/max date display

### User Interactions
- [ ] Click schema folder to expand/collapse
- [ ] Click table to select and load preview
- [ ] Click sync button to refresh tables
- [ ] Type in search to filter tree
- [ ] Click tab to switch between Preview/Statistics
- [ ] Click column header to sort (Preview tab)
- [ ] Click pagination controls
- [ ] Change rows per page
- [ ] Click download button
- [ ] Click refresh button (Statistics tab)
- [ ] Toggle chart/numeric view (NumberInsights)
- [ ] Hover on charts for tooltips

### Permissions & Auth
- [ ] JWT token authentication
- [ ] Organization context via header
- [ ] Permission: can_create_dbt_model
- [ ] Permission: can_sync_sources
- [ ] Feature flag: DATA_STATISTICS

### Error Handling
- [ ] Toast notifications for API errors
- [ ] Graceful handling of failed statistics
- [ ] Console logging for debugging

### Shared Component Behavior (ProjectTree)
- [ ] `included_in` prop support ('explore' vs 'visual_designer')
- [ ] Delete button hidden in explore mode
- [ ] Add-to-canvas button hidden in explore mode
- [ ] Different handleNodeClick behavior per mode
- [ ] Tree auto-expand when search term present
- [ ] Collapsible schema folders
- [ ] Custom Node renderer with icons
- [ ] Row height: 30px
- [ ] Indent: 8px

### Statistics Polling
- [ ] POST request to start metrics calculation
- [ ] 1-second delay before polling starts
- [ ] 5-second polling interval
- [ ] Poll until: completed, failed, or error
- [ ] Hashkey parameter: "data-insights"
- [ ] Per-column independent polling
- [ ] Cleanup all timers on unmount
- [ ] Skeleton loading while polling
- [ ] Handle multiple modes display (other_modes)

### DateTimeInsights Specifics
- [ ] Range filter: year/month/day
- [ ] Navigation arrows for pagination (10 items)
- [ ] Re-polls backend when filter changes
- [ ] Min/max date display

### StringInsights Specifics
- [ ] Multiple views: RangeChart, BarChart, StatsChart
- [ ] Cycles through 3 visualizations
- [ ] Handles edge cases: all nulls, all distinct

### NumberInsights Specifics
- [ ] Toggle between chart and numeric display (switch icon)
- [ ] ECharts box-whisker style visualization
- [ ] Tooltip for multiple modes (other_modes)
- [ ] Edge case: "All entries identical" message when min === max
- [ ] Values formatted with toLocaleString() and Math.trunc()

### Chart Component Requirements (ECharts)
- [ ] Follow webapp_v2 ChartPreview.tsx patterns
- [ ] Use echarts.init() with proper disposal on unmount
- [ ] Implement ResizeObserver for responsive sizing
- [ ] Use consistent color palette: `#00897b` (primary teal)
- [ ] Teal gradient for stacked bars: `['#00897b', '#33a195', '#66b8b0', '#98d0c9', '#cce7e4', '#c7d8d7']`
- [ ] Consistent tooltip styling (white bg, black 1px border, 8px radius)
- [ ] Label truncation to 10 chars with full text in tooltip
- [ ] 700x100px chart dimensions (or responsive equivalent)

### Tree Data Structure
- [ ] Root folder: "Data"
- [ ] Schema folders as children
- [ ] Tables as leaf nodes under schemas
- [ ] DbtModelResponse normalization from WarehouseTable

---

## 2. File Mapping

### Source Files (webapp)

| Source Path | Purpose | LOC |
|-------------|---------|-----|
| `src/pages/explore/index.tsx` | Entry point | 10 |
| `src/components/Explore/Explore.tsx` | Main container | 197 |
| `src/components/TransformWorkflow/FlowEditor/Components/ProjectTree.tsx` | Tree sidebar (SHARED) | 404 |
| `src/components/TransformWorkflow/FlowEditor/Components/LowerSectionTabs/PreviewPane.tsx` | Data preview (SHARED) | 304 |
| `src/components/TransformWorkflow/FlowEditor/Components/LowerSectionTabs/StatisticsPane.tsx` | Statistics view (SHARED) | 587 |
| `src/components/Charts/NumberInsights.tsx` | Numeric stats chart | ~100 |
| `src/components/Charts/RangeChart.tsx` | Boolean bar chart | ~150 |
| `src/components/Charts/StringInsights.tsx` | String distribution | ~80 |
| `src/components/Charts/DateTimeInsights.tsx` | Datetime chart | ~100 |
| `src/components/Charts/StatsChart.tsx` | D3 stats chart | ~120 |
| `src/components/Charts/BarChart.tsx` | D3 bar chart (used by StringInsights) | ~80 |
| `src/contexts/FlowEditorPreviewContext.tsx` | Preview context | 41 |
| `src/contexts/ParentCommunicationProvider.tsx` | Embedding/iframe communication | ~150 |
| `src/contexts/ContextProvider.tsx` | Global context (permissions, toast, org) | ~100 |
| `src/customHooks/useFeatureFlags.tsx` | Feature flags hook | 54 |
| `src/helpers/http.tsx` | API helpers (httpGet, httpPost, etc.) | 135 |
| `src/utils/common.tsx` | Utilities (delay, getOrgHeaderValue) | ~50 |
| `src/components/ToastMessage/ToastHelper.ts` | Toast helper functions | ~30 |
| `src/components/DBT/UITransformTab.tsx` | Transform page (uses ProjectTree) | ~300 |
| `src/types/transform-v2.types.ts` | Type definitions | ~100 |

### Target Files (webapp_v2)

| Target Path | Purpose | Notes |
|-------------|---------|-------|
| `app/explore/page.tsx` | Entry point (App Router) | |
| `components/explore/Explore.tsx` | Main container | |
| `components/explore/ProjectTree.tsx` | Tree sidebar | **SHARED** - supports `included_in` prop |
| `components/explore/PreviewPane.tsx` | Data preview tab | **SHARED** - used by transform too |
| `components/explore/StatisticsPane.tsx` | Statistics tab | **SHARED** - contains polling logic |
| `components/explore/charts/NumberInsights.tsx` | Numeric stats | ECharts-based |
| `components/explore/charts/RangeChart.tsx` | Boolean chart | ECharts-based |
| `components/explore/charts/StringInsights.tsx` | String distribution | ECharts-based |
| `components/explore/charts/DateTimeInsights.tsx` | Datetime chart | ECharts-based |
| `components/explore/charts/StatsChart.tsx` | Box plot chart | ECharts-based |
| `components/explore/charts/BarChart.tsx` | Bar chart | ECharts-based |
| `hooks/api/useWarehouse.ts` | Warehouse API hooks | SWR-based |
| `hooks/api/useFeatureFlags.ts` | Feature flags hook | SWR-based |
| `hooks/api/useTaskPolling.ts` | Async task polling | Custom hook for statistics |
| `stores/exploreStore.ts` | Zustand store for explore state | |
| `types/explore.ts` | Type definitions | |

**Alternative Structure (if sharing with transform):**
```
components/
├── shared/
│   ├── ProjectTree/
│   │   ├── ProjectTree.tsx
│   │   ├── TreeNode.tsx
│   │   └── index.ts
│   ├── PreviewPane/
│   │   └── PreviewPane.tsx
│   └── StatisticsPane/
│       ├── StatisticsPane.tsx
│       └── charts/
│           ├── NumberInsights.tsx
│           ├── RangeChart.tsx
│           ├── StringInsights.tsx
│           └── DateTimeInsights.tsx
├── explore/
│   └── Explore.tsx
└── transform/
    └── (uses shared components)
```

---

## 3. API Endpoints

### Endpoints to Integrate

| Endpoint | Method | Purpose | Response Type |
|----------|--------|---------|---------------|
| `warehouse/sync_tables?fresh=1` | GET | Fetch all schemas/tables | `WarehouseTable[]` |
| `warehouse/table_columns/{schema}/{table}` | GET | Column metadata | `{name, data_type}[]` |
| `warehouse/table_data/{schema}/{table}` | GET | Paginated table data | `any[]` |
| `warehouse/table_count/{schema}/{table}` | GET | Total row count | `{total_rows: number}` |
| `warehouse/download/{schema}/{table}` | GET | Download CSV | `Blob` |
| `warehouse/v1/table_data/{schema}/{table}` | GET | Column types | `{name, translated_type}[]` |
| `warehouse/insights/metrics/` | POST | Request statistics | `{task_id: string}` |
| `tasks/{taskId}?hashkey=data-insights` | GET | Poll task status | `{progress: [...]}` |
| `organizations/flags` | GET | Feature flags | `{[key]: boolean}` |

### API Hooks to Create

```typescript
// hooks/api/useWarehouse.ts

// Fetch all tables
export function useWarehouseTables(fresh?: boolean);

// Fetch table columns
export function useTableColumns(schema: string, table: string);

// Fetch table data (paginated)
export function useTableData(schema: string, table: string, params: {
  page: number;
  limit: number;
  order_by?: string;
  order?: 1 | -1;
});

// Fetch row count
export function useTableCount(schema: string, table: string);

// Download table as CSV (imperative, not hook)
export async function downloadTableCSV(schema: string, table: string): Promise<Blob>;

// Request statistics calculation
export async function requestTableMetrics(params: {
  db_schema: string;
  db_table: string;
  column_name: string;
  filter?: { range: string; limit: number; offset: number };
}): Promise<{ task_id: string }>;

// Poll task status
export function useTaskStatus(taskId: string | null, hashkey: string);
```

### Query Parameters

**table_data endpoint:**
- `page`: number (1-indexed)
- `limit`: number (5, 10, 25, 100)
- `order_by`: string (column name)
- `order`: 1 | -1 (ascending/descending)

---

## 4. Component Architecture

### Component Hierarchy

```
app/explore/page.tsx
│
└─ ExploreProvider (Zustand context or React context)
   └─ Explore
      │
      ├─ ResizablePanel (left sidebar)
      │  └─ ProjectTree
      │     ├─ SearchInput
      │     ├─ SyncButton
      │     └─ Tree (react-arborist)
      │        └─ TreeNode (custom renderer)
      │
      └─ ContentPanel (right side)
         ├─ Tabs
         │  ├─ Tab "Preview"
         │  └─ Tab "Data Statistics" (conditional)
         │
         └─ TabContent
            ├─ PreviewPane (when preview selected)
            │  ├─ Header (table name + download)
            │  ├─ DataTable (sortable)
            │  └─ Pagination
            │
            └─ StatisticsPane (when statistics selected)
               ├─ Header (table name + counts + refresh)
               └─ StatisticsTable
                  └─ StatisticsRow (per column)
                     └─ ChartCell
                        ├─ NumberInsights
                        ├─ StringInsights
                        ├─ RangeChart
                        └─ DateTimeInsights
```

### Props Interface

```typescript
// ProjectTree
interface ProjectTreeProps {
  tables: WarehouseTable[];
  loading: boolean;
  onSync: () => void;
  onTableSelect: (schema: string, table: string) => void;
  selectedTable: { schema: string; table: string } | null;
}

// PreviewPane
interface PreviewPaneProps {
  schema: string;
  table: string;
}

// StatisticsPane
interface StatisticsPaneProps {
  schema: string;
  table: string;
}

// Chart components
interface NumberInsightsProps {
  data: {
    minVal: number;
    maxVal: number;
    mean: number;
    median: number;
    mode: number;
    other_modes?: number[];
  };
}

interface RangeChartProps {
  data: Array<{ name: string; percentage: number; count: number }>;
}

interface StringInsightsProps {
  data: {
    charts: Array<{ data: Array<{ category: string; count: number }> }>;
    count: number;
    countNull: number;
    countDistinct: number;
  };
}

interface DateTimeInsightsProps {
  data: {
    charts: Array<{ data: any[] }>;
    minVal: string;
    maxVal: string;
  };
}
```

---

## 5. State Management Migration

### Legacy (webapp) → New (webapp_v2)

| Legacy Pattern | webapp_v2 Pattern |
|----------------|-------------------|
| useState for local state | Keep useState |
| FlowEditorPreviewContext | Zustand store OR React context |
| GlobalContext (permissions) | useUserPermissions hook |
| GlobalContext (toast) | Sonner toast (already in v2) |
| Global org context | useAuthStore (already in v2) |

### Zustand Store Design

```typescript
// stores/exploreStore.ts
interface ExploreState {
  // Selected table
  selectedTable: { schema: string; table: string } | null;
  setSelectedTable: (table: { schema: string; table: string } | null) => void;

  // Active tab
  activeTab: 'preview' | 'statistics';
  setActiveTab: (tab: 'preview' | 'statistics') => void;

  // Sidebar width (for persistence)
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
}
```

### SWR for Server State

All API data fetching should use SWR hooks:
- `useWarehouseTables()` - GET warehouse/sync_tables
- `useTableColumns(schema, table)` - GET warehouse/table_columns
- `useTableData(schema, table, params)` - GET warehouse/table_data
- `useTableCount(schema, table)` - GET warehouse/table_count
- `useTaskStatus(taskId)` - GET tasks/{taskId} (polling)
- `useFeatureFlags()` - GET organizations/flags

---

## 6. UI Component Mapping

### MUI → Radix/shadcn Mapping

| MUI Component | webapp_v2 Equivalent |
|---------------|---------------------|
| Dialog (fullScreen) | Full page or Dialog from ui/dialog |
| Tabs, Tab | Tabs from ui/tabs |
| Table, TableHead, TableBody, TableRow, TableCell | Table from ui/table |
| TablePagination | Custom pagination with ui/button |
| TableSortLabel | Custom with icons |
| TextField | Input from ui/input |
| Button, IconButton | Button from ui/button |
| CircularProgress | Spinner/loader |
| Tooltip | Tooltip from ui/tooltip |
| Typography | Native HTML + Tailwind |
| Box | Native div + Tailwind |
| Skeleton | Skeleton from ui/skeleton |

### Specific Component Mappings

```tsx
// MUI Dialog fullScreen → webapp_v2
// Option 1: Full page (recommended for explore)
// app/explore/page.tsx as dedicated route

// Option 2: Full-screen dialog
<Dialog open={true} className="w-screen h-screen max-w-none">
  ...
</Dialog>

// MUI Tabs → shadcn Tabs
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="preview">Preview</TabsTrigger>
    <TabsTrigger value="statistics">Data Statistics</TabsTrigger>
  </TabsList>
  <TabsContent value="preview">...</TabsContent>
  <TabsContent value="statistics">...</TabsContent>
</Tabs>

// MUI Table → shadcn Table
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Column</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Value</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

---

## 7. Chart Migration (D3 → ECharts)

### Existing ECharts Patterns in webapp_v2

webapp_v2 has established ECharts patterns in `components/charts/` and `components/dashboard/`:

**Key Files to Reference:**
- `components/charts/ChartPreview.tsx` - Main ECharts renderer
- `components/dashboard/chart-element-view.tsx` - Comprehensive implementation (1,833 LOC)
- `lib/chart-legend-utils.ts` - Legend positioning utilities
- `lib/responsive-legend.ts` - Responsive behavior utilities
- `lib/chart-export.ts` - Export functionality

**ECharts Registration Pattern:**
```typescript
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, GaugeChart, ScatterChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, GridComponent, LegendComponent, DatasetComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart, LineChart, PieChart, GaugeChart, ScatterChart,
  TitleComponent, TooltipComponent, GridComponent, LegendComponent,
  DatasetComponent, CanvasRenderer,
]);
```

**Chart Instance Lifecycle Pattern:**
```typescript
const chartRef = useRef<HTMLDivElement>(null);
const chartInstance = useRef<echarts.ECharts | null>(null);

useEffect(() => {
  if (chartRef.current && !chartInstance.current) {
    chartInstance.current = echarts.init(chartRef.current);
  }

  if (chartInstance.current && config) {
    chartInstance.current.setOption(config, { notMerge: true });
  }

  return () => {
    if (chartInstance.current) {
      chartInstance.current.dispose();
      chartInstance.current = null;
    }
  };
}, [config]);
```

---

### Detailed Chart Migration Specifications

#### 1. NumberInsights (Numeric Columns)

**Legacy Behavior:**
- Two modes: `'chart'` (StatsChart) and `'numbers'` (stat boxes)
- Toggle via switch icon
- Shows: minimum, maximum, mean, median, mode
- Special tooltip for "other modes" if multiple modes exist
- Edge case: "All entries in this column are identical" when min === max

**Props Interface:**
```typescript
interface NumberInsightsProps {
  data: {
    minimum: number;
    maximum: number;
    mean: number;
    median: number;
    mode: number | null;
    otherModes: number[] | null;
  };
  type?: 'chart' | 'numbers';
}
```

**ECharts Migration - StatsChart (Box-Whisker Style):**
```typescript
const option: EChartsOption = {
  tooltip: {
    trigger: 'item',
    formatter: (params) => {
      const { name, value } = params;
      if (name === 'Mode' && data.otherModes?.length) {
        return `${name}: ${value}<br/>Other modes: ${data.otherModes.join(', ')}`;
      }
      return `${name}: ${value.toLocaleString()}`;
    },
    backgroundColor: '#fff',
    borderColor: '#000',
    borderWidth: 1,
  },
  xAxis: {
    type: 'value',
    min: data.minimum,
    max: data.maximum,
    axisLabel: { formatter: (v) => Math.trunc(v).toLocaleString() },
  },
  yAxis: { type: 'category', data: [''] },
  series: [
    // Central box (mean to median range)
    {
      type: 'bar',
      data: [[Math.min(data.mean, data.median, data.mode ?? data.mean),
              Math.max(data.mean, data.median, data.mode ?? data.mean)]],
      itemStyle: { color: '#00897b' },
      barWidth: 10,
    },
    // Whisker markers
    {
      type: 'scatter',
      data: [
        { value: [data.minimum, 0], name: 'Min' },
        { value: [data.maximum, 0], name: 'Max' },
        { value: [data.mean, 0], name: 'Mean' },
        { value: [data.median, 0], name: 'Median' },
        ...(data.mode !== null ? [{ value: [data.mode, 0], name: 'Mode' }] : []),
      ],
      symbol: 'rect',
      symbolSize: [2, 20],
      itemStyle: { color: '#000' },
      label: {
        show: true,
        position: 'top',
        formatter: (p) => `${p.name}: ${Math.trunc(p.value[0]).toLocaleString()}`,
      },
    },
  ],
  grid: { top: 40, bottom: 20, left: 60, right: 60 },
};
```

**Numbers Mode (Keep as JSX, no chart):**
```tsx
<div className="flex items-center min-h-[110px] min-w-[700px] gap-12">
  {['minimum', 'maximum', 'mean', 'median', 'mode'].map((key) => (
    <div key={key}>
      <span className="text-[rgba(15,36,64,0.57)] text-xs capitalize">{key}</span>
      <div className="bg-[#F5FAFA] h-6 w-[84px] flex items-center justify-center">
        {data[key]?.toLocaleString() ?? 'NA'}
      </div>
    </div>
  ))}
</div>
```

---

#### 2. RangeChart (Boolean Columns)

**Legacy Behavior:**
- Stacked horizontal bar chart (700x100px)
- Shows True/False distribution as percentage
- Legend below bar with colored squares
- Tooltip on hover: "name: percentage% | Count: count"
- Colors: teal gradient `['#00897b', '#33a195', '#66b8b0', '#98d0c9', '#cce7e4', '#c7d8d7']`

**Props Interface:**
```typescript
interface RangeChartProps {
  data: Array<{
    name: string;       // "True", "False", etc.
    percentage: string; // "65.5"
    count: number;
  }>;
  colors?: string[];
  barHeight?: number;   // Default 16
}
```

**ECharts Migration:**
```typescript
const colors = ['#00897b', '#33a195', '#66b8b0', '#98d0c9', '#cce7e4', '#c7d8d7'];
const totalCount = data.reduce((sum, d) => sum + d.count, 0);

const option: EChartsOption = {
  tooltip: {
    trigger: 'item',
    formatter: (params) => {
      const item = data[params.dataIndex];
      return `<strong>${item.name}</strong>: ${item.percentage}% | Count: ${item.count}`;
    },
    backgroundColor: '#fff',
    borderColor: '#000',
    borderWidth: 1,
  },
  legend: {
    show: true,
    bottom: 0,
    left: 'center',
    orient: 'horizontal',
    itemWidth: 16,
    itemHeight: 8,
    data: data.map((d, i) => ({
      name: d.name.length > 10 ? d.name.substring(0, 10) + '...' : d.name,
      itemStyle: { color: colors[i % colors.length] },
    })),
  },
  xAxis: { type: 'value', max: 100, show: false },
  yAxis: { type: 'category', data: [''], show: false },
  series: data.map((d, i) => ({
    name: d.name,
    type: 'bar',
    stack: 'total',
    data: [parseFloat(d.percentage)],
    itemStyle: { color: colors[i % colors.length] },
    barWidth: 16,
    label: {
      show: parseFloat(d.percentage) > 7, // Only show if segment wide enough
      position: 'inside',
      formatter: `${d.percentage}% (${d.count})`,
      fontSize: 11,
    },
  })),
  grid: { top: 30, bottom: 40, left: 0, right: 0, containLabel: false },
};
```

---

#### 3. StringInsights (String Columns)

**Legacy Behavior:**
- **3-mode toggle** cycling: chart → bars → stats
- Mode 1 (`chart`): RangeChart showing value distribution
- Mode 2 (`bars`): BarChart with vertical bars
- Mode 3 (`stats`): StatsChart for string length distribution
- Caption "String length distribution" in stats mode

**Props Interface:**
```typescript
interface StringInsightsProps {
  data: Array<{
    name: string;       // Category value
    percentage: string; // "25.5"
    count: number;
  }>;
  statsData: {
    minimum: number;    // Min string length
    maximum: number;    // Max string length
    mean: number;
    median: number;
    mode: number | null;
    otherModes: number[] | null;
  };
}
```

**ECharts Migration - Bar Mode:**
```typescript
const option: EChartsOption = {
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    formatter: (params) => {
      const p = params[0];
      const item = data[p.dataIndex];
      return `${item.name}<br/>Count: ${item.count} | ${item.percentage}%`;
    },
  },
  xAxis: {
    type: 'category',
    data: data.map(d => d.name.length > 10 ? d.name.substring(0, 10) + '...' : d.name),
    axisLabel: {
      interval: 0,
      rotate: data.length > 5 ? 45 : 0,
    },
  },
  yAxis: { type: 'value' },
  series: [{
    type: 'bar',
    data: data.map(d => d.count),
    itemStyle: { color: '#00897b' },
    label: {
      show: true,
      position: 'top',
      formatter: (p) => {
        const item = data[p.dataIndex];
        return `${item.count} | ${item.percentage}%`;
      },
      fontSize: 10,
    },
  }],
  grid: { top: 40, bottom: 60, left: 40, right: 20, containLabel: true },
};
```

---

#### 4. DateTimeInsights (Datetime Columns)

**Legacy Behavior:**
- Pagination arrows (left/right) for navigating through time periods
- Range filter toggle: year → month → day (cycles)
- Async API polling when filter changes
- BarChart showing frequency by time period
- Numbers mode showing Min Date, Max Date, Total Days
- Loading skeleton during API calls
- "No Data available" if empty

**Props Interface:**
```typescript
interface DateTimeInsightsProps {
  minDate: string;
  maxDate: string;
  barProps: {
    data: Array<{
      year?: number;
      month?: number;
      day?: number;
      frequency: number;
    }>;
  };
  type: 'chart' | 'numbers';
  postBody: {
    db_schema: string;
    db_table: string;
    column_name: string;
  };
}

interface DateTimeFilter {
  range: 'year' | 'month' | 'day';
  limit: 10;
  offset: number;
}
```

**ECharts Migration - Chart Mode:**
```typescript
const formatDateLabel = (d: any, range: string) => {
  if (range === 'year') return d.year?.toString();
  if (range === 'month') return `${monthNames[d.month - 1]} ${d.year}`;
  if (range === 'day') return `${d.day} ${monthNames[d.month - 1]} ${d.year}`;
  return '';
};

const option: EChartsOption = {
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
  },
  xAxis: {
    type: 'category',
    data: data.map(d => formatDateLabel(d, filter.range)),
    axisLabel: {
      interval: 0,
      rotate: filter.range !== 'year' ? 45 : 0,
    },
  },
  yAxis: {
    type: 'value',
    name: 'Frequency',
  },
  series: [{
    type: 'bar',
    data: data.map(d => d.frequency),
    itemStyle: { color: '#00897b' },
  }],
  grid: { top: 40, bottom: 80, left: 60, right: 20, containLabel: true },
};
```

**Pagination & Filter UI (JSX alongside chart):**
```tsx
<div className="flex items-center gap-2">
  {/* Left Arrow */}
  <button
    onClick={() => setFilter(f => ({ ...f, offset: f.offset - 10 }))}
    disabled={filter.offset === 0}
    className="w-4 h-20 bg-[#F5FAFA] hover:bg-[#c8d3d3] disabled:opacity-50"
  >
    <ChevronLeft />
  </button>

  {/* Chart */}
  <div ref={chartRef} className="w-[600px] h-[100px]" />

  {/* Right Arrow */}
  <button
    onClick={() => setFilter(f => ({ ...f, offset: f.offset + 10 }))}
    disabled={data.length < 10}
    className="w-4 h-20 bg-[#F5FAFA] hover:bg-[#c8d3d3] disabled:opacity-50"
  >
    <ChevronRight />
  </button>

  {/* Range Toggle */}
  <button onClick={cycleRange} className="text-xs text-gray-600">
    {filter.range}
  </button>
</div>
```

---

#### 5. BarChart (Generic Vertical Bars)

**Legacy Behavior:**
- Vertical bar chart (700x100px)
- Labels truncated to 10 chars with tooltip for full text
- Custom top labels above bars (optional barTopLabel prop)
- Color: #00897b (teal)

**Props Interface:**
```typescript
interface BarChartProps {
  data: Array<{
    label: string;
    value: number;
    barTopLabel?: string; // Optional custom label
  }>;
}
```

**ECharts Migration:**
```typescript
const option: EChartsOption = {
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    formatter: (params) => {
      const p = params[0];
      const item = data[p.dataIndex];
      // Show full label if truncated
      return `${item.label}<br/>Value: ${item.value}`;
    },
  },
  xAxis: {
    type: 'category',
    data: data.map(d => d.label.length > 10 ? d.label.substring(0, 10) + '...' : d.label),
    axisLabel: {
      interval: 0,
      rotate: data.length > 6 ? 45 : 0,
    },
  },
  yAxis: { type: 'value' },
  series: [{
    type: 'bar',
    data: data.map(d => d.value),
    itemStyle: { color: '#00897b' },
    label: {
      show: true,
      position: 'top',
      formatter: (p) => {
        const item = data[p.dataIndex];
        return item.barTopLabel ?? item.value.toString();
      },
      fontSize: 10,
    },
  }],
  grid: { top: 40, bottom: 60, left: 40, right: 20, containLabel: true },
};
```

---

### Chart Migration Summary Table

| Legacy Component | D3 Elements | ECharts Type | Key Features to Preserve |
|------------------|-------------|--------------|--------------------------|
| **NumberInsights** | StatsChart (box-whisker) | scatter + bar | Toggle modes, other_modes tooltip |
| **RangeChart** | Stacked horizontal SVG rects | Stacked bar (horizontal) | 6-color teal gradient, legend below |
| **StringInsights** | Wraps 3 chart types | Mode cycling | 3-mode toggle, caption for stats |
| **DateTimeInsights** | BarChart + pagination | Bar + custom UI | Pagination arrows, range filter, async polling |
| **StatsChart** | Box-whisker SVG | scatter + bar | Min/max whiskers, central box, label positioning |
| **BarChart** | Vertical bars SVG | Basic bar | Label truncation with tooltip, top labels |

---

### Dimensions & Styling

**All charts use consistent dimensions:**
- **SVG Size (legacy)**: 700x100px
- **ECharts Container**: 700x100px (or responsive with min-height)
- **Bar Height**: 16px (RangeChart), auto (BarChart)

**Color Palette (preserve exactly):**
```typescript
const TEAL_PALETTE = ['#00897b', '#33a195', '#66b8b0', '#98d0c9', '#cce7e4', '#c7d8d7'];
const PRIMARY_TEAL = '#00897b';
```

**Tooltip Styling:**
```typescript
tooltip: {
  backgroundColor: '#fff',
  borderColor: '#000',
  borderWidth: 1,
  borderRadius: 8,
  textStyle: { fontSize: 12, fontFamily: 'sans-serif' },
}
```

---

### Edge Cases to Handle

| Case | Legacy Behavior | ECharts Implementation |
|------|-----------------|------------------------|
| All values identical | Shows text message "All entries are identical" | Conditional render: show message instead of chart |
| Empty data | Empty SVG | Show "No data available" message |
| Mode with multiple values | Tooltip shows other modes | Custom tooltip formatter |
| Very long labels | Truncate to 10 chars + "..." | axisLabel formatter + full text in tooltip |
| Zero counts | Renders 0-width bar | ECharts handles naturally |
| Single data point | Single bar | Works, but may look odd - consider min width |

---

## 8. Dependencies

### Dependencies to Add

| Package | Purpose | Required? |
|---------|---------|-----------|
| `react-arborist` | Tree component for schema/table hierarchy | **YES** - No existing tree in webapp_v2 |
| `use-resize-observer` | Dynamic height calculation for tree | **YES** - For responsive tree sizing |

### Dependencies Already in webapp_v2 (Reuse)

| Package | Purpose | Location |
|---------|---------|----------|
| `react-resizable` | Resizable sidebar panel | Used in dashboard-builder-v2.tsx |
| `@dnd-kit/core` | Drag & drop (if needed later) | Used in dashboard components |
| `swr` | Data fetching with caching | Used throughout |
| `echarts` | Chart visualizations | Used in chart components |

### Table Strategy Decision

**Recommendation: Use existing plain HTML tables**

webapp_v2 already has a mature table pattern:
- `components/ui/table.tsx` - Base table components
- `components/dashboard/dashboard-list-v2.tsx` - Best reference for sorting/pagination

**Why NOT add @tanstack/react-table:**
- Plain tables work fine for data preview (simple use case)
- Keeps consistency with rest of webapp_v2
- Less bundle size
- Sorting/pagination already implemented via useMemo pattern

**PreviewPane Table Pattern (Server-Side Sorting & Pagination):**
```typescript
// State for sorting
const [sortConfig, setSortConfig] = useState<{
  column: string | null;
  order: 1 | -1;
}>({ column: null, order: 1 });

// State for pagination
const [page, setPage] = useState(1);
const [pageSize, setPageSize] = useState(10);

// SWR hook fetches with sort/pagination params
const { data, isLoading } = useTableData(schema, table, {
  page,
  limit: pageSize,
  order_by: sortConfig.column ?? undefined,
  order: sortConfig.column ? sortConfig.order : undefined,
});

// Handle sort click
const handleSort = (columnId: string) => {
  if (sortConfig.column === columnId) {
    // Toggle direction
    setSortConfig({ column: columnId, order: sortConfig.order === 1 ? -1 : 1 });
  } else {
    // New column, default to ascending
    setSortConfig({ column: columnId, order: 1 });
  }
};

// Sort arrow UI (using lucide-react icons)
<TableHead
  onClick={() => handleSort(column.name)}
  className="cursor-pointer hover:bg-muted"
>
  <div className="flex items-center gap-1">
    {column.name}
    {sortConfig.column === column.name ? (
      sortConfig.order === 1 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
    ) : (
      <ArrowUpDown className="h-4 w-4 opacity-30" />
    )}
  </div>
</TableHead>
```

**Note:** This is SERVER-SIDE sorting. The API returns pre-sorted data. Do NOT sort client-side with useMemo - that only works for client-side sorting which we don't need here.

### ProjectTree Strategy

**Must use react-arborist** (same as legacy):
- No existing tree component in webapp_v2
- Handles virtualization for large trees
- Built-in search/filter support
- Expand/collapse with keyboard nav
- Same API as legacy - easier migration

### Packages NOT in webapp_v2 (Don't Add)

| Package | Reason |
|---------|--------|
| `@tanstack/react-table` | NOT installed - use plain HTML tables instead |
| `d3` | NOT installed - use ECharts instead |

### Dependencies to Remove (from migration)

| Package | Reason |
|---------|--------|
| `@mui/material` | Using Radix UI instead |
| `@mui/icons-material` | Using lucide-react instead |
| `d3` | Using ECharts instead |

### webapp_v2 ECharts Files to Reference/Reuse

| File | Purpose | Reuse? |
|------|---------|--------|
| `components/charts/ChartPreview.tsx` | Main ECharts renderer | Reference pattern |
| `components/charts/MiniChart.tsx` | Lightweight chart | Reference registration |
| `components/dashboard/chart-element-view.tsx` | Full implementation | Reference lifecycle |
| `lib/chart-legend-utils.ts` | Legend positioning | Can reuse functions |
| `lib/responsive-legend.ts` | Responsive behavior | Can reuse functions |
| `lib/chart-export.ts` | PNG/PDF export | Can reuse for download |
| `constants/chart-types.ts` | Color schemes | Reference colors |

---

## 9. Implementation Order

### Phase 1: Foundation (Day 1-2)
1. [ ] Create `app/explore/page.tsx` entry point
2. [ ] Create `components/explore/` directory structure
3. [ ] Set up `stores/exploreStore.ts` (Zustand)
4. [ ] Create `hooks/api/useWarehouse.ts` with basic SWR hooks
5. [ ] Create `hooks/api/useFeatureFlags.ts`

### Phase 2: Layout & Tree (Day 2-3)
6. [ ] Create `Explore.tsx` main container with layout
7. [ ] Implement resizable sidebar panel
8. [ ] Create `ProjectTree.tsx` with react-arborist
9. [ ] Add search filtering
10. [ ] Add sync button functionality
11. [ ] Add loading/empty states

### Phase 3: Preview Tab (Day 3-4)
12. [ ] Create `PreviewPane.tsx`
13. [ ] Implement data table using plain HTML tables (`components/ui/table.tsx`)
14. [ ] Add sortable column headers (server-side sorting via API params)
15. [ ] Add pagination controls (server-side pagination)
16. [ ] Implement CSV download (blob fetch + download)
17. [ ] Add loading/empty states

### Phase 4: Statistics Tab (Day 4-6)
18. [ ] Create `StatisticsPane.tsx`
19. [ ] Implement async task polling for metrics
20. [ ] Create `NumberInsights.tsx` with ECharts
21. [ ] Create `RangeChart.tsx` with ECharts
22. [ ] Create `StringInsights.tsx` with ECharts
23. [ ] Create `DateTimeInsights.tsx` with ECharts
24. [ ] Add skeleton loading per column
25. [ ] Add error states

### Phase 5: Polish & Integration (Day 6-7)
26. [ ] Add permission checks
27. [ ] Add feature flag for statistics tab
28. [ ] Add toast notifications for errors
29. [ ] Test all interactions
30. [ ] Ensure responsive behavior
31. [ ] Add data-testid attributes
32. [ ] Write unit tests

---

## 10. Testing Requirements

### Unit Tests

- [ ] `useWarehouseTables` hook
- [ ] `useTableColumns` hook
- [ ] `useTableData` hook
- [ ] `useTableCount` hook
- [ ] `useTaskStatus` hook (polling)
- [ ] `useFeatureFlags` hook
- [ ] `exploreStore` Zustand store

### Component Tests

- [ ] ProjectTree renders tree structure
- [ ] ProjectTree search filters correctly
- [ ] ProjectTree sync button triggers callback
- [ ] PreviewPane renders table with data
- [ ] PreviewPane sorting works
- [ ] PreviewPane pagination works
- [ ] PreviewPane download triggers
- [ ] StatisticsPane renders column stats
- [ ] Chart components render with sample data
- [ ] Empty states display correctly
- [ ] Loading states display correctly

### Integration Tests

- [ ] Full flow: select table → see preview
- [ ] Full flow: select table → switch to statistics
- [ ] Full flow: search → select → preview
- [ ] Permission restrictions work
- [ ] Feature flag hides statistics tab

### Mock Data Files

```typescript
// components/explore/__tests__/explore-mock-data.ts

export const createMockWarehouseTable = (overrides = {}) => ({
  id: 'table-1',
  name: 'users',
  schema: 'public',
  type: 'source' as const,
  ...overrides
});

export const createMockColumnData = (overrides = {}) => ({
  name: 'id',
  data_type: 'integer',
  ...overrides
});

export const createMockStatistics = (type: string, overrides = {}) => {
  // Return appropriate mock based on column type
};
```

---

## Appendix: Type Definitions

```typescript
// types/explore.ts

export interface WarehouseTable {
  id: string;
  name: string;
  schema: string;
  type: 'source' | 'model';
}

export interface TableColumn {
  name: string;
  data_type: string;
}

export interface TableColumnWithType {
  name: string;
  translated_type: 'Numeric' | 'String' | 'Boolean' | 'Datetime' | 'Json';
}

export interface PreviewTableData {
  schema: string;
  table: string;
}

export interface TaskProgress {
  status: 'pending' | 'completed' | 'failed' | 'error';
  results?: NumericStats | StringStats | BooleanStats | DatetimeStats;
}

export interface NumericStats {
  minVal: number;
  maxVal: number;
  mean: number;
  median: number;
  mode: number;
  other_modes?: number[];
}

export interface StringStats {
  charts: Array<{ data: Array<{ category: string; count: number }> }>;
  count: number;
  countNull: number;
  countDistinct: number;
  minVal?: string;
  maxVal?: string;
  mode?: string;
}

export interface BooleanStats {
  count: number;
  countTrue: number;
  countFalse: number;
}

export interface DatetimeStats {
  charts: Array<{ data: any[] }>;
  minVal: string;
  maxVal: string;
}

export interface MetricsRequest {
  db_schema: string;
  db_table: string;
  column_name: string;
  filter?: {
    range: 'year' | 'month' | 'day';
    limit: number;
    offset: number;
  };
}
```

---

## 11. CRITICAL: Shared Component Architecture

### ProjectTree Reusability

ProjectTree is used in **TWO contexts** with different behaviors:

| Context | `included_in` Value | Behavior Differences |
|---------|---------------------|---------------------|
| **Explore Page** | `'explore'` | No delete button, click selects for preview |
| **Visual Designer** | `'visual_designer'` | Delete button visible, click adds to canvas |

**Props Interface (Full):**
```typescript
interface ProjectTreeProps {
  dbtSourceModels: DbtModelResponse[];
  handleNodeClick: (...args: any) => void;
  handleSyncClick: (...args: any) => void;
  isSyncing?: boolean;
  included_in: 'explore' | 'visual_designer';  // CRITICAL PROP
  onClose?: () => void;
}
```

**Conditional Logic in Node Component:**
```typescript
// Only show delete button in visual_designer mode
{included_in !== 'explore' && (
  <Tooltip title="Delete source">
    <DeleteIcon onClick={handleDelete} />
  </Tooltip>
)}
```

**handleNodeClick Behavior:**
- **Explore**: Calls `setPreviewAction({ type: 'preview', data: { schema, table } })`
- **Visual Designer**: Calls `setCanvasAction({ type: 'add-srcmodel-node', data: {...} })`

### PreviewPane & StatisticsPane Reusability

These components are also shared between Explore and FlowEditor (transform page):
- Subscribe to `usePreviewAction()` context
- Same rendering logic in both contexts
- Height passed as prop for layout flexibility

**Migration Decision Required:**
- [ ] Keep components in shared location (e.g., `components/shared/`)
- [ ] OR duplicate for explore-specific customization
- [ ] Design `included_in` prop pattern for webapp_v2

---

## 12. CRITICAL: Polling & Task Mechanism (Detailed)

### Async Statistics Calculation Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. User selects table in ProjectTree                                │
├─────────────────────────────────────────────────────────────────────┤
│ 2. StatisticsPane.fetchRowCountAndColumns() triggered               │
│    └─ GET warehouse/v1/table_data/{schema}/{table}  → columns       │
│    └─ GET warehouse/table_count/{schema}/{table}    → rowCount      │
├─────────────────────────────────────────────────────────────────────┤
│ 3. For EACH column (async forEach loop):                            │
│    └─ POST warehouse/insights/metrics/              → { task_id }   │
│    └─ delay(1000)  // 1 second wait                                 │
│    └─ pollTaskStatus(taskId)                                        │
├─────────────────────────────────────────────────────────────────────┤
│ 4. pollTaskStatus() implementation:                                 │
│    ┌─────────────────────────────────────────────────┐              │
│    │ GET tasks/{taskId}?hashkey=data-insights        │              │
│    │     ↓                                           │              │
│    │ status === 'completed' → resolve(results)       │              │
│    │ status === 'failed'    → reject()               │              │
│    │ status === 'error'     → reject()               │              │
│    │ status === 'pending'   → setTimeout(poll, 5000) │              │
│    └─────────────────────────────────────────────────┘              │
├─────────────────────────────────────────────────────────────────────┤
│ 5. Results update column's distribution state → chart renders       │
└─────────────────────────────────────────────────────────────────────┘
```

### pollTaskStatus Implementation

```typescript
export const pollTaskStatus = async (
  session: Session | null,
  taskId: string,
  postBody: PostBody,
  setData: (data: any) => void,
  interval = 5000  // 5 second polling interval
) => {
  const hashKey = 'data-insights';
  const taskUrl = `tasks/${taskId}?hashkey=${hashKey}`;

  const poll = async (resolve, reject) => {
    try {
      const response = await httpGet(session, taskUrl);
      const latestProgress = response.progress[response.progress.length - 1];

      if (latestProgress.status === 'completed') {
        setData(latestProgress.results);
        resolve(latestProgress.results);
      } else if (latestProgress.status === 'failed' || latestProgress.status === 'error') {
        setData('failed');
        reject({ reason: 'Failed' });
      } else {
        // Still pending - poll again after interval
        setTimeout(() => poll(resolve, reject), interval);
      }
    } catch (error) {
      reject(error);
    }
  };

  return new Promise(poll);
};
```

### Hashkey Parameter Purpose

- **Value**: `"data-insights"`
- **Purpose**: Backend uses this to:
  1. Route to correct task handler
  2. Use appropriate cache key
  3. Identify polling context type
- **Must be preserved** in webapp_v2 migration

### Cleanup on Unmount (Critical!)

```typescript
// StatisticsPane.tsx - Lines 378-385
useEffect(() => {
  return () => {
    // AGGRESSIVE cleanup - clears ALL intervals/timeouts
    const highestId = window.setTimeout(() => {
      for (let i = highestId; i >= 0; i--) {
        window.clearInterval(i);
      }
    }, 0);
  };
}, []);
```

**Why this matters:**
- Prevents memory leaks from orphaned polling
- Avoids state updates on unmounted components
- Must be replicated in webapp_v2

### SWR Alternative for Polling

In webapp_v2, consider using SWR's `refreshInterval` for polling:

```typescript
// Option 1: SWR with refreshInterval
const { data } = useSWR(
  taskId ? `tasks/${taskId}?hashkey=data-insights` : null,
  fetcher,
  {
    refreshInterval: (data) => {
      if (data?.progress?.at(-1)?.status === 'completed') return 0;
      if (data?.progress?.at(-1)?.status === 'failed') return 0;
      return 5000; // Continue polling
    },
    onSuccess: (data) => {
      const latest = data.progress.at(-1);
      if (latest.status === 'completed') {
        setColumnStats(latest.results);
      }
    }
  }
);

// Option 2: Keep manual polling for complex per-column logic
// (Recommended for statistics since each column polls independently)
```

---

## 13. CRITICAL: Context Providers Architecture

### FlowEditorPreviewContext

**Location**: `/src/contexts/FlowEditorPreviewContext.tsx`

```typescript
interface Action {
  type: 'preview' | 'clear-preview' | '' | undefined | null;
  data: PreviewTableData | null;
}

interface PreviewActionContext {
  previewAction: Action;
  setPreviewAction: Dispatch<SetStateAction<Action>>;
}

// Implementation: Simple useState wrapper
const PreviewActionProvider = ({ children }) => {
  const [previewAction, setPreviewAction] = useState<Action>({
    type: null,
    data: null
  });

  return (
    <PreviewActionContext.Provider value={{ previewAction, setPreviewAction }}>
      {children}
    </PreviewActionContext.Provider>
  );
};
```

**webapp_v2 Migration**: Convert to Zustand store (see Section 5)

### ParentCommunicationProvider (Embedding)

**Location**: `/src/contexts/ParentCommunicationProvider.tsx`

**Purpose**: Handle webapp embedded in webapp_v2 iframe

```typescript
interface ParentCommState {
  isEmbedded: boolean;           // true when in iframe
  parentToken: string | null;    // JWT from parent
  parentOrgSlug: string | null;  // Org context from parent
  hideHeader: boolean;           // Hide navbar in embedded mode
  isReady: boolean;              // Initialization complete
  isEmbeddingBlocked: boolean;   // Security check failed
}
```

**PostMessage Protocol:**
```typescript
interface IframeMessage {
  type: 'AUTH_UPDATE' | 'ORG_SWITCH' | 'AUTH_REQUEST' | 'READY' | 'LOGOUT';
  payload?: {
    token?: string;
    orgSlug?: string;
    timestamp?: number;
  };
  source: 'webapp_v2' | 'webapp';
}
```

**Security Validation:**
1. Origin check: `NEXT_PUBLIC_ALLOWED_PARENT_ORIGINS` env var
2. Source validation: expects `'webapp_v2'`
3. Blocks embedding if no allowed origins configured

**Message Handlers:**
| Message Type | Action |
|--------------|--------|
| `AUTH_UPDATE` | Sign in via 'embed-token' provider, set org |
| `ORG_SWITCH` | Update org slug, Header component detects and switches |
| `LOGOUT` | signOut(), reset state, redirect to /login |
| `READY` | Webapp sends to parent when initialized |

**webapp_v2 Migration Decision:**
- [ ] Since webapp_v2 IS the parent, this context is NOT needed for explore
- [ ] BUT: If explore needs to be embeddable elsewhere, keep this pattern

### GlobalContext Structure

```typescript
interface GlobalContextType {
  Permissions: {
    state: string[];  // ['can_create_dbt_model', 'can_sync_sources', ...]
    dispatch: (action: PermissionAction) => void;
  };
  Toast: {
    state: ToastStateInterface;
    dispatch: (action: ToastAction) => void;
  };
  CurrentOrg: {
    state: CurrentOrgStateInterface;
    dispatch: (action: OrgAction) => void;
  };
  OrgUsers: {
    state: OrgUserStateInterface[];
    dispatch: (action: UsersAction) => void;
  };
  UnsavedChanges: {
    state: boolean;
    dispatch: (action: UnsavedAction) => void;
  };
}
```

**webapp_v2 Equivalents:**
| GlobalContext | webapp_v2 |
|---------------|-----------|
| `Permissions.state` | `useUserPermissions()` hook |
| `Toast.dispatch` | `toast()` from Sonner |
| `CurrentOrg.state` | `useAuthStore().selectedOrgSlug` |
| `OrgUsers.state` | Custom SWR hook if needed |
| `UnsavedChanges.state` | Zustand store or local state |

---

## 14. CRITICAL: API Helpers Deep Dive

### HTTP Module Pattern

**Location**: `/src/helpers/http.tsx`

```typescript
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002';

export async function httpGet(session: any, path: string, isJson = true) {
  const response = await fetch(`${backendUrl}/api/${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${session?.user?.token}`,
      'x-dalgo-org': getOrgHeaderValue('GET', path),
    },
  });

  if (response.ok) {
    return isJson ? await response.json() : response;
  }

  if (response.status === 401) {
    handleUnauthorizedError();
    return;
  }

  const error = await response.json();
  throw new Error(error?.detail || 'error', { cause: error });
}
```

### Organization Header Logic

```typescript
// /src/utils/common.tsx
export const getOrgHeaderValue = (verb: string, path: string) => {
  // Skip org header for these endpoints
  const skipGetPaths = ['currentuserv2', 'users/invitations'];
  const skipPostPaths = ['organizations/', 'v1/organizations/users/invite/accept/'];

  if (verb === 'GET' && skipGetPaths.includes(path)) return '';
  if (verb === 'POST' && skipPostPaths.includes(path)) return '';

  return localStorage.getItem('org-slug') || '';
};
```

### Embedded Mode Detection

```typescript
function isEmbedded(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;  // Cross-origin iframe throws error
  }
}
```

### 401 Error Handling

```typescript
function handleUnauthorizedError() {
  const embedded = isEmbedded();

  if (embedded) {
    // Let parent handle re-auth - no action
    console.log('[Child HTTP] Embedded auth failed');
    return;
  }

  // Standalone: redirect to login
  signOut({ callbackUrl: '/login', redirect: true });
}
```

**webapp_v2 Equivalent**: Already handled in `lib/api.ts` with automatic token refresh

---

## 15. Transform Page Integration Details

### UITransformTab Structure

```
UITransformTab.tsx
├─ DBTRepositoryCard (Git connection)
├─ Card (Workflow Section)
│  ├─ Header with "Edit Workflow" button
│  └─ CanvasPreview (read-only preview)
└─ Dialog (fullScreen)
   ├─ TopNavBar (hides when embedded)
   └─ WorkflowEditor
      ├─ ProjectTree (included_in="visual_designer")
      └─ Canvas + other editor components
```

### hideHeader Usage

```typescript
// TopNavBar.tsx
const { hideHeader } = useParentCommunication();

export const TopNavBar = ({ handleClose }) => {
  if (hideHeader) return null;  // Don't render in embedded mode

  return (
    <AppBar>
      <IconButton onClick={handleClose}>
        <CloseIcon />
      </IconButton>
    </AppBar>
  );
};
```

### CanvasPreview Refresh Pattern

```typescript
// Force remount to refetch data after workflow changes
const [previewRefreshKey, setPreviewRefreshKey] = useState(0);

const handleWorkflowClose = () => {
  setPreviewRefreshKey(prev => prev + 1);  // Increment key
  setDialogOpen(false);
};

<CanvasPreview key={previewRefreshKey} />
```

---

## 16. Additional Patterns to Preserve

### Toast Notifications

**Legacy Pattern:**
```typescript
import { successToast, errorToast } from '@/components/ToastMessage/ToastHelper';

const globalContext = useContext(GlobalContext);

// Usage
successToast('Tables synced with warehouse', [], globalContext);
errorToast('Failed to fetch data', ['Check connection'], globalContext);
```

**webapp_v2 Pattern:**
```typescript
import { toast } from 'sonner';

// Usage
toast.success('Tables synced with warehouse');
toast.error('Failed to fetch data');
```

### Permission Checking

**Legacy Pattern:**
```typescript
const globalContext = useContext(GlobalContext);
const permissions = globalContext?.Permissions.state || [];

// Check
if (permissions.includes('can_create_dbt_model')) {
  // Allow action
}

// Conditional styling
<Button sx={{ opacity: permissions.includes('can_sync_sources') ? 1 : 0.5 }}>
  Sync
</Button>
```

**webapp_v2 Pattern:**
```typescript
const { permissions } = useUserPermissions();

// Check
if (permissions.includes('can_create_dbt_model')) {
  // Allow action
}

// Conditional styling
<Button className={cn(!permissions.includes('can_sync_sources') && 'opacity-50')}>
  Sync
</Button>
```

### Feature Flags

**Legacy Implementation:**
```typescript
// /src/customHooks/useFeatureFlags.tsx
export enum FeatureFlagKeys {
  LOG_SUMMARIZATION = 'LOG_SUMMARIZATION',
  EMBED_SUPERSET = 'EMBED_SUPERSET',
  USAGE_DASHBOARD = 'USAGE_DASHBOARD',
  DATA_QUALITY = 'DATA_QUALITY',
  AI_DATA_ANALYSIS = 'AI_DATA_ANALYSIS',
  DATA_STATISTICS = 'DATA_STATISTICS',  // Used in Explore
}

export const useFeatureFlags = () => {
  const { data: flags } = useSWR('organizations/flags', fetcher, {
    refreshInterval: 5 * 60 * 1000,  // 5 minute cache
  });

  const isFeatureFlagEnabled = (flag: FeatureFlagKeys) => {
    return flags?.[flag] === true;
  };

  return { isFeatureFlagEnabled };
};
```

**Usage in Explore:**
```typescript
const { isFeatureFlagEnabled } = useFeatureFlags();

// Only show statistics tab if flag enabled
{isFeatureFlagEnabled(FeatureFlagKeys.DATA_STATISTICS) && (
  <Tab label="Data statistics" value="statistics" />
)}
```

### useResizeObserver for Dynamic Heights

```typescript
import { useResizeObserver } from 'use-resize-observer';

const ProjectTree = ({ height: parentHeight }) => {
  const { ref, width, height } = useResizeObserver();

  const SEARCH_AREA_HEIGHT = 70;
  const BOTTOM_PADDING = 16;
  const treeHeight = height
    ? Math.max(200, height - SEARCH_AREA_HEIGHT - BOTTOM_PADDING)
    : 400;

  return (
    <div ref={ref} style={{ height: parentHeight }}>
      <SearchInput />  {/* 70px */}
      <Tree height={treeHeight} width={width} />
    </div>
  );
};
```

### react-arborist Tree Configuration

```typescript
<Tree
  childrenAccessor={(d) => d.children}
  openByDefault={searchTerm ? true : false}  // Auto-expand on search
  indent={8}
  data={projectTreeData}
  height={treeHeight}
  width={width}
  rowHeight={30}
  onSelect={
    permissions.includes('can_create_dbt_model')
      ? handleNodeClick
      : undefined  // Disable selection if no permission
  }
>
  {(props) => (
    <Node
      {...props}
      handleSyncClick={handleSyncClick}
      isSyncing={isSyncing}
      included_in={included_in}
    />
  )}
</Tree>
```

**Tree Data Structure:**
```typescript
const projectTreeData = [
  {
    id: '0',
    schema: 'Data',  // Root folder label
    children: [
      {
        id: '1',
        schema: 'public',  // Schema folder
        children: [
          {
            id: 'uuid-1',
            name: 'users',
            schema: 'public',
            type: 'source',
            display_name: 'users',
            source_name: 'public',
            sql_path: '',
            output_cols: [],
            uuid: 'uuid-1',
          }
        ]
      }
    ]
  }
];
```

---

## 17. DbtModelResponse Type (Complete)

```typescript
// Used by ProjectTree and Explore
interface DbtModelResponse {
  id: string;
  name: string;
  schema: string;
  type: 'source' | 'model';
  display_name: string;
  source_name: string;
  sql_path: string;
  output_cols: string[];
  uuid: string;
}

// Normalized from warehouse/sync_tables response
const normalizeWarehouseTable = (table: WarehouseTable): DbtModelResponse => ({
  id: table.id,
  name: table.name,
  schema: table.schema,
  type: table.type,
  display_name: table.name,
  source_name: table.schema,
  sql_path: '',
  output_cols: [],
  uuid: table.id,
});
```

---

## Notes

- **Embedded mode**: The legacy webapp supports embedded mode via PostMessage. Since webapp_v2 IS the parent, this is likely NOT needed for explore page itself.
- **Visual Designer reuse**: ProjectTree is shared with visual_designer via `included_in` prop. Consider if webapp_v2 will also have a visual designer that needs this component.
- **Performance**: Statistics calculations are async tasks. The polling mechanism (5s interval) MUST be preserved.
- **Cleanup**: The aggressive timer cleanup pattern in StatisticsPane is critical to prevent memory leaks.
- **Accessibility**: Ensure all interactive elements have proper aria labels and keyboard navigation.

---

## 18. Migration Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Polling memory leaks | High | Implement same cleanup pattern or use SWR refreshInterval |
| Missing `included_in` logic | Medium | Design prop system before implementation |
| D3 → ECharts chart differences | Medium | Test visual parity, may need tweaks |
| Permission system differences | Low | Map GlobalContext → useUserPermissions early |
| Feature flag endpoint compatibility | Low | Verify API response format |
| Statistics task failures | Medium | Preserve error state UI exactly |

---

## 19. Quick Reference Summary

### By the Numbers
| Item | Count |
|------|-------|
| API Endpoints | 9 |
| Chart Components | 5 (NumberInsights, StringInsights, RangeChart, DateTimeInsights, BarChart) |
| Source Files | 19 |
| Target Files | 17 |
| Feature Checklist Items | 90+ |
| Implementation Phases | 5 |
| Implementation Tasks | 32 |

### Install Command
```bash
npm install react-arborist use-resize-observer
```

### Key Icons Needed (lucide-react)
- `ArrowUp`, `ArrowDown`, `ArrowUpDown` - Table sorting
- `ChevronLeft`, `ChevronRight` - DateTime pagination
- `RefreshCw` or `RotateCw` - Sync/Refresh buttons
- `Download` - CSV download
- `Folder`, `FolderOpen` - Schema folders
- `Table2` or `Database` - Table icons
- `X` - Close button
- `Search` - Search input
- `Loader2` - Loading spinner

### Color Constants
```typescript
const PRIMARY_TEAL = '#00897b';
const TEAL_PALETTE = ['#00897b', '#33a195', '#66b8b0', '#98d0c9', '#cce7e4', '#c7d8d7'];
const STAT_BOX_BG = '#F5FAFA';
const LABEL_COLOR = 'rgba(15, 36, 64, 0.57)';
```

### Key Dimensions
| Element | Size |
|---------|------|
| Chart width | 700px |
| Chart height | 100px |
| Tree row height | 30px |
| Tree indent | 8px |
| Sidebar min width | 280px |
| Sidebar max width | 550px |
| Sidebar default | 260px |
| Statistics row height | 180px |
| Bar height (RangeChart) | 16px |
