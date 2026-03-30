# StringInsights Chart - Gap Analysis

## Overview
Shows statistics for **String** columns. Has three view modes cycled by a toggle icon.

---

## View Modes Comparison

| Mode | webapp (v1) | webapp_v2 (current) | Match? |
|------|------------|---------------------|--------|
| 1 - Range | `<RangeChart>` (D3 horizontal stacked bar) | `<RangeChart>` (ECharts horizontal stacked bar) | Close - see RangeChart doc |
| 2 - Bars | `<BarChart>` (D3 vertical bars) with `barTopLabel: "{count} \| {percentage}%"` | `<BarChart>` (ECharts vertical bars) | Close - see BarChart doc |
| 3 - Stats | `<StatsChart>` (D3 number-line for **string length** stats) + caption | **Text list** of top 5 categories with counts | **MAJOR GAP** |

---

## Mode 3: Stats View - MAJOR GAP

### webapp (v1) - REFERENCE
The stats view shows a **StatsChart** (same as NumberInsights chart view) for **string length distribution**:
- Shows min/max/mean/median/mode of string lengths
- Data passed: `{ minimum, maximum, mean, median, mode, otherModes }` from API response
- Below the chart: caption text `"String length distribution"` with `fontSize: 11px, color: '#768292', fontWeight: 600, ml: 2`
- Edge case: If `minimum === maximum`, shows `"All entries in this column are identical in length"` (width: 700px)

### webapp_v2 (current)
Shows a **plain text list** of top 5 categories:
```
String length distribution   (text-xs, text-muted-foreground, mb-2)
Category1                    100 (25.0%)
Category2                     80 (20.0%)
...
+N more
```

### Fix Required
Replace the text list with an ECharts chart replicating the StatsChart (number-line visualization):
1. Use the same chart configuration as `NumberInsights` chart view
2. Feed it the string-length stats: `{ minVal, maxVal, mean, median, mode }` from the API response
3. Add caption below: `"String length distribution"` with `fontSize: 11px, color: '#768292', fontWeight: 600, marginLeft: 8px`
4. Handle edge case: `minVal === maxVal` → show `"All entries in this column are identical in length"`

**Note**: The `StringStats` type needs `mean`, `median`, `mode`, `other_modes`, `minVal`, `maxVal` fields for string length stats. Check the API response to confirm these are returned.

---

## Data Transformation

### webapp (v1) - REFERENCE
Data is transformed in `StatisticsPane.tsx` before passing to `StringInsights`:
```typescript
// Range chart data
data={chartData.map((data) => ({
  name: data.category,
  percentage: ((data.count * 100) / distribution.count).toFixed(1),
  count: data.count,
}))}

// Stats data (string lengths)
statsData={{
  minimum: distribution.minVal,
  maximum: distribution.maxVal,
  mean: distribution.mean,
  median: distribution.median,
  mode: distribution.mode,
  otherModes: distribution.other_modes,
}}
```

### webapp_v2 (current)
Data transformation happens inside `StringInsights`:
```typescript
const chartData = charts[0].data.map((item) => ({
  name: item.category,
  percentage: count > 0 ? ((item.count / count) * 100).toFixed(1) : '0',
  count: item.count,
  label: item.category,
  value: item.count,
}));
```
Stats data (minVal, maxVal, mean, median, mode) is **NOT extracted or used**.

### Fix Required
1. Extract `minVal`, `maxVal`, `mean`, `median`, `mode`, `other_modes` from `StringStats`
2. Update `StringStats` type if needed to include these fields
3. Pass as props to the stats chart view

---

## Edge Cases

### webapp (v1)
| Condition | Behavior |
|-----------|----------|
| `count === countNull` | `<Box>All values are null</Box>` (no row count shown) |
| `count === countDistinct` | `<Box>All values are distinct</Box>` (no threshold check) |

### webapp_v2 (current)
| Condition | Behavior |
|-----------|----------|
| `countNull === count` | `"All values are NULL ({count} rows)"` |
| `countDistinct === count && count > 10` | `"All values are distinct ({countDistinct} unique values)"` |
| `chartData.length === 0` | `"No distribution data available"` |

### Differences to Fix
1. **All null text**: Remove ` ({count} rows)` suffix → just `"All values are null"`
2. **All distinct**: Remove `count > 10` threshold check. Remove ` ({countDistinct} unique values)` suffix → just `"All values are distinct"`
3. **No data**: v1 doesn't have this check (data is always present from the API). Keep for safety but text should be `"-- -- -- No data available -- -- --"` to match v1 pattern.

---

## Outer Container

### webapp (v1)
```css
display: flex
alignItems: center
minHeight: 110px
```

### webapp_v2 (current)
```css
flex items-center gap-2
/* No minHeight */
```

### Fix
1. Add `min-h-[110px]`
2. Change layout: toggle icon should be in a separate `Box` with `marginLeft: 20px`

---

## Toggle Icon

### webapp (v1)
```jsx
<Box sx={{ marginLeft: '20px' }}>
  <Image src={switchIcon} onClick={cycle} alt="switch icon" style={{ cursor: 'pointer' }} />
</Box>
```
Cycle order: `chart → bars → stats → chart`

### webapp_v2 (current)
```jsx
<Button variant="ghost" size="icon" onClick={cycleViewMode}>
  {getViewIcon()}  // PieChart → BarChart3 → TrendingUp
</Button>
```
Cycle order: `range → bars → stats → range`

### Differences
- View mode naming: v1 uses `chart/bars/stats`, v2 uses `range/bars/stats` (functionally same)
- Icon: v1 uses custom SVG, v2 uses Lucide icons (acceptable modernization)
- Spacing: v1 has `marginLeft: 20px`, v2 has `gap-2` (8px)
- **Fix**: Increase margin/gap to 20px

---

## BarChart Data Mapping for String "bars" View

### webapp (v1)
```typescript
data={data.map((bar) => ({
  label: bar.name,
  value: bar.count,
  barTopLabel: `${bar.count} | ${bar.percentage}%`,
}))}
```

### webapp_v2 (current)
The `BarChart` receives `chartData` directly which already has `label`, `value`, `name`, `count`, `percentage` fields. The `barTopLabel` is constructed inside `BarChart.tsx` from the item data.

### Fix
Ensure the bar top label format matches: `"{count} | {percentage}%"`. Check `BarChart.tsx` formatter.
