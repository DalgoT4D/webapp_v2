// components/explore/charts/RangeChart.tsx
// ECharts equivalent of v1's D3 RangeChart — uses `graphic` for pixel-perfect positioning.
// v1 layout: SVG 700×100, bar at y=30, labels at y=25, legend at y=60
'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as echarts from 'echarts/core';
import { GraphicComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { EXPLORE_COLORS, EXPLORE_DIMENSIONS } from '@/constants/explore';

echarts.use([GraphicComponent, CanvasRenderer]);

interface RangeChartData {
  name: string;
  percentage: string;
  count: number;
}

interface RangeChartProps {
  data: RangeChartData[];
  colors?: string[];
  barHeight?: number;
}

const CHART_W = EXPLORE_DIMENSIONS.CHART_WIDTH; // 700
const CHART_H = EXPLORE_DIMENSIONS.CHART_HEIGHT; // 100

// Trim to 10 chars matching v1
const trimName = (name: string) => (name.length > 10 ? name.substring(0, 10) + '...' : name);

export function RangeChart({
  data,
  colors = EXPLORE_COLORS.TEAL_PALETTE as unknown as string[],
  barHeight = EXPLORE_DIMENSIONS.BAR_HEIGHT,
}: RangeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // Create/destroy tooltip div matching v1 style
  // ECharts graphic events wrap native events — extract pageX/pageY safely
  const showTooltip = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (echartsEvent: any, item: RangeChartData) => {
      // ECharts graphic event: { event: ZRenderEvent } where ZRenderEvent has .event (native)
      // or sometimes the native event is at echartsEvent.event directly
      const nativeEvent: MouseEvent =
        echartsEvent?.event?.event ?? echartsEvent?.event ?? echartsEvent;
      const pageX = nativeEvent?.pageX ?? 0;
      const pageY = nativeEvent?.pageY ?? 0;

      if (!tooltipRef.current) {
        tooltipRef.current = document.createElement('div');
        Object.assign(tooltipRef.current.style, {
          position: 'absolute',
          textAlign: 'center',
          width: '150px',
          padding: '2px',
          zIndex: '2000',
          font: '12px sans-serif',
          background: 'white',
          border: '1px solid black',
          borderRadius: '8px',
          pointerEvents: 'none',
          opacity: '0',
          transition: 'opacity 0.2s',
        });
        document.body.appendChild(tooltipRef.current);
      }
      tooltipRef.current.innerHTML = `<strong>${item.name}</strong>: ${item.percentage}%  |  <strong>Count</strong>: ${item.count.toLocaleString()}`;
      tooltipRef.current.style.left = pageX + 5 + 'px';
      tooltipRef.current.style.top = pageY - 28 + 'px';
      tooltipRef.current.style.opacity = '0.9';
    },
    []
  );

  const hideTooltip = useCallback(() => {
    if (tooltipRef.current) {
      tooltipRef.current.style.opacity = '0';
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    chartRef.current = echarts.init(containerRef.current);

    return () => {
      chartRef.current?.dispose();
      chartRef.current = null;
      if (tooltipRef.current) {
        document.body.removeChild(tooltipRef.current);
        tooltipRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

    const totalCount = data.reduce((sum, d) => sum + d.count, 0);

    // Scale: count → pixel width
    const scaleW = (count: number) => (count / totalCount) * CHART_W;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const elements: any[] = [];

    // --- Bar segments at y=30 ---
    let offsetX = 0;
    data.forEach((d, i) => {
      const segW = scaleW(d.count);
      const itemColor = colors[i % colors.length];

      // Bar rectangle
      elements.push({
        type: 'rect',
        shape: { x: offsetX, y: 30, width: segW, height: barHeight },
        style: { fill: itemColor },
        silent: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onmousemove: (e: any) => {
          showTooltip(e, d);
        },
        onmouseout: () => hideTooltip(),
      });

      // Percentage label just above bar — only when segment > 50px (v1 rule)
      // v1 D3: y=25 is text baseline; ECharts: use textVerticalAlign:'bottom' to match
      if (segW > 50) {
        elements.push({
          type: 'text',
          x: offsetX + segW / 2,
          y: 28,
          style: {
            text: `${d.percentage}% | ${d.count}`,
            textAlign: 'center',
            textVerticalAlign: 'bottom',
            fontSize: 12,
            fill: '#000',
            fontFamily: 'sans-serif',
          },
          silent: true,
        });
      }

      offsetX += segW;
    });

    // --- Legend at y=60 ---
    // v1: rectangles 16×8, spaced 110px apart, text 25px right of rectangle
    let legendX = 0;
    data.forEach((d, i) => {
      const itemColor = colors[i % colors.length];

      // Legend color rectangle
      elements.push({
        type: 'rect',
        shape: { x: legendX, y: 60, width: 16, height: 8 },
        style: { fill: itemColor },
        silent: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onmousemove: (e: any) => {
          showTooltip(e, d);
        },
        onmouseout: () => hideTooltip(),
      });

      // Legend text
      elements.push({
        type: 'text',
        x: legendX + 25,
        y: 68,
        style: {
          text: trimName(d.name),
          textAlign: 'left',
          textVerticalAlign: 'middle',
          fontSize: 12,
          fill: '#000',
          fontFamily: 'sans-serif',
        },
        silent: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onmousemove: (e: any) => {
          showTooltip(e, d);
        },
        onmouseout: () => hideTooltip(),
      });

      legendX += 110; // v1: 110px spacing between legend items
    });

    chartRef.current.setOption({ graphic: { elements } }, { notMerge: true });
  }, [data, colors, barHeight, showTooltip, hideTooltip]);

  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', minHeight: 110 }}>
        -- -- -- No data available -- -- --
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ width: CHART_W, height: CHART_H }}
      data-testid="range-chart-container"
    />
  );
}
