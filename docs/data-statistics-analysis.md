# Data Statistics Page - Gap Analysis: webapp (v1) vs webapp_v2

> **Goal**: Make webapp_v2's Data Statistics page **visually and functionally identical** to webapp (v1).
> **Chart Library**: webapp uses D3.js; webapp_v2 uses ECharts. All charts must replicate D3 output with ECharts.

---

## Summary of Differences

| Area | webapp (v1) | webapp_v2 (current) | Status |
|------|------------|---------------------|--------|
| **StatisticsPane layout** | MUI Table + `@tanstack/react-table`, sticky header | Radix Table, sticky header | Differs in column widths, padding, header style |
| **Header info bar** | Table name, eye icon + column count, row count, Refresh button | `schema.table`, text column/row count, Refresh button | Differs in layout, icon, spacing |
| **Column widths** | 160, 150, 100, 100, 800 | 200, 120, 100, 100, flex | Differs |
| **Header labels** | "Column name", "Column type", "Distinct", "Null", "Data distribution" | "Column", "Type", "Distinct", "Nulls", "Distribution" | Differs |
| **Header styling** | `bg:#F5FAFA`, `border:1px solid #ddd`, `color:rgba(15,36,64,0.57)`, `fontWeight:700` | `bg-gray-50`, no border on cells, `text-gray-700`, `font-medium` | Differs significantly |
| **Row height** | `180px` inline | `180px` via constant | Match |
| **Cell padding** | First col `8px 8px 8px 46px`, others `8px` | Default padding | Differs |
| **Cell font** | `fontWeight:600`, `fontSize:0.8rem` | `font-medium` (500), default size | Differs |
| **Loading state** | `CircularProgress` + "Generating insights" | Skeleton rows | Differs |
| **Sorting** | `TableSortLabel` (MUI), all 4 columns sortable | Custom sort icons, only name/type sortable | Differs (distinct/null not sortable in v2) |
| **NumberInsights** | D3 StatsChart + numbers toggle, switch-chart.svg icon | ECharts + numbers toggle, Lucide icons | Visual differences |
| **StringInsights** | 3-mode: RangeChart / BarChart / StatsChart (string length) | 3-mode: RangeChart / BarChart / text list (no StatsChart) | **Major gap** |
| **DateTimeInsights** | D3 BarChart, arrow pagination, switch-filter icon, moment.js dates | ECharts BarChart, button pagination, Lucide icons, native Date | Visual + format differences |
| **Boolean** | RangeChart with `colors=['#00897b','#c7d8d7']`, `barHeight=12` | RangeChart, default barHeight=16, includes Null segment | Behavior differs |
| **Edge cases** | "All values are null", "All values are distinct" (no count threshold) | Adds count threshold `>10` for distinct | Differs |
| **Refresh button** | MUI `variant="contained"`, text "Refresh" | Ghost + teal bg, text "REFRESH" | Styling differs |

---

## Detailed Docs by Component

See individual analysis docs:

1. [Statistics Pane Layout](./data-statistics-pane-layout.md) - Table structure, header, column widths, cell styling
2. [NumberInsights Chart](./data-statistics-number-insights.md) - Numeric column visualization
3. [StringInsights Chart](./data-statistics-string-insights.md) - String column visualization
4. [DateTimeInsights Chart](./data-statistics-datetime-insights.md) - Datetime column visualization
5. [Boolean / RangeChart](./data-statistics-boolean-range-chart.md) - Boolean column visualization
6. [BarChart](./data-statistics-bar-chart.md) - Shared vertical bar chart
