# NumberInsights Chart - Gap Analysis

## Overview
Shows statistics for **Numeric** columns. Has two view modes: chart view and numbers view, toggled by an icon.

---

## Chart View

### webapp (v1) - D3 StatsChart - REFERENCE

**SVG dimensions**: `width=700, height=100`
**Margins**: `{ top: 20, right: 40, bottom: 20, left: 40 }` → net area `620 x 60`
**SVG overflow**: `visible` (labels can extend beyond bounds)

**Visual structure**:
```
        Min: 100                    Median: 450           Max: 900
           |                            |                    |
  ─────────┤████████████████████████████┤────────────────────┤
           |           teal bar         |                    |
        Mean: 350                                        Mode: 800
```

1. **Central teal bar** (`fill: #00897b`):
   - Spans from `min(mean, median, mode)` to `max(mean, median, mode)`
   - Height: 10px, vertically centered at `height/2 - 5`

2. **Black connecting lines** (`stroke: black, stroke-width: 2`):
   - From `min` value to central bar start
   - From central bar end to `max` value
   - Horizontal, at `height/2`

3. **Tick markers** at each stat point:
   - Vertical line from `height/2 - 5` to `height/2 + 5`
   - `stroke: black, stroke-width: 2`

4. **Labels**:
   - `Min`: above center (`y = height/2 - 20`)
   - `Max`: above center
   - `Mean`: below center (`y = height/1.1`)
   - `Median`: further above (`y = height/5 - 20`)
   - `Mode`: below at (`y = height/0.8`)
   - Format: `"Label: value"` with `Math.trunc().toLocaleString()`
   - Mode tooltip (on hover): shows "Other modes: ..." if `otherModes.length > 0`

5. **Tooltip**: D3-appended div to `document.body`
   - `position: absolute, width: 150px, background: white, border: 1px solid black, border-radius: 8px, font: 12px sans-serif, z-index: 2000`

### webapp_v2 (current) - ECharts

**Dimensions**: `width=700, height=100` via `EXPLORE_DIMENSIONS`
**Grid**: `{ top: 40, bottom: 20, left: 60, right: 60 }`

**Structure**:
- `xAxis`: value axis (min to max), labels formatted with `Math.trunc().toLocaleString()`
- `yAxis`: hidden category axis with single empty row
- **Series 1 (bar)**: teal bar from `min(mean,median,mode)` to `max(mean,median,mode)`, barWidth 10
- **Series 2 (scatter)**: rect markers at Min, Max, Mean, Median, Mode positions
  - Symbol: `rect`, size `[2, 20]`, color `#000`
  - Labels: `show: true, position: 'top'`, format `"Name: value"`

**Tooltip**: ECharts native, `{ backgroundColor: '#fff', borderColor: '#000', borderWidth: 1, borderRadius: 8 }`

### Differences to Fix
1. **Label positions**: v1 places labels at specific y-positions (Min/Max above, Mean below, Median further above, Mode further below). v2 puts all labels at `position: 'top'` of scatter points. **Fix**: Use ECharts custom label offsets or a custom series to replicate the staggered label placement.
2. **X-axis labels**: v1 has NO x-axis (pure D3 manual positioning). v2 shows x-axis with tick labels. **Fix**: Hide the x-axis or remove labels to match.
3. **Grid margins**: v1 has `left:40, right:40`. v2 has `left:60, right:60`. **Fix**: Match margins.
4. **Mode tooltip**: v1 shows tooltip on hover over the Mode text label. v2 shows it as part of ECharts tooltip. Both show "Other modes: ..." - functionally equivalent but trigger mechanism differs.

---

## Numbers View

### webapp (v1) - REFERENCE

**Container**: `minWidth: 700px, display: flex, alignItems: center`

**Stat boxes** (5 total: minimum, maximum, mean, median, mode):
```css
/* Label */
color: 'rgba(15, 36, 64, 0.57)'
/* Capitalized: "Minimum", "Maximum", etc. */

/* Value box */
margin-top: 8px  (mt: 1)
width: 84px
height: 24px
background: '#F5FAFA'
display: flex
alignItems: center

/* Value text */
margin-left: 8px  (ml: 1)
format: Math.trunc(value).toLocaleString() or 'NA'
```

**Spacing between boxes**: `marginRight: 50px` (mr: '50px')

**Mode tooltip**: MUI `<Tooltip>` with `title="Other modes: ..."` when `otherModes.length > 1`

**Key iteration**: Iterates over `Object.keys(data)` filtering out `otherModes`, capitalizes first letter of key name.

### webapp_v2 (current)

**Container**: `flex items-center gap-8 min-h-[100px] min-w-[700px]`

**Stat boxes** (5 total: Minimum, Maximum, Mean, Median, Mode):
- Label: `text-xs capitalize`, `color: EXPLORE_COLORS.LABEL_COLOR`
- Value box: `h-6 w-[84px] flex items-center justify-center text-sm`, `background: STAT_BOX_BG`
- Values: `Math.trunc(value).toLocaleString()` or `'NA'`

**Spacing**: `gap-8` (32px) between boxes

### Differences to Fix
1. **Spacing**: v1 uses `marginRight: 50px` per box. v2 uses `gap-8` (32px). **Fix**: Change to `gap-[50px]` or use `mr-[50px]` per box.
2. **Alignment**: v1 has `flex-col` implicit (label above value). v2 uses `flex-col items-center`. v1 items are **left-aligned**, v2 are **center-aligned**. **Fix**: Remove `items-center` from stat box flex-col.
3. **Value text position**: v1 has `ml: 1` (left-aligned inside box). v2 has `justify-center`. **Fix**: Change to left-aligned with `ml-1`.
4. **Label capitalization**: v1 manually capitalizes `key.charAt(0).toUpperCase() + key.slice(1)` from object keys (lowercase: `minimum`, `maximum`, etc.). v2 uses pre-defined labels. Both produce same result - OK.
5. **Font size**: v1 label has no explicit font-size (inherits ~14px). v2 uses `text-xs` (12px). **Fix**: Remove `text-xs` or use inherited size.

---

## Toggle Icon

### webapp (v1)
- Image: `switch-chart.svg` from `@/assets/icons/`
- Style: `marginLeft: 20px, cursor: pointer`
- Toggles between `'chart'` and `'numbers'`

### webapp_v2 (current)
- Lucide icons: `<List>` and `<BarChart3>` inside a `<Button variant="ghost" size="icon">`
- Gap from chart: `gap-2` in parent flex

### Differences to Fix
1. **Icon**: v1 uses a custom SVG icon (`switch-chart.svg`). v2 uses Lucide icons. **Decision**: Keep Lucide icons (acceptable modernization) OR port the SVG for pixel-perfect match.
2. **Spacing**: v1 has `marginLeft: 20px`. v2 has `gap-2` (8px). **Fix**: Increase gap or add explicit margin.

---

## Edge Case: All Identical Values

### webapp (v1)
Text: `"All entries in this column are identical"` (plain text, no extra info)

### webapp_v2 (current)
Text: `"All entries in this column are identical ({value})"` inside `h-24 text-muted-foreground text-sm`

### Differences to Fix
1. **Text**: Remove the `({value})` part to match v1.
2. **Styling**: v1 is plain inline text (no special container). v2 wraps in a centered div with muted color. **Fix**: Use plain inline text.

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

### Differences to Fix
1. Add `min-h-[110px]` to match v1.
2. Change `gap-2` to no gap (items are positioned with individual margins in v1).
