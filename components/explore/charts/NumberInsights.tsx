// components/explore/charts/NumberInsights.tsx
'use client';

import { useState, useMemo } from 'react';
import { BaseChart } from './BaseChart';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { BarChart3, List } from 'lucide-react';
import { EXPLORE_COLORS, EXPLORE_DIMENSIONS } from '@/constants/explore';
import type { EChartsOption } from 'echarts';
import type { NumericStats } from '@/types/explore';

interface NumberInsightsProps {
  data: NumericStats;
}

export function NumberInsights({ data }: NumberInsightsProps) {
  const [viewMode, setViewMode] = useState<'chart' | 'numbers'>('chart');

  const { minVal, maxVal, mean, median, mode, other_modes } = data;

  // Check if all values are identical
  const allIdentical = minVal === maxVal;

  const chartOption = useMemo<EChartsOption>(() => {
    if (allIdentical) return {};

    const values = [
      { name: 'Min', value: minVal },
      { name: 'Max', value: maxVal },
      { name: 'Mean', value: mean },
      { name: 'Median', value: median },
    ];

    if (mode !== null && mode !== undefined) {
      values.push({ name: 'Mode', value: mode });
    }

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#fff',
        borderColor: '#000',
        borderWidth: 1,
        borderRadius: 8,
        formatter: (params: { name: string; value: number[] }) => {
          const name = params.name;
          const val = params.value[0];

          if (name === 'Mode' && other_modes && other_modes.length > 0) {
            return `${name}: ${Math.trunc(val).toLocaleString()}<br/>Other modes: ${other_modes.map((m) => Math.trunc(m).toLocaleString()).join(', ')}`;
          }
          return `${name}: ${Math.trunc(val).toLocaleString()}`;
        },
      },
      xAxis: {
        type: 'value',
        min: minVal,
        max: maxVal,
        axisLabel: {
          formatter: (v: number) => Math.trunc(v).toLocaleString(),
        },
      },
      yAxis: {
        type: 'category',
        data: [''],
        show: false,
      },
      series: [
        {
          type: 'bar',
          data: [[Math.min(mean, median, mode ?? mean), Math.max(mean, median, mode ?? mean)]],
          itemStyle: { color: EXPLORE_COLORS.PRIMARY_TEAL },
          barWidth: 10,
        },
        {
          type: 'scatter',
          data: values.map((v) => ({
            value: [v.value, 0],
            name: v.name,
          })),
          symbol: 'rect',
          symbolSize: [2, 20],
          itemStyle: { color: '#000' },
          label: {
            show: true,
            position: 'top',
            formatter: (p: { name: string; value: number[] }) =>
              `${p.name}: ${Math.trunc(p.value[0]).toLocaleString()}`,
            fontSize: 10,
          },
        },
      ],
      grid: { top: 40, bottom: 20, left: 60, right: 60 },
    };
  }, [minVal, maxVal, mean, median, mode, other_modes, allIdentical]);

  if (allIdentical) {
    return (
      <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
        All entries in this column are identical ({Math.trunc(minVal).toLocaleString()})
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {viewMode === 'chart' ? (
        <BaseChart
          option={chartOption}
          width={EXPLORE_DIMENSIONS.CHART_WIDTH}
          height={EXPLORE_DIMENSIONS.CHART_HEIGHT}
        />
      ) : (
        <div className="flex items-center gap-8 min-h-[100px] min-w-[700px]">
          {[
            { key: 'minimum', label: 'Minimum', value: minVal },
            { key: 'maximum', label: 'Maximum', value: maxVal },
            { key: 'mean', label: 'Mean', value: mean },
            { key: 'median', label: 'Median', value: median },
            { key: 'mode', label: 'Mode', value: mode },
          ].map(({ key, label, value }) => (
            <div key={key} className="flex flex-col items-center">
              <span className="text-xs capitalize" style={{ color: EXPLORE_COLORS.LABEL_COLOR }}>
                {label}
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="h-6 w-[84px] flex items-center justify-center text-sm"
                      style={{ backgroundColor: EXPLORE_COLORS.STAT_BOX_BG }}
                    >
                      {value !== null && value !== undefined
                        ? Math.trunc(value).toLocaleString()
                        : 'NA'}
                    </div>
                  </TooltipTrigger>
                  {key === 'mode' && other_modes && other_modes.length > 0 && (
                    <TooltipContent>
                      <p>
                        Other modes:{' '}
                        {other_modes.map((m) => Math.trunc(m).toLocaleString()).join(', ')}
                      </p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          ))}
        </div>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setViewMode((prev) => (prev === 'chart' ? 'numbers' : 'chart'))}
        data-testid="toggle-view-mode"
      >
        {viewMode === 'chart' ? <List className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
      </Button>
    </div>
  );
}
