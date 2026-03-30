# Data Statistics Pane Layout - Gap Analysis

## Header Info Bar

### webapp (v1) - REFERENCE
```
Layout: flex row, padding: '6px 8px 6px 44px'
  [Table name]       (Typography body1, fontWeight bold)
  [56px gap]
  [Eye icon (#00897b)]  [X Columns]  [Y Rows]   (fontWeight 600)
  [auto gap]
  [Refresh button]   (MUI variant="contained", margin-right: 16px)
```
- Eye icon: MUI `VisibilityIcon` with `color: '#00897b'`
- Column/row count format: `{count} Columns` and `{count} Rows` separated by `mr: 2`
- Title shows only `table` name (not `schema.table`)

### webapp_v2 (current)
```
Layout: flex row, px-6 py-4, border-b
  [schema.table]     (font-medium text-lg text-gray-900)
  [gap-4]
  [X columns · Y rows]  (text-sm text-gray-500)
  [auto gap]
  [REFRESH button]   (ghost + teal bg, text-white)
```

### Changes Needed in webapp_v2
1. **Title**: Show only `table` name, not `schema.table`
2. **Add eye icon**: Use Lucide `Eye` icon with `color: #00897b` before column count
3. **Separate column/row count**: Use `{count} Columns` and `{count} Rows` as separate elements (not `·` joined)
4. **Padding**: Change to `padding: 6px 8px 6px 44px` (left-indent 44px)
5. **Typography**: Table name should be `fontWeight: bold` (not `font-medium`)
6. **Column/row count**: `fontWeight: 600`, not `text-sm text-gray-500`
7. **Button text**: "Refresh" (not "REFRESH"), use `variant="contained"` style equivalent

---

## Table Structure

### Column Definitions

| # | webapp (v1) Header | webapp (v1) Width | webapp_v2 Header | webapp_v2 Width | Fix |
|---|---|---|---|---|---|
| 0 | Column name | 160px | Column | 200px | Change to "Column name", 160px |
| 1 | Column type | 150px | Type | 120px | Change to "Column type", 150px |
| 2 | Distinct | 100px | Distinct | 100px | Match |
| 3 | Null | 100px | Nulls | 100px | Change to "Null" |
| 4 | Data distribution | 800px | Distribution | flex | Change to "Data distribution", 800px |

### Sorting

| Column | webapp (v1) | webapp_v2 | Fix |
|--------|------------|-----------|-----|
| Column name | Sortable (MUI `TableSortLabel`) | Sortable | Match |
| Column type | Sortable | Sortable | Match |
| Distinct | Sortable | NOT sortable | Make sortable |
| Null | Sortable | NOT sortable | Make sortable |
| Distribution | NOT sortable | NOT sortable | Match |

---

## Table Header Styling

### webapp (v1) - REFERENCE
```css
backgroundColor: '#F5FAFA'
border: '1px solid #dddddd'
padding: first_col '8px 8px 8px 40px', others '8px'
fontWeight: 700
color: 'rgba(15, 36, 64, 0.57)'
textAlign: 'left'
```

### webapp_v2 (current)
```css
bg-gray-50  (≈ #F9FAFB, not exactly #F5FAFA)
border-r only (not full border)
text-base font-medium text-gray-700
cursor-pointer (sortable columns)
```

### Changes Needed
1. **Background**: Change from `bg-gray-50` to `background: #F5FAFA`
2. **Border**: Add `border: 1px solid #dddddd` on all sides (not just right)
3. **Padding**: First column `8px 8px 8px 40px`, others `8px`
4. **Font weight**: Change from `font-medium` (500) to `fontWeight: 700`
5. **Color**: Change from `text-gray-700` to `color: rgba(15, 36, 64, 0.57)`

---

## Table Body Row Styling

### webapp (v1) - REFERENCE
```css
boxShadow: 'unset'
height: '180px'
```

### Cell styling:
```css
fontWeight: 600
textAlign: 'left'
borderBottom: '1px solid #ddd'
fontSize: '0.8rem'
padding: first_col '8px 8px 8px 46px', others '8px'
```

### webapp_v2 (current)
```css
height: 180px (via STATISTICS_ROW_HEIGHT constant) ✓
hover:bg-gray-50/50
```

### Cell styling:
```css
font-medium (500, not 600)
border-r
default padding (not 46px left for first col)
```

### Changes Needed
1. **Cell font weight**: Change to `fontWeight: 600`
2. **Cell font size**: Set to `0.8rem` (~12.8px)
3. **Cell padding**: First column `8px 8px 8px 46px`, others `8px`
4. **Cell border**: Use `borderBottom: 1px solid #ddd` (not `border-r`)
5. **Row shadow**: Add `boxShadow: unset`

---

## Loading State

### webapp (v1)
When `data.length === 0` and table is selected with rows > 0:
```
Centered: [CircularProgress icon] "Generating insights"
Height: full available height (debouncedHeight)
```

### webapp_v2 (current)
Shows 5 skeleton rows in the table structure.

### Changes Needed
Replace skeleton rows with centered spinner + "Generating insights" text.

---

## Empty/Error States

### webapp (v1)
| State | Text |
|-------|------|
| No table selected | "Select a table from the left pane to view" |
| 0 rows | "No data (0 rows) available to generate insights" |
| Loading | CircularProgress + "Generating insights" |
| Failed distribution | "-- -- -- No data available -- -- --" |

### webapp_v2 (current)
| State | Text |
|-------|------|
| No table selected | (handled by parent - not shown) |
| 0 rows | "No data (0 rows) available" |
| Loading | Skeleton rows |
| Failed distribution | "No data available" |

### Changes Needed
1. 0 rows: Change to "No data (0 rows) available to generate insights"
2. Failed: Change to "-- -- -- No data available -- -- --"
3. Loading: Use spinner, not skeleton rows

---

## Skeleton (per-row loading)

### webapp (v1)
When a specific column's distribution is still loading (but others are ready):
```
<Skeleton variant="rectangular" height={118} />
```
Full rectangular skeleton in the distribution cell only. Other cells (name, type) show immediately.

### webapp_v2 (current)
```
<Skeleton className="h-24 w-full" />
```

### Changes Needed
Change skeleton height from `h-24` (96px) to `height: 118px`.
