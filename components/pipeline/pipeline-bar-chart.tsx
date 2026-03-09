'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts';
import { DashboardRun } from '@/types/pipeline';
import { formatDuration } from './utils';
import { format } from 'date-fns';

interface PipelineBarChartProps {
  runs: DashboardRun[];
  onSelectRun: (run: DashboardRun) => void;
  scaleToRuntime?: boolean;
  selectedRunId?: string | null;
}

// Constants matching webapp D3 implementation exactly
const BAR_WIDTH = 8;
const BAR_GAP = 6;
const BAR_HEIGHT = 48;

/**
 * PipelineBarChart - ECharts-based bar chart for pipeline run history
 * Uses custom series to match D3 positioning exactly
 */
export function PipelineBarChart({
  runs,
  onSelectRun,
  scaleToRuntime = true,
  selectedRunId = null,
}: PipelineBarChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

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
    const chartData = [...runs].reverse().map((run, index) => ({
      ...run,
      index,
      formattedTime: format(new Date(run.startTime), 'yyyy-MM-dd HH:mm:ss'),
      formattedDuration: formatDuration(run.totalRunTime),
    }));

    // Calculate max runtime for scaling
    const maxRuntime = Math.max(...chartData.map((d) => d.totalRunTime)) || 1;
    const chartWidth = runs.length * (BAR_WIDTH + BAR_GAP);

    const option: echarts.EChartsOption = {
      animation: true,
      animationDuration: 1000,
      animationEasing: 'cubicOut',

      // No grid needed - we draw in pixel coordinates
      grid: {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        containLabel: false,
      },

      // Hidden axes - we position manually
      xAxis: {
        type: 'value',
        show: false,
        min: 0,
        max: chartWidth,
      },

      yAxis: {
        type: 'value',
        show: false,
        min: 0,
        max: BAR_HEIGHT,
      },

      tooltip: {
        show: false, // We'll use custom tooltip
      },

      // Custom series to draw rectangles at exact positions (like D3)
      series: [
        {
          type: 'custom',
          coordinateSystem: 'cartesian2d',
          data: chartData,
          renderItem: (params: any, api: any) => {
            const dataItem = chartData[params.dataIndex];
            const x = dataItem.index * (BAR_WIDTH + BAR_GAP);
            const barHeight = scaleToRuntime
              ? (dataItem.totalRunTime / maxRuntime) * BAR_HEIGHT
              : BAR_HEIGHT;
            const y = BAR_HEIGHT - barHeight;

            // Convert to pixel coordinates
            const startPoint = api.coord([x, 0]);
            const endPoint = api.coord([x + BAR_WIDTH, barHeight]);

            const rectHeight = Math.abs(endPoint[1] - startPoint[1]);
            const rectY = startPoint[1] - rectHeight;

            const isSelected = selectedRunId === dataItem.id;
            const hasSelection = !!selectedRunId;

            return {
              type: 'rect',
              shape: {
                x: startPoint[0],
                y: rectY,
                width: BAR_WIDTH,
                height: rectHeight,
              },
              style: {
                fill: getBarColor(dataItem),
                opacity: hasSelection && !isSelected ? 0.35 : 1,
              },
              emphasis: {
                style: {
                  opacity: 0.8,
                },
              },
            };
          },
          // Encode for proper event handling
          encode: {
            x: 0,
            y: 1,
          },
        },
      ],
    };

    chartInstance.current.setOption(option);

    // Custom tooltip handling with mouseover/mouseout
    chartInstance.current.on('mouseover', (params: any) => {
      if (params.componentType !== 'series') return;
      const run = chartData[params.dataIndex];
      if (!run) return;

      // Calculate bar position for tooltip placement
      const barX = run.index * (BAR_WIDTH + BAR_GAP) + BAR_WIDTH / 2;
      showTooltip(run, barX);
    });

    chartInstance.current.on('mouseout', () => {
      hideTooltipDelayed();
    });

    // Click handler
    chartInstance.current.on('click', (params: any) => {
      if (params.componentType !== 'series') return;
      const run = chartData[params.dataIndex];
      if (run) {
        onSelectRun(run);
      }
    });
  }, [runs, scaleToRuntime, onSelectRun, selectedRunId]);

  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const hideTooltipDelayed = useCallback(() => {
    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      if (tooltipRef.current) {
        tooltipRef.current.style.visibility = 'hidden';
      }
    }, 300);
  }, [clearHideTimeout]);

  // Create tooltip DOM node once on mount, clean up on unmount
  useEffect(() => {
    const tooltip = document.createElement('div');
    tooltip.style.cssText = `
      position: absolute;
      background: white;
      border: 1px solid black;
      border-radius: 10px;
      padding: 12px 16px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 9999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      pointer-events: auto;
      visibility: hidden;
    `;
    document.body.appendChild(tooltip);
    tooltipRef.current = tooltip;

    const handleMouseEnter = () => clearHideTimeout();
    const handleMouseLeave = () => hideTooltipDelayed();
    tooltip.addEventListener('mouseenter', handleMouseEnter);
    tooltip.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      tooltip.removeEventListener('mouseenter', handleMouseEnter);
      tooltip.removeEventListener('mouseleave', handleMouseLeave);
      document.body.removeChild(tooltip);
      tooltipRef.current = null;
      clearHideTimeout();
    };
  }, [clearHideTimeout, hideTooltipDelayed]);

  // Update tooltip content and position — no DOM creation here
  const showTooltip = useCallback(
    (run: DashboardRun & { formattedTime: string; formattedDuration: string }, barX: number) => {
      if (!chartRef.current || !tooltipRef.current) return;

      const statusText =
        run.state_name === 'DBT_TEST_FAILED'
          ? 'DBT tests failed'
          : run.status === 'COMPLETED'
            ? 'Completed'
            : 'FAILED';

      const statusColor =
        run.state_name === 'DBT_TEST_FAILED'
          ? '#df8e14'
          : run.status === 'COMPLETED'
            ? '#00897B'
            : '#C15E5E';

      // Build tooltip content
      const contentDiv = document.createElement('div');
      contentDiv.style.lineHeight = '1.8';

      const startTimeDiv = document.createElement('div');
      startTimeDiv.innerHTML = `<strong>Start time:</strong> ${run.formattedTime}`;

      const runTimeDiv = document.createElement('div');
      runTimeDiv.innerHTML = `<strong>Run time:</strong> ${run.formattedDuration}`;

      const statusDiv = document.createElement('div');
      statusDiv.innerHTML = `<strong>Status:</strong> <span style="color: ${statusColor}; font-weight: 600;">${statusText}</span>`;

      const button = document.createElement('button');
      button.textContent = 'Check logs';
      button.style.cssText = `
        margin-top: 8px;
        background: #5C7080;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 6px 14px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
      `;
      button.addEventListener('mouseover', () => {
        button.style.background = '#4a5d69';
      });
      button.addEventListener('mouseout', () => {
        button.style.background = '#5C7080';
      });
      button.addEventListener('click', () => {
        onSelectRun(run);
      });

      contentDiv.appendChild(startTimeDiv);
      contentDiv.appendChild(runTimeDiv);
      contentDiv.appendChild(statusDiv);
      contentDiv.appendChild(button);

      // Replace tooltip content (clears old listeners on old children)
      tooltipRef.current.replaceChildren(contentDiv);

      // Position tooltip above the bar, centered on the bar
      const chartRect = chartRef.current.getBoundingClientRect();
      const tooltipX = chartRect.left + barX;
      // 10px gap above the chart
      const tooltipY = chartRect.top - 10;

      tooltipRef.current.style.left = `${tooltipX}px`;
      tooltipRef.current.style.top = `${tooltipY}px`;
      tooltipRef.current.style.transform = 'translate(-50%, -100%)';
      tooltipRef.current.style.visibility = 'visible';

      clearHideTimeout();
    },
    [onSelectRun, clearHideTimeout]
  );

  useEffect(() => {
    initChart();
    return () => {
      chartInstance.current?.dispose();
    };
  }, [initChart]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (runs.length === 0) return null;

  // Total width: bars + gaps, matching webapp D3 calculation
  const totalWidth = runs.length * (BAR_WIDTH + BAR_GAP);

  return (
    <div className="overflow-x-auto">
      {/* Chart container */}
      <div
        ref={chartRef}
        style={{
          width: `${totalWidth}px`,
          minWidth: '50px',
          height: `${BAR_HEIGHT}px`,
        }}
      />
      {/* Baseline - separate element like D3's line, spans full width */}
      <div
        className="mt-2"
        style={{
          width: `${totalWidth}px`,
          minWidth: '50px',
          height: '1px',
          backgroundColor: '#758397',
        }}
      />
    </div>
  );
}
