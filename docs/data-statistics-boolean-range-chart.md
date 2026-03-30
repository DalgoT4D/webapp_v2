# Boolean / RangeChart - Gap Analysis

## Overview
Boolean columns use `RangeChart` (horizontal stacked bar) to show True/False distribution.
The `RangeChart` is also used by `StringInsights` for the "range" view mode.

---

## Boolean Data Transformation

### webapp (v1) - REFERENCE
Data is transformed in `StatisticsPane.tsx`:
```typescript
<RangeChart
  data={[
    {
      name: 'True',
      percentage: ((distribution.countTrue * 100) / distribution.count).toFixed(1),
      count: distribution.countTrue,
    },
    {
      name: 'False',
      percentage: ((distribution.countFalse * 100) / distribution.count).toFixed(1),
      count: distribution.countFalse,
    },
  ]}
  colors={['#00897b', '#c7d8d7']}
  barHeight={12}
/>
```
- **Only 2 segments**: True and False
- **Percentage base**: `distribution.count` (total non-null count from API)
- **Colors**: `['#00897b', '#c7d8d7']` (dark teal, light teal)
- **Bar height**: `12px`
- **No Null segment**

### webapp_v2 (current)
Data transformed in `formatBooleanData`:
```typescript
function formatBooleanData(stats: BooleanStats, totalRows: number) {
  // Percentage base: totalRows (includes nulls)
  // Includes Null segment if nullCount > 0
  result = [
    { name: 'True', percentage, count: stats.countTrue },
    { name: 'False', percentage, count: stats.countFalse },
  ];
  if (nullCount > 0) {
    result.push({ name: 'Null', percentage, count: nullCount });
  }
  return result;
}
```
- **2-3 segments**: True, False, and optionally Null
- **Percentage base**: `totalRows` (includes nulls)
- **Colors**: Default `TEAL_PALETTE` (6 teal shades)
- **Bar height**: Default `16px`
- **Includes Null segment**

### Differences to Fix
1. **Remove Null segment**: v1 does NOT show null as a separate segment. Only True/False.
2. **Percentage base**: v1 uses `distribution.count` (from API). v2 uses `totalRows`. **Fix**: Use `stats.count` from the API response (add `count` to `BooleanStats` type if needed, or compute as `countTrue + countFalse`).
3. **Colors**: v1 passes explicit `['#00897b', '#c7d8d7']`. v2 uses default palette. **Fix**: Pass explicit colors to match.
4. **Bar height**: v1 uses `12px`. v2 uses default `16px`. **Fix**: Pass `barHeight={12}`.

---

## RangeChart Component

### webapp (v1) - D3 - REFERENCE

**SVG**: `width=700, height=100`

**Bar**: `y=30`, configurable `barHeight` (default 16, Boolean uses 12)

**Colors**: Default `['#00897b', '#33a195', '#66b8b0', '#98d0c9', '#cce7e4', '#c7d8d7']`, overridable via props

**Percentage labels above bar**:
- Position: `y=25` (5px above bar top at y=30)
- `text-anchor: middle`
- Only shown when segment width > 50px
- Format: `"{percentage}% | {count}"`
- Hidden segments get CSS class `hidden-text`

**Legend section**:
- Position: `y=60` (below bar)
- Legend rectangles: `width=16, height=8`
- Spaced 110px apart horizontally
- Legend text: trimmed to 10 chars + `...`
- Legend text position: 25px right of rectangle

**Tooltip** (on hover over bar segments AND legend items):
```css
position: absolute
text-align: center
width: 150px
padding: 2px
z-index: 2000
font: 12px sans-serif
background: white
border: 1px solid black
border-radius: 8px
pointer-events: none
```
Format: `"<strong>{name}</strong>: {percentage}%  |  <strong>Count</strong>: {count}"`

**Cleanup**: Tooltip div is removed on unmount (returned from useEffect)

### webapp_v2 (current) - ECharts

**Dimensions**: `width=700, height=100` via constants ✓

**Bar**: Horizontal stacked bar using ECharts `stack: 'total'`

**Colors**: Uses `TEAL_PALETTE` ✓

**Labels**: Shown inside bar when percentage > 7% (not above bar like v1)
- Format: `"{percentage}%"` (no count in label)
- Color: white (`#fff`), fontSize 11

**Legend**: ECharts native legend at bottom, `itemWidth: 16, itemHeight: 8` ✓

**Tooltip**: ECharts native
- Format: `"<strong>{name}</strong>: {percentage}% | Count: {count}"`

**Grid**: `{ top: 30, bottom: 40, left: 0, right: 0 }`

### Differences to Fix

1. **Label position**: v1 shows labels **above** the bar (`y=25`). v2 shows labels **inside** the bar.
   **Fix**: Change ECharts label `position` to `'top'` and adjust formatting.

2. **Label visibility threshold**: v1 shows when segment > 50px wide. v2 shows when percentage > 7%.
   **Fix**: 50px of 700px width ≈ 7.14%, so the threshold is approximately equivalent. Keep as-is.

3. **Label format**: v1: `"{percentage}% | {count}"`. v2: `"{percentage}%"`.
   **Fix**: Add count to label: `"{percentage}% | {count}"`

4. **Label color**: v1: black (default SVG text). v2: white.
   **Fix**: Change to black or dark color since labels will be above the bar.

5. **Legend spacing**: v1 spaces legends 110px apart. v2 uses ECharts auto layout.
   **Fix**: ECharts legend auto-layout is acceptable if visual result is similar.

6. **Legend text**: Both trim to 10 chars. ✓

7. **Tooltip format**: v1: `"<strong>{name}</strong>: {percentage}% | <strong>Count</strong>: {count}"`. v2: `"<strong>{name}</strong>: {percentage}% | Count: {count}"`. Minor difference ("Count" not bold in v2). **Fix**: Make "Count" bold.

---

## BooleanStats Type Gap

### webapp (v1)
API response includes `count` field (total including non-null):
```typescript
{ countTrue, countFalse, count, countNull, countDistinct }
```

### webapp_v2 (current)
```typescript
interface BooleanStats {
  count: number;
  countTrue: number;
  countFalse: number;
}
```
Missing: `countNull`, `countDistinct`.

### Fix
Add `countNull` and `countDistinct` to `BooleanStats` type. Use `count` (not `totalRows`) as the percentage base.
