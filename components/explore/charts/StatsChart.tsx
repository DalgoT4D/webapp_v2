// components/explore/charts/StatsChart.tsx
// ECharts equivalent of v1's D3 StatsChart — uses `graphic` for pixel-perfect positioning.
// Unlike D3 (SVG overflow:visible), ECharts canvas clips at boundaries,
// so we use a taller container (130px vs 100px) to prevent label cutoff.
'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { GraphicComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { EXPLORE_COLORS, EXPLORE_DIMENSIONS } from '@/constants/explore';

echarts.use([GraphicComponent, CanvasRenderer]);

export interface StatsData {
  minimum: number;
  maximum: number;
  mean: number;
  median: number;
  mode: number | null;
  otherModes?: number[] | null;
}

interface StatsChartProps {
  data: StatsData;
}

// v1 D3: SVG 700×100, margins { top:20, right:40, bottom:20, left:40 }, overflow:visible
// Canvas clips, so we use 130px height with extra top/bottom padding.
// The net drawing area (620×60) and relative positions stay identical.
const CHART_W = EXPLORE_DIMENSIONS.CHART_WIDTH; // 700
const STATS_CHART_H = 130;
const MARGIN = { top: 30, right: 40, bottom: 40, left: 40 };
const NET_W = CHART_W - MARGIN.left - MARGIN.right; // 620
const NET_H = 60; // Same as v1: 100 - 20 - 20
const CENTER_Y = MARGIN.top + NET_H / 2; // 60

export function StatsChart({ data }: StatsChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    chartRef.current = echarts.init(containerRef.current);

    return () => {
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current || data.minimum === data.maximum) return;

    const { minimum, maximum, mean, median, mode, otherModes } = data;

    // Scale: maps data value → pixel x
    const scaleX = (val: number) => MARGIN.left + ((val - minimum) / (maximum - minimum)) * NET_W;

    // Central bar spans from min(mean,median,mode) to max(mean,median,mode)
    const centralVals = [mean, median];
    if (mode !== null && mode !== undefined) centralVals.push(mode);
    const minC = Math.min(...centralVals);
    const maxC = Math.max(...centralVals);

    // v1 label y-positions (in local coords relative to the SVG group):
    //   addMarker(min, 'Min')                → y = h/2 − 20 = 10
    //   addMarker(max, 'Max')                → y = h/2 − 20 = 10
    //   addMarker(mean, 'Mean', false, 1.1)  → y = h/1.1 ≈ 54.5
    //   addMarker(median, 'Median', true, 5) → y = h/5 − 20 = −8
    //   Mode                                 → y = h/0.8 = 75
    // Add MARGIN.top for absolute canvas coords:
    const labelY = {
      Min: MARGIN.top + (NET_H / 2 - 20), // 40
      Max: MARGIN.top + (NET_H / 2 - 20), // 40
      Mean: MARGIN.top + NET_H / 1.1, // ≈84.5
      Median: MARGIN.top + (NET_H / 5 - 20), // 22
      Mode: MARGIN.top + NET_H / 0.8, // 105
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const elements: any[] = [];

    // --- horizontal line from min to minCentral ---
    elements.push({
      type: 'line',
      shape: { x1: scaleX(minimum), y1: CENTER_Y, x2: scaleX(minC), y2: CENTER_Y },
      style: { stroke: '#000', lineWidth: 2 },
      silent: true,
    });

    // --- central teal bar ---
    const barW = Math.max(scaleX(maxC) - scaleX(minC), 2);
    elements.push({
      type: 'rect',
      shape: { x: scaleX(minC), y: CENTER_Y - 5, width: barW, height: 10 },
      style: { fill: EXPLORE_COLORS.PRIMARY_TEAL },
      silent: true,
    });

    // --- horizontal line from maxCentral to max ---
    elements.push({
      type: 'line',
      shape: { x1: scaleX(maxC), y1: CENTER_Y, x2: scaleX(maximum), y2: CENTER_Y },
      style: { stroke: '#000', lineWidth: 2 },
      silent: true,
    });

    // --- tick marks + labels for each stat ---
    const markers: Array<{ name: string; value: number }> = [
      { name: 'Min', value: minimum },
      { name: 'Max', value: maximum },
      { name: 'Mean', value: mean },
      { name: 'Median', value: median },
    ];
    if (mode !== null && mode !== undefined) {
      markers.push({ name: 'Mode', value: mode });
    }

    markers.forEach((m) => {
      // Tick mark
      elements.push({
        type: 'line',
        shape: {
          x1: scaleX(m.value),
          y1: CENTER_Y - 5,
          x2: scaleX(m.value),
          y2: CENTER_Y + 5,
        },
        style: { stroke: '#000', lineWidth: 2 },
        silent: true,
      });

      // Label — use textVerticalAlign:'bottom' to match D3 where y is text baseline
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textEl: any = {
        type: 'text',
        x: scaleX(m.value),
        y: labelY[m.name as keyof typeof labelY],
        style: {
          text: `${m.name}: ${Math.trunc(m.value).toLocaleString()}`,
          textAlign: 'center',
          textVerticalAlign: 'bottom',
          fontSize: 12,
          fill: '#000',
          fontFamily: 'sans-serif',
        },
        silent: true,
      };

      if (m.name === 'Mode' && otherModes && otherModes.length > 0) {
        textEl.silent = false;
        textEl.style = {
          ...textEl.style,
          cursor: 'pointer',
        };
      }

      elements.push(textEl);
    });

    chartRef.current.setOption(
      {
        graphic: { elements },
      },
      { notMerge: true }
    );
  }, [data]);

  return (
    <div
      ref={containerRef}
      style={{ width: CHART_W, height: STATS_CHART_H }}
      data-testid="stats-chart-container"
    />
  );
}
