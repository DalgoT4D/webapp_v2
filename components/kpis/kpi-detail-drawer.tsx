'use client';

import { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, X } from 'lucide-react';
import { useKPIData } from '@/hooks/api/useKPIs';
import type { KPI } from '@/types/kpis';
import type { RAGStatus } from '@/types/kpis';
import { RAG_COLORS } from '@/types/kpis';

interface KPIDetailDrawerProps {
  kpi: KPI | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function TrendChart({ config, height = 'h-64' }: { config: Record<string, any>; height?: string }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || !config || Object.keys(config).length === 0) return;

    if (chartInstance.current) {
      chartInstance.current.dispose();
    }
    chartInstance.current = echarts.init(chartRef.current);
    chartInstance.current.setOption(config);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, [config]);

  if (!config || Object.keys(config).length === 0) {
    return (
      <div className={`${height} flex items-center justify-center text-sm text-muted-foreground`}>
        Not enough data for a trend yet.
      </div>
    );
  }

  return <div ref={chartRef} className={`${height} w-full`} />;
}

function formatValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return '\u2014';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000)
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function KPIDetailDrawer({
  kpi,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: KPIDetailDrawerProps) {
  const { chartData, echartsConfig, isLoading } = useKPIData(open && kpi ? kpi.id : null);

  if (!kpi) return null;

  const ragStatus = chartData?.rag_status as RAGStatus | null;
  const ragInfo = ragStatus ? RAG_COLORS[ragStatus] : null;
  const currentValue = chartData?.current_value;
  const periods = chartData?.periods || [];

  const popChange = (() => {
    if (periods.length < 2) return null;
    const current = periods[periods.length - 1]?.value;
    const previous = periods[periods.length - 2]?.value;
    if (current == null || previous == null || previous === 0) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
  })();

  const isPositiveChange =
    popChange !== null &&
    ((kpi.direction === 'increase' && popChange > 0) ||
      (kpi.direction === 'decrease' && popChange < 0));

  const timeGrainLabel: Record<string, string> = {
    daily: 'day',
    weekly: 'week',
    monthly: 'month',
    quarterly: 'quarter',
    yearly: 'year',
  };

  const timeGrainDisplay: Record<string, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    yearly: 'Yearly',
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:max-w-[600px] p-0 overflow-y-auto [&>button]:hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{kpi.name}</h2>
              <p className="text-sm text-muted-foreground">
                {kpi.program_tags.length > 0 && <>{kpi.program_tags.join(', ')} &middot; </>}
                <span style={{ color: 'var(--primary)' }}>
                  {kpi.metric.schema_name}.{kpi.metric.table_name}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onOpenChange(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Value section */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-start justify-between">
            <div>
              {isLoading ? (
                <Skeleton className="h-12 w-32" />
              ) : (
                <>
                  <p className="text-4xl font-bold text-gray-900">{formatValue(currentValue)}</p>
                  {kpi.target_value !== null && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Target: {formatValue(kpi.target_value)}
                    </p>
                  )}
                  {popChange !== null && (
                    <p
                      className={`text-sm font-medium mt-0.5 ${
                        isPositiveChange ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {popChange > 0 ? '\u2191' : '\u2193'} {popChange > 0 ? '+' : ''}
                      {popChange.toFixed(1)}% from last {timeGrainLabel[kpi.time_grain] || 'period'}
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="text-sm border rounded-md px-3 py-1 text-gray-700">
                {timeGrainDisplay[kpi.time_grain] || kpi.time_grain}
              </span>
              {ragInfo && (
                <Badge
                  variant="outline"
                  className={`${ragInfo.bg} ${ragInfo.text} border-0 text-xs`}
                >
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${ragInfo.dot}`} />
                  {ragInfo.label}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Chart — full width */}
        <div className="px-4 pb-2">
          {isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <TrendChart config={echartsConfig || {}} height="h-56" />
          )}
        </div>

        {/* Divider */}
        <div className="mx-6 border-t" />

        {/* Notes section placeholder — M7 will fill this */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Notes</h3>
              <p className="text-xs text-muted-foreground">Add beneficiary quotes or notes</p>
            </div>
            <Button
              size="sm"
              className="text-white"
              style={{ backgroundColor: 'var(--primary)' }}
              disabled
            >
              + ADD NOTE
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4 text-center py-6">
            No notes yet. Notes and beneficiary quotes will appear here.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
