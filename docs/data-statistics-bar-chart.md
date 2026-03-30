# BarChart - Gap Analysis

## Overview
Shared vertical bar chart used by `StringInsights` (bars view) and `DateTimeInsights` (frequency chart).

---

## webapp (v1) - D3 - REFERENCE

**SVG element**: `width=700, height=100`

**Margins**: `{ top: 20, right: 0, bottom: 20, left: 0 }` → net area `700 x 60`

**Scales**:
- X: `d3.scaleBand()` with `padding(0.1)`, domain = trimmed labels
- Y: `d3.scaleLinear()`, domain `[0, max(values)]`, range `[height, 0]`

**Bars**:
- Fill: `#00897b`
- Width: `x.bandwidth()` (auto-calculated by d3.scaleBand)
- Height: `height - y(value)`

**Bar labels** (above each bar):
- Text: `barTopLabel` if provided, otherwise `value`
- Position: `x = center of bar`, `y = y(value) - 5` (5px above bar top)
- `text-anchor: middle`, fill: `#000`
- Font size: inherits from SVG (default ~10-12px)

**X-axis**:
- Labels trimmed to 10 chars + `...`
- Axis line removed (`.domain` removed)
- Tick lines removed
- No rotation (all labels horizontal)

**Tooltip** (on x-axis label hover):
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
- Shows full label text when original label.length > 10
- Positioned at mouse cursor

**No y-axis labels/ticks shown.**

---

## webapp_v2 (current) - ECharts

**Dimensions**: `width=700, height=100` via `EXPLORE_DIMENSIONS` ✓

**Grid**: `{ top: 40, bottom: 60, left: 40, right: 20, containLabel: true }`

**X-axis**:
- Category type
- Labels trimmed to 10 chars + `...` ✓
- `interval: 0` (show all labels)
- `rotate: 45` when `data.length > 6`, else `0`
- `fontSize: 10`

**Y-axis**: `type: 'value'` (shows axis labels by default)

**Bars**:
- Color: `EXPLORE_COLORS.PRIMARY_TEAL` (`#00897b`) ✓
- Labels: `show: true, position: 'top'`
- Label format: `barTopLabel ?? value.toLocaleString()`
- `fontSize: 10`

**Tooltip**: ECharts native
- Format: `"{label}\nValue: {value}"`
- `backgroundColor: '#fff', borderColor: '#000', borderWidth: 1, borderRadius: 8`

---

## Differences to Fix

### 1. X-axis label rotation
- **v1**: Labels are always **horizontal** (no rotation). D3 uses scaleBand which spaces them evenly.
- **v2**: Rotates 45 degrees when `> 6 items`.
- **Fix**: Remove rotation to match v1 (always horizontal). If labels overlap, let them truncate.

### 2. Y-axis visibility
- **v1**: No y-axis is drawn. Only bars and x-axis labels.
- **v2**: Shows y-axis with value labels.
- **Fix**: Hide y-axis: `yAxis: { show: false }`

### 3. Grid / margins
- **v1**: Margins `{ top: 20, right: 0, bottom: 20, left: 0 }` (700x60 net area)
- **v2**: Grid `{ top: 40, bottom: 60, left: 40, right: 20 }` (much more padding)
- **Fix**: Change grid to `{ top: 20, bottom: 20, left: 0, right: 0 }`

### 4. Axis line/ticks
- **v1**: X-axis line and tick lines are explicitly removed. Only category text labels remain.
- **v2**: Default ECharts axis (shows line + ticks)
- **Fix**: Add `axisLine: { show: false }, axisTick: { show: false }` to xAxis config

### 5. Tooltip trigger
- **v1**: Tooltip only appears on hover over **x-axis labels** (not bars), and only if label was truncated.
- **v2**: Tooltip appears on hover over **bars** (`trigger: 'axis'`), always shows.
- **Fix**: Change tooltip to trigger on label hover only, or keep bar-hover (acceptable improvement). If strict match needed, disable bar tooltip and add axisPointer label.

### 6. Tooltip format
- **v1**: Shows only the full untruncated label text.
- **v2**: Shows `"{label}\nValue: {value}"`.
- **Fix**: If matching strictly, show only the full label. Current v2 format is arguably better (shows value too).

### 7. Bar label format
- **v1**: Uses `barTopLabel` if provided, else raw `value` (no `.toLocaleString()`)
- **v2**: Uses `barTopLabel ?? value.toLocaleString()`
- **Fix**: Remove `.toLocaleString()` from the fallback to match v1 exactly (minor difference).

### 8. containLabel
- **v1**: D3 doesn't use this concept. Labels can overflow SVG.
- **v2**: `containLabel: true` ensures labels fit within grid.
- **Fix**: Set `containLabel: false` and add `overflow: 'visible'` styling if needed.

---

## Usage Context Differences

### In StringInsights (bars view)
**v1**: Passes `barTopLabel: "${count} | ${percentage}%"` → label shows both count and percentage above bar.
**v2**: BarChart reads `item.barTopLabel` from data. `StringInsights` currently passes `chartData` which has both `count` and `percentage` fields but does NOT set `barTopLabel` explicitly.
**Fix**: In `StringInsights`, when rendering in bars mode, map data to include `barTopLabel: "${count} | ${percentage}%"`.

### In DateTimeInsights
**v1**: Default labels (frequency values) above bars. No `barTopLabel`.
**v2**: Same - shows frequency values. ✓
