// components/explore/charts/StringInsights.tsx
'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { RangeChart } from './RangeChart';
import { BarChart } from './BarChart';
import { BarChart3, PieChart, TrendingUp } from 'lucide-react';
import type { StringStats } from '@/types/explore';

interface StringInsightsProps {
  data: StringStats;
}

type ViewMode = 'range' | 'bars' | 'stats';

export function StringInsights({ data }: StringInsightsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('range');

  const { charts, count, countNull, countDistinct } = data;

  // Check edge cases
  const isAllNull = countNull === count;
  const isAllDistinct = countDistinct === count;

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
      };
    });
  }, [charts, count]);

  const cycleViewMode = () => {
    setViewMode((prev) => {
      if (prev === 'range') return 'bars';
      if (prev === 'bars') return 'stats';
      return 'range';
    });
  };

  const getViewIcon = () => {
    switch (viewMode) {
      case 'range':
        return <PieChart className="h-4 w-4" />;
      case 'bars':
        return <BarChart3 className="h-4 w-4" />;
      case 'stats':
        return <TrendingUp className="h-4 w-4" />;
    }
  };

  // Edge case: all nulls
  if (isAllNull) {
    return (
      <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
        All values are NULL ({count.toLocaleString()} rows)
      </div>
    );
  }

  // Edge case: all distinct
  if (isAllDistinct && count > 10) {
    return (
      <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
        All values are distinct ({countDistinct.toLocaleString()} unique values)
      </div>
    );
  }

  // No data
  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
        No distribution data available
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        {viewMode === 'range' && <RangeChart data={chartData} />}
        {viewMode === 'bars' && <BarChart data={chartData} />}
        {viewMode === 'stats' && (
          <div className="flex flex-col gap-1 text-sm">
            <p className="text-muted-foreground text-xs mb-2">String length distribution</p>
            {chartData.slice(0, 5).map((item, idx) => (
              <div key={idx} className="flex justify-between">
                <span className="truncate max-w-[200px]">{item.name}</span>
                <span className="text-muted-foreground">
                  {item.count.toLocaleString()} ({item.percentage}%)
                </span>
              </div>
            ))}
            {chartData.length > 5 && (
              <span className="text-muted-foreground text-xs">+{chartData.length - 5} more</span>
            )}
          </div>
        )}
      </div>

      <Button variant="ghost" size="icon" onClick={cycleViewMode} data-testid="cycle-view-mode">
        {getViewIcon()}
      </Button>
    </div>
  );
}
