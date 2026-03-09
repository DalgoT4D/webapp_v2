'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import * as echarts from 'echarts';
import type {
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemAPI,
  ECElementEvent,
} from 'echarts';
import { DashboardRun } from '@/types/pipeline';
import { formatDuration } from './utils';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  FlowRunStatus,
  FlowRunStateName,
  STATUS_COLOR_SUCCESS,
  STATUS_COLOR_FAILED,
  STATUS_COLOR_DBT_TEST_FAILED,
  CHART_BASELINE_COLOR,
  TOOLTIP_BUTTON_BG,
} from '@/constants/pipeline';

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

// Delay before hiding tooltip when mouse leaves bar (allows moving to tooltip)
const TOOLTIP_HIDE_DELAY_MS = 300;

interface TooltipData {
  run: DashboardRun & { formattedTime: string; formattedDuration: string };
  x: number;
  y: number;
}

/**
 * ChartTooltip - React portal-based tooltip for the bar chart
 * Renders into document.body but stays in the React tree
 */
function ChartTooltip({
  data,
  onSelectRun,
  onMouseEnter,
  onMouseLeave,
}: {
  data: TooltipData;
  onSelectRun: (run: DashboardRun) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const { run, x, y } = data;

  const statusText =
    run.state_name === FlowRunStateName.DBT_TEST_FAILED
      ? 'DBT tests failed'
      : run.status === FlowRunStatus.COMPLETED
        ? 'Completed'
        : 'FAILED';

  const statusColor =
    run.state_name === FlowRunStateName.DBT_TEST_FAILED
      ? STATUS_COLOR_DBT_TEST_FAILED
      : run.status === FlowRunStatus.COMPLETED
        ? STATUS_COLOR_SUCCESS
        : STATUS_COLOR_FAILED;

  return createPortal(
    <div
      data-testid="pipeline-chart-tooltip"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-[9999] bg-white border border-black rounded-[10px] px-4 py-3 text-sm shadow-md"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translate(-50%, -100%)',
        pointerEvents: 'auto',
      }}
    >
      <div className="leading-[1.8]">
        <div>
          <strong>Start time:</strong> {run.formattedTime}
        </div>
        <div>
          <strong>Run time:</strong> {run.formattedDuration}
        </div>
        <div>
          <strong>Status:</strong>{' '}
          <span className="font-semibold" style={{ color: statusColor }}>
            {statusText}
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          data-testid="tooltip-check-logs-btn"
          className="mt-2 text-xs text-white"
          style={{ backgroundColor: TOOLTIP_BUTTON_BG }}
          onClick={() => onSelectRun(run)}
        >
          Check logs
        </Button>
      </div>
    </div>,
    document.body
  );
}

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
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);

  const getBarColor = (run: DashboardRun): string => {
    if (run.state_name === FlowRunStateName.DBT_TEST_FAILED) return STATUS_COLOR_DBT_TEST_FAILED;
    if (run.status === FlowRunStatus.COMPLETED) return STATUS_COLOR_SUCCESS;
    return STATUS_COLOR_FAILED;
  };

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const hideTooltipDelayed = useCallback(() => {
    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      setTooltipData(null);
    }, TOOLTIP_HIDE_DELAY_MS);
  }, [clearHideTimeout]);

  const handleTooltipMouseEnter = useCallback(() => {
    clearHideTimeout();
  }, [clearHideTimeout]);

  const handleTooltipMouseLeave = useCallback(() => {
    hideTooltipDelayed();
  }, [hideTooltipDelayed]);

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
        show: false, // We use React portal tooltip
      },

      // Custom series to draw rectangles at exact positions (like D3)
      series: [
        {
          type: 'custom',
          coordinateSystem: 'cartesian2d',
          data: chartData,
          renderItem: (params: CustomSeriesRenderItemParams, api: CustomSeriesRenderItemAPI) => {
            const dataItem = chartData[params.dataIndex];
            const x = dataItem.index * (BAR_WIDTH + BAR_GAP);
            const barHeight = scaleToRuntime
              ? (dataItem.totalRunTime / maxRuntime) * BAR_HEIGHT
              : BAR_HEIGHT;

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

    // Tooltip handling with mouseover/mouseout
    chartInstance.current.on('mouseover', (params: ECElementEvent) => {
      if (params.componentType !== 'series') return;
      const run = chartData[params.dataIndex];
      if (!run || !chartRef.current) return;

      // Calculate position for tooltip
      const barX = run.index * (BAR_WIDTH + BAR_GAP) + BAR_WIDTH / 2;
      const chartRect = chartRef.current.getBoundingClientRect();

      setTooltipData({
        run,
        x: chartRect.left + barX,
        y: chartRect.top - 10, // 10px gap above the chart
      });
      clearHideTimeout();
    });

    chartInstance.current.on('mouseout', () => {
      hideTooltipDelayed();
    });

    // Click handler
    chartInstance.current.on('click', (params: ECElementEvent) => {
      if (params.componentType !== 'series') return;
      const run = chartData[params.dataIndex];
      if (run) {
        onSelectRun(run);
      }
    });
  }, [runs, scaleToRuntime, onSelectRun, selectedRunId, clearHideTimeout, hideTooltipDelayed]);

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

  // Clean up hide timeout on unmount
  useEffect(() => {
    return () => clearHideTimeout();
  }, [clearHideTimeout]);

  if (runs.length === 0) return null;

  // Total width: bars + gaps, matching webapp D3 calculation
  const totalWidth = runs.length * (BAR_WIDTH + BAR_GAP);

  return (
    <div className="overflow-x-auto" data-testid="pipeline-bar-chart">
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
          backgroundColor: CHART_BASELINE_COLOR,
        }}
      />

      {/* React portal tooltip */}
      {tooltipData && (
        <ChartTooltip
          data={tooltipData}
          onSelectRun={onSelectRun}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        />
      )}
    </div>
  );
}
