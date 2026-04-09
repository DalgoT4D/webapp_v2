# Pivot Table Chart Type — Design Spec

**Date:** 2026-04-08
**Status:** Draft
**Chart Type ID:** `pivot_table`

## Overview

Add a new `pivot_table` chart type to Dalgo that enables NGO users to cross-tabulate their data — viewing aggregated metrics at the intersection of row groupings and column groupings. This is the most-requested analytical pattern in program reporting: "show me [metric] by [group], broken down by [time period or category]."

**Primary use cases for NGOs:**
- Beneficiaries served per district, broken down by month
- Funds disbursed by program, broken down by funding source
- Training sessions by region, broken down by quarter
- Average test scores by school, broken down by subject

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| New chart type vs table mode | New chart type | Config UX, response format, and rendering are fundamentally different from flat table |
| Backend vs frontend pivoting | Backend does all computation | Consistency with other Dalgo charts (backend computes, frontend renders). Correct subtotals on raw data. Server-side pagination on pivoted results. |
| Interactivity model | Configure-then-render | All pivot configuration in chart builder. Rendered chart is read-only + sortable. Same pattern as Superset/Looker and all other Dalgo charts. |
| Column dimension cardinality | Single column dimension | Covers 95%+ of NGO use cases. Multiple column dimensions creates exponential column explosion — not useful for reporting. |
| Time grain on column dimension | Supported | "By month/quarter/year" is the most common pivot pattern for NGOs. Reuses existing time grain infrastructure from bar/line charts. |

## v1 Scope

**In scope:**
- 1-3 row dimensions (hierarchical grouping)
- 0-1 column dimension (the pivot axis) with optional time grain
- Multiple metrics with aggregation (SUM, AVG, COUNT, MIN, MAX, COUNT_DISTINCT)
- Row subtotals per group level (toggleable)
- Column subtotals (toggleable)
- Grand totals — row and column (toggleable)
- Column sorting via header click (triggers new API call)
- Number formatting per metric (reuse existing column formatting)
- Server-side pagination (by row groups)
- CSV export of pivoted data
- Dashboard filter support
- Public/share view support
- Auto-prefill defaults on dataset selection

**Out of scope (v2):**
- Conditional formatting (threshold-based cell coloring)
- Transpose toggle (swap rows and columns)
- Multiple column dimensions
- Percentage of total (% of row/column/grand total)
- Collapsible row groups (expand/collapse hierarchy)
- Heatmap coloring (color scale across values)

---

## Data Model

### Chart Configuration (extra_config)

Stored in the `ChartCreate` payload and persisted to the database.

```typescript
{
  chart_type: 'pivot_table',
  computation_type: 'aggregated',  // always aggregated for pivot
  schema_name: string,
  table_name: string,
  extra_config: {
    // Row dimensions — left-side hierarchical groupings (1-3)
    row_dimensions: ChartDimension[],
    // e.g., [{ column: 'district' }, { column: 'program' }]

    // Column dimension — the pivot axis (0 or 1)
    // null/undefined means no pivot column — just grouped rows with metrics
    column_dimension: {
      column: string,
      time_grain?: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | null
      // time_grain only applicable when column is datetime type
    } | null,

    // Metrics — aggregated values in cells
    metrics: ChartMetric[],
    // e.g., [
    //   { column: 'beneficiary_id', aggregation: 'count', alias: 'Beneficiaries' },
    //   { column: 'amount', aggregation: 'sum', alias: 'Total Spend' }
    // ]

    // Pivot display options
    show_row_subtotals: boolean,     // default: true
    show_column_subtotals: boolean,  // default: false
    show_grand_total: boolean,       // default: true

    // Reused from existing chart system
    filters: ChartFilter[],
    pagination: { enabled: boolean, page_size: number },  // default: enabled, 50
    sort: PivotSort[],

    // Frontend-only customizations
    customizations: {
      columnFormatting: Record<string, {
        numberFormat?: NumberFormat,
        decimalPlaces?: number
      }>
    }
  }
}
```

**Reused interfaces:**
- `ChartDimension` from `types/charts.ts` — `{ column: string, enable_drill_down?: boolean }`
- `ChartMetric` from `types/charts.ts` — `{ column: string | null, aggregation: string, alias?: string }`
- `ChartFilter` from `types/charts.ts` — existing filter system with 14 operators

**New interface for pivot sorting:**

```typescript
interface PivotSort {
  column: string;          // metric alias (e.g., 'Beneficiaries')
  pivot_value?: string;    // specific column group (e.g., 'Jan 2026'), omit for row-level sort
  direction: 'asc' | 'desc';
}
```

---

## Backend API

### Endpoint

Reuse existing `POST /api/charts/chart-data/` with `chart_type: 'pivot_table'`.

The backend receives the standard `ChartDataPayload` with pivot-specific fields in `extra_config`. It performs:

1. **SQL GROUP BY** on all row dimensions + column dimension
2. **Aggregation** per metric using the specified function
3. **Date truncation** via `DATE_TRUNC(grain, column)` when time_grain is set on column dimension
4. **Pivoting** — rotate column dimension values into columns (pandas `pivot_table` or equivalent)
5. **Subtotals** — compute from raw grouped data (not from aggregated values, so AVG subtotals are correct)
6. **Grand totals** — overall sums/averages across all groups
7. **Sorting** — apply sort on the pivoted result
8. **Pagination** — paginate by top-level row groups (all sub-groups included in each page)

### Response Format

```typescript
interface PivotTableResponse {
  // Column headers — unique values of the column dimension
  // When column_dimension is datetime with month grain: ["Jan 2026", "Feb 2026", ...]
  // When column_dimension is categorical: ["Program X", "Program Y", ...]
  // When no column_dimension: empty array (metrics become direct columns)
  column_headers: string[];

  // Metric names in display order
  metric_headers: string[];  // e.g., ["Beneficiaries", "Total Spend"]

  // Pivoted data rows — already grouped and ordered
  rows: PivotRow[];

  // Column subtotals — one entry per data row, summing across all column groups
  // Only present when show_column_subtotals is true
  column_subtotals: PivotColumnSubtotal[] | null;

  // Grand total data
  // Only present when show_grand_total is true
  grand_total: PivotGrandTotal | null;

  // Pagination
  total_row_groups: number;  // count of top-level row groups (for pagination)
  page: number;
  page_size: number;
}

interface PivotRow {
  // Row labels matching row_dimensions order
  // Full rows: ["District A", "Program X"]
  // Subtotal rows: ["District A"] (partial — level indicated by length)
  row_labels: string[];

  // Whether this is a subtotal row
  is_subtotal: boolean;

  // Values matrix: values[column_index][metric_index]
  // When no column_dimension: values[0][metric_index] (single column group)
  values: (number | null)[][];
}

interface PivotColumnSubtotal {
  row_labels: string[];
  values: (number | null)[];  // one value per metric, summing across all columns
}

interface PivotGrandTotal {
  // Total per column group per metric: [column_index][metric_index]
  column_totals: (number | null)[][];

  // Total per metric across everything
  overall: (number | null)[];
}
```

### Pagination Strategy

Pagination is by **top-level row groups**, not individual rows. If `page_size` is 50 and you have row dimensions `[district, program]`, you get 50 districts with all their programs, subtotals included. This ensures:
- No half-rendered groups split across pages
- Subtotals are always visible with their parent group
- Page count = `ceil(distinct_top_level_groups / page_size)`

### Sorting Strategy

Sort applies before pagination. Sort keys reference:
- A metric alias (which metric to sort by)
- Optionally a `pivot_value` (which column group's value to sort by)
- Direction (asc/desc)

Example: Sort by "Beneficiaries" in "Jan 2026" descending:
```json
{ "column": "Beneficiaries", "pivot_value": "Jan 2026", "direction": "desc" }
```

Sort by total Beneficiaries (column subtotal) descending:
```json
{ "column": "Beneficiaries", "direction": "desc" }
```

---

## Frontend Components

### File Structure

```
components/charts/
├── pivot-table/
│   ├── PivotTableChart.tsx           # Renders the pivoted HTML table
│   ├── PivotTableCustomizations.tsx  # Number formatting per metric
│   ├── PivotDataConfiguration.tsx    # Row/Column/Values bucket config
│   ├── utils.ts                      # CSV export, header span calculation
│   └── __tests__/
│       ├── PivotTableChart.test.tsx
│       └── pivot-mock-data.ts

types/
├── pivot-table.ts                    # PivotTableResponse, PivotRow, PivotSort, etc.

constants/
├── pivot-table.ts                    # DEFAULT_PAGE_SIZE, MAX_ROW_DIMENSIONS, etc.
```

### PivotDataConfiguration

The data configuration panel shown in the chart builder. Three distinct sections:

```
┌─────────────────────────────────┐
│  ROW DIMENSIONS (1-3)           │
│  ┌─────────────────────┐        │
│  │ = district           │  x    │
│  │ = program            │  x    │
│  └─────────────────────┘        │
│  + Add Row Dimension            │
├─────────────────────────────────┤
│  COLUMN DIMENSION (0-1)         │
│  ┌─────────────────────┐        │
│  │ enrollment_date       │  x   │
│  └─────────────────────┘        │
│  Time Grain: [Month v]          │
│  (only shown for datetime cols) │
├─────────────────────────────────┤
│  VALUES / METRICS               │
│  ┌──────────────────────┐       │
│  │ COUNT(beneficiary_id) │  x   │
│  │ SUM(amount)           │  x   │
│  └──────────────────────┘       │
│  + Add Metric                   │
├─────────────────────────────────┤
│  [x] Show Row Subtotals         │
│  [ ] Show Column Subtotals      │
│  [x] Show Grand Total           │
└─────────────────────────────────┘
```

**Reused components:**
- Row Dimensions: reuse `TableDimensionsSelector` (drag-to-reorder via @dnd-kit, limit max to 3)
- Column Dimension: single column `Select` dropdown from existing UI components
- Time Grain: reuse existing time grain picker from bar/line chart config
- Metrics: reuse `MetricsSelector` (multi-metric with aggregation picker)
- Toggles: standard `Switch` components from `components/ui/`

**Column selection behavior:**
- Row dimension dropdown shows all columns
- Column dimension dropdown shows all columns; when a datetime column is selected, time grain picker appears
- Metric column dropdown shows numeric columns only (for SUM/AVG/MIN/MAX); COUNT allows all columns or null for COUNT(*)

### PivotTableChart

The rendering component. Receives `PivotTableResponse` from the API and renders a styled HTML `<table>`.

**Header rendering (two-level `<thead>`):**

```
┌──────────┬──────────┬────────────────────────┬────────────────────────┬───────────┐
│          │          │      Jan 2026          │      Feb 2026          │   Total   │
│ District │ Program  ├──────────┬─────────────┼──────────┬─────────────┼─────┬─────┤
│          │          │ Benefic. │ Total Spend │ Benefic. │ Total Spend │ B.  │ T.S.│
├──────────┼──────────┼──────────┼─────────────┼──────────┼─────────────┼─────┼─────┤
│ Dist. A  │ Prog. X  │      120 │       5,000 │       95 │       3,200 │ 355 │ 14K │
│          │ Prog. Y  │       80 │       2,100 │       60 │       1,800 │ 250 │  8K │
│          │ Subtotal │      200 │       7,100 │      155 │       5,000 │ 605 │ 22K │
├──────────┼──────────┼──────────┼─────────────┼──────────┼─────────────┼─────┼─────┤
│ Dist. B  │ Prog. X  │       90 │       4,000 │       70 │       2,500 │ ... │ ... │
│          │ ...      │          │             │          │             │     │     │
├──────────┴──────────┼──────────┼─────────────┼──────────┼─────────────┼─────┼─────┤
│ Grand Total         │      500 │      15,000 │      400 │      12,000 │1105 │ 57K │
└─────────────────────┴──────────┴─────────────┴──────────┴─────────────┴─────┴─────┘
```

**Rendering details:**
- Row dimension values use `rowSpan` to group hierarchically (District A spans all its program rows)
- Subtotal rows: bold text, light gray background (`bg-muted`)
- Grand total row: bold text, slightly darker background, top border
- Column headers: first row uses `colSpan` to group metrics under each column value
- When no column dimension: single-level header with just metric names
- Sticky first column(s) for row dimensions (CSS `position: sticky`)
- Horizontal scroll for many columns with `overflow-x-auto` on container

**Interactivity:**
- Click any metric column header to sort → calls `onSort(metricAlias, pivotValue, direction)` → parent triggers new API call
- Sort indicator (arrow icon) on the currently sorted column
- Pagination controls below the table (reuse same UI pattern as TableChart: record count, page size selector, prev/next)

**Props:**
```typescript
interface PivotTableChartProps {
  data: PivotTableResponse;
  config: {
    show_row_subtotals: boolean;
    show_column_subtotals: boolean;
    show_grand_total: boolean;
    columnFormatting?: Record<string, {
      numberFormat?: NumberFormat;
      decimalPlaces?: number;
    }>;
    sort?: PivotSort[];
  };
  onSort?: (sort: PivotSort) => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
  };
}
```

### PivotTableCustomizations

Sidebar panel in the chart builder for formatting options.

**Sections:**
1. **Number Formatting** — per metric (reuse NumberFormatSection pattern from TableChartCustomizations)
   - Number format: default, indian, international, european, adaptive_indian, adaptive_international
   - Decimal places: 0-6
2. **Display Toggles** (mirrors the data config toggles for quick access)
   - Show Row Subtotals
   - Show Column Subtotals
   - Show Grand Total

### utils.ts

**CSV export function:**
- Takes `PivotTableResponse` + formatting config
- Builds multi-level header rows: column dimension values with metric names
- Flattens to CSV with `" | "` separator for merged headers (e.g., `"Jan 2026 | Beneficiaries"`)
- Includes subtotal and grand total rows
- Applies number formatting
- Triggers browser download

**Header span calculator:**
- Computes `colSpan` values for column headers based on number of metrics per column group
- Computes `rowSpan` values for row dimension cells based on group sizes

---

## Auto-Prefill Defaults

When a user selects a dataset for pivot_table, auto-fill:

| Field | Default |
|-------|---------|
| Row dimension | First text column |
| Column dimension | First datetime column (if any), otherwise null |
| Time grain | `month` (when column dimension is datetime) |
| Metric | `COUNT(*)` with alias "Total Count" |
| show_row_subtotals | `true` |
| show_column_subtotals | `false` |
| show_grand_total | `true` |
| pagination | `{ enabled: true, page_size: 50 }` |

---

## Integration Points

### Existing files that need changes

| File | Change |
|------|--------|
| `types/charts.ts` | Add `PIVOT_TABLE: 'pivot_table'` to ChartTypes. Add `row_dimensions`, `column_dimension`, `show_row_subtotals`, `show_column_subtotals`, `show_grand_total` to extra_config type. |
| `constants/chart-types.ts` | Add pivot_table entry with color `#0D9488` (teal-600) and display metadata. |
| `components/charts/ChartPreview.tsx` | Add `if (chartType === ChartTypes.PIVOT_TABLE)` branch that renders `PivotTableChart`. |
| `components/charts/ChartCustomizations.tsx` | Add `pivot_table` case that renders `PivotTableCustomizations`. |
| `components/charts/ChartDataConfigurationV3.tsx` | Add `pivot_table` case that renders `PivotDataConfiguration`. |
| `lib/chart-payload-utils.ts` | Add pivot_table to `getApiCustomizations()` — same treatment as table (exclude customizations from API payload). |
| `lib/chartAutoPrefill.ts` | Add pivot_table auto-prefill logic (first text col, first datetime col, count metric). |
| `components/charts/StaticChartPreview.tsx` | Add pivot_table case with a representative SVG icon (grid with pivot arrow). |
| `app/charts/new/configure/page.tsx` | Handle pivot_table in chart save payload construction — include `row_dimensions`, `column_dimension`, pivot options. |
| `app/charts/[id]/edit/page.tsx` | Same as above for edit flow. |

### Files that need NO changes

| File | Why |
|------|-----|
| Dashboard components | Chart rendering goes through `ChartPreview` which dispatches by type — adding pivot_table to ChartPreview is sufficient. |
| Public/share views | Same rendering pipeline via ChartPreview. |
| Filter system | Existing `ChartFilter` and dashboard filter infrastructure works as-is. Backend applies filters before pivoting. |
| `hooks/api/useChart.ts` | Existing `useChartData()` and `useChartDataPreview()` hooks work — they POST to the same endpoints. Pivot-specific fields are in the payload, not the hook. |

---

## UX Flow

### Creating a pivot table

1. User navigates to Charts → clicks "Create Chart"
2. Selects "Pivot Table" from chart type grid
3. Selects a dataset (schema.table)
4. Columns load → auto-prefill kicks in (first text col as row, first datetime as column with monthly grain, COUNT as metric)
5. User adjusts buckets: drags dimensions, picks column dimension, adds/removes metrics
6. Live preview renders below — each change triggers API call
7. User adjusts formatting in the customizations sidebar (number format, decimal places)
8. User titles the chart and saves

### Viewing a pivot table

1. Rendered as an HTML table with hierarchical row headers, grouped column headers
2. Click any metric column header → sort by that column (API re-fetch)
3. Page through results using pagination controls
4. Export to CSV via export button

### On a dashboard

1. Pivot table renders in a grid cell — recommended full-width or near-full-width
2. Dashboard filters apply to pivot table (same as any other chart)
3. Minimum recommended grid width: 6 of 12 columns (prevent unreadable narrow pivots)

---

## CSV Export Format

```csv
,,"Jan 2026 | Beneficiaries","Jan 2026 | Total Spend","Feb 2026 | Beneficiaries","Feb 2026 | Total Spend","Total | Beneficiaries","Total | Total Spend"
"District A","Program X",120,5000,95,3200,355,14300
"District A","Program Y",80,2100,60,1800,250,8400
"District A","Subtotal",200,7100,155,5000,605,22700
"District B","Program X",90,4000,70,2500,...,...
"Grand Total",,500,15000,400,12000,1105,57900
```

- First two columns are row dimension labels
- Remaining columns use `"Column Value | Metric Name"` format
- Subtotal and grand total rows clearly labeled
- Number formatting applied

---

## Testing Strategy

### Unit tests (Jest)

- **PivotTableChart rendering:** Given mock `PivotTableResponse`, verify correct number of rows/columns, rowSpan/colSpan values, subtotal row styling, grand total row presence
- **Header computation:** Test `utils.ts` functions for computing header spans from varying metric counts and column groups
- **CSV export:** Verify output format with multi-level headers, subtotals, grand totals, edge cases (no column dimension, single metric, no subtotals)
- **PivotDataConfiguration:** Verify bucket interactions — adding/removing dimensions and metrics, time grain visibility toggle for datetime columns

### Edge cases to test

- No column dimension (metrics as direct columns, no pivoting — just grouped aggregation)
- Single row dimension (no hierarchy, no subtotals needed)
- Single metric (no metric sub-columns)
- Null values in data (render as empty cell, not "0")
- Very long column header text (truncate with tooltip)
- Column dimension with high cardinality (many unique values — backend should limit, frontend should scroll horizontally)

### E2E tests (Playwright)

- Create a pivot table chart end-to-end
- Verify sort interaction triggers re-render
- Verify pagination works
- Verify CSV export downloads a file
