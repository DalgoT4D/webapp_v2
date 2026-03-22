// components/explore/charts/StringInsights.tsx
'use client';

import { useState, useMemo, useCallback } from 'react';
import { RangeChart } from './RangeChart';
import { BarChart } from './BarChart';
import { StatsChart } from './StatsChart';
import { BarChart3, List } from 'lucide-react';
import type { StringStats } from '@/types/explore';

interface StringInsightsProps {
  data: StringStats;
}

type ViewMode = 'chart' | 'bars' | 'stats';

export function StringInsights({ data }: StringInsightsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('chart');

  const { charts, count } = data;

  // Format data for charts
  const chartData = useMemo(() => {
    if (!charts || charts.length === 0 || !charts[0]?.data) return [];

    return charts[0].data.map((item) => {
      const percentage = count > 0 ? ((item.count / count) * 100).toFixed(1) : '0';
      return {
        name: item.category,
        percentage,
        count: item.count,
        label: item.category,
        value: item.count,
        barTopLabel: `${item.count} | ${percentage}%`,
      };
    });
  }, [charts, count]);

  const cycleViewMode = useCallback(() => {
    setViewMode((prev) => {
      if (prev === 'chart') return 'bars';
      if (prev === 'bars') return 'stats';
      return 'chart';
    });
  }, []);

  // No data
  if (chartData.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', minHeight: 110 }}>
        -- -- -- No data available -- -- --
      </div>
    );
  }

  // String-length stats for the stats view
  const isStringLengthIdentical = data.minVal === data.maxVal;
  const hasStringLengthStats =
    data.minVal !== undefined && data.maxVal !== undefined && !isStringLengthIdentical;

  return (
    <div style={{ display: 'flex', alignItems: 'center', minHeight: 110 }}>
      {viewMode === 'chart' && <RangeChart data={chartData} />}

      {viewMode === 'bars' && <BarChart data={chartData} />}

      {viewMode === 'stats' &&
        (isStringLengthIdentical ? (
          <div style={{ width: 700 }}>All entries in this column are identical in length</div>
        ) : hasStringLengthStats ? (
          <div>
            <StatsChart
              data={{
                minimum: data.minVal,
                maximum: data.maxVal,
                mean: data.mean,
                median: data.median,
                mode: data.mode,
                otherModes: data.other_modes,
              }}
            />
            <div
              style={{
                fontSize: 11,
                color: '#768292',
                fontWeight: 600,
                marginLeft: 8,
              }}
            >
              String length distribution
            </div>
          </div>
        ) : (
          <div style={{ width: 700 }}>All entries in this column are identical in length</div>
        ))}

      <div
        style={{ marginLeft: 20, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        onClick={cycleViewMode}
        data-testid="cycle-view-mode"
      >
        {viewMode === 'chart' ? (
          <BarChart3 className="h-5 w-5" />
        ) : viewMode === 'bars' ? (
          <List className="h-5 w-5" />
        ) : (
          <BarChart3 className="h-5 w-5" />
        )}
      </div>
    </div>
  );
}
