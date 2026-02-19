# D3 vs ECharts Analysis for Pipeline Run History Bar Chart

## D3 Implementation Features (Current in webapp)

```javascript
// From webapp/src/pages/pipeline/index.tsx lines 36-185
```

### Feature Breakdown

| # | Feature | D3 Implementation |
|---|---------|-------------------|
| 1 | **Bar dimensions** | 8px width, 48px max height |
| 2 | **Color coding** | Success (#00897B), Failed (#C15E5E), DBT Test Failed (#df8e14) |
| 3 | **Height scaling** | Toggle: proportional to runtime OR fixed height |
| 4 | **Animation** | 1000ms transition on load |
| 5 | **Tooltip content** | Start time, Runtime, Status, "Check logs" link |
| 6 | **Clickable link in tooltip** | Clicking "Check logs" opens modal |
| 7 | **Horizontal baseline** | Line below bars at y=height+8 |
| 8 | **Responsive width** | Width = runs.length * 14px |

---

## ECharts Capability Analysis

### Feature 1: Bar Dimensions
**ECharts Support: YES**

```typescript
series: [{
  type: 'bar',
  barWidth: 8,
  barMaxWidth: 8,
  // Height controlled by yAxis max value
}]
```

### Feature 2: Color Coding by Status
**ECharts Support: YES**

```typescript
series: [{
  type: 'bar',
  itemStyle: {
    // Function-based coloring
    color: (params) => {
      const status = params.data.state_name;
      if (status === 'DBT_TEST_FAILED') return '#df8e14';
      if (params.data.status === 'COMPLETED') return '#00897B';
      return '#C15E5E';
    }
  }
}]
```

### Feature 3: Height Scaling Toggle
**ECharts Support: YES**

```typescript
// Proportional scaling (default)
yAxis: {
  type: 'value',
  max: 'dataMax'
}

// Fixed height (all bars same)
// Transform data: all values = 1, store actual value in custom field
series: [{
  data: runs.map(run => ({
    value: scaleToRuntime ? run.totalRunTime : 1,
    originalValue: run.totalRunTime,
    ...run
  }))
}]
```

### Feature 4: Animation
**ECharts Support: YES**

```typescript
animationDuration: 1000,
animationEasing: 'cubicOut'
```

### Feature 5: Custom Tooltip Content
**ECharts Support: YES**

```typescript
tooltip: {
  trigger: 'item',
  formatter: (params) => {
    const run = params.data;
    const runtime = formatDuration(run.totalRunTime);
    return `
      <strong>Start time:</strong> ${run.lastRunDateFormat}<br/>
      <strong>Run time:</strong> ${runtime}<br/>
      <strong>Status:</strong> ${run.status}<br/>
      <a class="check-logs-link" data-id="${run.id}">Check logs</a>
    `;
  }
}
```

### Feature 6: Clickable Link in Tooltip ⚠️
**ECharts Support: PARTIAL - Requires Workaround**

**The Challenge:**
- D3 tooltip stays visible and allows clicking the link
- ECharts tooltip disappears when mouse leaves the bar

**Solution Options:**

#### Option A: Enterable Tooltip (Recommended)
```typescript
tooltip: {
  trigger: 'item',
  enterable: true,  // Allow mouse to enter tooltip
  hideDelay: 200,   // Delay before hiding
  formatter: (params) => {
    return `
      ...
      <a class="check-logs-link"
         style="cursor:pointer; color:#0066cc; text-decoration:underline;"
         onclick="window.dispatchEvent(new CustomEvent('openFlowRunLogs', {detail: '${params.data.id}'}))">
        Check logs
      </a>
    `;
  }
}

// In React component:
useEffect(() => {
  const handler = (e) => onSelectRun(e.detail);
  window.addEventListener('openFlowRunLogs', handler);
  return () => window.removeEventListener('openFlowRunLogs', handler);
}, [onSelectRun]);
```

#### Option B: Click on Bar Directly (Simpler)
```typescript
// Remove link from tooltip, click bar to open logs
chart.on('click', (params) => {
  onSelectRun(params.data);
});

tooltip: {
  formatter: (params) => {
    return `
      ...
      <em style="color:#666;">Click bar to view logs</em>
    `;
  }
}
```

**Recommendation:** Option B is cleaner and more reliable. Users click the bar directly instead of hovering then clicking a link.

### Feature 7: Horizontal Baseline
**ECharts Support: YES**

```typescript
xAxis: {
  type: 'category',
  axisLine: {
    show: true,
    lineStyle: {
      color: '#758397',
      width: 1
    }
  },
  // Position line below bars
  offset: 8
}
```

### Feature 8: Responsive Width
**ECharts Support: YES**

```typescript
// Container width calculation
<div style={{ width: `${runs.length * 14}px` }}>
  <ReactECharts ... />
</div>
```

---

## Full ECharts Implementation

```tsx
'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts';
import { DashboardRun } from '@/types/pipeline';
import { formatDuration } from '@/lib/pipeline-utils';
import { format } from 'date-fns';

interface PipelineBarChartProps {
  runs: DashboardRun[];
  onSelectRun: (run: DashboardRun) => void;
  scaleToRuntime?: boolean;
}

export function PipelineBarChart({
  runs,
  onSelectRun,
  scaleToRuntime = true
}: PipelineBarChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const getBarColor = (run: DashboardRun): string => {
    if (run.state_name === 'DBT_TEST_FAILED') return '#df8e14';
    if (run.status === 'COMPLETED') return '#00897B';
    return '#C15E5E';
  };

  const initChart = useCallback(() => {
    if (!chartRef.current || runs.length === 0) return;

    if (chartInstance.current) {
      chartInstance.current.dispose();
    }

    chartInstance.current = echarts.init(chartRef.current);

    // Transform data (reverse for chronological order, oldest first)
    const chartData = [...runs].reverse().map((run) => ({
      value: scaleToRuntime ? run.totalRunTime : 1,
      ...run,
      formattedTime: format(new Date(run.startTime), 'yyyy-MM-dd HH:mm:ss'),
      formattedDuration: formatDuration(run.totalRunTime),
    }));

    const option: echarts.EChartsOption = {
      animation: true,
      animationDuration: 1000,
      animationEasing: 'cubicOut',

      grid: {
        left: 0,
        right: 0,
        top: 0,
        bottom: 16, // Space for baseline
        containLabel: false,
      },

      xAxis: {
        type: 'category',
        data: chartData.map((_, i) => i),
        show: false,
        axisLine: {
          show: true,
          lineStyle: { color: '#758397', width: 1 },
        },
      },

      yAxis: {
        type: 'value',
        show: false,
        max: scaleToRuntime ? 'dataMax' : 1,
      },

      tooltip: {
        trigger: 'item',
        enterable: true,
        hideDelay: 300,
        backgroundColor: 'white',
        borderColor: 'black',
        borderWidth: 1,
        borderRadius: 10,
        padding: 8,
        textStyle: {
          fontFamily: 'Arial',
          fontSize: 12,
          color: '#000',
        },
        formatter: (params: any) => {
          const run = params.data;
          const statusText = run.state_name === 'DBT_TEST_FAILED'
            ? 'dbt tests failed'
            : run.status;
          return `
            <strong>Start time:</strong> ${run.formattedTime}<br/>
            <strong>Run time:</strong> ${run.formattedDuration}<br/>
            <strong>Status:</strong> ${statusText}<br/>
            <span style="color:#0066cc; cursor:pointer;">Click bar to view logs</span>
          `;
        },
      },

      series: [{
        type: 'bar',
        barWidth: 8,
        barGap: '75%', // Gap between bars (14px total = 8px bar + 6px gap)
        data: chartData,
        itemStyle: {
          color: (params: any) => getBarColor(params.data),
        },
        emphasis: {
          itemStyle: {
            opacity: 0.8,
          },
        },
      }],

      // Baseline below bars
      graphic: [{
        type: 'line',
        shape: {
          x1: 0,
          y1: 56,  // 48px height + 8px gap
          x2: runs.length * 14,
          y2: 56,
        },
        style: {
          stroke: '#758397',
          lineWidth: 1,
        },
      }],
    };

    chartInstance.current.setOption(option);

    // Click handler
    chartInstance.current.on('click', (params: any) => {
      if (params.data) {
        onSelectRun(params.data);
      }
    });
  }, [runs, scaleToRuntime, onSelectRun]);

  useEffect(() => {
    initChart();
    return () => {
      chartInstance.current?.dispose();
    };
  }, [initChart]);

  if (runs.length === 0) return null;

  return (
    <div style={{ overflowX: 'auto' }}>
      <div
        ref={chartRef}
        style={{
          width: `${runs.length * 14}px`,
          height: '58px'
        }}
      />
    </div>
  );
}
```

---

## Feature Comparison Summary

| Feature | D3 | ECharts | Notes |
|---------|:--:|:-------:|-------|
| Bar dimensions | ✅ | ✅ | Identical |
| Color by status | ✅ | ✅ | Function-based coloring |
| Height scaling toggle | ✅ | ✅ | Transform data values |
| Animation | ✅ | ✅ | Built-in, configurable |
| Custom tooltip | ✅ | ✅ | Rich HTML support |
| Clickable tooltip link | ✅ | ⚠️ | Need workaround or use bar click |
| Horizontal baseline | ✅ | ✅ | Via graphic element |
| Responsive width | ✅ | ✅ | Container-based |

---

## Potential Functionality Gaps

### 1. Tooltip Interaction Model
**D3:** Hover bar → tooltip appears → move mouse to tooltip → click link
**ECharts with enterable:** Same behavior possible, but less common pattern

**Mitigation:** Use bar click directly. This is actually a **better UX**:
- One click instead of hover + click
- Works on touch devices
- More intuitive

### 2. Tooltip Positioning
**D3:** Manual positioning with exact pixel offsets (`x - 5`, `y - 95`)
**ECharts:** Automatic positioning, can customize with `position` option

```typescript
tooltip: {
  position: function (point, params, dom, rect, size) {
    return [point[0] - 5, point[1] - 95];
  }
}
```

### 3. SVG vs Canvas
**D3:** Uses SVG elements (vector, crisp at any zoom)
**ECharts:** Uses Canvas by default (faster for large datasets)

**Mitigation:** ECharts supports SVG renderer:
```typescript
echarts.init(chartRef.current, null, { renderer: 'svg' });
```

---

## Recommendation

**YES, ECharts can fully replace D3** for this use case with these adjustments:

1. **Use bar click instead of tooltip link** - Better UX, simpler code
2. **Use `enterable` tooltip** if link in tooltip is required
3. **Use graphic element for baseline** instead of separate SVG line

**Benefits of ECharts:**
- Consistent with rest of webapp_v2 codebase
- Better performance for larger datasets
- Built-in touch support
- Easier maintenance (declarative config vs imperative DOM)
- Automatic resize handling

**Potential Downsides:**
- Slightly less pixel-perfect control
- Bundle size (already included, so not a concern)

---

## Final Verdict

**No functionality will be lost.** The only UX change is:
- **Before (D3):** Hover → Click "Check logs" link in tooltip
- **After (ECharts):** Click bar directly (tooltip says "Click bar to view logs")

This is actually an **improvement** in usability.
