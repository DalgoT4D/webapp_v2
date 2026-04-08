// components/explore/charts/NumberInsights.tsx
'use client';

import { useState, useCallback } from 'react';
import { StatsChart } from './StatsChart';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { BarChart3, List } from 'lucide-react';
import { EXPLORE_COLORS } from '@/constants/explore';
import type { NumericStats } from '@/types/explore';

interface NumberInsightsProps {
  data: NumericStats;
}

// Stat box labels matching v1 key iteration order
const STAT_KEYS: Array<{ key: keyof NumericStats; label: string }> = [
  { key: 'minVal', label: 'Minimum' },
  { key: 'maxVal', label: 'Maximum' },
  { key: 'mean', label: 'Mean' },
  { key: 'median', label: 'Median' },
  { key: 'mode', label: 'Mode' },
];

export function NumberInsights({ data }: NumberInsightsProps) {
  const [viewMode, setViewMode] = useState<'chart' | 'numbers'>('chart');

  const { minVal, maxVal, other_modes } = data;

  const allIdentical = minVal === maxVal;

  const toggleView = useCallback(() => {
    setViewMode((prev) => (prev === 'chart' ? 'numbers' : 'chart'));
  }, []);

  if (allIdentical) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', minHeight: 110 }}>
        All entries in this column are identical
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', minHeight: 110 }}>
      {viewMode === 'chart' ? (
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
      ) : (
        <div style={{ minWidth: 700, display: 'flex', alignItems: 'center' }}>
          {STAT_KEYS.map(({ key, label }) => {
            const value = data[key] as number | null | undefined;
            return (
              <div key={key} style={{ marginRight: 50 }}>
                <div style={{ color: EXPLORE_COLORS.LABEL_COLOR }}>{label}</div>
                <div
                  style={{
                    marginTop: 8,
                    width: 84,
                    height: 24,
                    backgroundColor: EXPLORE_COLORS.STAT_BOX_BG,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ marginLeft: 8 }}>
                    {value !== null && value !== undefined ? (
                      key === 'mode' && other_modes && other_modes.length > 1 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>{Math.trunc(value).toLocaleString()}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                Other modes:{' '}
                                {other_modes.map((m) => Math.trunc(m).toLocaleString()).join(', ')}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        Math.trunc(value).toLocaleString()
                      )
                    ) : (
                      'NA'
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        style={{ marginLeft: 20, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        onClick={toggleView}
        data-testid={`switchicon-${viewMode === 'chart' ? 'numbers' : 'chart'}`}
      >
        {viewMode === 'chart' ? <List className="h-5 w-5" /> : <BarChart3 className="h-5 w-5" />}
      </div>
    </div>
  );
}
