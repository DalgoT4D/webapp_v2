# DateTimeInsights Chart - Gap Analysis

## Overview
Shows statistics for **Datetime** columns. Two view modes: chart (bar chart with pagination) and numbers (date range stats).

---

## Chart View

### webapp (v1) - D3 BarChart - REFERENCE

**Chart**: Reuses `<BarChart>` component (D3, SVG 700x100)

**Layout structure**:
```
[Left Arrow]  [BarChart]  [Right Arrow]
                          [range label]
                          [filter icon]
```

**Pagination arrows**:
```css
width: 16px
margin-top: 24px  (mt: 3)
height: 80px
background: '#F5FAFA'
display: flex, alignItems: center, justifyContent: center
cursor: pointer
hover_background: '#c8d3d3'
```
- Left arrow: MUI `<ArrowLeftIcon>`, only shown when `offset > 0`
- Right arrow: MUI `<ArrowRightIcon>`, only shown when `barChartData.length === 10`
- Icons: MUI arrow icons (filled triangular arrows)

**Range label & filter toggle**:
- Positioned absolute: `right: 20, top: -50`
- Shows range text (`"year"`, `"month"`, `"day"`)
- Below: `switch-filter.svg` icon (custom SVG), `cursor: pointer`, `display: block`, `marginLeft: auto`

**Chart container**: `position: relative, mt: 5` (marginTop: 40px)

**Date formatting** (using `moment.js`):
- Year: `'YYYY'` → e.g., `"2024"`
- Month: `'MMM YYYY'` → e.g., `"Jan 2024"`
- Day: `'D MMM YYYY'` → e.g., `"15 Jan 2024"`

**Loading**: MUI `<Skeleton height={100} width={700} />`
**No data**: `<Box width={700} textAlign="center">No Data available</Box>`

### webapp_v2 (current) - ECharts

**Chart**: `<BaseChart>` with ECharts bar series, `width=600, height=100`

**Layout**:
```
[Prev Button]  [ECharts]  [Next Button]  [Range Toggle Button]
```

**Pagination buttons**: Radix `<Button variant="ghost" size="icon">` with `h-20 w-4 rounded-sm`, `bg: STAT_BOX_BG`
- Lucide `<ChevronLeft>` and `<ChevronRight>` icons
- Disabled state instead of hidden when not applicable

**Range toggle**: `<Button variant="outline" size="sm">` showing range text

**Date formatting** (using native `Date` + manual month names from `MONTH_NAMES` constant):
- Year: `year.toString()`
- Month: `"Jan 2024"` (from `MONTH_NAMES` array)
- Day: `"15 Jan 2024"`

### Differences to Fix

1. **Chart width**: v1 uses 700px. v2 uses 600px. **Fix**: Change to 700px.

2. **Arrow buttons**:
   - v1: Custom styled boxes (16px wide, 80px tall, #F5FAFA bg, hover #c8d3d3), MUI filled arrows
   - v2: Radix buttons with `h-20 w-4`, Lucide chevrons
   - **Fix**: Style buttons to match: `width: 16px, height: 80px, background: #F5FAFA, hover: #c8d3d3`
   - **Visibility**: v1 **hides** arrows when not applicable. v2 **disables** them. **Fix**: Use conditional rendering (hide, don't disable)

3. **Range label position**:
   - v1: Absolute positioned `right: 20, top: -50` above the chart, with filter icon below
   - v2: Separate button to the right of arrows
   - **Fix**: Position range label and filter icon absolutely above the chart, matching v1 layout

4. **Filter icon**: v1 uses `switch-filter.svg`. v2 uses a text button. **Fix**: Either port the SVG or use a Lucide icon (e.g., `<Filter>`) styled similarly.

5. **Chart container margin**: v1 has `mt: 5` (40px top margin) for the chart box. v2 has none. **Fix**: Add margin.

6. **Date formatting**: Both produce same format. v1 uses `moment.js`, v2 uses manual mapping. Functionally equivalent - OK.

7. **Skeleton dimensions**: v1: `height={100} width={700}`. v2: `w-[600px] h-[100px]`. **Fix**: Change to w-[700px].

---

## Numbers View

### webapp (v1) - REFERENCE

**Container**: `minWidth: 700px, display: flex, alignItems: center`

**Layout**:
```
[Min Date box]  [TO text]  [Max Date box]  [Total days data box]
```

**Min Date box**:
```css
margin-right: 30px
/* Label */
color: 'rgba(15, 36, 64, 0.57)'
text: "Minimum date"

/* Value box */
margin-top: 8px
padding-right: 16px  (pr: 2)
background: '#F5FAFA'
height: 24px
display: flex, alignItems: center
/* Inner text */
margin-left: 8px
format: moment(minDate).format('ddd, Do MMMM, YYYY')
/* e.g., "Mon, 1st January, 2024" */
```

**"TO" separator**: `paddingTop: 24px` (pt: 3)

**Max Date box**: Same styling, `margin: 0 30px`, label: `"Maximum date"`

**Total days box**: `margin: 0`, label: `"Total days data"`, value: `moment(maxDate).diff(moment(minDate), 'days')`

### webapp_v2 (current)

**Container**: `flex items-center gap-8 min-h-[100px] min-w-[600px]`

**Layout**:
```
[Min Date]  [Max Date]  [Total Days]
```
(No "TO" separator)

**Stat boxes**:
- Label: `text-xs`, `color: LABEL_COLOR`
- Value: `h-6 px-3 flex items-center justify-center text-sm`, `bg: STAT_BOX_BG`
- Format: `new Date(minVal).toLocaleDateString()` (browser-locale dependent)

### Differences to Fix

1. **Labels**: Change `"Min Date"` → `"Minimum date"`, `"Max Date"` → `"Maximum date"`, `"Total Days"` → `"Total days data"`

2. **"TO" separator**: Add `"TO"` text between min and max date boxes with `paddingTop: 24px`

3. **Date format**:
   - v1: `moment(date).format('ddd, Do MMMM, YYYY')` → `"Mon, 1st January, 2024"`
   - v2: `toLocaleDateString()` → locale-dependent (e.g., `"1/1/2024"`)
   - **Fix**: Install or import a date formatting library, or use `Intl.DateTimeFormat` with explicit options to match: weekday short, day ordinal, month full, year numeric

4. **Total days calculation**:
   - v1: `moment(maxDate).diff(moment(minDate), 'days')` (floor/truncate)
   - v2: `Math.ceil((max - min) / (1000*60*60*24))` (ceiling)
   - **Fix**: Use floor/truncate instead of ceiling to match v1

5. **Container min-width**: v1 is `700px`. v2 is `600px`. **Fix**: Change to `700px`.

6. **Spacing**: v1 uses `mr: 30px` and `m: 0 30px`. v2 uses `gap-8` (32px). **Fix**: Adjust to 30px.

7. **Value box alignment**: v1 left-aligns values (`ml: 1`). v2 center-aligns (`justify-center`). **Fix**: Left-align.

8. **Value box width**: v1 uses auto width with `pr: 2`. v2 uses `px-3`. Match padding.

---

## Toggle Icon

### webapp (v1)
```jsx
<Box sx={{ marginLeft: '20px' }}>
  <Image src={switchIcon} onClick={toggle} alt="switch icon" style={{ cursor: 'pointer' }} />
</Box>
```

### webapp_v2 (current)
```jsx
<Button variant="ghost" size="icon" onClick={toggle}>
  {viewMode === 'chart' ? <List /> : <Calendar />}
</Button>
```

### Fix
- Increase spacing to `marginLeft: 20px`
- Icon difference is acceptable modernization (Lucide vs custom SVG)

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
```

### Fix
1. Add `min-h-[110px]`
2. Remove `gap-2`, use individual margins

---

## Data Flow Difference

### webapp (v1)
- `DateTimeInsights` receives `barProps.data`, `minDate`, `maxDate`, `postBody` as props
- On filter change, calls `httpPost` directly with `{ ...postBody, filter, refresh: true }`
- Polls with local `pollTaskStatus` function
- Sets `barChartData` state from response

### webapp_v2 (current)
- Receives full `DatetimeStats` object, plus `schema`, `table`, `columnName`
- Uses `requestTableMetrics` from hooks
- Polls via `useTaskStatus` SWR hook
- Same end result but cleaner separation

### Fix
Functionally equivalent - no change needed. The v2 approach is architecturally better.
